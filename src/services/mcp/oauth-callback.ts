/**
 * MCP OAuth Callback Manager
 *
 * Manages OAuth callbacks for MCP servers that require authentication.
 * Handles the authorization code flow for SSE and streamable-http MCP servers.
 */

import * as http from "http"
import * as crypto from "crypto"
import * as vscode from "vscode"
import { McpOAuthTokens } from "../../shared/mcp"

/**
 * Pending OAuth flow state
 */
interface PendingOAuthFlow {
	serverName: string
	serverUrl: string
	state: string
	codeVerifier: string
	redirectUri: string
	resolve?: (tokens: McpOAuthTokens) => void
	reject?: (error: Error) => void
}

/**
 * Pending auth data stored during OAuth flow
 */
interface PendingAuthData {
	serverName: string
	serverUrl: string
	codeVerifier: string
	redirectUri: string
	tokenEndpoint: string
	clientId?: string
	clientSecret?: string
}

/**
 * Singleton manager for MCP OAuth callbacks.
 * Handles both VS Code URI callbacks and local HTTP server callbacks.
 */
export class McpOAuthCallbackManager {
	private static instance: McpOAuthCallbackManager | null = null
	private pendingFlows: Map<string, PendingOAuthFlow> = new Map()
	private pendingAuthData: Map<string, PendingAuthData> = new Map()
	private callbackServer: http.Server | null = null
	private callbackPort: number | null = null

	private constructor() {}

	static getInstance(): McpOAuthCallbackManager {
		if (!McpOAuthCallbackManager.instance) {
			McpOAuthCallbackManager.instance = new McpOAuthCallbackManager()
		}
		return McpOAuthCallbackManager.instance
	}

	/**
	 * Generates a secure random string for state parameter
	 */
	generateState(): string {
		return crypto.randomBytes(32).toString("base64url")
	}

	/**
	 * Generates a PKCE code verifier
	 */
	generateCodeVerifier(): string {
		return crypto.randomBytes(32).toString("base64url")
	}

	/**
	 * Generates a PKCE code challenge from the verifier
	 */
	generateCodeChallenge(verifier: string): string {
		return crypto.createHash("sha256").update(verifier).digest("base64url")
	}

	/**
	 * Registers a pending OAuth flow
	 */
	registerFlow(flow: PendingOAuthFlow): void {
		this.pendingFlows.set(flow.state, flow)
	}

	/**
	 * Removes a pending OAuth flow
	 */
	removeFlow(state: string): void {
		this.pendingFlows.delete(state)
	}

	/**
	 * Gets a pending OAuth flow by state
	 */
	getPendingFlow(state: string): PendingOAuthFlow | undefined {
		return this.pendingFlows.get(state)
	}

	/**
	 * Registers pending auth data for OAuth flow
	 */
	registerPendingAuth(state: string, data: PendingAuthData): void {
		this.pendingAuthData.set(state, data)
	}

	/**
	 * Gets pending auth data by state
	 */
	getPendingAuth(state: string): PendingAuthData | undefined {
		return this.pendingAuthData.get(state)
	}

	/**
	 * Clears pending auth data by state
	 */
	clearPendingAuth(state: string): void {
		this.pendingAuthData.delete(state)
	}

	/**
	 * Handles the OAuth callback from VS Code URI handler
	 */
	async handleCallback(code: string, state: string, serverName?: string): Promise<void> {
		// First check pendingAuthData (set by McpOAuthProvider.startOAuthFlow)
		const authData = this.pendingAuthData.get(state)
		// Also check pendingFlows (legacy support)
		const flow = this.pendingFlows.get(state)

		if (!authData && !flow) {
			console.warn(`[MCP OAuth] No pending flow found for state: ${state}`)
			vscode.window.showWarningMessage(`MCP OAuth callback received but no pending authorization flow was found.`)
			return
		}

		try {
			// Use authData if available (preferred), otherwise fall back to flow
			const serverNameToUse = authData?.serverName || flow?.serverName || serverName
			const serverUrl = authData?.serverUrl || flow?.serverUrl
			const codeVerifier = authData?.codeVerifier || flow?.codeVerifier
			const redirectUri = authData?.redirectUri || flow?.redirectUri
			const tokenEndpoint = authData?.tokenEndpoint

			if (!serverUrl || !codeVerifier || !redirectUri) {
				throw new Error("Missing required OAuth flow data")
			}

			// Exchange authorization code for tokens
			const tokens = await this.exchangeCodeForTokens(
				code,
				{
					serverName: serverNameToUse || "unknown",
					serverUrl,
					codeVerifier,
					redirectUri,
					tokenEndpoint: tokenEndpoint || "",
				},
				authData?.clientId,
				authData?.clientSecret,
			)

			// Resolve the promise if it exists
			flow?.resolve?.(tokens)

			// Clean up
			this.pendingFlows.delete(state)
			this.pendingAuthData.delete(state)

			vscode.window.showInformationMessage(`Successfully authenticated with ${serverNameToUse}`)
		} catch (error) {
			flow?.reject?.(error as Error)
			this.pendingFlows.delete(state)
			this.pendingAuthData.delete(state)

			vscode.window.showErrorMessage(`Failed to authenticate: ${(error as Error).message}`)
		}
	}

