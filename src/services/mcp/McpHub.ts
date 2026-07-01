import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { StdioClientTransport, getDefaultEnvironment } from "@modelcontextprotocol/sdk/client/stdio.js"
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js"
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js"
import ReconnectingEventSource from "reconnecting-eventsource"
import {
	CallToolResultSchema,
	ListResourcesResultSchema,
	ListResourceTemplatesResultSchema,
	ListToolsResultSchema,
	ReadResourceResultSchema,
} from "@modelcontextprotocol/sdk/types.js"
import chokidar, { FSWatcher } from "chokidar"
import delay from "delay"
import deepEqual from "fast-deep-equal"
import * as fs from "fs/promises"
import * as path from "path"
import * as vscode from "vscode"
import { z } from "zod"
import { t } from "../../i18n"

import { ClineProvider } from "../../core/webview/ClineProvider"
import { GlobalFileNames } from "../../shared/globalFileNames"
import {
	McpAuthError,
	McpResource,
	McpResourceResponse,
	McpResourceTemplate,
	McpServer,
	McpTool,
	McpToolCallResponse,
	McpOAuthConfig,
	McpOAuthTokens,
} from "../../shared/mcp"
import { fileExistsAtPath } from "../../utils/fs"
import { arePathsEqual, getWorkspacePath } from "../../utils/path"
import { injectVariables } from "../../utils/config"
import { NotificationService } from "./kilocode/NotificationService"
import { McpOAuthProvider } from "./oauth-provider"

// Discriminated union for connection states
export type ConnectedMcpConnection = {
	type: "connected"
	server: McpServer
	client: Client
	transport: StdioClientTransport | SSEClientTransport | StreamableHTTPClientTransport
}

export type DisconnectedMcpConnection = {
	type: "disconnected"
	server: McpServer
	client: null
	transport: null
}

export type NeedsAuthMcpConnection = {
	type: "needs-auth"
	server: McpServer
	client: null
	transport: null
	authUrl?: string
	authState?: string
}

export type McpConnection = ConnectedMcpConnection | DisconnectedMcpConnection | NeedsAuthMcpConnection

// Enum for disable reasons
export enum DisableReason {
	MCP_DISABLED = "mcpDisabled",
	SERVER_DISABLED = "serverDisabled",
}

// OAuth configuration schema for URL-based servers
const OAuthConfigSchema = z
	.object({
		clientId: z.string().optional(),
		clientSecret: z.string().optional(),
		callbackPort: z.number().min(1024).max(65535).optional(),
		authServerMetadataUrl: z.string().url().optional(),
		scopes: z.array(z.string()).optional(),
		xaa: z.boolean().optional(),
	})
	.optional()

// Base configuration schema for common settings
const BaseConfigSchema = z.object({
	disabled: z.boolean().optional(),
	timeout: z.number().min(1).max(3600).optional().default(60),
	alwaysAllow: z.array(z.string()).default([]),
	watchPaths: z.array(z.string()).optional(), // paths to watch for changes and restart server
	disabledTools: z.array(z.string()).default([]),
})

// Canonical URL-based transport types accepted in server configs.
// "http" is a common alias used by other MCP clients (Figma, Cursor, Claude) and is
// treated identically to "streamable-http". The schema normalizes it on read.
const URL_TRANSPORT_TYPES = ["sse", "streamable-http", "http"] as const
type UrlTransportType = (typeof URL_TRANSPORT_TYPES)[number]

// Custom error messages for better user feedback
const typeErrorMessage = "Server type must be 'stdio', 'sse', 'streamable-http', or 'http'"
const stdioFieldsErrorMessage =
	"For 'stdio' type servers, you must provide a 'command' field and can optionally include 'args' and 'env'"
const sseFieldsErrorMessage =
	"For 'sse' type servers, you must provide a 'url' field and can optionally include 'headers'"
const streamableHttpFieldsErrorMessage =
	"For 'streamable-http' or 'http' type servers, you must provide a 'url' field and can optionally include 'headers'"
const mixedFieldsErrorMessage =
	"Cannot mix 'stdio' and ('sse', 'streamable-http', or 'http') fields. For 'stdio' use 'command', 'args', and 'env'. For 'sse'/'streamable-http'/'http' use 'url' and 'headers'"
const missingFieldsErrorMessage =
	"Server configuration must include either 'command' (for stdio) or 'url' (for sse/streamable-http/http) and a corresponding 'type' if 'url' is used."

// Helper function to create a refined schema with better error messages
const createServerTypeSchema = () => {
	return z.union([
		// Stdio config (has command field)
		BaseConfigSchema.extend({
			type: z.enum(["stdio"]).optional(),
			command: z.string().min(1, "Command cannot be empty"),
			args: z.array(z.string()).optional(),
			cwd: z.string().default(() => vscode.workspace.workspaceFolders?.at(0)?.uri.fsPath ?? process.cwd()),
			env: z.record(z.string()).optional(),
			// Ensure no URL-based fields are present
			url: z.undefined().optional(),
			headers: z.undefined().optional(),
			oauth: z.undefined().optional(),
		})
			.transform((data) => ({
				...data,
				type: "stdio" as const,
			}))
			.refine((data) => data.type === undefined || data.type === "stdio", { message: typeErrorMessage }),
		// URL-based config (sse, streamable-http, or http) - defaults to streamable-http if type not specified
		BaseConfigSchema.extend({
			type: z.enum(URL_TRANSPORT_TYPES).optional(),
			url: z.string().url("URL must be a valid URL format"),
			headers: z.record(z.string()).optional(),
			oauth: OAuthConfigSchema,
			// Ensure no stdio fields are present
			command: z.undefined().optional(),
			args: z.undefined().optional(),
			env: z.undefined().optional(),
		}).transform((data) => {
			// Preserve the user's literal type. "http" is accepted as an alias
			// for "streamable-http" (Figma, Cursor, Claude use it) and is mapped
			// to the SDK transport at connection time. Keeping the original
			// alias means error logs and the UI reflect what the user actually
			// wrote instead of an internal canonical name.
			return {
				...data,
				type: (data.type ?? "streamable-http") as "sse" | "streamable-http" | "http",
			}
		}),
	])
}

// Server configuration schema with automatic type inference and validation
export const ServerConfigSchema = createServerTypeSchema()

// Settings schema
const McpSettingsSchema = z.object({
	mcpServers: z.record(ServerConfigSchema),
})

export class McpHub {
	private providerRef: WeakRef<ClineProvider>
	private disposables: vscode.Disposable[] = []
	private settingsWatcher?: vscode.FileSystemWatcher
	private fileWatchers: Map<string, FSWatcher[]> = new Map()
	private projectMcpWatcher?: vscode.FileSystemWatcher
	private isDisposed: boolean = false
	connections: McpConnection[] = []
	isConnecting: boolean = false
	readonly kiloNotificationService = new NotificationService()
	private refCount: number = 0 // Reference counter for active clients
	private configChangeDebounceTimers: Map<string, NodeJS.Timeout> = new Map()

	constructor(provider: ClineProvider) {
		this.providerRef = new WeakRef(provider)
		this.watchMcpSettingsFile()
		this.watchProjectMcpFile().catch(console.error)
		this.setupWorkspaceFoldersWatcher()
		this.initializeGlobalMcpServers()
		this.initializeProjectMcpServers()
	}
	/**
	 * Registers a client (e.g., ClineProvider) using this hub.
	 * Increments the reference count.
	 */
	public registerClient(): void {
		this.refCount++
		// console.log(`McpHub: Client registered. Ref count: ${this.refCount}`)
	}

	/**
	 * Unregisters a client. Decrements the reference count.
	 * If the count reaches zero, disposes the hub.
	 */
	public async unregisterClient(): Promise<void> {
		this.refCount--

		// console.log(`McpHub: Client unregistered. Ref count: ${this.refCount}`)

		if (this.refCount <= 0) {
			console.log("McpHub: Last client unregistered. Disposing hub.")
			await this.dispose()
		}
	}

	/**
	 * Validates and normalizes server configuration
	 * @param config The server configuration to validate
	 * @param serverName Optional server name for error messages
	 * @returns The validated configuration
	 * @throws Error if the configuration is invalid
	 */
	private validateServerConfig(config: any, serverName?: string): z.infer<typeof ServerConfigSchema> {
		// Detect configuration issues before validation
		const hasStdioFields = config.command !== undefined
		const hasUrlFields = config.url !== undefined // Covers sse and streamable-http

		// Check for mixed fields (stdio vs url-based)
		if (hasStdioFields && hasUrlFields) {
			throw new Error(mixedFieldsErrorMessage)
		}

		// Infer type for stdio if not provided
		if (!config.type && hasStdioFields) {
			config.type = "stdio"
		}

		// For url-based configs without type, default to streamable-http (will be auto-detected later)
		if (hasUrlFields && !config.type) {
			config.type = "streamable-http" // Default, will be auto-detected in connectToServer
		}

		// Validate type if provided. "http" is accepted as a streamable-http alias
		// (Figma, Cursor, and other MCP clients use it) and is normalized downstream.
		if (config.type && !["stdio", "sse", "streamable-http", "http"].includes(config.type)) {
			throw new Error(typeErrorMessage)
		}

		// Check for type/field mismatch
		if (config.type === "stdio" && !hasStdioFields) {
			throw new Error(stdioFieldsErrorMessage)
		}
		if (config.type === "sse" && !hasUrlFields) {
			throw new Error(sseFieldsErrorMessage)
		}
		if ((config.type === "streamable-http" || config.type === "http") && !hasUrlFields) {
			throw new Error(streamableHttpFieldsErrorMessage)
		}

		// If neither command nor url is present (type alone is not enough)
		if (!hasStdioFields && !hasUrlFields) {
			throw new Error(missingFieldsErrorMessage)
		}

		// Validate the config against the schema
		try {
			return ServerConfigSchema.parse(config)
		} catch (validationError) {
			if (validationError instanceof z.ZodError) {
				// Extract and format validation errors
				const errorMessages = validationError.errors
					.map((err) => `${err.path.join(".")}: ${err.message}`)
					.join("; ")
				throw new Error(
					serverName
						? `Invalid configuration for server "${serverName}": ${errorMessages}`
						: `Invalid server configuration: ${errorMessages}`,
				)
			}
			throw validationError
		}
	}

	/**
	 * Formats and displays error messages to the user
	 * @param message The error message prefix
	 * @param error The error object
	 */
	private showErrorMessage(message: string, error: unknown): void {
		console.error(`${message}:`, error)
	}

