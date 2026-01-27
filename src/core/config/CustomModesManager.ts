import * as vscode from "vscode"
import * as path from "path"
import * as fs from "fs/promises"
import * as os from "os"

import * as yaml from "yaml"
import stripBom from "strip-bom"
import axios from "axios" // kilocode_change

import { type ModeConfig, type PromptComponent, customModesSettingsSchema, modeConfigSchema } from "@roo-code/types"

import { fileExistsAtPath } from "../../utils/fs"
import { getWorkspacePath } from "../../utils/path"
import { getGlobalRooDirectory, getProjectRooDirectoryForCwd /*kilocode_change*/ } from "../../services/roo-config"
import { logger } from "../../utils/logging"
import { GlobalFileNames } from "../../shared/globalFileNames"
import { ensureSettingsDirectoryExists } from "../../utils/globalContext"
import { t } from "../../i18n"
// kilocode_change start
import { getKiloUrlFromToken } from "@roo-code/types"
import { X_KILOCODE_ORGANIZATIONID, X_KILOCODE_TESTER } from "../../shared/kilocode/headers"
// kilocode_change end

const ROOMODES_FILENAME = ".kilocodemodes"

// Type definitions for import/export functionality
interface RuleFile {
	relativePath: string
	content: string
}

interface ExportedModeConfig extends ModeConfig {
	rulesFiles?: RuleFile[]
}

interface ImportData {
	customModes: ExportedModeConfig[]
}

interface ExportResult {
	success: boolean
	yaml?: string
	error?: string
}

interface ImportResult {
	success: boolean
	error?: string
}

export class CustomModesManager {
	private static readonly cacheTTL = 10_000

	private disposables: vscode.Disposable[] = []
	private isWriting = false
	private writeQueue: Array<() => Promise<void>> = []
	private cachedModes: ModeConfig[] | null = null
	private cachedAt: number = 0

	constructor(
		private readonly context: vscode.ExtensionContext,
		private readonly onUpdate: () => Promise<void>,
	) {
		// Custom modes are disabled - no file watching needed
		// Only the 3 built-in modes (agent, plan, ask) are allowed
	}

	private async queueWrite(operation: () => Promise<void>): Promise<void> {
		this.writeQueue.push(operation)

		if (!this.isWriting) {
			await this.processWriteQueue()
		}
	}

	private async processWriteQueue(): Promise<void> {
		if (this.isWriting || this.writeQueue.length === 0) {
			return
		}

		this.isWriting = true

		try {
			while (this.writeQueue.length > 0) {
				const operation = this.writeQueue.shift()

				if (operation) {
					await operation()
				}
			}
		} finally {
			this.isWriting = false
		}
	}

	private async getWorkspaceRoomodes(): Promise<string | undefined> {
		const workspaceFolders = vscode.workspace.workspaceFolders

		if (!workspaceFolders || workspaceFolders.length === 0) {
			return undefined
		}

		const workspaceRoot = getWorkspacePath()
		const roomodesPath = path.join(workspaceRoot, ROOMODES_FILENAME)
		const exists = await fileExistsAtPath(roomodesPath)
		return exists ? roomodesPath : undefined
	}

	/**
	 * Regex pattern for problematic characters that need to be cleaned from YAML content
	 * Includes:
	 * - \u00A0: Non-breaking space
	 * - \u200B-\u200D: Zero-width spaces and joiners
	 * - \u2010-\u2015, \u2212: Various dash characters
	 * - \u2018-\u2019: Smart single quotes
	 * - \u201C-\u201D: Smart double quotes
	 */
	private static readonly PROBLEMATIC_CHARS_REGEX =
		// eslint-disable-next-line no-misleading-character-class
		/[\u00A0\u200B\u200C\u200D\u2010\u2011\u2012\u2013\u2014\u2015\u2212\u2018\u2019\u201C\u201D]/g

