/**
 * MCP OAuth Provider
 *
 * Manages OAuth tokens for MCP servers using VS Code's SecretStorage API.
 * Implements the OAuthClientProvider interface from the MCP SDK.
 */

import * as vscode from "vscode"
import { McpOAuthConfig, McpOAuthTokens } from "../../shared/mcp"
import { McpOAuthCallbackManager } from "./oauth-callback"

const SECRET_KEY_PREFIX = "mcp-oauth-tokens"
const CLIENT_SECRET_PREFIX = "mcp-oauth-client-secret"
const OAUTH_STATE_PREFIX = "mcp-oauth-state"
const TOKEN_REGISTRY_KEY = "mcp-oauth-token-registry"

/**
 * OAuth client metadata for MCP servers
 */
interface OAuthClientMetadata {
	client_id: string
	client_secret?: string
	redirect_uris: string[]
}

/**
 * OAuth discovery state cached during auth flow
 */
interface OAuthDiscoveryState {
	authorizationServerUrl?: string
	resourceMetadataUrl?: string
}

/**
 * Pending OAuth flow state
 */
interface PendingOAuthFlow {
	serverName: string
	serverUrl: string
	state: string
	codeVerifier: string
	redirectUri: string
	scopes?: string[]
}

/**
 * VS Code SecretStorage-based OAuth provider for MCP servers.
 * Implements token persistence using the extension's secret storage.
 */
export class McpOAuthProvider {
	private secretStorage: vscode.SecretStorage
	private context: vscode.ExtensionContext
	private callbackManager: McpOAuthCallbackManager
	private pendingFlows: Map<string, PendingOAuthFlow> = new Map()

	constructor(context: vscode.ExtensionContext) {
		this.context = context
		this.secretStorage = context.secrets
		this.callbackManager = McpOAuthCallbackManager.getInstance()
	}

	/**
	 * Gets the token registry that maps server names to their URLs
	 */
	private async getTokenRegistry(): Promise<Map<string, string>> {
		const registryData = await this.secretStorage.get(TOKEN_REGISTRY_KEY)
		if (!registryData) {
			return new Map()
		}
		try {
			const obj = JSON.parse(registryData) as Record<string, string>
			return new Map(Object.entries(obj))
		} catch {
			return new Map()
		}
	}

	/**
	 * Saves the token registry
	 */
	private async saveTokenRegistry(registry: Map<string, string>): Promise<void> {
		const obj = Object.fromEntries(registry)
		await this.secretStorage.store(TOKEN_REGISTRY_KEY, JSON.stringify(obj))
	}

	/**
	 * Gets the storage key for a server's tokens
	 */
	private getTokenKey(serverName: string, serverUrl: string): string {
		const hash = this.hashConfig(serverUrl)
		return `${SECRET_KEY_PREFIX}:${serverName}:${hash}`
	}

	/**
	 * Gets the storage key for a server's client secret
	 */
	private getClientSecretKey(serverName: string, serverUrl: string): string {
		const hash = this.hashConfig(serverUrl)
		return `${CLIENT_SECRET_PREFIX}:${serverName}:${hash}`
	}

	/**
	 * Hashes a config for key generation
	 */
	private hashConfig(config: string): string {
		return require("crypto").createHash("sha256").update(config).digest("hex").substring(0, 16)
	}

	/**
	 * Retrieves stored tokens for a server
	 */
	async getTokens(serverName: string, serverUrl: string): Promise<McpOAuthTokens | null> {
		const key = this.getTokenKey(serverName, serverUrl)
		const stored = await this.secretStorage.get(key)

		if (!stored) {
			return null
		}

		try {
			return JSON.parse(stored) as McpOAuthTokens
		} catch {
			return null
		}
	}

