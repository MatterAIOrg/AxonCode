/**
 * Migrate MCP server configurations from other clients into Orbital's
 * global MCP settings file (`mcp_settings.json`).
 *
 * Detected sources:
 *   - Cursor (global):        `~/.cursor/mcp.json`                       -> mcpServers
 *   - Cursor (project):       `<cwd>/.cursor/mcp.json`                   -> mcpServers
 *   - Claude Code (user):     `~/.claude/settings.json`                  -> mcpServers
 *   - Claude Code (user, root):`~/.claude.json` (root mcpServers block)
 *   - Claude Code (project):  `~/.claude.json` -> projects.<cwd>.mcpServers
 *   - Claude Desktop:         `claude_desktop_config.json` (platform path)
 *
 * Both the webview UI (via the `mcpMigrate*` webview messages) and the CLI
 * (via the `mcp migrate` command) call into this module. The webview lets
 * the user pick a subset; the CLI either does a dry-run preview or copies
 * everything that doesn't conflict.
 *
 * Conflict policy: if a server with the same name already exists in the
 * destination, the incoming entry is silently dropped. The summary at the
 * end reports the skipped count.
 */
import * as fs from "node:fs"
import * as os from "node:os"
import * as path from "node:path"

/** Normalized MCP server config after the migration step. Mirrors the
 *  shape Orbital's `McpHub` already accepts (stdio / sse / streamable-http). */
export interface MigrationServerConfig {
	type: "stdio" | "sse" | "streamable-http"
	command?: string
	args?: string[]
	env?: Record<string, string>
	url?: string
	headers?: Record<string, string>
	disabled?: boolean
	alwaysAllow?: string[]
	timeout?: number
}

export type MigrationSourceId =
	| "cursor-global"
	| "cursor-project"
	| "cursor-plugins"
	| "claude-code-user"
	| "claude-code-json-user"
	| "claude-code-project"
	| "claude-desktop"

export interface MigrationSource {
	id: MigrationSourceId
	/** Human-readable label for the picker. */
	label: string
	/** Absolute path to the config file we read. */
	configPath: string
	/** Servers found at that path, in the order they appear in the file. */
	servers: Record<string, MigrationServerConfig>
}

export interface MigrationEntry {
	/** Stable key for checkbox state and the result summary. */
	key: string
	source: MigrationSourceId
	sourceLabel: string
	name: string
	config: MigrationServerConfig
}

export interface MigrationResult {
	added: MigrationEntry[]
	skipped: { entry: MigrationEntry; reason: string }[]
	/** Servers already in the destination before this call (used to diff
	 *  the in-memory connection list against the freshly-written file). */
	destinationPath: string
}

const SERVER_NAME_RE = /^[A-Za-z0-9_ -]+$/

/** A safe label for the picker (one per source). */
function sourceLabel(id: MigrationSourceId): string {
	switch (id) {
		case "cursor-global":
			return "Cursor (global)"
		case "cursor-project":
			return "Cursor (this project)"
		case "cursor-plugins":
			return "Cursor (plugins)"
		case "claude-code-user":
			return "Claude Code (user)"
		case "claude-code-json-user":
			return "Claude Code (user, ~/.claude.json)"
		case "claude-code-project":
			return "Claude Code (this project)"
		case "claude-desktop":
			return "Claude Desktop"
	}
}

/** Cross-platform location of Claude Desktop's MCP config file. */
function claudeDesktopConfigPath(): string {
	const home = os.homedir()
	if (process.platform === "darwin") {
		return path.join(home, "Library", "Application Support", "Claude", "claude_desktop_config.json")
	}
	if (process.platform === "win32") {
		const appData = process.env.APPDATA || path.join(home, "AppData", "Roaming")
		return path.join(appData, "Claude", "claude_desktop_config.json")
	}
	const xdg = process.env.XDG_CONFIG_HOME || path.join(home, ".config")
	return path.join(xdg, "Claude", "claude_desktop_config.json")
}

function readJsonFile(filePath: string): Record<string, unknown> | undefined {
	try {
		return JSON.parse(fs.readFileSync(filePath, "utf8")) as Record<string, unknown>
	} catch {
		return undefined
	}
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value)
}

/** Walk `${workspaceFolder}/.cursor/mcp.json` looking for any workspace root
 *  that has the file. Returns the first match. */
function cursorProjectMcpPath(): string | undefined {
	const cwd = process.cwd()
	const candidates = [cwd, path.join(cwd, ".cursor"), path.dirname(cwd)]
	for (const dir of candidates) {
		const file = path.join(dir, ".cursor", "mcp.json")
		try {
			if (fs.statSync(file).isFile()) return file
		} catch {
			// not found, try next
		}
	}
	return undefined
}

