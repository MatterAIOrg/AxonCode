import { isFigmaMcpServer, isFigmaMcpTool } from "../figmaMcpGuard"

describe("Figma MCP guard", () => {
	it.each([
		["figma", { type: "http", url: "https://example.com/mcp" }],
		["design", { type: "http", url: "https://mcp.figma.com/mcp" }],
		["design", { type: "http", url: "http://127.0.0.1:3845/mcp" }],
		["design", { command: "npx", args: ["-y", "figma-developer-mcp"] }],
		["design", { command: "node", env: { FIGMA_ACCESS_TOKEN: "secret" } }],
		["design", { command: "node", env: { MCP_URL: "https://mcp.figma.com/mcp" } }],
	])("blocks Figma server %s", (name, config) => {
		expect(isFigmaMcpServer(name, config)).toBe(true)
	})

	it("allows unrelated MCP servers", () => {
		expect(isFigmaMcpServer("github", { type: "http", url: "https://api.github.com/mcp" })).toBe(false)
	})

	it("blocks Figma-specific tools from a general MCP server", () => {
		expect(isFigmaMcpTool({ name: "get_design", description: "Read a Figma frame" })).toBe(true)
		expect(isFigmaMcpTool({ name: "search_issues", description: "Search GitHub issues" })).toBe(false)
	})
})