	/**
	 * Stores tokens for a server
	 */
	async saveTokens(tokens: McpOAuthTokens): Promise<void> {
		const key = this.getTokenKey(tokens.serverName, tokens.serverUrl)
		await this.secretStorage.store(key, JSON.stringify(tokens))

		// Update registry
		const registry = await this.getTokenRegistry()
		registry.set(tokens.serverName, tokens.serverUrl)
		await this.saveTokenRegistry(registry)
	}

	/**
	 * Removes tokens for a server
	 */
	async clearTokens(serverName: string, serverUrl?: string): Promise<void> {
		if (serverUrl) {
			const key = this.getTokenKey(serverName, serverUrl)
			await this.secretStorage.delete(key)
		} else {
			// Get URL from registry
			const registry = await this.getTokenRegistry()
			const storedUrl = registry.get(serverName)
			if (storedUrl) {
				const key = this.getTokenKey(serverName, storedUrl)
				await this.secretStorage.delete(key)
				registry.delete(serverName)
				await this.saveTokenRegistry(registry)
			}
		}
	}

	/**
	 * Gets stored tokens for a server by name only (searches all URLs)
	 */
	async getStoredTokens(serverName: string): Promise<McpOAuthTokens | null> {
		// Get URL from registry
		const registry = await this.getTokenRegistry()
		const serverUrl = registry.get(serverName)

		if (!serverUrl) {
			return null
		}

		return await this.getTokens(serverName, serverUrl)
	}

	/**
	 * Generates a random state parameter for CSRF protection
	 */
	private generateState(): string {
		return require("crypto").randomBytes(32).toString("base64url")
	}

	/**
	 * Generates a PKCE code verifier
	 */
	private generateCodeVerifier(): string {
		return require("crypto").randomBytes(32).toString("base64url")
	}

	/**
	 * Generates a PKCE code challenge from a verifier
	 */
	private generateCodeChallenge(verifier: string): string {
		return require("crypto").createHash("sha256").update(verifier).digest("base64url")
	}

	/**
	 * Starts an OAuth flow for a server
	 */
	async startOAuthFlow(config: {
		serverName: string
		serverUrl: string
		clientId?: string
		clientSecret?: string
		scopes?: string[]
		callbackPort?: number
		authServerMetadataUrl?: string
	}): Promise<string> {
		const {
			serverName,
			serverUrl,
			clientId,
			clientSecret,
			scopes = [],
			callbackPort = 8765,
			authServerMetadataUrl,
		} = config

		// Generate state and PKCE verifier
		const state = this.generateState()
		const codeVerifier = this.generateCodeVerifier()
		const codeChallenge = this.generateCodeChallenge(codeVerifier)

		// Determine redirect URI
		const redirectUri = `http://localhost:${callbackPort}/callback`

		// Discover OAuth metadata
		let authorizationEndpoint: string
		let tokenEndpoint: string

		if (authServerMetadataUrl) {
			const metadata = await this.fetchOAuthMetadata(authServerMetadataUrl)
			authorizationEndpoint = metadata.authorization_endpoint || ""
			tokenEndpoint = metadata.token_endpoint || ""
		} else {
			const metadata = await this.discoverOAuthMetadata(serverUrl)
			authorizationEndpoint = metadata.authorization_endpoint || `${new URL(serverUrl).origin}/authorize`
			tokenEndpoint = metadata.token_endpoint || `${new URL(serverUrl).origin}/token`
		}

		if (!authorizationEndpoint) {
			throw new Error("Could not discover authorization endpoint")
		}

		// Build authorization URL
		const authUrl = new URL(authorizationEndpoint)
		authUrl.searchParams.set("response_type", "code")
		authUrl.searchParams.set("client_id", clientId || "")
		authUrl.searchParams.set("redirect_uri", redirectUri)
		authUrl.searchParams.set("state", state)
		authUrl.searchParams.set("code_challenge", codeChallenge)
		authUrl.searchParams.set("code_challenge_method", "S256")

		if (scopes.length > 0) {
			authUrl.searchParams.set("scope", scopes.join(" "))
		}

		// Store pending flow
		this.pendingFlows.set(state, {
			serverName,
			serverUrl,
			state,
			codeVerifier,
			redirectUri,
			scopes,
		})

		// Register callback handler
		this.callbackManager.registerPendingAuth(state, {
			serverName,
			serverUrl,
			codeVerifier,
			redirectUri,
			tokenEndpoint,
			clientId,
			clientSecret,
		})

		return authUrl.toString()
	}