	/**
	 * Clean invisible and problematic characters from YAML content
	 */
	private cleanInvisibleCharacters(content: string): string {
		// Single pass replacement for all problematic characters
		return content.replace(CustomModesManager.PROBLEMATIC_CHARS_REGEX, (match) => {
			switch (match) {
				case "\u00A0": // Non-breaking space
					return " "
				case "\u200B": // Zero-width space
				case "\u200C": // Zero-width non-joiner
				case "\u200D": // Zero-width joiner
					return ""
				case "\u2018": // Left single quotation mark
				case "\u2019": // Right single quotation mark
					return "'"
				case "\u201C": // Left double quotation mark
				case "\u201D": // Right double quotation mark
					return '"'
				default: // Dash characters (U+2010 through U+2015, U+2212)
					return "-"
			}
		})
	}

	/**
	 * Parse YAML content with enhanced error handling and preprocessing
	 */
	private parseYamlSafely(content: string, filePath: string): any {
		// Clean the content
		let cleanedContent = stripBom(content)
		cleanedContent = this.cleanInvisibleCharacters(cleanedContent)

		try {
			const parsed = yaml.parse(cleanedContent)
			// Ensure we never return null or undefined
			return parsed ?? {}
		} catch (yamlError) {
			// For .roomodes files, try JSON as fallback
			if (filePath.endsWith(ROOMODES_FILENAME)) {
				try {
					// Try parsing the original content as JSON (not the cleaned content)
					return JSON.parse(content)
				} catch (jsonError) {
					// JSON also failed, show the original YAML error
					const errorMsg = yamlError instanceof Error ? yamlError.message : String(yamlError)
					console.error(`[CustomModesManager] Failed to parse YAML from ${filePath}:`, errorMsg)

					const lineMatch = errorMsg.match(/at line (\d+)/)
					const line = lineMatch ? lineMatch[1] : "unknown"
					vscode.window.showErrorMessage(t("common:customModes.errors.yamlParseError", { line }))

					// Return empty object to prevent duplicate error handling
					return {}
				}
			}

			// For non-.roomodes files, just log and return empty object
			const errorMsg = yamlError instanceof Error ? yamlError.message : String(yamlError)
			console.error(`[CustomModesManager] Failed to parse YAML from ${filePath}:`, errorMsg)
			return {}
		}
	}

	private async loadModesFromFile(filePath: string): Promise<ModeConfig[]> {
		try {
			const content = await fs.readFile(filePath, "utf-8")
			const settings = this.parseYamlSafely(content, filePath)

			// Ensure settings has customModes property
			if (!settings || typeof settings !== "object" || !settings.customModes) {
				return []
			}

			const result = customModesSettingsSchema.safeParse(settings)

			if (!result.success) {
				console.error(`[CustomModesManager] Schema validation failed for ${filePath}:`, result.error)

				// Show user-friendly error for .roomodes files
				if (filePath.endsWith(ROOMODES_FILENAME)) {
					const issues = result.error.issues
						.map((issue) => `• ${issue.path.join(".")}: ${issue.message}`)
						.join("\n")

					vscode.window.showErrorMessage(t("common:customModes.errors.schemaValidationError", { issues }))
				}

				return []
			}

			// Determine source based on file path
			const isRoomodes = filePath.endsWith(ROOMODES_FILENAME)
			const source = isRoomodes ? ("project" as const) : ("global" as const)

			// Add source to each mode
			return result.data.customModes.map((mode) => ({ ...mode, source }))
		} catch (error) {
			// Only log if the error wasn't already handled in parseYamlSafely
			if (!(error as any).alreadyHandled) {
				const errorMsg = `Failed to load modes from ${filePath}: ${error instanceof Error ? error.message : String(error)}`
				console.error(`[CustomModesManager] ${errorMsg}`)
			}
			return []
		}
	}