	public setupWorkspaceFoldersWatcher(): void {
		// Skip if test environment is detected
		if (process.env.NODE_ENV === "test") {
			return
		}

		this.disposables.push(
			vscode.workspace.onDidChangeWorkspaceFolders(async () => {
				await this.updateProjectMcpServers()
				await this.watchProjectMcpFile()
			}),
		)
	}

	/**
	 * Debounced wrapper for handling config file changes
	 */
	private debounceConfigChange(filePath: string, source: "global" | "project"): void {
		const key = `${source}-${filePath}`

		// Clear existing timer if any
		const existingTimer = this.configChangeDebounceTimers.get(key)
		if (existingTimer) {
			clearTimeout(existingTimer)
		}

		// Set new timer
		const timer = setTimeout(async () => {
			this.configChangeDebounceTimers.delete(key)
			await this.handleConfigFileChange(filePath, source)
		}, 500) // 500ms debounce

		this.configChangeDebounceTimers.set(key, timer)
	}

	private async handleConfigFileChange(filePath: string, source: "global" | "project"): Promise<void> {
		try {
			const content = await fs.readFile(filePath, "utf-8")
			let config: any

			try {
				config = JSON.parse(content)
			} catch (parseError) {
				const errorMessage = t("mcp:errors.invalid_settings_syntax")
				console.error(errorMessage, parseError)
				vscode.window.showErrorMessage(errorMessage)
				return
			}

			const result = McpSettingsSchema.safeParse(config)

			if (!result.success) {
				const errorMessages = result.error.errors
					.map((err) => `${err.path.join(".")}: ${err.message}`)
					.join("\n")
				vscode.window.showErrorMessage(t("mcp:errors.invalid_settings_validation", { errorMessages }))
				return
			}

			await this.updateServerConnections(result.data.mcpServers || {}, source)
		} catch (error) {
			// Check if the error is because the file doesn't exist
			if (error.code === "ENOENT" && source === "project") {
				// File was deleted, clean up project MCP servers
				await this.cleanupProjectMcpServers()
				await this.notifyWebviewOfServerChanges()
				vscode.window.showInformationMessage(t("mcp:info.project_config_deleted"))
			} else {
				this.showErrorMessage(t("mcp:errors.failed_update_project"), error)
			}
		}
	}

	private async watchProjectMcpFile(): Promise<void> {
		// Skip if test environment is detected or VSCode APIs are not available
		if (process.env.NODE_ENV === "test" || !vscode.workspace.createFileSystemWatcher) {
			return
		}

		// Clean up existing project MCP watcher if it exists
		if (this.projectMcpWatcher) {
			this.projectMcpWatcher.dispose()
			this.projectMcpWatcher = undefined
		}

		if (!vscode.workspace.workspaceFolders?.length) {
			return
		}

		const workspaceFolder = this.providerRef.deref()?.cwd ?? getWorkspacePath()
		const projectMcpPattern = new vscode.RelativePattern(workspaceFolder, ".orbital/mcp.json")

		// Create a file system watcher for the project MCP file pattern
		this.projectMcpWatcher = vscode.workspace.createFileSystemWatcher(projectMcpPattern)

		// Watch for file changes
		const changeDisposable = this.projectMcpWatcher.onDidChange((uri) => {
			this.debounceConfigChange(uri.fsPath, "project")
		})

		// Watch for file creation
		const createDisposable = this.projectMcpWatcher.onDidCreate((uri) => {
			this.debounceConfigChange(uri.fsPath, "project")
		})

		// Watch for file deletion
		const deleteDisposable = this.projectMcpWatcher.onDidDelete(async () => {
			// Clean up all project MCP servers when the file is deleted
			await this.cleanupProjectMcpServers()
			await this.notifyWebviewOfServerChanges()
			vscode.window.showInformationMessage(t("mcp:info.project_config_deleted"))
		})

		this.disposables.push(
			vscode.Disposable.from(changeDisposable, createDisposable, deleteDisposable, this.projectMcpWatcher),
		)
	}

	private async updateProjectMcpServers(): Promise<void> {
		try {
			const projectMcpPath = await this.getProjectMcpPath()
			if (!projectMcpPath) return

			const content = await fs.readFile(projectMcpPath, "utf-8")
			let config: any

			try {
				config = JSON.parse(content)
			} catch (parseError) {
				const errorMessage = t("mcp:errors.invalid_settings_syntax")
				console.error(errorMessage, parseError)
				vscode.window.showErrorMessage(errorMessage)
				return
			}

			// Validate configuration structure
			const result = McpSettingsSchema.safeParse(config)
			if (result.success) {
				await this.updateServerConnections(result.data.mcpServers || {}, "project")
			} else {
				// Format validation errors for better user feedback
				const errorMessages = result.error.errors
					.map((err) => `${err.path.join(".")}: ${err.message}`)
					.join("\n")
				console.error("Invalid project MCP settings format:", errorMessages)
				vscode.window.showErrorMessage(t("mcp:errors.invalid_settings_validation", { errorMessages }))
			}
		} catch (error) {
			this.showErrorMessage(t("mcp:errors.failed_update_project"), error)
		}
	}

	private async cleanupProjectMcpServers(): Promise<void> {
		// Disconnect and remove all project MCP servers
		const projectConnections = this.connections.filter((conn) => conn.server.source === "project")

		for (const conn of projectConnections) {
			await this.deleteConnection(conn.server.name, "project")
		}

		// Clear project servers from the connections list
		await this.updateServerConnections({}, "project", false)
	}

	getServers(): McpServer[] {
		// Only return enabled servers
		return this.connections.filter((conn) => !conn.server.disabled).map((conn) => conn.server)
	}

	getAllServers(): McpServer[] {
		// Return all servers regardless of state
		return this.connections.map((conn) => conn.server)
	}

	async getMcpServersPath(): Promise<string> {
		const provider = this.providerRef.deref()
		if (!provider) {
			throw new Error("Provider not available")
		}
		const mcpServersPath = await provider.ensureMcpServersDirectoryExists()
		return mcpServersPath
	}

	async getMcpSettingsFilePath(): Promise<string> {
		const provider = this.providerRef.deref()
		if (!provider) {
			throw new Error("Provider not available")
		}
		const mcpSettingsFilePath = path.join(
			await provider.ensureSettingsDirectoryExists(),
			GlobalFileNames.mcpSettings,
		)
		const fileExists = await fileExistsAtPath(mcpSettingsFilePath)
		if (!fileExists) {
			await fs.writeFile(
				mcpSettingsFilePath,
				`{
  "mcpServers": {

  }
}`,
			)
		}
		return mcpSettingsFilePath
	}

	private async watchMcpSettingsFile(): Promise<void> {
		// Skip if test environment is detected or VSCode APIs are not available
		if (process.env.NODE_ENV === "test" || !vscode.workspace.createFileSystemWatcher) {
			return
		}

		// Clean up existing settings watcher if it exists
		if (this.settingsWatcher) {
			this.settingsWatcher.dispose()
			this.settingsWatcher = undefined
		}

		const settingsPath = await this.getMcpSettingsFilePath()
		const settingsUri = vscode.Uri.file(settingsPath)
		const settingsPattern = new vscode.RelativePattern(path.dirname(settingsPath), path.basename(settingsPath))

		// Create a file system watcher for the global MCP settings file
		this.settingsWatcher = vscode.workspace.createFileSystemWatcher(settingsPattern)

		// Watch for file changes
		const changeDisposable = this.settingsWatcher.onDidChange((uri) => {
			if (arePathsEqual(uri.fsPath, settingsPath)) {
				this.debounceConfigChange(settingsPath, "global")
			}
		})

		// Watch for file creation
		const createDisposable = this.settingsWatcher.onDidCreate((uri) => {
			if (arePathsEqual(uri.fsPath, settingsPath)) {
				this.debounceConfigChange(settingsPath, "global")
			}
		})

		this.disposables.push(vscode.Disposable.from(changeDisposable, createDisposable, this.settingsWatcher))
	}

	private async initializeMcpServers(source: "global" | "project"): Promise<void> {
		try {
			const configPath =
				source === "global" ? await this.getMcpSettingsFilePath() : await this.getProjectMcpPath()

			if (!configPath) {
				return
			}

			const content = await fs.readFile(configPath, "utf-8")
			const config = JSON.parse(content)
			const result = McpSettingsSchema.safeParse(config)

			if (result.success) {
				// Pass all servers including disabled ones - they'll be handled in updateServerConnections
				await this.updateServerConnections(result.data.mcpServers || {}, source, false)
			} else {
				const errorMessages = result.error.errors
					.map((err) => `${err.path.join(".")}: ${err.message}`)
					.join("\n")
				console.error(`Invalid ${source} MCP settings format:`, errorMessages)
				vscode.window.showErrorMessage(t("mcp:errors.invalid_settings_validation", { errorMessages }))

				if (source === "global") {
					// Still try to connect with the raw config, but show warnings
					try {
						await this.updateServerConnections(config.mcpServers || {}, source, false)
					} catch (error) {
						this.showErrorMessage(`Failed to initialize ${source} MCP servers with raw config`, error)
					}
				}
			}
		} catch (error) {
			if (error instanceof SyntaxError) {
				const errorMessage = t("mcp:errors.invalid_settings_syntax")
				console.error(errorMessage, error)
				vscode.window.showErrorMessage(errorMessage)
			} else {
				this.showErrorMessage(`Failed to initialize ${source} MCP servers`, error)
			}
		}
	}

	private async initializeGlobalMcpServers(): Promise<void> {
		await this.initializeMcpServers("global")
	}

	// Get project-level MCP configuration path
	private async getProjectMcpPath(): Promise<string | null> {
		const workspacePath = this.providerRef.deref()?.cwd ?? getWorkspacePath()
		const projectMcpDir = path.join(workspacePath, ".orbital")
		const projectMcpPath = path.join(projectMcpDir, "mcp.json")

		try {
			await fs.access(projectMcpPath)
			return projectMcpPath
		} catch {
			// If not found in .orbital/, fall back to .mcp.json in root directory
			const rootMcpPath = path.join(workspacePath, ".mcp.json")
			try {
				await fs.access(rootMcpPath)
				return rootMcpPath
			} catch {
				return null
			}
		}
	}

	// Initialize project-level MCP servers
	private async initializeProjectMcpServers(): Promise<void> {
		await this.initializeMcpServers("project")
	}

