import * as vscode from "vscode"

import { CloudService } from "@roo-code/cloud"

import { ClineProvider } from "../core/webview/ClineProvider"
import { McpOAuthCallbackManager } from "../services/mcp/oauth-callback"
import { McpOAuthProvider } from "../services/mcp/oauth-provider"

export const handleUri = async (uri: vscode.Uri) => {
	const path = uri.path
	const query = new URLSearchParams(uri.query.replace(/\+/g, "%2B"))
	const visibleProvider = ClineProvider.getVisibleInstance()

	if (!visibleProvider) {
		return
	}

	switch (path) {
		case "/glama": {
			const code = query.get("code")
			if (code) {
				await visibleProvider.handleGlamaCallback(code)
			}
			break
		}
		case "/openrouter": {
			const code = query.get("code")
			if (code) {
				await visibleProvider.handleOpenRouterCallback(code)
			}
			break
		}
		case "/axoncode": {
			const token = query.get("token")
			if (token) {
				await visibleProvider.handleKiloCodeCallback(token)
			}
			break
		}
		// forked_change start
		case "/axoncode/profile": {
			await visibleProvider.postMessageToWebview({
				type: "action",
				action: "profileButtonClicked",
			})
			await visibleProvider.postMessageToWebview({
				type: "updateProfileData",
			})
			break
		}
		// forked_change end
		case "/requesty": {
			const code = query.get("code")
			if (code) {
				await visibleProvider.handleRequestyCallback(code)
			}
			break
		}
		case "/auth/clerk/callback": {
			const code = query.get("code")
			const state = query.get("state")
			const organizationId = query.get("organizationId")

			await CloudService.instance.handleAuthCallback(
				code,
				state,
				organizationId === "null" ? null : organizationId,
			)
			break
		}
		case "/mcp/oauth/callback": {
			// Handle MCP OAuth callback
			const code = query.get("code")
			const state = query.get("state")
			const serverName = query.get("server_name")

			if (code && state) {
				try {
					// Get the pending auth data from callback manager
					const callbackManager = McpOAuthCallbackManager.getInstance()
					const authData = callbackManager.getPendingAuth(state)

					if (authData) {
						// Create OAuth provider to save tokens
						const context = visibleProvider.context
						const oauthProvider = new McpOAuthProvider(context)

						// Complete the OAuth flow and save tokens
						const tokens = await oauthProvider.completeOAuthFlow(authData.serverName, code, state)

						// Clean up pending auth data
						callbackManager.clearPendingAuth(state)

						// Get the MCP hub and reconnect the server
						const mcpHub = visibleProvider.getMcpHub()
						if (mcpHub) {
							// Reconnect the server with the new tokens
							await mcpHub.reconnectServer(authData.serverName)
						}

						vscode.window.showInformationMessage(
							`Successfully authenticated with ${authData.serverName}. The server is now reconnecting...`,
						)
					} else {
						// Fall back to the callback manager's handleCallback
						await callbackManager.handleCallback(code, state, serverName || undefined)
					}
				} catch (error) {
					console.error("[MCP OAuth] Failed to complete OAuth flow:", error)
					vscode.window.showErrorMessage(`Failed to complete authentication: ${(error as Error).message}`)
				}
			}
			break
		}
		default:
			break
	}
}
