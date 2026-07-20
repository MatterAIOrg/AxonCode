const FIGMA_MARKER = /figma/i
const FIGMA_DESKTOP_ENDPOINT = /^https?:\/\/(?:127\.0\.0\.1|localhost|\[::1\]):3845(?:\/|$)/i

/**
 * Figma access is provided by MatterAI's native `figma_fetch` tool. External
 * MCP servers must not provide a second Figma implementation because that can
 * bypass the native integration or compete with it in the model's tool list.
 */
export function isFigmaMcpServer(name: string, config: unknown): boolean {
	if (FIGMA_MARKER.test(name)) return true

	if (!config || typeof config !== "object") return false
	const candidate = config as Record<string, unknown>
	if (typeof candidate.url === "string" && FIGMA_DESKTOP_ENDPOINT.test(candidate.url)) return true
	const identityParts: unknown[] = [candidate.command, candidate.url, candidate.args]

	// Environment/header entries also identify wrapper-based integrations (for
	// example FIGMA_ACCESS_TOKEN or MCP_URL=https://mcp.figma.com/mcp).
	for (const field of [candidate.env, candidate.headers]) {
		if (field && typeof field === "object" && !Array.isArray(field)) {
			identityParts.push(Object.entries(field as Record<string, unknown>).flat())
		}
	}

	return identityParts.flat(2).some((value) => typeof value === "string" && FIGMA_MARKER.test(value))
}

/** Block Figma-specific functions exposed by an otherwise general MCP server. */
export function isFigmaMcpTool(tool: { name?: string; description?: string }): boolean {
	return [tool.name, tool.description].some((value) => typeof value === "string" && FIGMA_MARKER.test(value))
}
