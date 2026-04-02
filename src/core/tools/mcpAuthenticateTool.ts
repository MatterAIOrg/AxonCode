import { Task } from "../task/Task"
import { ToolUse, AskApproval, HandleError, PushToolResult, RemoveClosingTag } from "../../shared/tools"
import { formatResponse } from "../prompts/responses"
import { t } from "../../i18n"

interface McpAuthenticateParams {
	server_name?: string
}

/**
 * Detects if a stdio server configuration is using mcp-remote as a wrapper.
 * mcp-remote is a tool that bridges stdio to remote HTTP MCP servers.
 */
function isMcpRemoteWrapper(serverConfig: any): { isWrapper: boolean; remoteUrl?: string } {
	if (serverConfig.type && serverConfig.type !== "stdio") {
		return { isWrapper: false }
	}

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
 * Implements the mcp_authenticate tool.
 *
 * This tool initiates OAuth authentication for MCP servers that require it.
 * It returns an authorization URL that the user must visit to complete authentication.
 */
export async function mcpAuthenticateTool(
	cline: Task,
	block: ToolUse,
	askApproval: AskApproval,
	handleError: HandleError,
	pushToolResult: PushToolResult,
	removeClosingTag: RemoveClosingTag,
) {
	try {
		const params: McpAuthenticateParams = {
			server_name: block.params.server_name,
		}

		// Handle partial requests
		if (block.partial) {
			const partialMessage = JSON.stringify({
				type: "mcp_authenticate",
				serverName: removeClosingTag("server_name", params.server_name),
			})
			await cline.ask("use_mcp_server", partialMessage, true).catch(() => {})
			return
		}

		// Validate server_name parameter
		if (!params.server_name) {
			cline.consecutiveMistakeCount++
			cline.recordToolError("mcp_authenticate")
			pushToolResult(await cline.sayAndCreateMissingParamError("mcp_authenticate", "server_name"))
			return
		}

		const serverName = params.server_name

		// Reset mistake count on successful validation
		cline.consecutiveMistakeCount = 0

		// Get the MCP hub
		const provider = cline.providerRef.deref()
		const mcpHub = provider?.getMcpHub()

		if (!mcpHub) {
			pushToolResult(
				formatResponse.toolError("MCP hub is not available. Please ensure MCP servers are configured."),
			)
			return
		}

		// Check if the server exists
		const servers = mcpHub.getAllServers()
		const server = servers.find((s) => s.name === serverName)

		if (!server) {
			const availableServers = servers.map((s) => s.name)
			const serversList = availableServers.length > 0 ? availableServers.join(", ") : "No servers available"
			cline.consecutiveMistakeCount++
			cline.recordToolError("mcp_authenticate")
			await cline.say("error", t("mcp:errors.serverNotFound", { serverName, availableServers: serversList }))
			pushToolResult(formatResponse.unknownMcpServerError(serverName, availableServers))
			return
		}

		// Check if server already has valid authentication
		if (server.status === "connected") {
			pushToolResult(
				`The MCP server "${serverName}" is already connected and authenticated. No further action is needed.\n\nYou can now use the server's tools directly.`,
			)
			return
		}

		// Check if this is a stdio server - only allow if it's an mcp-remote wrapper
		try {
			const serverConfig = JSON.parse(server.config)
			if (serverConfig.type === "stdio" || (!serverConfig.type && serverConfig.command)) {
				const mcpRemoteCheck = isMcpRemoteWrapper(serverConfig)
				if (!mcpRemoteCheck.isWrapper) {
					pushToolResult(
						formatResponse.toolError(
							`The MCP server "${serverName}" is a local stdio server that doesn't support OAuth authentication.\n\nFor local stdio servers, you typically need to configure authentication in the server's configuration (e.g., via environment variables).\n\nIf this server uses mcp-remote to connect to a remote server, ensure the configuration includes the mcp-remote wrapper.`,
						),
					)
					return
				}
			}
		} catch {
			// If we can't parse config, continue with the OAuth flow
		}

		// Ask for user approval before starting OAuth flow
		const completeMessage = JSON.stringify({
			type: "mcp_authenticate",
			serverName,
		})
		const didApprove = await askApproval("use_mcp_server", completeMessage)

		if (!didApprove) {
			return
		}

		// Start the OAuth flow
		const result = await mcpHub.startOAuthFlow(serverName)

		if (result.success && result.authUrl) {
			const message = `OAuth authentication initiated for MCP server "${serverName}".

Please visit the following URL to authorize access:
${result.authUrl}

After you complete authentication in your browser, the server's tools will become automatically available.
You can check the server status by trying to use its tools again.`

			await cline.say("mcp_server_response", message)
			pushToolResult(message)
		} else {
			// OAuth flow failed
			const errorMessage = result.error || "Unknown error occurred"
			await cline.say("error", `Failed to start OAuth flow for ${serverName}: ${errorMessage}`)
			pushToolResult(
				formatResponse.toolError(
					`Failed to start OAuth authentication for server "${serverName}": ${errorMessage}\n\nThis may happen if:\n- The server doesn't support OAuth (stdio servers require manual configuration)\n- The server configuration is missing OAuth credentials\n- There was a network error contacting the server`,
				),
			)
		}
	} catch (error) {
		await handleError("authenticating with MCP server", error)
	}
}
