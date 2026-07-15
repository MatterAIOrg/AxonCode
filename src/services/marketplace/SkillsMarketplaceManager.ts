import axios from "axios"
import * as vscode from "vscode"

import type { MarketplaceItem, PluginMarketplaceItem } from "@roo-code/types"

import { getInstalledPluginMetadata, OFFICIAL_PLUGIN_MARKETPLACE } from "./PluginInstaller"

const CLAUDE_PLUGINS_MARKETPLACE_URL =
	"https://raw.githubusercontent.com/anthropics/claude-plugins-official/main/.claude-plugin/marketplace.json"
const CACHE_DURATION_MS = 5 * 60 * 1000

interface ClaudePluginSource {
	source: string
	url?: string
	repo?: string
	path?: string
	ref?: string
	sha?: string
	commit?: string
	package?: string
	version?: string
	[key: string]: unknown
}

interface ClaudePluginEntry {
	name: string
	displayName?: string
	description?: string
	author?: string | { name?: string; email?: string; url?: string }
	category?: string
	homepage?: string
	version?: string
	source: string | ClaudePluginSource
	strict?: boolean
	skills?: string[]
	commands?: string | string[]
	agents?: string | string[]
	hooks?: unknown
	mcpServers?: unknown
	tags?: string[]
	keywords?: string[]
}

interface ClaudeMarketplaceFile {
	name?: string
	renames?: Record<string, string>
	plugins: ClaudePluginEntry[]
}

export interface SkillsMarketplaceResponse {
	items: MarketplaceItem[]
	errors?: string[]
}

/**
 * Loads the official Claude plugin catalog. The legacy class and message names
 * are retained so existing webview state remains compatible, but every row is
 * now a complete plugin bundle rather than a guessed individual SKILL.md.
 */
export class SkillsMarketplaceManager {
	private cache: { data: MarketplaceItem[]; timestamp: number } | null = null

	constructor(_context: vscode.ExtensionContext) {}

	async getItems(): Promise<SkillsMarketplaceResponse> {
		try {
			return { items: await this.fetchItems() }
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error)
			console.error("Failed to load plugins marketplace:", error)
			return { items: [], errors: [message] }
		}
	}

	private async fetchItems(): Promise<MarketplaceItem[]> {
		if (this.cache && Date.now() - this.cache.timestamp < CACHE_DURATION_MS) return this.cache.data

		const response = await axios.get<ClaudeMarketplaceFile>(CLAUDE_PLUGINS_MARKETPLACE_URL, {
			timeout: 15_000,
			headers: { Accept: "application/json" },
		})
		const marketplace = response.data
		if (!marketplace?.plugins || !Array.isArray(marketplace.plugins)) {
			throw new Error("Invalid marketplace.json: missing plugins array")
		}

		const renames = marketplace.renames ?? {}
		const items = marketplace.plugins.map((plugin): PluginMarketplaceItem & { type: "plugin" } => {
			const name = renames[plugin.name] ?? plugin.name
			const author = typeof plugin.author === "string" ? plugin.author : plugin.author?.name
			const authorUrl = typeof plugin.author === "object" ? plugin.author?.url : undefined
			const tags = [plugin.category, ...(plugin.tags ?? []), ...(plugin.keywords ?? [])].filter(
				(tag, index, all): tag is string => Boolean(tag) && all.indexOf(tag) === index,
			)

			return {
				type: "plugin",
				id: name,
				name: plugin.displayName ?? name,
				description: plugin.description ?? "",
				author,
				authorUrl,
				tags,
				marketplace: marketplace.name || OFFICIAL_PLUGIN_MARKETPLACE,
				source: plugin.source,
				sourceUrl: this.sourceUrl(plugin),
				homepage: plugin.homepage,
				version: plugin.version,
				category: plugin.category,
				strict: plugin.strict,
				skills: plugin.skills,
				commands: plugin.commands,
				agents: plugin.agents,
				hooks: plugin.hooks,
				mcpServers: plugin.mcpServers,
			}
		})

		this.cache = { data: items, timestamp: Date.now() }
		return items
	}

	private sourceUrl(plugin: ClaudePluginEntry): string | undefined {
		if (plugin.homepage) return plugin.homepage
		if (typeof plugin.source === "object") {
			if (plugin.source.url?.startsWith("http")) return plugin.source.url.replace(/\.git$/, "")
			if (plugin.source.repo) return `https://github.com/${plugin.source.repo}`
		}
		return "https://github.com/anthropics/claude-plugins-official"
	}

	clearCache(): void {
		this.cache = null
	}

	async getInstallationMetadata(): Promise<{
		project: Record<
			string,
			{ type: string; inventory?: ReturnType<typeof getInstalledPluginMetadata>[string]["inventory"] }
		>
		global: Record<string, { type: string }>
	}> {
		const workspaceFolder = vscode.workspace.workspaceFolders?.[0]
		return {
			project: workspaceFolder ? getInstalledPluginMetadata(workspaceFolder.uri.fsPath) : {},
			global: {},
		}
	}
}