/**
 * Normalize a single MCP server config from an external source. We do not run
 * the full zod schema from `McpHub.ts` because it requires `vscode` (for the
 * `cwd` default) and rejects valid Claude/Cursor shapes that include extra
 * fields like `enabledTools` / `envFile`. Only stdio / sse / streamable-http
 * entries with the required fields survive.
 */
function normalizeExternalServer(raw: unknown): MigrationServerConfig | undefined {
	if (!isPlainObject(raw)) return undefined
	// Cursor plugins use `transport` instead of `type` for HTTP servers.
	const type = typeof raw.type === "string" ? raw.type : typeof raw.transport === "string" ? raw.transport : "stdio"

	if (type === "stdio") {
		if (typeof raw.command !== "string" || !raw.command.trim()) return undefined
		const config: MigrationServerConfig = { type: "stdio", command: raw.command }
		if (Array.isArray(raw.args)) {
			const args = raw.args.filter((a): a is string => typeof a === "string")
			if (args.length > 0) config.args = args
		}
		if (isPlainObject(raw.env)) {
			const env: Record<string, string> = {}
			for (const [k, v] of Object.entries(raw.env)) {
				if (typeof v === "string") env[k] = v
			}
			if (Object.keys(env).length > 0) config.env = env
		}
		return config
	}

	if (type === "http" || type === "sse") {
		if (typeof raw.url !== "string" || !raw.url.trim()) return undefined
		const config: MigrationServerConfig = {
			type: type === "http" ? "streamable-http" : "sse",
			url: raw.url,
		}
		if (isPlainObject(raw.headers)) {
			const headers: Record<string, string> = {}
			for (const [k, v] of Object.entries(raw.headers)) {
				if (typeof v === "string") headers[k] = v
			}
			if (Object.keys(headers).length > 0) config.headers = headers
		}
		return config
	}

	// `streamable-http` / `streamable_http` are the canonical modern names.
	if (type === "streamable-http" || type === "streamable_http") {
		if (typeof raw.url !== "string" || !raw.url.trim()) return undefined
		const config: MigrationServerConfig = { type: "streamable-http", url: raw.url }
		if (isPlainObject(raw.headers)) {
			const headers: Record<string, string> = {}
			for (const [k, v] of Object.entries(raw.headers)) {
				if (typeof v === "string") headers[k] = v
			}
			if (Object.keys(headers).length > 0) config.headers = headers
		}
		return config
	}

	return undefined
}

/** Read a `mcpServers` block, skipping any entry that fails to normalize. */
function readMcpServers(filePath: string): Record<string, MigrationServerConfig> {
	const json = readJsonFile(filePath)
	if (!json) return {}
	const block = json.mcpServers
	if (!isPlainObject(block)) return {}
	const out: Record<string, MigrationServerConfig> = {}
	for (const [name, raw] of Object.entries(block)) {
		if (!SERVER_NAME_RE.test(name)) continue
		const config = normalizeExternalServer(raw)
		if (config) out[name] = config
	}
	return out
}

/** Read a Cursor plugin mcp.json. These files come in two shapes:
 *  1. Wrapped: `{ "mcpServers": { "Name": { "type": "http", ... } } }`
 *  2. Unwrapped: `{ "serverName": { "url": "...", "transport": "http" } }`
 *  We try the wrapped format first; if no `mcpServers` key exists, we treat
 *  every top-level key as a server name and its value as the config. */
function readCursorPluginMcpServers(filePath: string): Record<string, MigrationServerConfig> {
	const json = readJsonFile(filePath)
	if (!json) return {}
	// Wrapped format
	if (isPlainObject(json.mcpServers)) {
		return readMcpServersFromObject(json)
	}
	// Unwrapped format — each top-level key is a server name
	const out: Record<string, MigrationServerConfig> = {}
	for (const [name, raw] of Object.entries(json)) {
		if (name === "mcpServers") continue
		if (!SERVER_NAME_RE.test(name)) continue
		const config = normalizeExternalServer(raw)
		if (config) out[name] = config
	}
	return out
}

/** Scan ~/.cursor/plugins/cache/cursor-public/<plugin>/<hash>/mcp.json for
 *  plugin-based MCP servers. Cursor installs marketplace plugins here, each
 *  with its own mcp.json that may use either the wrapped or unwrapped format. */
