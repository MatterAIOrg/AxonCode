import { execFile } from "node:child_process"
import * as fs from "node:fs"
import * as os from "node:os"
import * as path from "node:path"

import type { PluginMarketplaceItem } from "@roo-code/types"

export const OFFICIAL_PLUGIN_MARKETPLACE = "claude-plugins-official"
export const OFFICIAL_PLUGIN_REPOSITORY = "https://github.com/anthropics/claude-plugins-official.git"

const PLUGINS_DIR = path.join(".orb", "plugins")
const METADATA_FILE = ".orb-plugin.json"
const GIT_TIMEOUT_MS = 120_000

export interface PluginInventory {
	skills: number
	commands: number
	agents: number
	mcpServers: number
	hooks: number
}

export interface InstalledPluginMetadata {
	schemaVersion: 1
	name: string
	marketplace: string
	description?: string
	author?: string
	category?: string
	homepage?: string
	version?: string
	source: PluginMarketplaceItem["source"]
	strict?: boolean
	installedAt: string
	registeredMcpServers: string[]
	inventory: PluginInventory
}

interface GitSource {
	url: string
	revision: string
	subdir: string
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value)
}

function validatePluginName(name: string): void {
	if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(name)) {
		throw new Error(`Invalid plugin name "${name}".`)
	}
}

function resolveInside(root: string, relativePath: string): string {
	const resolvedRoot = path.resolve(root)
	const target = path.resolve(resolvedRoot, relativePath)
	if (target !== resolvedRoot && !target.startsWith(resolvedRoot + path.sep)) {
		throw new Error(`Plugin source path escapes its repository: ${relativePath}`)
	}
	return target
}

function resolveGitSource(source: PluginMarketplaceItem["source"]): GitSource {
	if (typeof source === "string") {
		return {
			url: OFFICIAL_PLUGIN_REPOSITORY,
			revision: "main",
			subdir: source.replace(/^\.\//, ""),
		}
	}

	if (source.source === "npm") {
		throw new Error("npm-packaged plugins are not supported yet.")
	}

	if (source.source === "github") {
		if (!source.repo || !/^[^/]+\/[^/]+$/.test(source.repo)) {
			throw new Error("Invalid GitHub plugin source.")
		}
		return {
			url: `https://github.com/${source.repo}.git`,
			revision: source.sha || source.commit || source.ref || "HEAD",
			subdir: source.path || "",
		}
	}

	if (!source.url) {
		throw new Error("Plugin source is missing its git URL.")
	}

	return {
		url: source.url,
		revision: source.sha || source.commit || source.ref || "HEAD",
		subdir: source.path || "",
	}
}

function runGit(args: string[]): Promise<void> {
	return new Promise((resolve, reject) => {
		execFile(
			"git",
			args,
			{
				timeout: GIT_TIMEOUT_MS,
				maxBuffer: 4 * 1024 * 1024,
				env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
			},
			(error, _stdout, stderr) => {
				if (!error) {
					resolve()
					return
				}
				const detail = String(stderr || error.message).trim()
				reject(new Error(detail || "git failed while downloading the plugin"))
			},
		)
	})
}

function isInside(root: string, target: string): boolean {
	const resolvedRoot = path.resolve(root)
	const resolvedTarget = path.resolve(target)
	return resolvedTarget === resolvedRoot || resolvedTarget.startsWith(resolvedRoot + path.sep)
}

function copyDereferenced(source: string, destination: string, allowedRoot: string, seen = new Set<string>()): void {
	const realSource = fs.realpathSync(source)
	if (!isInside(allowedRoot, realSource) || seen.has(realSource)) return
	const nextSeen = new Set(seen).add(realSource)
	const stat = fs.statSync(realSource)
	if (stat.isDirectory()) {
		fs.mkdirSync(destination, { recursive: true })
		for (const entry of fs.readdirSync(realSource)) {
			copyDereferenced(path.join(realSource, entry), path.join(destination, entry), allowedRoot, nextSeen)
		}
		return
	}
	if (!stat.isFile()) return
	fs.mkdirSync(path.dirname(destination), { recursive: true })
	fs.copyFileSync(realSource, destination)
	fs.chmodSync(destination, stat.mode)
}

function copyPluginTree(
	sourceRoot: string,
	destinationRoot: string,
	current = sourceRoot,
	allowedRoot = sourceRoot,
): void {
	fs.mkdirSync(destinationRoot, { recursive: true })
	for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
		if (entry.name === ".git") continue
		const sourcePath = path.join(current, entry.name)
		const relative = path.relative(sourceRoot, sourcePath)
		const destinationPath = path.join(destinationRoot, relative)
		const stat = fs.lstatSync(sourcePath)
		if (stat.isSymbolicLink()) {
			const link = fs.readlinkSync(sourcePath)
			const target = path.resolve(path.dirname(sourcePath), link)
			if (isInside(sourceRoot, target)) {
				fs.mkdirSync(path.dirname(destinationPath), { recursive: true })
				fs.symlinkSync(link, destinationPath)
			} else if (isInside(allowedRoot, target) && fs.existsSync(target)) {
				copyDereferenced(target, destinationPath, allowedRoot)
			}
			continue
		}
		if (stat.isDirectory()) {
			copyPluginTree(sourceRoot, destinationRoot, sourcePath, allowedRoot)
			continue
		}
		if (!stat.isFile()) continue
		fs.mkdirSync(path.dirname(destinationPath), { recursive: true })
		fs.copyFileSync(sourcePath, destinationPath)
		fs.chmodSync(destinationPath, stat.mode)
	}
}

