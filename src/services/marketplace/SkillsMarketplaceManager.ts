import axios from "axios"
import * as fs from "fs/promises"
import * as path from "path"
import * as vscode from "vscode"

import type { MarketplaceItem, SkillMarketplaceItem } from "@roo-code/types"
import { TelemetryService } from "@roo-code/telemetry"

import { t } from "../../i18n"
import { SimpleInstaller } from "./SimpleInstaller"

/**
 * Skills marketplace backed by the official Anthropic Claude Code plugins
 * directory: https://github.com/anthropics/claude-plugins-official
 *
 * The marketplace.json file lists plugins; each plugin can declare a
 * `skills` array (skill-bundle plugins) or live as a single skill under
 * `plugins/<name>/skills/<skill>/SKILL.md`. We surface every individual
 * skill as a marketplace item so users can install them into their
 * workspace's `.agent/skills/<name>/SKILL.md`.
 */
const CLAUDE_PLUGINS_MARKETPLACE_URL =
	"https://raw.githubusercontent.com/anthropics/claude-plugins-official/main/.claude-plugin/marketplace.json"

const CACHE_KEY = "claude-plugins-official"
const CACHE_DURATION_MS = 5 * 60 * 1000 // 5 minutes

interface ClaudePluginSource {
	source: "git-subdir" | "url" | "github" | string
	url?: string
	repo?: string
	path?: string
	ref?: string
	sha?: string
	commit?: string
}

interface ClaudePluginEntry {
	name: string
	displayName?: string
	description?: string
	author?: { name?: string; email?: string; url?: string }
	category?: string
	homepage?: string
	source: string | ClaudePluginSource
	strict?: boolean
	skills?: string[]
	tags?: string[]
	keywords?: string[]
}

interface ClaudeMarketplaceFile {
	name: string
	description?: string
	owner?: { name?: string; email?: string }
	renames?: Record<string, string>
	plugins: ClaudePluginEntry[]
}

export interface SkillsMarketplaceResponse {
	items: MarketplaceItem[]
	errors?: string[]
}

export class SkillsMarketplaceManager {
	private cache: { data: MarketplaceItem[]; timestamp: number } | null = null

	constructor(private readonly context: vscode.ExtensionContext) {}

