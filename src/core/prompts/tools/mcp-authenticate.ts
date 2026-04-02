/**
 * McpAuthenticate tool prompt and description
 *
 * This tool is surfaced when an MCP server requires authentication.
 * It allows the model to initiate the OAuth flow for the user.
 */

import { McpHub } from "../../../services/mcp/McpHub"

interface McpAuthenticateArgs {
	mcpHub?: McpHub
	server_name?: string
}

export function getMcpAuthenticateDescription(args: McpAuthenticateArgs): string {
	const { mcpHub } = args

	// Get list of servers that need authentication
	const serversNeedingAuth =
		mcpHub
			?.getAllServers()
			.filter((server) => server.status === "needs-auth")
			.map((server) => server.name) || []

	if (serversNeedingAuth.length > 0) {
		return `## mcp_authenticate

Description: Request to authenticate with an MCP server that requires OAuth authorization. This tool initiates the OAuth flow and returns an authorization URL for the user to complete authentication in their browser.

The following servers require authentication: ${serversNeedingAuth.join(", ")}

Usage:
<mcp_authenticate>
<server_name>server name here</server_name>
</mcp_authenticate>

Parameters:
- server_name: The name of the MCP server that requires authentication (required)

Result:
- status: One of "auth_url", "already_authenticated", "unsupported", or "error"
- auth_url: The authorization URL (when status is "auth_url")
- message: A human-readable message explaining the result

Notes:
- SSE, streamable-http, and mcp-remote wrapped stdio servers support OAuth authentication
- For mcp-remote servers (e.g., npx -y mcp-remote https://...), the OAuth flow connects to the remote server
- Regular stdio servers (not using mcp-remote) require manual authentication setup via environment variables
- After the user completes authentication in their browser, the server's tools become automatically available
- If the server is already authenticated, the tool will indicate that no further action is needed`
	}

	return `## mcp_authenticate

Description: Request to authenticate with an MCP server that requires OAuth authorization. This tool initiates the OAuth flow and returns an authorization URL for the user to complete authentication in their browser.

Usage:
<mcp_authenticate>
<server_name>server name here</server_name>
</mcp_authenticate>

Parameters:
- server_name: The name of the MCP server that requires authentication (required)

Result:
- status: One of "auth_url", "already_authenticated", "unsupported", or "error"
- auth_url: The authorization URL (when status is "auth_url")
- message: A human-readable message explaining the result

Notes:
- SSE, streamable-http, and mcp-remote wrapped stdio servers support OAuth authentication
- For mcp-remote servers (e.g., npx -y mcp-remote https://...), the OAuth flow connects to the remote server
- Regular stdio servers (not using mcp-remote) require manual authentication setup via environment variables
- After the user completes authentication in their browser, the server's tools become automatically available`
}

/**
 * Gets the list of servers requiring authentication
 */
export function getServersNeedingAuth(mcpHub: McpHub | undefined): string[] {
	if (!mcpHub) {
		return []
	}

	return mcpHub
		.getAllServers()
		.filter((server) => server.status === "needs-auth")
		.map((server) => server.name)
}

/**
 * Checks if a server needs authentication
 */
export function serverNeedsAuth(mcpHub: McpHub | undefined, serverName: string): boolean {
	if (!mcpHub) {
		return false
	}

	const server = mcpHub.getAllServers().find((s) => s.name === serverName)
	return server?.status === "needs-auth"
}