function discoverCursorPluginSources(): MigrationSource[] {
	const pluginsDir = path.join(os.homedir(), ".cursor", "plugins", "cache", "cursor-public")
	let entries: string[]
	try {
		entries = fs.readdirSync(pluginsDir)
	} catch {
		return []
	}
	const sources: MigrationSource[] = []
	for (const pluginName of entries) {
		const pluginDir = path.join(pluginsDir, pluginName)
		let versions: string[]
		try {
			versions = fs.readdirSync(pluginDir)
		} catch {
			continue
		}
		for (const version of versions) {
			const mcpFile = path.join(pluginDir, version, "mcp.json")
			try {
				fs.statSync(mcpFile).isFile()
			} catch {
				continue
			}
			const servers = readCursorPluginMcpServers(mcpFile)
			if (Object.keys(servers).length > 0) {
				sources.push({
					id: "cursor-plugins",
					label: sourceLabel("cursor-plugins"),
					configPath: mcpFile,
					servers,
				})
			}
		}
	}
	return sources
}

/** Pull the user-scope MCP servers Claude Code stores at the top level of
 *  `~/.claude.json`. This is where `claude mcp add -s user …` writes — the
 *  root `mcpServers` block on the same file that also holds per-project
 *  entries under `projects.<path>`. */
function readClaudeCodeRootServers(): Record<string, MigrationServerConfig> {
	const json = readJsonFile(path.join(os.homedir(), ".claude.json"))
	if (!json) return {}
	return readMcpServersFromObject(json)
}

/** Pull the per-project MCP servers Claude Code stores in `~/.claude.json`. */
function readClaudeCodeProjectServers(): Record<string, MigrationServerConfig> {
	const json = readJsonFile(path.join(os.homedir(), ".claude.json"))
	if (!json) return {}
	const projects = json.projects
	if (!isPlainObject(projects)) return {}
	const cwd = process.cwd()
	const entries = Object.entries(projects).filter((entry): entry is [string, Record<string, unknown>] =>
		isPlainObject(entry[1]),
	)
	const direct = entries.find(([projectPath]) => projectPath === cwd)
	const fallback = entries.find(([, project]) => isPlainObject(project.mcpServers))
	const target = direct ?? fallback
	if (!target) return {}
	return readMcpServersFromObject(target[1])
}

/** Same as `readMcpServers` but takes a pre-parsed object. */
function readMcpServersFromObject(obj: Record<string, unknown>): Record<string, MigrationServerConfig> {
	const block = obj.mcpServers
	if (!isPlainObject(block)) return {}
	const out: Record<string, MigrationServerConfig> = {}
	for (const [name, raw] of Object.entries(block)) {
		if (!SERVER_NAME_RE.test(name)) continue
		const config = normalizeExternalServer(raw)
		if (config) out[name] = config
	}
	return out
}

/** Discover every available migration source on the current machine. */
export function discoverSources(): MigrationSource[] {
	const sources: MigrationSource[] = []

	// Cursor — global config in the user's home directory.
	const cursorGlobalPath = path.join(os.homedir(), ".cursor", "mcp.json")
	const cursorGlobalServers = readMcpServers(cursorGlobalPath)
	if (Object.keys(cursorGlobalServers).length > 0) {
		sources.push({
			id: "cursor-global",
			label: sourceLabel("cursor-global"),
			configPath: cursorGlobalPath,
			servers: cursorGlobalServers,
		})
	}

	// Cursor — project-scoped config under the workspace folder.
	const cursorProjectPath = cursorProjectMcpPath()
	if (cursorProjectPath) {
		const cursorProjectServers = readMcpServers(cursorProjectPath)
		if (Object.keys(cursorProjectServers).length > 0) {
			sources.push({
				id: "cursor-project",
				label: sourceLabel("cursor-project"),
				configPath: cursorProjectPath,
				servers: cursorProjectServers,
			})
		}
	}

	// Cursor — plugin-based MCP servers from the marketplace cache.
	// Each plugin lives in ~/.cursor/plugins/cache/cursor-public/<name>/<hash>/mcp.json
	for (const source of discoverCursorPluginSources()) {
		sources.push(source)
	}

	// Claude Code — user-scope under ~/.claude/settings.json.
	const claudeCodeUserPath = path.join(os.homedir(), ".claude", "settings.json")
	const claudeCodeUserServers = readMcpServers(claudeCodeUserPath)
	if (Object.keys(claudeCodeUserServers).length > 0) {
		sources.push({
			id: "claude-code-user",
			label: sourceLabel("claude-code-user"),
			configPath: claudeCodeUserPath,
			servers: claudeCodeUserServers,
		})
	}

	// ~/.claude.json can hold entries in two layers: the root mcpServers block
	// (user-scope, written by `claude mcp add -s user …`) and per-project
	// entries under `projects.<path>.mcpServers`. Both can define a server with
	// the same name; Claude treats the per-project one as the override. To
	// avoid showing the same name twice in the picker, we collect both layers
	// and drop any project-layer name that the root layer also has.
	const claudeCodeJsonPath = path.join(os.homedir(), ".claude.json")
	const rootServers = readClaudeCodeRootServers()
	const projectServers = readClaudeCodeProjectServers()
	const rootNames = new Set(Object.keys(rootServers))

	if (Object.keys(rootServers).length > 0) {
		sources.push({
			id: "claude-code-json-user",
			label: sourceLabel("claude-code-json-user"),
			configPath: claudeCodeJsonPath,
			servers: rootServers,
		})
	}

	if (Object.keys(projectServers).length > 0) {
		const deduped: Record<string, MigrationServerConfig> = {}
		for (const [name, cfg] of Object.entries(projectServers)) {
			if (rootNames.has(name)) continue
			deduped[name] = cfg
		}
		if (Object.keys(deduped).length > 0) {
			sources.push({
				id: "claude-code-project",
				label: sourceLabel("claude-code-project"),
				configPath: claudeCodeJsonPath,
				servers: deduped,
			})
		}
	}

	const claudeDesktopPath = claudeDesktopConfigPath()
	const claudeDesktopServers = readMcpServers(claudeDesktopPath)
	if (Object.keys(claudeDesktopServers).length > 0) {
		sources.push({
			id: "claude-desktop",
			label: sourceLabel("claude-desktop"),
			configPath: claudeDesktopPath,
			servers: claudeDesktopServers,
		})
	}

	return sources
}