function readJson(filePath: string): Record<string, unknown> | undefined {
	try {
		return JSON.parse(fs.readFileSync(filePath, "utf8")) as Record<string, unknown>
	} catch {
		return undefined
	}
}

function countFiles(dir: string, predicate: (name: string) => boolean): number {
	let count = 0
	let entries: fs.Dirent[]
	try {
		entries = fs.readdirSync(dir, { withFileTypes: true })
	} catch {
		return 0
	}
	for (const entry of entries) {
		const item = path.join(dir, entry.name)
		if (entry.isDirectory()) count += countFiles(item, predicate)
		else if (entry.isFile() && predicate(entry.name)) count++
	}
	return count
}

function replacePluginRoot(value: unknown, pluginDir: string): unknown {
	if (typeof value === "string") return value.replace(/\$\{CLAUDE_PLUGIN_ROOT\}/g, pluginDir)
	if (Array.isArray(value)) return value.map((entry) => replacePluginRoot(entry, pluginDir))
	if (!isPlainObject(value)) return value
	return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, replacePluginRoot(entry, pluginDir)]))
}

function addMcpCandidate(servers: Record<string, unknown>, candidate: unknown, pluginDir: string): void {
	if (typeof candidate === "string") {
		const configPath = resolveInside(pluginDir, candidate)
		const config = readJson(configPath)
		addMcpCandidate(servers, config?.mcpServers ?? config, pluginDir)
		return
	}
	if (!isPlainObject(candidate)) return
	const unwrapped = isPlainObject(candidate.mcpServers) ? candidate.mcpServers : candidate
	for (const [name, config] of Object.entries(unwrapped)) {
		if (isPlainObject(config)) servers[name] = replacePluginRoot(config, pluginDir)
	}
}

function collectMcpServers(item: PluginMarketplaceItem, pluginDir: string): Record<string, unknown> {
	const servers: Record<string, unknown> = {}
	const manifest = readJson(path.join(pluginDir, ".claude-plugin", "plugin.json"))
	const mcpFile = readJson(path.join(pluginDir, ".mcp.json"))
	addMcpCandidate(servers, item.mcpServers, pluginDir)
	addMcpCandidate(servers, manifest?.mcpServers, pluginDir)
	addMcpCandidate(servers, mcpFile?.mcpServers ?? mcpFile, pluginDir)
	return servers
}

function inspectPlugin(pluginDir: string, mcpServerCount: number): PluginInventory {
	return {
		skills:
			countFiles(path.join(pluginDir, "skills"), (name) => name === "SKILL.md") +
			(fs.existsSync(path.join(pluginDir, "SKILL.md")) ? 1 : 0),
		commands: countFiles(path.join(pluginDir, "commands"), (name) => name.toLowerCase().endsWith(".md")),
		agents: countFiles(path.join(pluginDir, "agents"), (name) => name.toLowerCase().endsWith(".md")),
		mcpServers: mcpServerCount,
		hooks: fs.existsSync(path.join(pluginDir, "hooks", "hooks.json")) ? 1 : 0,
	}
}

function readInstalledMetadata(pluginDir: string): InstalledPluginMetadata | undefined {
	return readJson(path.join(pluginDir, METADATA_FILE)) as InstalledPluginMetadata | undefined
}

function updateProjectMcpConfig(
	workspacePath: string,
	pluginName: string,
	servers: Record<string, unknown>,
	previousServerNames: string[],
): string[] {
	const configPath = path.join(workspacePath, ".orbital", "mcp.json")
	let config: Record<string, unknown> = { mcpServers: {} }
	if (fs.existsSync(configPath)) {
		try {
			config = JSON.parse(fs.readFileSync(configPath, "utf8")) as Record<string, unknown>
		} catch {
			throw new Error("Cannot install plugin: .orbital/mcp.json contains invalid JSON.")
		}
	}
	const configuredServers = isPlainObject(config.mcpServers) ? { ...config.mcpServers } : {}
	for (const oldName of previousServerNames) delete configuredServers[oldName]

	const registeredNames: string[] = []
	for (const [name, serverConfig] of Object.entries(servers)) {
		const registeredName = `${pluginName}:${name}`
		configuredServers[registeredName] = serverConfig
		registeredNames.push(registeredName)
	}

	if (registeredNames.length === 0 && previousServerNames.length === 0) return []
	config.mcpServers = configuredServers
	fs.mkdirSync(path.dirname(configPath), { recursive: true })
	fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n", "utf8")
	return registeredNames
}