	/**
	 * Creates a placeholder connection for disabled servers or when MCP is globally disabled
	 * @param name The server name
	 * @param config The server configuration
	 * @param source The source of the server (global or project)
	 * @param reason The reason for creating a placeholder (mcpDisabled or serverDisabled)
	 * @returns A placeholder DisconnectedMcpConnection object
	 */
	private createPlaceholderConnection(
		name: string,
		config: z.infer<typeof ServerConfigSchema>,
		source: "global" | "project",
		reason: DisableReason,
	): DisconnectedMcpConnection {
		return {
			type: "disconnected",
			server: {
				name,
				config: JSON.stringify(config),
				status: "disconnected",
				disabled: reason === DisableReason.SERVER_DISABLED ? true : config.disabled,
				source,
				projectPath: source === "project" ? vscode.workspace.workspaceFolders?.[0]?.uri.fsPath : undefined,
				errorHistory: [],
			},
			client: null,
			transport: null,
		}
	}

	/**
	 * Checks if MCP is globally enabled
	 * @returns Promise<boolean> indicating if MCP is enabled
	 */
	private async isMcpEnabled(): Promise<boolean> {
		const provider = this.providerRef.deref()
		if (!provider) {
			return true // Default to enabled if provider is not available
		}
		const state = await provider.getState()
		return state.mcpEnabled ?? true
	}

	private async connectToServer(
		name: string,
		config: z.infer<typeof ServerConfigSchema>,
		source: "global" | "project" = "global",
	): Promise<void> {
		// Remove existing connection if it exists with the same source
		await this.deleteConnection(name, source)

		// Check if MCP is globally enabled
		const mcpEnabled = await this.isMcpEnabled()
		if (!mcpEnabled) {
			// Still create a connection object to track the server, but don't actually connect
			const connection = this.createPlaceholderConnection(name, config, source, DisableReason.MCP_DISABLED)
			this.connections.push(connection)
			return
		}

		// Skip connecting to disabled servers
		if (config.disabled) {
			// Still create a connection object to track the server, but don't actually connect
			const connection = this.createPlaceholderConnection(name, config, source, DisableReason.SERVER_DISABLED)
			this.connections.push(connection)
			return
		}

		// Set up file watchers for enabled servers
		this.setupFileWatcher(name, config, source)

		try {
			// Inject variables to the config (environment, magic variables,...)
			const configInjected = (await injectVariables(config, {
				env: process.env,
				workspaceFolder: vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? "",
			})) as typeof config

			// For URL-based servers, check for stored OAuth tokens and inject them.
			// The schema normalizes "http" -> "streamable-http", but accept both for
			// defense in depth in case a config reaches here without normalization.
			if (
				configInjected.type === "streamable-http" ||
				configInjected.type === "sse" ||
				configInjected.type === "http"
			) {
				const oauthProvider = this.getOAuthProvider()
				if (oauthProvider) {
					try {
						const tokens = await oauthProvider.getStoredTokens(name)
						if (tokens && oauthProvider.isTokenValid(tokens)) {
							// Inject the Bearer token into headers
							configInjected.headers = {
								...(configInjected.headers || {}),
								Authorization: `Bearer ${tokens.accessToken}`,
							}
						} else if (tokens && tokens.refreshToken && oauthProvider.needsRefresh(tokens)) {
							// Try to refresh the token
							try {
								const newTokens = await oauthProvider.refreshTokens(name, tokens.refreshToken)
								configInjected.headers = {
									...(configInjected.headers || {}),
									Authorization: `Bearer ${newTokens.accessToken}`,
								}
							} catch (refreshError) {
								console.warn(`Failed to refresh token for ${name}, will need re-auth:`, refreshError)
								// Mark connection as needing auth
								const needsAuthConnection: NeedsAuthMcpConnection = {
									type: "needs-auth",
									server: {
										name,
										config: JSON.stringify(configInjected),
										status: "needs-auth",
										disabled: configInjected.disabled,
										source,
										projectPath:
											source === "project"
												? vscode.workspace.workspaceFolders?.[0]?.uri.fsPath
												: undefined,
										errorHistory: [],
									},
									client: null,
									transport: null,
								}
								this.connections.push(needsAuthConnection)
								await this.notifyWebviewOfServerChanges()
								return
							}
						}
					} catch (error) {
						console.warn(`Error checking OAuth tokens for ${name}:`, error)
					}
				}
			}

			if (configInjected.type === "stdio") {
				// On Windows, wrap commands with cmd.exe to handle non-exe executables like npx.ps1
				// This is necessary for node version managers (fnm, nvm-windows, volta) that implement
				// commands as PowerShell scripts rather than executables.
				// Note: This adds a small overhead as commands go through an additional shell layer.
				const isWindows = process.platform === "win32"

				// Check if command is already cmd.exe to avoid double-wrapping
				const isAlreadyWrapped =
					configInjected.command.toLowerCase() === "cmd.exe" || configInjected.command.toLowerCase() === "cmd"

				const command = isWindows && !isAlreadyWrapped ? "cmd.exe" : configInjected.command
				let args =
					isWindows && !isAlreadyWrapped
						? ["/c", configInjected.command, ...(configInjected.args || [])]
						: [...(configInjected.args || [])]

				// Check if this is an mcp-remote wrapper and inject OAuth token if available
				const mcpRemoteCheck = this.isMcpRemoteWrapper(configInjected)
				if (mcpRemoteCheck.isWrapper && mcpRemoteCheck.remoteUrl) {
					const oauthProvider = this.getOAuthProvider()
					if (oauthProvider) {
						try {
							const tokens = await oauthProvider.getStoredTokens(name)
							if (tokens && oauthProvider.isTokenValid(tokens)) {
								// Inject the Bearer token via --header flag for mcp-remote
								// mcp-remote supports: --header "Authorization: Bearer ${AUTH_TOKEN}"
								args.push("--header", `Authorization: Bearer ${tokens.accessToken}`)
								console.log(`Injecting OAuth token into mcp-remote for ${name}`)
							} else if (tokens && tokens.refreshToken && oauthProvider.needsRefresh(tokens)) {
								// Try to refresh the token
								try {
									const newTokens = await oauthProvider.refreshTokens(name, tokens.refreshToken)
									args.push("--header", `Authorization: Bearer ${newTokens.accessToken}`)
									console.log(`Refreshed and injected OAuth token into mcp-remote for ${name}`)
								} catch (refreshError) {
									console.warn(
										`Failed to refresh token for ${name}, will need re-auth:`,
										refreshError,
									)
									// Mark connection as needing auth
									const needsAuthConnection: NeedsAuthMcpConnection = {
										type: "needs-auth",
										server: {
											name,
											config: JSON.stringify(configInjected),
											status: "needs-auth",
											disabled: configInjected.disabled,
											source,
											projectPath:
												source === "project"
													? vscode.workspace.workspaceFolders?.[0]?.uri.fsPath
													: undefined,
											errorHistory: [],
										},
										client: null,
										transport: null,
									}
									this.connections.push(needsAuthConnection)
									await this.notifyWebviewOfServerChanges()
									return
								}
							}
						} catch (error) {
							console.warn(`Error checking OAuth tokens for mcp-remote ${name}:`, error)
						}
					}
				}

				const client = new Client(
					{
						name: "Orbital",
						version: this.providerRef.deref()?.context.extension?.packageJSON?.version ?? "1.0.0",
					},
					{
						capabilities: {},
					},
				)

				const transport: StdioClientTransport = new StdioClientTransport({
					command,
					args,
					cwd: configInjected.cwd,
					env: {
						...getDefaultEnvironment(),
						...(configInjected.env || {}),
					},
					stderr: "pipe",
				})

				// Set up stdio specific error handling
				transport.onerror = async (error) => {
					console.error(`Transport error for "${name}":`, error)
					const connection = this.findConnection(name, source)
					if (connection) {
						connection.server.status = "disconnected"
						this.appendErrorMessage(connection, error instanceof Error ? error.message : `${error}`)
					}
					await this.notifyWebviewOfServerChanges()
				}

				transport.onclose = async () => {
					const connection = this.findConnection(name, source)
					if (connection) {
						connection.server.status = "disconnected"
					}
					await this.notifyWebviewOfServerChanges()
				}

				// transport.stderr is only available after the process has been started. However we can't start it separately from the .connect() call because it also starts the transport. And we can't place this after the connect call since we need to capture the stderr stream before the connection is established, in order to capture errors during the connection process.
				// As a workaround, we start the transport ourselves, and then monkey-patch the start method to no-op so that .connect() doesn't try to start it again.
				await transport.start()
				const stderrStream = transport.stderr
				if (stderrStream) {
					stderrStream.on("data", async (data: Buffer) => {
						const output = data.toString()
						// Check if output contains INFO level log
						const isInfoLog = /INFO/i.test(output)

						if (isInfoLog) {
							// Log normal informational messages
							console.log(`Server "${name}" info:`, output)
						} else {
							// Treat as error log
							console.error(`Server "${name}" stderr:`, output)
							const connection = this.findConnection(name, source)
							if (connection) {
								this.appendErrorMessage(connection, output)
								if (connection.server.status === "disconnected") {
									await this.notifyWebviewOfServerChanges()
								}
							}
						}
					})
				} else {
					console.error(`No stderr stream for ${name}`)
				}

				// Monkey-patch transport.start to no-op since we already started it
				transport.start = async () => {}

				// Create a connected connection for stdio
				const connection: ConnectedMcpConnection = {
					type: "connected",
					server: {
						name,
						config: JSON.stringify(configInjected),
						status: "connecting",
						disabled: configInjected.disabled,
						source,
						projectPath:
							source === "project" ? vscode.workspace.workspaceFolders?.[0]?.uri.fsPath : undefined,
						errorHistory: [],
					},
					client,
					transport,
				}
				this.connections.push(connection)

				// Connect (this will automatically start the transport)
				await client.connect(transport)
				connection.server.status = "connected"
				connection.server.error = ""
				connection.server.instructions = client.getInstructions()

				this.kiloNotificationService.connect(name, connection.client)

				// Initial fetch of tools and resources
				connection.server.tools = await this.fetchToolsList(name, source)
				connection.server.resources = await this.fetchResourcesList(name, source)
				connection.server.resourceTemplates = await this.fetchResourceTemplatesList(name, source)
			} else if (
				configInjected.type === "streamable-http" ||
				configInjected.type === "sse" ||
				configInjected.type === "http"
			) {
				// URL-based connection (streamable-http, http, or sse).
				// "http" is an alias for "streamable-http" (used by Figma, Cursor,
				// Claude); the SDK transport we construct below is identical.
				const userType = configInjected.type
				let actualType = userType

				// Try the configured/detected type first, then fallback to the other
				const typesToTry: Array<"streamable-http" | "sse"> = [
					actualType === "http" ? "streamable-http" : (actualType as "streamable-http" | "sse"),
				]
				if (typesToTry[0] === "streamable-http") {
					typesToTry.push("sse")
				} else {
					typesToTry.push("streamable-http")
				}

				let lastError: Error | null = null
				let authFailure: Error | null = null

				for (const typeToTry of typesToTry) {
					// Create a fresh client for each attempt
					const client = new Client(
						{
							name: "Orbital",
							version: this.providerRef.deref()?.context.extension?.packageJSON?.version ?? "1.0.0",
						},
						{
							capabilities: {},
						},
					)

					let transport: SSEClientTransport | StreamableHTTPClientTransport
					try {
						if (typeToTry === "streamable-http") {
							transport = new StreamableHTTPClientTransport(new URL(configInjected.url), {
								requestInit: {
									headers: configInjected.headers,
								},
							})

							transport.onerror = async (error) => {
								console.error(`Transport error for "${name}" (streamable-http):`, error)
								const connection = this.findConnection(name, source)
								if (connection) {
									connection.server.status = "disconnected"
									this.appendErrorMessage(
										connection,
										error instanceof Error ? error.message : `${error}`,
									)
								}
								await this.notifyWebviewOfServerChanges()
							}

							transport.onclose = async () => {
								const connection = this.findConnection(name, source)
								if (connection) {
									connection.server.status = "disconnected"
								}
								await this.notifyWebviewOfServerChanges()
							}
						} else {
							// SSE connection
							const sseOptions = {
								requestInit: {
									headers: configInjected.headers,
								},
							}
							const reconnectingEventSourceOptions = {
								max_retry_time: 5000,
								withCredentials: configInjected.headers?.["Authorization"] ? true : false,
								fetch: (url: string | URL, init: RequestInit) => {
									const headers = new Headers({
										...(init?.headers || {}),
										...(configInjected.headers || {}),
									})
									return fetch(url, {
										...init,
										headers,
									})
								},
							}
							global.EventSource = ReconnectingEventSource
							transport = new SSEClientTransport(new URL(configInjected.url), {
								...sseOptions,
								eventSourceInit: reconnectingEventSourceOptions,
							})

							transport.onerror = async (error) => {
								console.error(`Transport error for "${name}" (sse):`, error)
								const connection = this.findConnection(name, source)
								if (connection) {
									connection.server.status = "disconnected"
									this.appendErrorMessage(
										connection,
										error instanceof Error ? error.message : `${error}`,
									)
								}
								await this.notifyWebviewOfServerChanges()
							}

							transport.onclose = async () => {
								const connection = this.findConnection(name, source)
								if (connection) {
									connection.server.status = "disconnected"
								}
								await this.notifyWebviewOfServerChanges()
							}
						}

						// Update config with the type we're trying
						configInjected.type = typeToTry

						// Create a connected connection
						const connection: ConnectedMcpConnection = {
							type: "connected",
							server: {
								name,
								config: JSON.stringify(configInjected),
								status: "connecting",
								disabled: configInjected.disabled,
								source,
								projectPath:
									source === "project"
										? vscode.workspace.workspaceFolders?.[0]?.uri.fsPath
										: undefined,
								errorHistory: [],
							},
							client,
							transport,
						}
						this.connections.push(connection)

						// Try to connect
						await client.connect(transport)

						// Connection successful - update the type in config if it changed
						if (typeToTry !== actualType) {
							await this.updateServerTypeInConfig(name, typeToTry, source)
						}

						connection.server.status = "connected"
						connection.server.error = ""
						connection.server.instructions = client.getInstructions()

						this.kiloNotificationService.connect(name, connection.client)

						// Initial fetch of tools and resources
						connection.server.tools = await this.fetchToolsList(name, source)
						connection.server.resources = await this.fetchResourcesList(name, source)
						connection.server.resourceTemplates = await this.fetchResourceTemplatesList(name, source)

						// Success - exit the method
						return
					} catch (error) {
						const err = error instanceof Error ? error : new Error(`${error}`)
						lastError = err
						// Log using the user-supplied type so messages like
						// "Failed to connect to \"figma\" with http: …" match what
						// the user actually wrote, not the internal transport name.
						console.log(`Failed to connect to "${name}" with ${userType}:`, error)

						// Clean up failed connection
						const failedConnection = this.findConnection(name, source)
						if (failedConnection) {
							this.connections = this.connections.filter((c) => c !== failedConnection)
						}

						// Short-circuit on authentication errors. Falling back from
						// streamable-http → sse on a 401 just produces a second
						// identical failure (both transports hit the same endpoint
						// with the same headers) and floods the log. Bail out and
						// let the outer handler mark the server as needs-auth.
						if (this.isAuthenticationError(err)) {
							authFailure = err
							throw err
						}

						// If this was the last type to try, throw the error
						if (typeToTry === typesToTry[typesToTry.length - 1]) {
							throw lastError
						}
						// Otherwise, continue to try the next type
					}
				}

				// Should not reach here, but throw last error if we do
				if (lastError) {
					throw lastError
				}
				return
			} else {
				// Should not happen if validateServerConfig is correct
				throw new Error(`Unsupported MCP server type: ${(configInjected as any).type}`)
			}
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : `${error}`

			// Auto-detect authentication errors (401 / unauthorized / invalid token)
			// and mark the connection as needs-auth so the UI can show an
			// "Authenticate" button instead of a generic retry button.
			const isAuthError = this.isAuthenticationError(error)

			let connection = this.findConnection(name, source)
			if (connection) {
				if (isAuthError) {
					connection.server.status = "needs-auth"
				} else {
					connection.server.status = "disconnected"
				}
				this.appendErrorMessage(connection, errorMessage)
			} else {
				// The inner catch already removed the failed connection — create a
				// placeholder so the server still shows up in the UI with its
				// error message. Without this, a server that fails to connect
				// (e.g. missing auth) vanishes from the list entirely and the
				// user has no way to see it, retry, or configure credentials.
				if (isAuthError) {
					const needsAuth: NeedsAuthMcpConnection = {
						type: "needs-auth",
						server: {
							name,
							config: JSON.stringify(config),
							status: "needs-auth",
							disabled: config.disabled,
							source,
							projectPath:
								source === "project" ? vscode.workspace.workspaceFolders?.[0]?.uri.fsPath : undefined,
							errorHistory: [],
						},
						client: null,
						transport: null,
					}
					this.connections.push(needsAuth)
					this.appendErrorMessage(needsAuth, errorMessage)
				} else {
					const disconnected: DisconnectedMcpConnection = {
						type: "disconnected",
						server: {
							name,
							config: JSON.stringify(config),
							status: "disconnected",
							disabled: config.disabled,
							source,
							projectPath:
								source === "project" ? vscode.workspace.workspaceFolders?.[0]?.uri.fsPath : undefined,
							errorHistory: [],
						},
						client: null,
						transport: null,
					}
					this.connections.push(disconnected)
					this.appendErrorMessage(disconnected, errorMessage)
				}
			}
			throw error
		}
	}