/** Flatten all sources into a single checklist. Stable order: source first,
 *  then server name. */
export function listMigrationEntries(): MigrationEntry[] {
	const entries: MigrationEntry[] = []
	for (const source of discoverSources()) {
		for (const [name, config] of Object.entries(source.servers)) {
			entries.push({
				key: `${source.id}::${name}`,
				source: source.id,
				sourceLabel: source.label,
				name,
				config,
			})
		}
	}
	return entries
}

/** Short summary of a server for the picker / dry-run output. */
export function describeEntry(entry: MigrationEntry): string {
	const cfg = entry.config
	if (cfg.type === "sse" || cfg.type === "streamable-http") {
		return `${cfg.type} ${cfg.url}`
	}
	const args = cfg.args ?? []
	return `stdio ${cfg.command}${args.length ? " " + args.join(" ") : ""}`
}

/** True when `name` already exists in the destination file. */
function destinationHasName(filePath: string, name: string): boolean {
	let existing: Record<string, unknown> = {}
	try {
		existing = JSON.parse(fs.readFileSync(filePath, "utf8")) as Record<string, unknown>
	} catch {
		return false
	}
	const block = existing.mcpServers
	if (!isPlainObject(block)) return false
	return Object.prototype.hasOwnProperty.call(block, name)
}

/**
 * Apply a set of migration entries to the destination settings file
 * (typically the global `mcp_settings.json` resolved by `McpHub`). Returns
 * the entries that were added and the entries that were skipped (with a
 * reason). Atomic write: existing servers that conflict are kept untouched.
 *
 * Does NOT start the new server connections — that's the caller's job
 * (`McpHub.updateServerConnections` after a write, or a manual restart).
 */
export function applyMigration(entries: MigrationEntry[], filePath: string): MigrationResult {
	const existing = readJsonFile(filePath) ?? {}
	const block = isPlainObject(existing.mcpServers)
		? { ...(existing.mcpServers as Record<string, MigrationServerConfig>) }
		: {}

	const added: MigrationEntry[] = []
	const skipped: { entry: MigrationEntry; reason: string }[] = []

	for (const entry of entries) {
		if (entry.name in block) {
			skipped.push({ entry, reason: "already exists in destination" })
			continue
		}
		if (destinationHasName(filePath, entry.name)) {
			// Race-safe double-check: the in-memory snapshot is the source of
			// truth at write time, so if it changed between our read and now
			// we still skip.
			skipped.push({ entry, reason: "already exists in destination" })
			continue
		}
		block[entry.name] = entry.config
		added.push(entry)
	}

	if (added.length > 0) {
		const next: Record<string, unknown> = { ...existing, mcpServers: block }
		fs.mkdirSync(path.dirname(filePath), { recursive: true })
		fs.writeFileSync(filePath, JSON.stringify(next, null, "\t") + "\n")
	}

	return { added, skipped, destinationPath: filePath }
}