	async getItems(): Promise<SkillsMarketplaceResponse> {
		try {
			const items = await this.fetchItems()
			return { items }
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error)
			console.error("Failed to load skills marketplace:", error)
			return { items: [], errors: [message] }
		}
	}

	private async fetchItems(): Promise<MarketplaceItem[]> {
		if (this.cache && Date.now() - this.cache.timestamp < CACHE_DURATION_MS) {
			return this.cache.data
		}

		const response = await axios.get<ClaudeMarketplaceFile>(CLAUDE_PLUGINS_MARKETPLACE_URL, {
			timeout: 15000,
			headers: { Accept: "application/json" },
		})

		const marketplace = response.data
		if (!marketplace?.plugins || !Array.isArray(marketplace.plugins)) {
			throw new Error("Invalid marketplace.json: missing plugins array")
		}

		const renames = marketplace.renames ?? {}
		const items: MarketplaceItem[] = []

		for (const plugin of marketplace.plugins) {
			const resolvedName = renames[plugin.name] ?? plugin.name

			// Skill-bundle plugins: declare skills inline.
			if (Array.isArray(plugin.skills) && plugin.skills.length > 0) {
				for (const skillPath of plugin.skills) {
					const skillItem = await this.resolveSkillFromBundle(plugin, resolvedName, skillPath)
					if (skillItem) items.push(skillItem)
				}
				continue
			}

			// Single-skill plugins: try to fetch SKILL.md from the plugin's
			// source repo at the conventional path
			// `plugins/<name>/skills/<name>/SKILL.md`.
			const skillItem = await this.resolveSkillFromPlugin(plugin, resolvedName)
			if (skillItem) items.push(skillItem)
		}

		this.cache = { data: items, timestamp: Date.now() }
		return items
	}

	private async resolveSkillFromBundle(
		plugin: ClaudePluginEntry,
		pluginName: string,
		skillPath: string,
	): Promise<MarketplaceItem | null> {
		const trimmed = skillPath.replace(/^\.\//, "").replace(/\/$/, "")
		const skillName = trimmed.split("/").pop() || pluginName
		const sourceUrl = this.buildRawUrl(plugin, `${trimmed}/SKILL.md`)

		const content = await this.fetchSkillContent(sourceUrl)
		if (!content) return null

		return this.buildSkillItem(plugin, pluginName, skillName, content, sourceUrl)
	}

	private async resolveSkillFromPlugin(
		plugin: ClaudePluginEntry,
		pluginName: string,
	): Promise<MarketplaceItem | null> {
		const sourceUrl = this.buildRawUrl(plugin, `skills/${pluginName}/SKILL.md`)
		const content = await this.fetchSkillContent(sourceUrl)
		if (!content) return null

		const skillName = this.extractSkillName(content) ?? pluginName
		return this.buildSkillItem(plugin, pluginName, skillName, content, sourceUrl)
	}

	private buildSkillItem(
		plugin: ClaudePluginEntry,
		pluginName: string,
		skillName: string,
		content: string,
		sourceUrl: string | undefined,
	): MarketplaceItem {
		const item: SkillMarketplaceItem = {
			id: `${pluginName}:${skillName}`,
			name: plugin.displayName ?? pluginName,
			description: plugin.description ?? "",
			author: plugin.author?.name,
			authorUrl: plugin.author?.url,
			tags: [
				...(plugin.category ? [plugin.category] : []),
				...(plugin.tags ?? []),
				...(plugin.keywords ?? []),
			].filter((tag, idx, arr) => arr.indexOf(tag) === idx),
			content,
			sourceUrl,
		}

		return { type: "skill", ...item }
	}

	private buildRawUrl(plugin: ClaudePluginEntry, relativePath: string): string | undefined {
		const source = this.normalizeSource(plugin.source)

		// git-subdir: url + path + ref/sha
		if (source.source === "git-subdir" && source.url && source.path) {
			const ref = source.sha ?? source.ref ?? "main"
			const base = this.toRawGithubUrl(source.url)
			if (!base) return undefined
			const subPath = source.path.replace(/^\//, "").replace(/\/$/, "")
			const cleanRel = relativePath.replace(/^\.\//, "").replace(/^\//, "")
			return `${base}/${ref}/${[subPath, cleanRel].filter(Boolean).join("/")}`
		}

		// url: clone the repo and read SKILL.md from the root or skills/ dir.
		// We only support GitHub URLs here.
		if (source.source === "url" && source.url) {
			const base = this.toRawGithubUrl(source.url)
			if (!base) return undefined
			const ref = source.sha ?? "main"
			const cleanRel = relativePath.replace(/^\.\//, "").replace(/^\//, "")
			return `${base}/${ref}/${cleanRel}`
		}

		// github: { repo, ref/sha, path? }
		if (source.source === "github" && source.repo) {
			const base = `https://raw.githubusercontent.com/${source.repo}`
			const ref = source.sha ?? source.commit ?? source.ref ?? "main"
			const subPath = source.path?.replace(/^\//, "").replace(/\/$/, "") ?? ""
			const cleanRel = relativePath.replace(/^\.\//, "").replace(/^\//, "")
			return `${base}/${ref}/${[subPath, cleanRel].filter(Boolean).join("/")}`
		}

		return undefined
	}

	private normalizeSource(source: string | ClaudePluginSource): ClaudePluginSource {
		if (typeof source === "string") {
			return { source }
		}
		return source
	}

	private toRawGithubUrl(url: string): string | undefined {
		// Accept https://github.com/<owner>/<repo>[.git] or git@github.com:...
		const httpsMatch = url.match(/^https?:\/\/github\.com\/([^/]+)\/([^/]+?)(?:\.git)?\/?$/i)
		if (httpsMatch) {
			return `https://raw.githubusercontent.com/${httpsMatch[1]}/${httpsMatch[2]}`
		}
		const sshMatch = url.match(/^git@github\.com:([^/]+)\/([^/]+?)(?:\.git)?\/?$/i)
		if (sshMatch) {
			return `https://raw.githubusercontent.com/${sshMatch[1]}/${sshMatch[2]}`
		}
		return undefined
	}

	private async fetchSkillContent(url: string | undefined): Promise<string | null> {
		if (!url) return null
		try {
			const response = await axios.get<string>(url, {
				timeout: 10000,
				// GitHub raw returns plain text; axios will parse JSON by default
				// for text/plain on some setups, so force responseType text.
				responseType: "text",
				transformResponse: [(data) => data],
				headers: { Accept: "text/plain, text/markdown, */*" },
			})
			const text = typeof response.data === "string" ? response.data : String(response.data ?? "")
			if (!text.trim()) return null
			// Sanity check: must look like a SKILL.md (frontmatter or markdown).
			if (!text.includes("---") && !text.toLowerCase().includes("skill")) {
				return null
			}
			return text
		} catch (error) {
			// 404s are common (not every plugin ships a SKILL.md); silently ignore them.
			if (axios.isAxiosError(error) && error.response?.status === 404) {
				return null
			}
			console.warn(`[SkillsMarketplace] Failed to fetch ${url}:`, this.errorMessage(error))
			return null
		}
	}

	private extractSkillName(content: string): string | undefined {
		const match = content.match(/^---\s*\n([\s\S]*?)\n---/)
		if (!match) return undefined
		const nameLine = match[1].split("\n").find((line) => line.trim().startsWith("name:"))
		if (!nameLine) return undefined
		const value = nameLine
			.split(":")
			.slice(1)
			.join(":")
			.trim()
			.replace(/^["']|["']$/g, "")
		return value || undefined
	}

	private errorMessage(error: unknown): string {
		return error instanceof Error ? error.message : String(error)
	}

	clearCache(): void {
		this.cache = null
	}

	/**
	 * Install a skill marketplace item into the user's workspace at
	 * `.agent/skills/<name>/SKILL.md`.
	 */
	async installSkill(item: MarketplaceItem, options?: { target?: "global" | "project" }): Promise<string> {
		if (item.type !== "skill") {
			throw new Error(`Cannot install non-skill item as skill: ${(item as { type: string }).type}`)
		}

		const installer = new SimpleInstaller(this.context)
		const target = options?.target ?? "project"
		const result = await installer.installSkill(item, target)
		const filePath = result.filePath

		TelemetryService.instance.captureMarketplaceItemInstalled(item.id, item.type, item.name, target, {})

		vscode.window.showInformationMessage(t("marketplace:installation.installSuccess", { itemName: item.name }))

		// Open the installed SKILL.md so the user can review it.
		try {
			const document = await vscode.workspace.openTextDocument(filePath)
			await vscode.window.showTextDocument(document)
		} catch (error) {
			console.warn("[SkillsMarketplace] Failed to open installed SKILL.md:", error)
		}

		return filePath
	}

	async removeSkill(item: MarketplaceItem, options?: { target?: "global" | "project" }): Promise<void> {
		if (item.type !== "skill") {
			throw new Error(`Cannot remove non-skill item as skill: ${(item as { type: string }).type}`)
		}

		const installer = new SimpleInstaller(this.context)
		const target = options?.target ?? "project"
		await installer.removeSkill(item, target)

		TelemetryService.instance.captureMarketplaceItemRemoved(item.id, item.type, item.name, target)

		vscode.window.showInformationMessage(t("marketplace:installation.removeSuccess", { itemName: item.name }))
	}

	/**
	 * Build installation metadata for the skills marketplace by scanning the
	 * workspace's `.agent/skills/` directory.
	 */
	async getInstallationMetadata(): Promise<{
		project: Record<string, { type: string }>
		global: Record<string, { type: string }>
	}> {
		const metadata = {
			project: {} as Record<string, { type: string }>,
			global: {} as Record<string, { type: string }>,
		}

		// Project-level: scan workspace .agent/skills/
		const workspaceFolder = vscode.workspace.workspaceFolders?.[0]
		if (workspaceFolder) {
			const skillsDir = path.join(workspaceFolder.uri.fsPath, ".agent", "skills")
			try {
				const entries = await fs.readdir(skillsDir, { withFileTypes: true })
				for (const entry of entries) {
					if (entry.isDirectory() || entry.isSymbolicLink()) {
						metadata.project[entry.name] = { type: "skill" }
					}
				}
			} catch {
				// Directory doesn't exist yet — that's fine.
			}
		}

		return metadata
	}
}