	private appendErrorMessage(connection: McpConnection, error: string, level: "error" | "warn" | "info" = "error") {
		const MAX_ERROR_LENGTH = 1000
		const truncatedError =
			error.length > MAX_ERROR_LENGTH
				? `${error.substring(0, MAX_ERROR_LENGTH)}...(error message truncated)`
				: error

		// Add to error history
		if (!connection.server.errorHistory) {
			connection.server.errorHistory = []
		}

		connection.server.errorHistory.push({
			message: truncatedError,
			timestamp: Date.now(),
			level,
		})

		// Keep only the last 100 errors
		if (connection.server.errorHistory.length > 100) {
			connection.server.errorHistory = connection.server.errorHistory.slice(-100)
		}

		// Update current error display
		connection.server.error = truncatedError
	}

	/**
	 * Detects the correct transport type for a URL-based MCP server
	 * by probing the endpoint. Returns 'streamable-http' or 'sse'.
	 */
	private async detectTransportType(url: string): Promise<"streamable-http" | "sse"> {
		try {
			// Try streamable-http first (POST to /mcp)
			const mcpUrl = url.endsWith("/mcp") ? url : `${url}/mcp`
			const response = await fetch(mcpUrl, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Accept: "application/json, text/event-stream",
				},
				body: JSON.stringify({
					jsonrpc: "2.0",
					id: 1,
					method: "initialize",
					params: {
						protocolVersion: "2024-11-05",
						capabilities: {},
						clientInfo: { name: "Orbital", version: "1.0.0" },
					},
				}),
			})