export async function installPlugin(item: PluginMarketplaceItem, workspacePath: string): Promise<string> {
	validatePluginName(item.id)
	const source = resolveGitSource(item.source)
	const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "orbital-plugin-"))
	const checkout = path.join(tempRoot, "repo")
	const pluginsDir = path.join(workspacePath, PLUGINS_DIR)
	const staging = path.join(pluginsDir, `.${item.id}.install-${process.pid}-${Date.now()}`)
	const destination = path.join(pluginsDir, item.id)
	const backup = path.join(pluginsDir, `.${item.id}.backup-${process.pid}-${Date.now()}`)
	const previousMetadata = readInstalledMetadata(destination)

	try {
		await runGit(["init", "--quiet", checkout])
		await runGit(["-C", checkout, "remote", "add", "origin", source.url])
		await runGit(["-C", checkout, "fetch", "--quiet", "--depth", "1", "origin", source.revision])
		await runGit(["-C", checkout, "checkout", "--quiet", "--detach", "FETCH_HEAD"])

		const pluginRoot = resolveInside(checkout, source.subdir)
		if (!fs.existsSync(pluginRoot) || !fs.statSync(pluginRoot).isDirectory()) {
			throw new Error(`Plugin source directory was not found: ${source.subdir || "."}`)
		}

		fs.mkdirSync(pluginsDir, { recursive: true })
		copyPluginTree(pluginRoot, staging, pluginRoot, checkout)
		if (fs.existsSync(destination)) fs.renameSync(destination, backup)
		try {
			fs.renameSync(staging, destination)
			const servers = collectMcpServers(item, destination)
			const registeredMcpServers = updateProjectMcpConfig(
				workspacePath,
				item.id,
				servers,
				previousMetadata?.registeredMcpServers ?? [],
			)
			const metadata: InstalledPluginMetadata = {
				schemaVersion: 1,
				name: item.id,
				marketplace: item.marketplace,
				description: item.description,
				author: item.author,
				category: item.category,
				homepage: item.homepage,
				version: item.version,
				source: item.source,
				strict: item.strict,
				installedAt: new Date().toISOString(),
				registeredMcpServers,
				inventory: inspectPlugin(destination, registeredMcpServers.length),
			}
			fs.writeFileSync(path.join(destination, METADATA_FILE), JSON.stringify(metadata, null, "\t") + "\n")
		} catch (error) {
			fs.rmSync(destination, { recursive: true, force: true })
			if (fs.existsSync(backup)) fs.renameSync(backup, destination)
			throw error
		}
		fs.rmSync(backup, { recursive: true, force: true })
		return destination
	} finally {
		fs.rmSync(staging, { recursive: true, force: true })
		fs.rmSync(tempRoot, { recursive: true, force: true })
	}
}

export function uninstallPlugin(pluginName: string, workspacePath: string): void {
	validatePluginName(pluginName)
	const pluginDir = path.join(workspacePath, PLUGINS_DIR, pluginName)
	const metadata = readInstalledMetadata(pluginDir)
	updateProjectMcpConfig(workspacePath, pluginName, {}, metadata?.registeredMcpServers ?? [])
	fs.rmSync(pluginDir, { recursive: true, force: true })
}

export function getInstalledPluginMetadata(
	workspacePath: string,
): Record<string, { type: string; inventory?: PluginInventory }> {
	const pluginsDir = path.join(workspacePath, PLUGINS_DIR)
	const result: Record<string, { type: string; inventory?: PluginInventory }> = {}
	let entries: fs.Dirent[]
	try {
		entries = fs.readdirSync(pluginsDir, { withFileTypes: true })
	} catch {
		return result
	}
	for (const entry of entries) {
		if ((!entry.isDirectory() && !entry.isSymbolicLink()) || entry.name.startsWith(".")) continue
		const pluginDir = path.join(pluginsDir, entry.name)
		const metadata = readInstalledMetadata(pluginDir)
		result[entry.name] = {
			type: "plugin",
			inventory: metadata?.inventory ?? inspectPlugin(pluginDir, metadata?.registeredMcpServers.length ?? 0),
		}
	}
	return result
}