	/**
	 * Completes an OAuth flow by exchanging the authorization code for tokens
	 */
	async completeOAuthFlow(serverName: string, code: string, state: string): Promise<McpOAuthTokens> {
		const pendingFlow = this.pendingFlows.get(state)
		if (!pendingFlow) {
			throw new Error(`No pending OAuth flow for state: ${state}`)
		}

		// Get callback manager data
		const authData = this.callbackManager.getPendingAuth(state)
		if (!authData) {
			throw new Error(`No pending auth data for state: ${state}`)
		}

		// Exchange code for tokens
		const tokenResponse = await this.exchangeCodeForTokens({
			code,
			codeVerifier: pendingFlow.codeVerifier,
			redirectUri: pendingFlow.redirectUri,
			tokenEndpoint: authData.tokenEndpoint,
			clientId: authData.clientId,
			clientSecret: authData.clientSecret,
		})

		// Create tokens object
		const tokens: McpOAuthTokens = {
			accessToken: tokenResponse.access_token,
			refreshToken: tokenResponse.refresh_token,
			expiresAt: Date.now() + (tokenResponse.expires_in || 3600) * 1000,
			scope: tokenResponse.scope,
			clientId: authData.clientId,
			serverName,
			serverUrl: pendingFlow.serverUrl,
		}

		// Save tokens
		await this.saveTokens(tokens)

		// Cleanup
		this.pendingFlows.delete(state)
		this.callbackManager.clearPendingAuth(state)

		return tokens
	}

	/**
	 * Exchanges authorization code for tokens
	 */
	private async exchangeCodeForTokens(params: {
		code: string
		codeVerifier: string
		redirectUri: string
		tokenEndpoint: string
		clientId?: string
		clientSecret?: string
	}): Promise<{ access_token: string; refresh_token?: string; expires_in?: number; scope?: string }> {
		const body = new URLSearchParams({
			grant_type: "authorization_code",
			code: params.code,
			redirect_uri: params.redirectUri,
			code_verifier: params.codeVerifier,
		})

		if (params.clientId) {
			body.set("client_id", params.clientId)
		}

		if (params.clientSecret) {
			body.set("client_secret", params.clientSecret)
		}

		const response = await fetch(params.tokenEndpoint, {
			method: "POST",
			headers: {
				"Content-Type": "application/x-www-form-urlencoded",
			},
			body: body.toString(),
		})

		if (!response.ok) {
			const errorText = await response.text()
			throw new Error(`Token exchange failed: ${response.status} - ${errorText}`)
		}

		return await response.json()
	}

	/**
	 * Refreshes tokens using a refresh token
	 */
	async refreshTokens(serverName: string, refreshToken: string): Promise<McpOAuthTokens> {
		const existingTokens = await this.getStoredTokens(serverName)
		if (!existingTokens) {
			throw new Error(`No stored tokens found for ${serverName}`)
		}

		// Discover token endpoint
		const metadata = await this.discoverOAuthMetadata(existingTokens.serverUrl)
		const tokenEndpoint = metadata.token_endpoint || `${new URL(existingTokens.serverUrl).origin}/token`

		const body = new URLSearchParams({
			grant_type: "refresh_token",
			refresh_token: refreshToken,
		})

		if (existingTokens.clientId) {
			body.set("client_id", existingTokens.clientId)
		}

		const response = await fetch(tokenEndpoint, {
			method: "POST",
			headers: {
				"Content-Type": "application/x-www-form-urlencoded",
			},
			body: body.toString(),
		})

		if (!response.ok) {
			throw new Error(`Token refresh failed: ${response.status}`)
		}

		const tokenResponse = (await response.json()) as {
			access_token: string
			refresh_token?: string
			expires_in?: number
			scope?: string
		}

		const newTokens: McpOAuthTokens = {
			accessToken: tokenResponse.access_token,
			refreshToken: tokenResponse.refresh_token || refreshToken,
			expiresAt: Date.now() + (tokenResponse.expires_in || 3600) * 1000,
			scope: tokenResponse.scope || existingTokens.scope,
			clientId: existingTokens.clientId,
			serverName,
			serverUrl: existingTokens.serverUrl,
		}

		await this.saveTokens(newTokens)
		return newTokens
	}