			// If we get a successful response, it's streamable-http
			if (response.ok) {
				return "streamable-http"
			}
		} catch (error) {
			console.log(`Streamable-http probe failed for ${url}:`, error)
		}

		// Fall back to SSE
		return "sse"
	}

	/**
	 * Updates the server config in the settings file with the detected type
	 */
	private async updateServerTypeInConfig(
		serverName: string,
		detectedType: "streamable-http" | "sse",
		source: "global" | "project",
	): Promise<void> {
		try {
			await this.updateServerConfig(serverName, { type: detectedType }, source)
			console.log(`Updated server "${serverName}" type to "${detectedType}" in config`)
		} catch (error) {
			console.error(`Failed to update server type for "${serverName}":`, error)
		}
	}

	/**
	 * Helper method to find a connection by server name and source
	 * @param serverName The name of the server to find
	 * @param source Optional source to filter by (global or project)
	 * @returns The matching connection or undefined if not found
	 */
	private findConnection(serverName: string, source?: "global" | "project"): McpConnection | undefined {
		// If source is specified, only find servers with that source
		if (source !== undefined) {
			return this.connections.find((conn) => conn.server.name === serverName && conn.server.source === source)
		}

		// If no source is specified, first look for project servers, then global servers
		// This ensures that when servers have the same name, project servers are prioritized
		const projectConn = this.connections.find(
			(conn) => conn.server.name === serverName && conn.server.source === "project",
		)
		if (projectConn) return projectConn

		// If no project server is found, look for global servers
		return this.connections.find(
			(conn) => conn.server.name === serverName && (conn.server.source === "global" || !conn.server.source),
		)
	}

	private async fetchToolsList(serverName: string, source?: "global" | "project"): Promise<McpTool[]> {
		try {
			// Use the helper method to find the connection
			const connection = this.findConnection(serverName, source)

			if (!connection || connection.type !== "connected") {
				return []
			}

			const response = await connection.client.request({ method: "tools/list" }, ListToolsResultSchema)

			// Determine the actual source of the server
			const actualSource = connection.server.source || "global"
			let configPath: string
			let alwaysAllowConfig: string[] = []
			let disabledToolsList: string[] = []

			// Read from the appropriate config file based on the actual source
			try {
				let serverConfigData: Record<string, any> = {}
				if (actualSource === "project") {
					// Get project MCP config path
					const projectMcpPath = await this.getProjectMcpPath()
					if (projectMcpPath) {
						configPath = projectMcpPath
						const content = await fs.readFile(configPath, "utf-8")
						serverConfigData = JSON.parse(content)
					}
				} else {
					// Get global MCP settings path
					configPath = await this.getMcpSettingsFilePath()
					const content = await fs.readFile(configPath, "utf-8")
					serverConfigData = JSON.parse(content)
				}
				if (serverConfigData) {
					alwaysAllowConfig = serverConfigData.mcpServers?.[serverName]?.alwaysAllow || []
					disabledToolsList = serverConfigData.mcpServers?.[serverName]?.disabledTools || []
				}
			} catch (error) {
				console.error(`Failed to read tool configuration for ${serverName}:`, error)
				// Continue with empty configs
			}

			// Mark tools as always allowed and enabled for prompt based on settings
			const tools = (response?.tools || []).map((tool) => ({
				...tool,
				alwaysAllow: alwaysAllowConfig.includes(tool.name),
				enabledForPrompt: !disabledToolsList.includes(tool.name),
			}))

			return tools
		} catch (error) {
			console.error(`Failed to fetch tools for ${serverName}:`, error)
			return []
		}
	}

	private async fetchResourcesList(serverName: string, source?: "global" | "project"): Promise<McpResource[]> {
		try {
			const connection = this.findConnection(serverName, source)
			if (!connection || connection.type !== "connected") {
				return []
			}
			const response = await connection.client.request({ method: "resources/list" }, ListResourcesResultSchema)
			return response?.resources || []
		} catch (error) {
			// console.error(`Failed to fetch resources for ${serverName}:`, error)
			return []
		}
	}

	private async fetchResourceTemplatesList(
		serverName: string,
		source?: "global" | "project",
	): Promise<McpResourceTemplate[]> {
		try {
			const connection = this.findConnection(serverName, source)
			if (!connection || connection.type !== "connected") {
				return []
			}
			const response = await connection.client.request(
				{ method: "resources/templates/list" },
				ListResourceTemplatesResultSchema,
			)
			return response?.resourceTemplates || []
		} catch (error) {
			// console.error(`Failed to fetch resource templates for ${serverName}:`, error)
			return []
		}
	}

	async deleteConnection(name: string, source?: "global" | "project"): Promise<void> {
		// Clean up file watchers for this server
		this.removeFileWatchersForServer(name)

		// If source is provided, only delete connections from that source
		const connections = source
			? this.connections.filter((conn) => conn.server.name === name && conn.server.source === source)
			: this.connections.filter((conn) => conn.server.name === name)

		for (const connection of connections) {
			try {
				if (connection.type === "connected") {
					await connection.transport.close()
					await connection.client.close()
				}
			} catch (error) {
				console.error(`Failed to close transport for ${name}:`, error)
			}
		}

		// Remove the connections from the array
		this.connections = this.connections.filter((conn) => {
			if (conn.server.name !== name) return true
			if (source && conn.server.source !== source) return true
			return false
		})
	}

	/**
	 * Reconnects a server after OAuth authentication.
	 * This deletes the existing connection and reconnects with fresh tokens.
	 */
	async reconnectServer(name: string, source?: "global" | "project"): Promise<void> {
		// Find the server configuration before deleting
		const connection = this.findConnection(name, source)
		if (!connection) {
			throw new Error(`Server "${name}" not found`)
		}

		// Store the config before deletion
		const config = JSON.parse(connection.server.config)
		const connectionSource = connection.server.source

		// Delete the existing connection
		await this.deleteConnection(name, connectionSource)

		// Reconnect to the server (this will pick up new OAuth tokens)
		await this.connectToServer(name, config, connectionSource)

		// Notify webview of the reconnection
		await this.notifyWebviewOfServerChanges()
	}

	async updateServerConnections(
		newServers: Record<string, any>,
		source: "global" | "project" = "global",
		manageConnectingState: boolean = true,
	): Promise<void> {
		if (manageConnectingState) {
			this.isConnecting = true
		}
		this.removeAllFileWatchers()
		// Filter connections by source
		const currentConnections = this.connections.filter(
			(conn) => conn.server.source === source || (!conn.server.source && source === "global"),
		)
		const currentNames = new Set(currentConnections.map((conn) => conn.server.name))
		const newNames = new Set(Object.keys(newServers))

		// Delete removed servers
		for (const name of currentNames) {
			if (!newNames.has(name)) {
				await this.deleteConnection(name, source)
			}
		}

		// Update or add servers in parallel to prevent slow servers from blocking others
		const connectionPromises = Object.entries(newServers).map(async ([name, config]) => {
			// Only consider connections that match the current source
			const currentConnection = this.findConnection(name, source)

			// Validate and transform the config
			let validatedConfig: z.infer<typeof ServerConfigSchema>
			try {
				validatedConfig = this.validateServerConfig(config, name)
			} catch (error) {
				this.showErrorMessage(`Invalid configuration for MCP server "${name}"`, error)
				return
			}

			if (!currentConnection) {
				// New server
				try {
					// Only setup file watcher for enabled servers
					if (!validatedConfig.disabled) {
						this.setupFileWatcher(name, validatedConfig, source)
					}
					await this.connectToServer(name, validatedConfig, source)
				} catch (error) {
					this.showErrorMessage(`Failed to connect to new MCP server ${name}`, error)
				}
			} else if (!deepEqual(JSON.parse(currentConnection.server.config), config)) {
				// Existing server with changed config
				try {
					// Only setup file watcher for enabled servers
					if (!validatedConfig.disabled) {
						this.setupFileWatcher(name, validatedConfig, source)
					}
					await this.deleteConnection(name, source)
					await this.connectToServer(name, validatedConfig, source)
				} catch (error) {
					this.showErrorMessage(`Failed to reconnect MCP server ${name}`, error)
				}
			}
			// If server exists with same config, do nothing
		})

		// Wait for all connections to complete (success or failure)
		await Promise.allSettled(connectionPromises)
		await this.notifyWebviewOfServerChanges()
		if (manageConnectingState) {
			this.isConnecting = false
		}
	}

	private setupFileWatcher(
		name: string,
		config: z.infer<typeof ServerConfigSchema>,
		source: "global" | "project" = "global",
	) {
		// Initialize an empty array for this server if it doesn't exist
		if (!this.fileWatchers.has(name)) {
			this.fileWatchers.set(name, [])
		}

		const watchers = this.fileWatchers.get(name) || []

		// Only stdio type has args
		if (config.type === "stdio") {
			// Setup watchers for custom watchPaths if defined
			if (config.watchPaths && config.watchPaths.length > 0) {
				const watchPathsWatcher = chokidar.watch(config.watchPaths, {
					// persistent: true,
					// ignoreInitial: true,
					// awaitWriteFinish: true,
				})

				watchPathsWatcher.on("change", async (changedPath) => {
					try {
						// Pass the source from the config to restartConnection
						await this.restartConnection(name, source)
					} catch (error) {
						console.error(`Failed to restart server ${name} after change in ${changedPath}:`, error)
					}
				})

				watchers.push(watchPathsWatcher)
			}

			// Also setup the fallback build/index.js watcher if applicable
			const filePath = config.args?.find((arg: string) => arg.includes("build/index.js"))
			if (filePath) {
				// we use chokidar instead of onDidSaveTextDocument because it doesn't require the file to be open in the editor
				const indexJsWatcher = chokidar.watch(filePath, {
					// persistent: true,
					// ignoreInitial: true,
					// awaitWriteFinish: true, // This helps with atomic writes
				})

				indexJsWatcher.on("change", async () => {
					try {
						// Pass the source from the config to restartConnection
						await this.restartConnection(name, source)
					} catch (error) {
						console.error(`Failed to restart server ${name} after change in ${filePath}:`, error)
					}
				})

				watchers.push(indexJsWatcher)
			}

			// Update the fileWatchers map with all watchers for this server
			if (watchers.length > 0) {
				this.fileWatchers.set(name, watchers)
			}
		}
	}

	private removeAllFileWatchers() {
		this.fileWatchers.forEach((watchers) => watchers.forEach((watcher) => watcher.close()))
		this.fileWatchers.clear()
	}

	private removeFileWatchersForServer(serverName: string) {
		const watchers = this.fileWatchers.get(serverName)
		if (watchers) {
			watchers.forEach((watcher) => watcher.close())
			this.fileWatchers.delete(serverName)
		}
	}

	async restartConnection(serverName: string, source?: "global" | "project"): Promise<void> {
		this.isConnecting = true

		// Check if MCP is globally enabled
		const mcpEnabled = await this.isMcpEnabled()
		if (!mcpEnabled) {
			this.isConnecting = false
			return
		}

		// Get existing connection and update its status
		const connection = this.findConnection(serverName, source)
		const config = connection?.server.config
		if (config) {
			vscode.window.showInformationMessage(t("mcp:info.server_restarting", { serverName }))
			connection.server.status = "connecting"
			connection.server.error = ""
			await this.notifyWebviewOfServerChanges()
			await delay(500) // artificial delay to show user that server is restarting
			try {
				await this.deleteConnection(serverName, connection.server.source)
				// Parse the config to validate it
				const parsedConfig = JSON.parse(config)
				try {
					// Validate the config
					const validatedConfig = this.validateServerConfig(parsedConfig, serverName)

					// Try to connect again using validated config
					await this.connectToServer(serverName, validatedConfig, connection.server.source || "global")
					vscode.window.showInformationMessage(t("mcp:info.server_connected", { serverName }))
				} catch (validationError) {
					this.showErrorMessage(`Invalid configuration for MCP server "${serverName}"`, validationError)
				}
			} catch (error) {
				this.showErrorMessage(`Failed to restart ${serverName} MCP server connection`, error)
			}
		}

		await this.notifyWebviewOfServerChanges()
		this.isConnecting = false
	}

	public async refreshAllConnections(): Promise<void> {
		if (this.isConnecting) {
			return
		}

		// Check if MCP is globally enabled
		const mcpEnabled = await this.isMcpEnabled()
		if (!mcpEnabled) {
			// Clear all existing connections
			const existingConnections = [...this.connections]
			for (const conn of existingConnections) {
				await this.deleteConnection(conn.server.name, conn.server.source)
			}

			// Still initialize servers to track them, but they won't connect
			await this.initializeMcpServers("global")
			await this.initializeMcpServers("project")

			await this.notifyWebviewOfServerChanges()
			return
		}

		this.isConnecting = true

		try {
			const globalPath = await this.getMcpSettingsFilePath()
			let globalServers: Record<string, any> = {}
			try {
				const globalContent = await fs.readFile(globalPath, "utf-8")
				const globalConfig = JSON.parse(globalContent)
				globalServers = globalConfig.mcpServers || {}
				const globalServerNames = Object.keys(globalServers)
			} catch (error) {
				console.log("Error reading global MCP config:", error)
			}

			const projectPath = await this.getProjectMcpPath()
			let projectServers: Record<string, any> = {}
			if (projectPath) {
				try {
					const projectContent = await fs.readFile(projectPath, "utf-8")
					const projectConfig = JSON.parse(projectContent)
					projectServers = projectConfig.mcpServers || {}
					const projectServerNames = Object.keys(projectServers)
				} catch (error) {
					console.log("Error reading project MCP config:", error)
				}
			}

			// Clear all existing connections first
			const existingConnections = [...this.connections]
			for (const conn of existingConnections) {
				await this.deleteConnection(conn.server.name, conn.server.source)
			}

			// Re-initialize all servers from scratch
			// This ensures proper initialization including fetching tools, resources, etc.
			await this.initializeMcpServers("global")
			await this.initializeMcpServers("project")

			await delay(100)

			await this.notifyWebviewOfServerChanges()
		} catch (error) {
			this.showErrorMessage("Failed to refresh MCP servers", error)
		} finally {
			this.isConnecting = false
		}
	}

	private async notifyWebviewOfServerChanges(): Promise<void> {
		// Get global server order from settings file
		const settingsPath = await this.getMcpSettingsFilePath()
		const content = await fs.readFile(settingsPath, "utf-8")
		const config = JSON.parse(content)
		const globalServerOrder = Object.keys(config.mcpServers || {})

		// Get project server order if available
		const projectMcpPath = await this.getProjectMcpPath()
		let projectServerOrder: string[] = []
		if (projectMcpPath) {
			try {
				const projectContent = await fs.readFile(projectMcpPath, "utf-8")
				const projectConfig = JSON.parse(projectContent)
				projectServerOrder = Object.keys(projectConfig.mcpServers || {})
			} catch (error) {
				// Silently continue with empty project server order
			}
		}

		// Sort connections: first project servers in their defined order, then global servers in their defined order
		// This ensures that when servers have the same name, project servers are prioritized
		const sortedConnections = [...this.connections].sort((a, b) => {
			const aIsGlobal = a.server.source === "global" || !a.server.source
			const bIsGlobal = b.server.source === "global" || !b.server.source

			// If both are global or both are project, sort by their respective order
			if (aIsGlobal && bIsGlobal) {
				const indexA = globalServerOrder.indexOf(a.server.name)
				const indexB = globalServerOrder.indexOf(b.server.name)
				return indexA - indexB
			} else if (!aIsGlobal && !bIsGlobal) {
				const indexA = projectServerOrder.indexOf(a.server.name)
				const indexB = projectServerOrder.indexOf(b.server.name)
				return indexA - indexB
			}

			// Project servers come before global servers (reversed from original)
			return aIsGlobal ? 1 : -1
		})

		// Send sorted servers to webview
		const targetProvider: ClineProvider | undefined = this.providerRef.deref()

		if (targetProvider) {
			const serversToSend = sortedConnections.map((connection) => connection.server)

			const message = {
				type: "mcpServers" as const,
				mcpServers: serversToSend,
			}

			try {
				await targetProvider.postMessageToWebview(message)
			} catch (error) {
				console.error("[McpHub] Error calling targetProvider.postMessageToWebview:", error)
			}
		} else {
			console.error(
				"[McpHub] No target provider available (neither from getInstance nor providerRef) - cannot send mcpServers message to webview",
			)
		}
	}

	public async toggleServerDisabled(
		serverName: string,
		disabled: boolean,
		source?: "global" | "project",
	): Promise<void> {
		try {
			// Find the connection to determine if it's a global or project server
			const connection = this.findConnection(serverName, source)
			if (!connection) {
				throw new Error(`Server ${serverName}${source ? ` with source ${source}` : ""} not found`)
			}

			const serverSource = connection.server.source || "global"
			// Update the server config in the appropriate file
			await this.updateServerConfig(serverName, { disabled }, serverSource)

			// Update the connection object
			if (connection) {
				try {
					connection.server.disabled = disabled

					// If disabling a connected server, disconnect it
					if (disabled && connection.server.status === "connected") {
						// Clean up file watchers when disabling
						this.removeFileWatchersForServer(serverName)
						await this.deleteConnection(serverName, serverSource)
						// Re-add as a disabled connection
						await this.connectToServer(serverName, JSON.parse(connection.server.config), serverSource)
					} else if (!disabled && connection.server.status === "disconnected") {
						// If enabling a disabled server, connect it
						const config = JSON.parse(connection.server.config)
						await this.deleteConnection(serverName, serverSource)
						// When re-enabling, file watchers will be set up in connectToServer
						await this.connectToServer(serverName, config, serverSource)
					} else if (connection.server.status === "connected") {
						// Only refresh capabilities if connected
						connection.server.tools = await this.fetchToolsList(serverName, serverSource)
						connection.server.resources = await this.fetchResourcesList(serverName, serverSource)
						connection.server.resourceTemplates = await this.fetchResourceTemplatesList(
							serverName,
							serverSource,
						)
					}
				} catch (error) {
					console.error(`Failed to refresh capabilities for ${serverName}:`, error)
				}
			}

			await this.notifyWebviewOfServerChanges()
		} catch (error) {
			this.showErrorMessage(`Failed to update server ${serverName} state`, error)
			throw error
		}
	}

	/**
	 * Helper method to update a server's configuration in the appropriate settings file
	 * @param serverName The name of the server to update
	 * @param configUpdate The configuration updates to apply
	 * @param source Whether to update the global or project config
	 */
	private async updateServerConfig(
		serverName: string,
		configUpdate: Record<string, any>,
		source: "global" | "project" = "global",
	): Promise<void> {
		// Determine which config file to update
		let configPath: string
		if (source === "project") {
			const projectMcpPath = await this.getProjectMcpPath()
			if (!projectMcpPath) {
				throw new Error("Project MCP configuration file not found")
			}
			configPath = projectMcpPath
		} else {
			configPath = await this.getMcpSettingsFilePath()
		}

		// Ensure the settings file exists and is accessible
		try {
			await fs.access(configPath)
		} catch (error) {
			console.error("Settings file not accessible:", error)
			throw new Error("Settings file not accessible")
		}

		// Read and parse the config file
		const content = await fs.readFile(configPath, "utf-8")
		const config = JSON.parse(content)

		// Validate the config structure
		if (!config || typeof config !== "object") {
			throw new Error("Invalid config structure")
		}

		if (!config.mcpServers || typeof config.mcpServers !== "object") {
			config.mcpServers = {}
		}

		if (!config.mcpServers[serverName]) {
			config.mcpServers[serverName] = {}
		}

		// Create a new server config object to ensure clean structure
		const serverConfig = {
			...config.mcpServers[serverName],
			...configUpdate,
		}

		// Ensure required fields exist
		if (!serverConfig.alwaysAllow) {
			serverConfig.alwaysAllow = []
		}

		config.mcpServers[serverName] = serverConfig

		// Write the entire config back
		const updatedConfig = {
			mcpServers: config.mcpServers,
		}

		await fs.writeFile(configPath, JSON.stringify(updatedConfig, null, 2))
	}

	public async updateServerTimeout(
		serverName: string,
		timeout: number,
		source?: "global" | "project",
	): Promise<void> {
		try {
			// Find the connection to determine if it's a global or project server
			const connection = this.findConnection(serverName, source)
			if (!connection) {
				throw new Error(`Server ${serverName}${source ? ` with source ${source}` : ""} not found`)
			}

			// Update the server config in the appropriate file
			await this.updateServerConfig(serverName, { timeout }, connection.server.source || "global")

			await this.notifyWebviewOfServerChanges()
		} catch (error) {
			this.showErrorMessage(`Failed to update server ${serverName} timeout settings`, error)
			throw error
		}
	}

	/**
	 * Import a batch of MCP server entries into the global settings file
	 * (skipping any that conflict with an existing name), then rebuild the
	 * live connection list so the new servers start connecting immediately.
	 *
	 * Returns the per-entry result so the caller (webview message handler or
	 * CLI) can report a summary back to the user. Designed for the
	 * `mcpMigrateApply` flow and `kilocode mcp migrate` — both call this
	 * after the user has confirmed a subset of the discovered entries.
	 */
	public async importMcpServers(
		entries: import("./mcpMigrate").MigrationEntry[],
	): Promise<import("./mcpMigrate").MigrationResult> {
		const settingsPath = await this.getMcpSettingsFilePath()
		const { applyMigration } = await import("./mcpMigrate.js")
		const result = applyMigration(entries, settingsPath)

		if (result.added.length > 0) {
			// Re-read the file and reconcile the connection list so the new
			// servers start connecting and the webview sees the new state.
			try {
				const content = await fs.readFile(settingsPath, "utf-8")
				const config = JSON.parse(content)
				const servers = (config && typeof config === "object" && config.mcpServers) || {}
				await this.updateServerConnections(servers, "global", false)
			} catch (error) {
				console.error("[McpHub] Failed to reconnect after import:", error)
			}
		}

		return result
	}

	public async deleteServer(serverName: string, source?: "global" | "project"): Promise<void> {
		try {
			// Find the connection to determine if it's a global or project server
			const connection = this.findConnection(serverName, source)
			if (!connection) {
				throw new Error(`Server ${serverName}${source ? ` with source ${source}` : ""} not found`)
			}

			const serverSource = connection.server.source || "global"
			// Determine config file based on server source
			const isProjectServer = serverSource === "project"
			let configPath: string

			if (isProjectServer) {
				// Get project MCP config path
				const projectMcpPath = await this.getProjectMcpPath()
				if (!projectMcpPath) {
					throw new Error("Project MCP configuration file not found")
				}
				configPath = projectMcpPath
			} else {
				// Get global MCP settings path
				configPath = await this.getMcpSettingsFilePath()
			}

			// Ensure the settings file exists and is accessible
			try {
				await fs.access(configPath)
			} catch (error) {
				throw new Error("Settings file not accessible")
			}

			const content = await fs.readFile(configPath, "utf-8")
			const config = JSON.parse(content)

			// Validate the config structure
			if (!config || typeof config !== "object") {
				throw new Error("Invalid config structure")
			}

			if (!config.mcpServers || typeof config.mcpServers !== "object") {
				config.mcpServers = {}
			}

			// Remove the server from the settings
			if (config.mcpServers[serverName]) {
				delete config.mcpServers[serverName]

				// Write the entire config back
				const updatedConfig = {
					mcpServers: config.mcpServers,
				}

				await fs.writeFile(configPath, JSON.stringify(updatedConfig, null, 2))

				// Update server connections with the correct source
				await this.updateServerConnections(config.mcpServers, serverSource)

				vscode.window.showInformationMessage(t("mcp:info.server_deleted", { serverName }))
			} else {
				vscode.window.showWarningMessage(t("mcp:info.server_not_found", { serverName }))
			}
		} catch (error) {
			this.showErrorMessage(`Failed to delete MCP server ${serverName}`, error)
			throw error
		}
	}

	async readResource(serverName: string, uri: string, source?: "global" | "project"): Promise<McpResourceResponse> {
		const connection = this.findConnection(serverName, source)
		if (!connection || connection.type !== "connected") {
			throw new Error(`No connection found for server: ${serverName}${source ? ` with source ${source}` : ""}`)
		}
		if (connection.server.disabled) {
			throw new Error(`Server "${serverName}" is disabled`)
		}
		return await connection.client.request(
			{
				method: "resources/read",
				params: {
					uri,
				},
			},
			ReadResourceResultSchema,
		)
	}

	async callTool(
		serverName: string,
		toolName: string,
		toolArguments?: Record<string, unknown>,
		source?: "global" | "project",
	): Promise<McpToolCallResponse> {
		const connection = this.findConnection(serverName, source)
		if (!connection) {
			throw new Error(
				`No connection found for server: ${serverName}${source ? ` with source ${source}` : ""}. Please make sure to use MCP servers available under 'Connected MCP Servers'.`,
			)
		}

		// Check if server needs authentication
		if (connection.type === "needs-auth") {
			throw new McpAuthError(
				serverName,
				`Server "${serverName}" requires authentication. Use the mcp_authenticate tool to initiate OAuth flow.`,
			)
		}

		if (connection.type !== "connected") {
			throw new Error(`Server "${serverName}" is not connected. Current status: ${connection.type}`)
		}

		if (connection.server.disabled) {
			throw new Error(`Server "${serverName}" is disabled and cannot be used`)
		}

		let timeout: number
		try {
			const parsedConfig = ServerConfigSchema.parse(JSON.parse(connection.server.config))
			timeout = (parsedConfig.timeout ?? 60) * 1000
		} catch (error) {
			console.error("Failed to parse server config for timeout:", error)
			// Default to 60 seconds if parsing fails
			timeout = 60 * 1000
		}

		try {
			console.log("[MCP Debug] callTool - sending request:", {
				name: toolName,
				arguments: toolArguments,
			})
			return await connection.client.request(
				{
					method: "tools/call",
					params: {
						name: toolName,
						arguments: toolArguments,
					},
				},
				CallToolResultSchema,
				{
					timeout,
				},
			)
		} catch (error: any) {
			console.log("[MCP Debug] callTool - error:", error)
			// Check for authentication errors (401 or specific MCP auth error)
			if (this.isAuthenticationError(error)) {
				// Update connection status to needs-auth
				await this.handleAuthenticationError(serverName, source)
				throw new McpAuthError(
					serverName,
					`Server "${serverName}" returned an authentication error. Use the mcp_authenticate tool to re-authenticate.`,
				)
			}
			throw error
		}
	}

	/**
	 * Checks if an error is an authentication error
	 */
	private isAuthenticationError(error: any): boolean {
		if (!error) return false

		// Check for HTTP 401 status
		if (error.status === 401 || error.statusCode === 401 || error.code === 401) {
			return true
		}

		// Check for MCP-specific auth error codes
		if (error.code === "Unauthorized" || error.code === "AUTH_REQUIRED") {
			return true
		}

		// Check error message for auth-related keywords
		const message = error.message?.toLowerCase() || ""
		if (
			message.includes("unauthorized") ||
			message.includes("authentication required") ||
			message.includes("authentication failed") ||
			message.includes("invalid token") ||
			message.includes("token expired")
		) {
			return true
		}

		return false
	}

	/**
	 * Handles authentication errors by updating connection status
	 */
	private async handleAuthenticationError(serverName: string, source?: "global" | "project"): Promise<void> {
		const connection = this.findConnection(serverName, source)
		if (!connection) return

		// Update connection to needs-auth status
		const needsAuthConnection: NeedsAuthMcpConnection = {
			type: "needs-auth",
			server: {
				...connection.server,
				status: "needs-auth" as const,
			},
			client: null,
			transport: null,
		}

		// Replace the connection in the array
		const index = this.connections.findIndex(
			(conn) => conn.server.name === serverName && (source ? conn.server.source === source : true),
		)
		if (index !== -1) {
			this.connections[index] = needsAuthConnection
		}

		// Notify webview of the status change
		await this.notifyWebviewOfServerChanges()
	}

	/**
	 * Helper method to update a specific tool list (alwaysAllow or disabledTools)
	 * in the appropriate settings file.
	 * @param serverName The name of the server to update
	 * @param source Whether to update the global or project config
	 * @param toolName The name of the tool to add or remove
	 * @param listName The name of the list to modify ("alwaysAllow" or "disabledTools")
	 * @param addTool Whether to add (true) or remove (false) the tool from the list
	 */
	private async updateServerToolList(
		serverName: string,
		source: "global" | "project",
		toolName: string,
		listName: "alwaysAllow" | "disabledTools",
		addTool: boolean,
	): Promise<void> {
		// Find the connection with matching name and source
		const connection = this.findConnection(serverName, source)

		if (!connection) {
			throw new Error(`Server ${serverName} with source ${source} not found`)
		}

		// Determine the correct config path based on the source
		let configPath: string
		if (source === "project") {
			// Get project MCP config path
			const projectMcpPath = await this.getProjectMcpPath()
			if (!projectMcpPath) {
				throw new Error("Project MCP configuration file not found")
			}
			configPath = projectMcpPath
		} else {
			// Get global MCP settings path
			configPath = await this.getMcpSettingsFilePath()
		}

		// Normalize path for cross-platform compatibility
		// Use a consistent path format for both reading and writing
		const normalizedPath = process.platform === "win32" ? configPath.replace(/\\/g, "/") : configPath

		// Read the appropriate config file
		const content = await fs.readFile(normalizedPath, "utf-8")
		const config = JSON.parse(content)

		if (!config.mcpServers) {
			config.mcpServers = {}
		}

		if (!config.mcpServers[serverName]) {
			config.mcpServers[serverName] = {
				type: "stdio",
				command: "node",
				args: [], // Default to an empty array; can be set later if needed
			}
		}

		if (!config.mcpServers[serverName][listName]) {
			config.mcpServers[serverName][listName] = []
		}

		const targetList = config.mcpServers[serverName][listName]
		const toolIndex = targetList.indexOf(toolName)

		if (addTool && toolIndex === -1) {
			targetList.push(toolName)
		} else if (!addTool && toolIndex !== -1) {
			targetList.splice(toolIndex, 1)
		}

		await fs.writeFile(normalizedPath, JSON.stringify(config, null, 2))

		if (connection) {
			connection.server.tools = await this.fetchToolsList(serverName, source)
			await this.notifyWebviewOfServerChanges()
		}
	}

	async toggleToolAlwaysAllow(
		serverName: string,
		source: "global" | "project",
		toolName: string,
		shouldAllow: boolean,
	): Promise<void> {
		try {
			await this.updateServerToolList(serverName, source, toolName, "alwaysAllow", shouldAllow)
		} catch (error) {
			this.showErrorMessage(
				`Failed to toggle always allow for tool "${toolName}" on server "${serverName}" with source "${source}"`,
				error,
			)
			throw error
		}
	}

	async toggleToolEnabledForPrompt(
		serverName: string,
		source: "global" | "project",
		toolName: string,
		isEnabled: boolean,
	): Promise<void> {
		try {
			// When isEnabled is true, we want to remove the tool from the disabledTools list.
			// When isEnabled is false, we want to add the tool to the disabledTools list.
			const addToolToDisabledList = !isEnabled
			await this.updateServerToolList(serverName, source, toolName, "disabledTools", addToolToDisabledList)
		} catch (error) {
			this.showErrorMessage(`Failed to update settings for tool ${toolName}`, error)
			throw error // Re-throw to ensure the error is properly handled
		}
	}

	/**
	 * Handles enabling/disabling MCP globally
	 * @param enabled Whether MCP should be enabled or disabled
	 * @returns Promise<void>
	 */
	async handleMcpEnabledChange(enabled: boolean): Promise<void> {
		if (!enabled) {
			// If MCP is being disabled, disconnect all servers with error handling
			const existingConnections = [...this.connections]
			const disconnectionErrors: Array<{ serverName: string; error: string }> = []

			for (const conn of existingConnections) {
				try {
					await this.deleteConnection(conn.server.name, conn.server.source)
				} catch (error) {
					const errorMessage = error instanceof Error ? error.message : String(error)
					disconnectionErrors.push({
						serverName: conn.server.name,
						error: errorMessage,
					})
					console.error(`Failed to disconnect MCP server ${conn.server.name}: ${errorMessage}`)
				}
			}

			// If there were errors, notify the user
			if (disconnectionErrors.length > 0) {
				const errorSummary = disconnectionErrors.map((e) => `${e.serverName}: ${e.error}`).join("\n")
				vscode.window.showWarningMessage(
					t("mcp:errors.disconnect_servers_partial", {
						count: disconnectionErrors.length,
						errors: errorSummary,
					}),
				)
			}

			// Re-initialize servers to track them in disconnected state
			try {
				await this.refreshAllConnections()
			} catch (error) {
				console.error(`Failed to refresh MCP connections after disabling: ${error}`)
				vscode.window.showErrorMessage(t("mcp:errors.refresh_after_disable"))
			}
		} else {
			// If MCP is being enabled, reconnect all servers
			try {
				await this.refreshAllConnections()
			} catch (error) {
				console.error(`Failed to refresh MCP connections after enabling: ${error}`)
				vscode.window.showErrorMessage(t("mcp:errors.refresh_after_enable"))
			}
		}
	}

	// =========================================
	// OAuth Authentication Methods
	// =========================================

	/**
	 * Gets the OAuth provider instance for token management
	 */
	private getOAuthProvider(): McpOAuthProvider | null {
		const provider = this.providerRef.deref()
		if (!provider) {
			console.error("McpHub: Cannot get OAuth provider")
			return null
		}
		return new McpOAuthProvider(provider.context)
	}

	/**
	 * Checks if a server configuration supports OAuth authentication.
	 * Only SSE and streamable-http servers can support OAuth.
	 */
	public supportsOAuth(serverName: string, source?: "global" | "project"): boolean {
		const connection = this.findConnection(serverName, source)
		if (!connection) return false

		try {
			const config = JSON.parse(connection.server.config)
			// Check if it's a URL-based server (sse, streamable-http, or the "http" alias)
			if (config.type !== "sse" && config.type !== "streamable-http" && config.type !== "http") {
				return false
			}
			// Has OAuth configuration
			return !!config.oauth || !!config.url
		} catch {
			return false
		}
	}

	/**
	 * Checks if a server currently needs authentication.
	 */
	public needsAuthentication(serverName: string, source?: "global" | "project"): boolean {
		const connection = this.findConnection(serverName, source)
		return connection?.type === "needs-auth"
	}

	/**
	 * Detects if a stdio server is using mcp-remote as a wrapper.
	 * mcp-remote is a tool that bridges stdio to remote HTTP MCP servers.
	 */
	private isMcpRemoteWrapper(serverConfig: any): { isWrapper: boolean; remoteUrl?: string } {
		if (serverConfig.type && serverConfig.type !== "stdio") {
			return { isWrapper: false }
		}

		// Check if command is npx and args contain mcp-remote with a URL
		const command = serverConfig.command || ""
		const args = serverConfig.args || []

		// Check for npx -y mcp-remote <url> pattern
		if (command === "npx" || command === "npx") {
			const argsStr = args.join(" ")
			// Look for mcp-remote followed by a URL
			const mcpRemoteMatch = argsStr.match(/mcp-remote\s+(https?:\/\/[^\s]+)/)
			if (mcpRemoteMatch) {
				return { isWrapper: true, remoteUrl: mcpRemoteMatch[1] }
			}
		}

		return { isWrapper: false }
	}

	/**
	 * Starts the OAuth flow for a server that requires authentication.
	 * Returns the authorization URL for the user to visit.
	 */
	public async startOAuthFlow(
		serverName: string,
		source?: "global" | "project",
	): Promise<{
		success: boolean
		authUrl?: string
		error?: string
	}> {
		const connection = this.findConnection(serverName, source)
		if (!connection) {
			return { success: false, error: `Server "${serverName}" not found` }
		}

		// Get server configuration
		let serverConfig: any
		try {
			serverConfig = JSON.parse(connection.server.config)
		} catch {
			return { success: false, error: "Invalid server configuration" }
		}

		// Check if this is an mcp-remote wrapper for a remote server
		const mcpRemoteCheck = this.isMcpRemoteWrapper(serverConfig)
		const isMcpRemote = mcpRemoteCheck.isWrapper
		const remoteUrl = mcpRemoteCheck.remoteUrl

		// URL-based servers and mcp-remote wrappers support OAuth
		if (
			serverConfig.type !== "sse" &&
			serverConfig.type !== "streamable-http" &&
			serverConfig.type !== "http" &&
			!isMcpRemote
		) {
			return {
				success: false,
				error: "OAuth is only supported for SSE, streamable-http, http, and mcp-remote wrapped MCP servers",
			}
		}

		// Get the server URL - either from config or from mcp-remote args
		const serverUrl = serverConfig.url || remoteUrl
		if (!serverUrl) {
			return { success: false, error: "Server URL not configured" }
		}

		const oauthProvider = this.getOAuthProvider()
		if (!oauthProvider) {
			return { success: false, error: "OAuth provider not available" }
		}

		try {
			// Get OAuth configuration from server config or discover from server
			const oauthConfig: McpOAuthConfig = serverConfig.oauth || {}

			// Start OAuth flow
			const authUrl = await oauthProvider.startOAuthFlow({
				serverName,
				serverUrl,
				clientId: oauthConfig.clientId,
				clientSecret: oauthConfig.clientSecret,
				scopes: oauthConfig.scopes,
				callbackPort: oauthConfig.callbackPort,
				authServerMetadataUrl: oauthConfig.authServerMetadataUrl,
			})

			// Update connection with auth URL
			const index = this.connections.findIndex(
				(conn) => conn.server.name === serverName && (source ? conn.server.source === source : true),
			)
			if (index !== -1) {
				this.connections[index] = {
					...this.connections[index],
					type: "needs-auth",
					server: {
						...this.connections[index].server,
						status: "needs-auth",
						authUrl,
						authState: "pending",
					},
				} as NeedsAuthMcpConnection
			}

			return { success: true, authUrl }
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error)
			console.error(`Failed to start OAuth flow for ${serverName}:`, errorMessage)
			return { success: false, error: errorMessage }
		}
	}

	/**
	 * Completes the OAuth flow after the user authorizes.
	 * This is called by the URI handler when receiving the OAuth callback.
	 */
	public async completeOAuthFlow(
		serverName: string,
		code: string,
		state: string,
	): Promise<{ success: boolean; error?: string }> {
		const connection = this.findConnection(serverName)
		if (!connection) {
			return { success: false, error: `Server "${serverName}" not found` }
		}

		const oauthProvider = this.getOAuthProvider()
		if (!oauthProvider) {
			return { success: false, error: "OAuth provider not available" }
		}

		try {
			// Exchange authorization code for tokens
			const tokens = await oauthProvider.completeOAuthFlow(serverName, code, state)

			// Update connection status to connected and reconnect
			const source = connection.server.source
			const index = this.connections.findIndex(
				(conn) => conn.server.name === serverName && (source ? conn.server.source === source : true),
			)

			if (index !== -1) {
				// Remove the needs-auth connection and reconnect
				this.connections.splice(index, 1)
			}

			// Reconnect the server with the new tokens
			await this.connectServerWithTokens(serverName, source, tokens)

			// Notify webview of the status change
			await this.notifyWebviewOfServerChanges()

			return { success: true }
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error)
			console.error(`Failed to complete OAuth flow for ${serverName}:`, errorMessage)

			// Update connection state to failed
			const index = this.connections.findIndex((conn) => conn.server.name === serverName)
			if (index !== -1) {
				this.connections[index] = {
					...this.connections[index],
					type: "needs-auth",
					server: {
						...this.connections[index].server,
						status: "needs-auth",
						authState: "failed",
						error: errorMessage,
					},
				} as NeedsAuthMcpConnection
			}

			return { success: false, error: errorMessage }
		}
	}

	/**
	 * Connects a server using stored OAuth tokens.
	 */
	private async connectServerWithTokens(
		serverName: string,
		source: "global" | "project" | undefined,
		tokens: McpOAuthTokens,
	): Promise<void> {
		// Get the server configuration
		const connection = this.connections.find(
			(conn) => conn.server.name === serverName && (source ? conn.server.source === source : true),
		)

		if (!connection) {
			throw new Error(`Server "${serverName}" not found`)
		}

		// Parse config and reconnect with tokens
		const config = JSON.parse(connection.server.config)

		// Add tokens to the transport headers
		// This will be used by the transport layer for authentication
		const headers: Record<string, string> = {
			...config.headers,
			Authorization: `Bearer ${tokens.accessToken}`,
		}

		// Update config with auth headers
		config.headers = headers

		// Delete the old connection
		await this.deleteConnection(serverName, source || "global")

		// Reconnect with the updated configuration
		try {
			await this.connectToServer(serverName, config, source || "global")
		} catch (error) {
			console.error(`Failed to reconnect server ${serverName} with tokens:`, error)
			throw error
		}
	}

	/**
	 * Gets stored OAuth tokens for a server.
	 */
	public async getStoredTokens(serverName: string): Promise<McpOAuthTokens | null> {
		const oauthProvider = this.getOAuthProvider()
		if (!oauthProvider) return null

		return oauthProvider.getStoredTokens(serverName)
	}

	/**
	 * Checks if a server has valid stored tokens.
	 */
	public async hasValidTokens(serverName: string): Promise<boolean> {
		const tokens = await this.getStoredTokens(serverName)
		if (!tokens) return false

		// Check if tokens are expired
		if (tokens.expiresAt && tokens.expiresAt < Date.now()) {
			return false
		}

		return true
	}

	/**
	 * Clears stored OAuth tokens for a server.
	 */
	public async clearTokens(serverName: string): Promise<void> {
		const oauthProvider = this.getOAuthProvider()
		if (!oauthProvider) return

		await oauthProvider.clearTokens(serverName)
	}

	/**
	 * Refreshes expired tokens for a server.
	 */
	public async refreshTokens(serverName: string): Promise<McpOAuthTokens | null> {
		const tokens = await this.getStoredTokens(serverName)
		if (!tokens) return null

		// Check if refresh is needed
		if (!tokens.refreshToken || tokens.expiresAt > Date.now()) {
			return tokens
		}

		const oauthProvider = this.getOAuthProvider()
		if (!oauthProvider) return null

		try {
			const newTokens = await oauthProvider.refreshTokens(serverName, tokens.refreshToken)
			return newTokens
		} catch (error) {
			console.error(`Failed to refresh tokens for ${serverName}:`, error)
			return null
		}
	}

	async dispose(): Promise<void> {
		// Prevent multiple disposals
		if (this.isDisposed) {
			console.log("McpHub: Already disposed.")
			return
		}
		console.log("McpHub: Disposing...")
		this.isDisposed = true

		// Clear all debounce timers
		for (const timer of this.configChangeDebounceTimers.values()) {
			clearTimeout(timer)
		}
		this.configChangeDebounceTimers.clear()

		this.removeAllFileWatchers()
		for (const connection of this.connections) {
			try {
				await this.deleteConnection(connection.server.name, connection.server.source)
			} catch (error) {
				console.error(`Failed to close connection for ${connection.server.name}:`, error)
			}
		}
		this.connections = []
		if (this.settingsWatcher) {
			this.settingsWatcher.dispose()
			this.settingsWatcher = undefined
		}
		if (this.projectMcpWatcher) {
			this.projectMcpWatcher.dispose()
			this.projectMcpWatcher = undefined
		}
		this.disposables.forEach((d) => d.dispose())
	}
}