	// kilocode_change start: Added organizationModes parameter and precedence logic
	private async mergeCustomModes(
		projectModes: ModeConfig[],
		globalModes: ModeConfig[],
		organizationModes: ModeConfig[] = [],
	): Promise<ModeConfig[]> {
		const slugs = new Set<string>()
		const merged: ModeConfig[] = []

		// Precedence order: organization > project > global

		// Add organization modes (highest precedence)
		for (const mode of organizationModes) {
			if (!slugs.has(mode.slug)) {
				slugs.add(mode.slug)
				merged.push({ ...mode, source: "organization" })
			}
		}

		// Add project modes (medium precedence)
		for (const mode of projectModes) {
			if (!slugs.has(mode.slug)) {
				slugs.add(mode.slug)
				merged.push({ ...mode, source: "project" })
			}
		}
		// kilocode_change end

		// Add global modes (lowest precedence)
		for (const mode of globalModes) {
			if (!slugs.has(mode.slug)) {
				slugs.add(mode.slug)
				merged.push({ ...mode, source: "global" })
			}
		}

		return merged
	}

	public async getCustomModesFilePath(): Promise<string> {
		const settingsDir = await ensureSettingsDirectoryExists(this.context)
		const filePath = path.join(settingsDir, GlobalFileNames.customModes)
		const fileExists = await fileExistsAtPath(filePath)

		if (!fileExists) {
			await this.queueWrite(() => fs.writeFile(filePath, yaml.stringify({ customModes: [] }, { lineWidth: 0 })))
		}

		return filePath
	}

	private async watchCustomModesFiles(): Promise<void> {
		// Skip if test environment is detected
		if (process.env.NODE_ENV === "test") {
			return
		}

		const settingsPath = await this.getCustomModesFilePath()

		// Watch settings file
		const settingsWatcher = vscode.workspace.createFileSystemWatcher(settingsPath)

		const handleSettingsChange = async () => {
			try {
				// Ensure that the settings file exists (especially important for delete events)
				await this.getCustomModesFilePath()
				const content = await fs.readFile(settingsPath, "utf-8")

				const errorMessage = t("common:customModes.errors.invalidFormat")

				let config: any

				try {
					config = this.parseYamlSafely(content, settingsPath)
				} catch (error) {
					console.error(error)
					vscode.window.showErrorMessage(errorMessage)
					return
				}

				const result = customModesSettingsSchema.safeParse(config)

				if (!result.success) {
					vscode.window.showErrorMessage(errorMessage)
					return
				}

				// Get modes from .kilocodemodes if it exists (takes precedence)
				const roomodesPath = await this.getWorkspaceRoomodes()
				const roomodesModes = roomodesPath ? await this.loadModesFromFile(roomodesPath) : []

				// kilocode_change start Get organization modes from global state to preserve them
				const storedModes = (await this.context.globalState.get<ModeConfig[]>("customModes")) || []
				const organizationModes = storedModes.filter((mode) => mode.source === "organization")

				// Merge modes from both sources with organization modes preserved
				const mergedModes = await this.mergeCustomModes(
					roomodesModes,
					result.data.customModes,
					organizationModes,
				)
				// kilocode_change end
				await this.context.globalState.update("customModes", mergedModes)
				this.clearCache()
				await this.onUpdate()
			} catch (error) {
				console.error(`[CustomModesManager] Error handling settings file change:`, error)
			}
		}

		this.disposables.push(settingsWatcher.onDidChange(handleSettingsChange))
		this.disposables.push(settingsWatcher.onDidCreate(handleSettingsChange))
		this.disposables.push(settingsWatcher.onDidDelete(handleSettingsChange))
		this.disposables.push(settingsWatcher)

		// Watch .roomodes file - watch the path even if it doesn't exist yet
		const workspaceFolders = vscode.workspace.workspaceFolders
		if (workspaceFolders && workspaceFolders.length > 0) {
			const workspaceRoot = getWorkspacePath()
			const roomodesPath = path.join(workspaceRoot, ROOMODES_FILENAME)
			const roomodesWatcher = vscode.workspace.createFileSystemWatcher(roomodesPath)

			const handleRoomodesChange = async () => {
				try {
					const settingsModes = await this.loadModesFromFile(settingsPath)
					const roomodesModes = await this.loadModesFromFile(roomodesPath)

					// Get organization modes from global state to preserve them
					const storedModes = (await this.context.globalState.get<ModeConfig[]>("customModes")) || []
					const organizationModes = storedModes.filter((mode) => mode.source === "organization")

					// kilocode_change start
					// Merge with organization modes preserved
					const mergedModes = await this.mergeCustomModes(roomodesModes, settingsModes, organizationModes)
					await this.context.globalState.update("customModes", mergedModes)
					// kilocode_change end
					this.clearCache()
					await this.onUpdate()
				} catch (error) {
					console.error(`[CustomModesManager] Error handling .kilocodemodes file change:`, error)
				}
			}

			this.disposables.push(roomodesWatcher.onDidChange(handleRoomodesChange))
			this.disposables.push(roomodesWatcher.onDidCreate(handleRoomodesChange))
			this.disposables.push(
				roomodesWatcher.onDidDelete(async () => {
					// When .roomodes is deleted, refresh with only settings modes
					try {
						const settingsModes = await this.loadModesFromFile(settingsPath)

						//// kilocode_change start Get organization modes from global state to preserve them
						const storedModes = (await this.context.globalState.get<ModeConfig[]>("customModes")) || []
						const organizationModes = storedModes.filter((mode) => mode.source === "organization")

						// Merge with organization modes preserved
						const mergedModes = await this.mergeCustomModes([], settingsModes, organizationModes)
						await this.context.globalState.update("customModes", mergedModes)
						// kilocode_change end
						this.clearCache()
						await this.onUpdate()
					} catch (error) {
						console.error(`[CustomModesManager] Error handling .roomodes file deletion:`, error)
					}
				}),
			)
			this.disposables.push(roomodesWatcher)
		}
	}