	/**
	 * Stores a client secret for a server
	 */
	async saveClientSecret(serverName: string, serverUrl: string, clientSecret: string): Promise<void> {
		const key = this.getClientSecretKey(serverName, serverUrl)
		await this.secretStorage.store(key, clientSecret)
	}

	/**
	 * Retrieves a client secret for a server
	 */
	async getClientSecret(serverName: string, serverUrl: string): Promise<string | null> {
		const key = this.getClientSecretKey(serverName, serverUrl)
		return (await this.secretStorage.get(key)) || null
	}

	/**
	 * Clears a client secret for a server
	 */
	async clearClientSecret(serverName: string, serverUrl: string): Promise<void> {
		const key = this.getClientSecretKey(serverName, serverUrl)
		await this.secretStorage.delete(key)
	}

	/**
	 * Checks if tokens are valid (not expired)
	 */
	isTokenValid(tokens: McpOAuthTokens): boolean {
		// Add a 5-minute buffer to expiration
		const bufferMs = 5 * 60 * 1000
		return tokens.expiresAt > Date.now() + bufferMs
	}

	/**
	 * Checks if we have tokens that need refresh
	 */
	needsRefresh(tokens: McpOAuthTokens): boolean {
		// Refresh if token expires in less than 10 minutes
		const refreshBufferMs = 10 * 60 * 1000
		return tokens.expiresAt < Date.now() + refreshBufferMs
	}

	/**
	 * Fetches OAuth metadata from a URL
	 */
	private async fetchOAuthMetadata(
		url: string,
	): Promise<{ authorization_endpoint?: string; token_endpoint?: string }> {
		const response = await fetch(url)
		if (!response.ok) {
			throw new Error(`Failed to fetch OAuth metadata: ${response.status}`)
		}
		return await response.json()
	}

	/**
	 * Discovers OAuth metadata from the server using RFC 8414
	 */
	private async discoverOAuthMetadata(
		serverUrl: string,
	): Promise<{ authorization_endpoint?: string; token_endpoint?: string }> {
		try {
			const resourceUrl = new URL(serverUrl)

			// Try RFC 9728 resource metadata first
			const protectedResourceUrl = new URL("/.well-known/oauth-protected-resource", resourceUrl.origin)

			const resourceResponse = await fetch(protectedResourceUrl.toString())
			if (resourceResponse.ok) {
				const resourceData = (await resourceResponse.json()) as { authorization_servers?: string[] }

				if (resourceData.authorization_servers?.length) {
					const authServerUrl = resourceData.authorization_servers[0]
					const metadataUrl = new URL("/.well-known/oauth-authorization-server", authServerUrl)

					const metadataResponse = await fetch(metadataUrl.toString())
					if (metadataResponse.ok) {
						return await metadataResponse.json()
					}
				}
			}

			// Fallback: Try direct authorization server metadata
			const metadataUrl = new URL("/.well-known/oauth-authorization-server", resourceUrl.origin)
			const metadataResponse = await fetch(metadataUrl.toString())

			if (metadataResponse.ok) {
				return await metadataResponse.json()
			}
		} catch (error) {
			console.warn("[MCP OAuth] Failed to discover OAuth metadata:", error)
		}

		return {}
	}
}