	/**
	 * Exchanges authorization code for access tokens
	 */
	private async exchangeCodeForTokens(
		code: string,
		flow: {
			serverName: string
			serverUrl: string
			codeVerifier: string
			redirectUri: string
			tokenEndpoint: string
		},
		clientId?: string,
		clientSecret?: string,
	): Promise<McpOAuthTokens> {
		// Discover OAuth metadata from the server if tokenEndpoint not provided
		let tokenEndpoint = flow.tokenEndpoint
		if (!tokenEndpoint) {
			const metadata = await this.discoverOAuthMetadata(flow.serverUrl)
			tokenEndpoint = metadata.token_endpoint || ""
		}

		if (!tokenEndpoint) {
			throw new Error("OAuth server does not provide a token endpoint")
		}

		// Build token request
		const tokenRequest: Record<string, string> = {
			grant_type: "authorization_code",
			code,
			redirect_uri: flow.redirectUri,
			code_verifier: flow.codeVerifier,
		}

		if (clientId) {
			tokenRequest.client_id = clientId
		}

		if (clientSecret) {
			tokenRequest.client_secret = clientSecret
		}

		// Make token request
		const response = await fetch(tokenEndpoint, {
			method: "POST",
			headers: {
				"Content-Type": "application/x-www-form-urlencoded",
			},
			body: new URLSearchParams(tokenRequest).toString(),
		})

		if (!response.ok) {
			const errorText = await response.text()
			throw new Error(`Token exchange failed: ${response.status} ${errorText}`)
		}

		const tokenData = (await response.json()) as {
			access_token: string
			refresh_token?: string
			expires_in?: number
			scope?: string
		}

		return {
			accessToken: tokenData.access_token,
			refreshToken: tokenData.refresh_token,
			expiresAt: Date.now() + (tokenData.expires_in || 3600) * 1000,
			scope: tokenData.scope,
			serverName: flow.serverName,
			serverUrl: flow.serverUrl,
			clientId,
		}
	}

	/**
	 * Discovers OAuth metadata from the server using RFC 8414
	 */
	private async discoverOAuthMetadata(
		serverUrl: string,
	): Promise<{ authorization_endpoint?: string; token_endpoint?: string }> {
		try {
			// Try RFC 9728 resource metadata first
			const resourceUrl = new URL(serverUrl)
			const protectedResourceUrl = new URL("/.well-known/oauth-protected-resource", resourceUrl.origin)

			const resourceResponse = await fetch(protectedResourceUrl.toString())
			if (resourceResponse.ok) {
				const resourceData = (await resourceResponse.json()) as { authorization_servers?: string[] }

				if (resourceData.authorization_servers?.length) {
					// Use the first authorization server
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

		// Return empty metadata - caller will need to provide endpoints manually
		return {}
	}

	/**
	 * Starts a local callback server for OAuth flows
	 * Returns the port number
	 */
	async startCallbackServer(): Promise<number> {
		if (this.callbackServer) {
			return this.callbackPort!
		}

		return new Promise((resolve, reject) => {
			this.callbackServer = http.createServer((req, res) => {
				const url = new URL(req.url || "/", "http://localhost")

				if (url.pathname === "/callback") {
					const code = url.searchParams.get("code")
					const state = url.searchParams.get("state")

					if (code && state) {
						this.handleCallback(code, state).catch(console.error)

						res.writeHead(200, { "Content-Type": "text/html" })
						res.end(`
							<html>
								<body>
									<h1>Authentication Successful!</h1>
									<p>You can close this window and return to VS Code.</p>
								</body>
							</html>
						`)
					} else {
						res.writeHead(400, { "Content-Type": "text/plain" })
						res.end("Missing code or state parameter")
					}
				} else {
					res.writeHead(404, { "Content-Type": "text/plain" })
					res.end("Not found")
				}
			})

			// Find an available port
			this.callbackServer.listen(0, "127.0.0.1", () => {
				const address = this.callbackServer!.address()
				if (typeof address === "object" && address) {
					this.callbackPort = address.port
					resolve(this.callbackPort)
				} else {
					reject(new Error("Failed to get callback server port"))
				}
			})

			this.callbackServer.on("error", (error) => {
				reject(error)
			})
		})
	}

	/**
	 * Stops the callback server
	 */
	stopCallbackServer(): void {
		if (this.callbackServer) {
			this.callbackServer.close()
			this.callbackServer = null
			this.callbackPort = null
		}
	}

	/**
	 * Gets the VS Code URI callback format
	 */
	getVSCodeCallbackUri(): string {
		return "vscode://matterai.axon-code/mcp/oauth/callback"
	}
}