	public async getCustomModes(): Promise<ModeConfig[]> {
		// Custom modes are disabled - always return empty array
		// Only the 3 built-in modes (agent, plan, ask) are allowed
		return []
	}

	public async updateCustomMode(slug: string, config: ModeConfig): Promise<void> {
		// Custom modes are disabled - do nothing
		// Only the 3 built-in modes (agent, plan, ask) are allowed
		logger.warn("Custom mode update attempted but custom modes are disabled", { slug })
	}

	private async updateModesInFile(filePath: string, operation: (modes: ModeConfig[]) => ModeConfig[]): Promise<void> {
		let content = "{}"

		try {
			content = await fs.readFile(filePath, "utf-8")
		} catch (error) {
			// File might not exist yet.
			content = yaml.stringify({ customModes: [] }, { lineWidth: 0 })
		}

		let settings

		try {
			settings = this.parseYamlSafely(content, filePath)
		} catch (error) {
			// Error already logged in parseYamlSafely
			settings = { customModes: [] }
		}

		// Ensure settings is an object and has customModes property
		if (!settings || typeof settings !== "object") {
			settings = { customModes: [] }
		}
		if (!settings.customModes) {
			settings.customModes = []
		}

		settings.customModes = operation(settings.customModes)
		await fs.writeFile(filePath, yaml.stringify(settings, { lineWidth: 0 }), "utf-8")
	}

	private async refreshMergedState(): Promise<void> {
		const settingsPath = await this.getCustomModesFilePath()
		const roomodesPath = await this.getWorkspaceRoomodes()

		const settingsModes = await this.loadModesFromFile(settingsPath)
		const roomodesModes = roomodesPath ? await this.loadModesFromFile(roomodesPath) : []

		// // kilocode_change start Get organization modes from global state to preserve them
		const storedModes = (await this.context.globalState.get<ModeConfig[]>("customModes")) || []
		const organizationModes = storedModes.filter((mode) => mode.source === "organization")

		// Merge with organization modes preserved
		const mergedModes = await this.mergeCustomModes(roomodesModes, settingsModes, organizationModes)
		// kilocode_change end

		await this.context.globalState.update("customModes", mergedModes)

		this.clearCache()

		await this.onUpdate()
	}

	public async deleteCustomMode(slug: string, fromMarketplace = false): Promise<void> {
		// Custom modes are disabled - do nothing
		// Only the 3 built-in modes (agent, plan, ask) are allowed
		logger.warn("Custom mode deletion attempted but custom modes are disabled", { slug })
	}

