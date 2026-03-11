import { MarketplaceItem, McpParameter } from "@roo-code/types"

export interface SuggestedPlugin {
	name: string
	companyName: string
	logo: string
	description: string
	code: string // JSON string containing mcpServers config
}

export interface PluginInstallData {
	plugin: SuggestedPlugin
	apiKey: string
	scope: "project" | "global"
}

/**
 * Transforms a suggested plugin from the API format to MarketplaceItem format
 * This allows us to reuse the existing marketplace components
 */
export function transformToMarketplaceItem(plugin: SuggestedPlugin): MarketplaceItem {
	// Parse the code to extract mcpServers config
	let mcpConfig: Record<string, any> = {}
	try {
		mcpConfig = JSON.parse(plugin.code)
	} catch (e) {
		console.error("Failed to parse plugin code:", e)
	}

	// Extract the first server config to get the URL
	const servers = mcpConfig.mcpServers || {}
	const serverName = Object.keys(servers)[0] || "default"
	const serverConfig = servers[serverName] || {}

	// Check if the config has an API key placeholder
	const configStr = JSON.stringify(serverConfig)
	const hasApiKeyPlaceholder = configStr.includes("YOUR_API_KEY") || configStr.includes("${API_KEY}")

	// Build parameters based on the config
	const parameters: McpParameter[] = []

	if (hasApiKeyPlaceholder) {
		parameters.push({
			name: "API Key",
			key: "apiKey",
			placeholder: "Enter your API key",
			optional: false,
		})
	}

	// Extract URL from headers or base URL
	const url = serverConfig.url || ""

	// Transform the code to use template format {{apiKey}} instead of YOUR_API_KEY
	// This is required because SimpleInstaller expects {{paramKey}} format
	let transformedCode = plugin.code
	if (hasApiKeyPlaceholder) {
		transformedCode = plugin.code.replace(/YOUR_API_KEY/g, "{{apiKey}}").replace(/\$\{API_KEY\}/g, "{{apiKey}}")
	}

	return {
		id: `suggested-${plugin.name.toLowerCase().replace(/\s+/g, "-")}`,
		name: plugin.name,
		description: plugin.description,
		author: plugin.companyName,
		logo: plugin.logo,
		type: "mcp",
		url: url,
		content: transformedCode,
		parameters,
		tags: ["suggested"],
	}
}

/**
 * Replaces API key placeholder in the config with actual API key
 */
export function injectApiKey(code: string, apiKey: string): string {
	return code.replace(/YOUR_API_KEY|\$\{API_KEY\}/g, apiKey)
}
