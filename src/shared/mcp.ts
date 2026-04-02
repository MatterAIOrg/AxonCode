export type McpErrorEntry = {
	message: string
	timestamp: number
	level: "error" | "warn" | "info"
}

export type McpServerStatus = "connected" | "connecting" | "disconnected" | "needs-auth"

export type McpServer = {
	name: string
	config: string
	status: McpServerStatus
	error?: string
	errorHistory?: McpErrorEntry[]
	tools?: McpTool[]
	resources?: McpResource[]
	resourceTemplates?: McpResourceTemplate[]
	disabled?: boolean
	timeout?: number
	source?: "global" | "project"
	projectPath?: string
	instructions?: string
	// OAuth-related fields
	authUrl?: string
	authState?: "pending" | "completed" | "failed"
}

export type McpTool = {
	name: string
	description?: string
	inputSchema?: object
	alwaysAllow?: boolean
	enabledForPrompt?: boolean
}

export type McpResource = {
	uri: string
	name: string
	mimeType?: string
	description?: string
}

export type McpResourceTemplate = {
	uriTemplate: string
	name: string
	description?: string
	mimeType?: string
}

export type McpResourceResponse = {
	_meta?: Record<string, any>
	contents: Array<{
		uri: string
		mimeType?: string
		text?: string
		blob?: string
	}>
}

export type McpToolCallResponse = {
	_meta?: Record<string, any>
	content: Array<
		| {
				type: "text"
				text: string
		  }
		| {
				type: "image"
				data: string
				mimeType: string
		  }
		| {
				type: "audio"
				data: string
				mimeType: string
		  }
		| {
				type: "resource"
				resource: {
					uri: string
					mimeType?: string
					text?: string
					blob?: string
				}
		  }
		| {
				type: "resource_link"
				uri: string
				name: string
				description?: string
				mimeType?: string
		  }
	>
	isError?: boolean
}

/**
 * Error thrown when an MCP server requires authentication.
 * This error indicates that the server returned a 401 Unauthorized response
 * and needs the user to complete an OAuth flow before it can be used.
 */
export class McpAuthError extends Error {
	constructor(
		public serverName: string,
		message: string = `MCP server "${serverName}" requires authentication`,
	) {
		super(message)
		this.name = "McpAuthError"
	}
}

/**
 * OAuth configuration for MCP servers.
 * Supports both SSE and streamable-http transports.
 */
export type McpOAuthConfig = {
	/** OAuth client ID */
	clientId?: string
	/** OAuth client secret (stored securely) */
	clientSecret?: string
	/** OAuth callback port (defaults to auto-assigned) */
	callbackPort?: number
	/** Authorization server metadata URL */
	authServerMetadataUrl?: string
	/** OAuth scopes to request */
	scopes?: string[]
	/** Whether to use Cross-App Access (XAA) */
	xaa?: boolean
}

/**
 * OAuth tokens stored for MCP servers.
 */
export type McpOAuthTokens = {
	accessToken: string
	refreshToken?: string
	expiresAt: number
	scope?: string
	clientId?: string
	clientSecret?: string
	serverName: string
	serverUrl: string
}