	/**
	 * Deletes the rules folder for a specific mode
	 * @param slug - The mode slug
	 * @param mode - The mode configuration to determine the scope
	 */
	private async deleteRulesFolder(slug: string, mode: ModeConfig, fromMarketplace = false): Promise<void> {
		try {
			// Determine the scope based on source (project or global)
			const scope = mode.source || "global"

			// Determine the rules folder path
			let rulesFolderPath: string
			if (scope === "project") {
				const workspacePath = getWorkspacePath()
				if (workspacePath) {
					rulesFolderPath = path.join(workspacePath, ".roo", `rules-${slug}`)
				} else {
					return // No workspace, can't delete project rules
				}
			} else {
				// Global scope - use OS home directory
				const homeDir = os.homedir()
				rulesFolderPath = path.join(homeDir, ".roo", `rules-${slug}`)
			}

			// Check if the rules folder exists and delete it
			const rulesFolderExists = await fileExistsAtPath(rulesFolderPath)
			if (rulesFolderExists) {
				try {
					await fs.rm(rulesFolderPath, { recursive: true, force: true })
					logger.info(`Deleted rules folder for mode ${slug}: ${rulesFolderPath}`)
				} catch (error) {
					logger.error(`Failed to delete rules folder for mode ${slug}: ${error}`)
					// Notify the user about the failure
					const messageKey = fromMarketplace
						? "common:marketplace.mode.rulesCleanupFailed"
						: "common:customModes.errors.rulesCleanupFailed"
					vscode.window.showWarningMessage(t(messageKey, { rulesFolderPath }))
					// Continue even if folder deletion fails
				}
			}
		} catch (error) {
			logger.error(`Error deleting rules folder for mode ${slug}`, {
				error: error instanceof Error ? error.message : String(error),
			})
		}
	}

	public async resetCustomModes(): Promise<void> {
		// Custom modes are disabled - do nothing
		// Only the 3 built-in modes (agent, plan, ask) are allowed
		logger.warn("Custom mode reset attempted but custom modes are disabled")
	}

	/**
	 * Checks if a mode has associated rules files in the .roo/rules-{slug}/ directory
	 * @param slug - The mode identifier to check
	 * @returns True if the mode has rules files with content, false otherwise
	 */
	public async checkRulesDirectoryHasContent(slug: string): Promise<boolean> {
		// Custom modes are disabled - always return false
		// Only the 3 built-in modes (agent, plan, ask) are allowed
		return false
	}

	/**
	 * Exports a mode configuration with its associated rules files into a shareable YAML format
	 * @param slug - The mode identifier to export
	 * @param customPrompts - Optional custom prompts to merge into the export
	 * @returns Success status with YAML content or error message
	 */
	public async exportModeWithRules(slug: string, customPrompts?: PromptComponent): Promise<ExportResult> {
		// Custom modes are disabled - return error
		// Only the 3 built-in modes (agent, plan, ask) are allowed
		return { success: false, error: "Custom modes are disabled" }
	}

	public async importModeWithRules(
		yamlContent: string,
		source: "global" | "project" = "project",
	): Promise<ImportResult> {
		// Custom modes are disabled - return error
		// Only the 3 built-in modes (agent, plan, ask) are allowed
		return { success: false, error: "Custom modes are disabled" }
	}

	public async fetchOrganizationModes(
		kilocodeToken: string,
		organizationId?: string,
		kilocodeTesterWarningsDisabledUntil?: number,
	): Promise<ModeConfig[]> {
		// Custom modes are disabled - return empty array
		// Only the 3 built-in modes (agent, plan, ask) are allowed
		return []
	}

	public async refreshWithOrganizationModes(organizationModes: ModeConfig[]): Promise<void> {
		// Custom modes are disabled - do nothing
		// Only the 3 built-in modes (agent, plan, ask) are allowed
	}

	private clearCache(): void {
		this.cachedModes = null
		this.cachedAt = 0
	}

	dispose(): void {
		for (const disposable of this.disposables) {
			disposable.dispose()
		}

		this.disposables = []
	}
}
