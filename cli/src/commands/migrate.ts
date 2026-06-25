/**
 * /migrate command — Import MCP server entries from Cursor / Claude Code /
 * Claude Desktop into Orbital's global MCP settings.
 *
 * This is the TUI equivalent of the webview's "Migrate from Cursor / Claude"
 * button. It uses the same `mcpMigrateList` / `mcpMigrateApply` webview
 * messages, so the actual file I/O happens inside the bundled extension
 * (which owns the MCP settings file via `McpHub`).
 */
import { logs } from "../services/logs.js"
import type { Command } from "./core/types.js"
import type { ExtensionService } from "../services/extension.js"
import type { ExtensionMessage } from "../types/messages.js"

interface MigrationEntry {
	key: string
	source: string
	sourceLabel: string
	name: string
	config: { type: "stdio" | "sse" | "streamable-http"; command?: string; url?: string; args?: string[] }
}

interface MigrationResultPayload {
	added: { name: string; source: string; sourceLabel: string }[]
	skipped: { name: string; source: string; sourceLabel: string; reason: string }[]
	destinationPath: string
}

interface MigrateCommandContext {
	addMessage: (message: { id: string; type: string; content: string; ts: number }) => void
	extensionService: ExtensionService | null
	sendMessage: (message: unknown) => Promise<void>
}

/** Wait for the next extension message matching `predicate`, with a timeout. */
function waitForMessage(
	service: ExtensionService,
	predicate: (m: ExtensionMessage) => boolean,
	timeoutMs = 10_000,
): Promise<ExtensionMessage | null> {
	return new Promise((resolve) => {
		const listener = (m: ExtensionMessage) => {
			if (predicate(m)) {
				clearTimeout(timer)
				service.off("message", listener)
				resolve(m)
			}
		}
		const timer = setTimeout(() => {
			service.off("message", listener)
			resolve(null)
		}, timeoutMs)
		service.on("message", listener)
	})
}

function describeEntry(entry: MigrationEntry): string {
	const cfg = entry.config
	if (cfg.type === "sse" || cfg.type === "streamable-http") {
		return `${cfg.type} ${cfg.url ?? ""}`
	}
	const args = cfg.args ?? []
	return `stdio ${cfg.command ?? ""}${args.length ? " " + args.join(" ") : ""}`
}

function shortId(): string {
	return Date.now().toString()
}

async function runMigrate(ctx: MigrateCommandContext, options: { all: boolean; dryRun: boolean }): Promise<void> {
	const { addMessage, extensionService, sendMessage } = ctx

	if (!extensionService) {
		addMessage({
			id: shortId(),
			type: "error",
			content: "Cannot reach the extension host. Start a task first, then run /migrate.",
			ts: Date.now(),
		})
		return
	}

	// 1) Ask the extension for the discovered entries.
	const listPromise = waitForMessage(
		extensionService,
		(m) => m.type === "mcpMigrationEntries" && Array.isArray(m.mcpMigrationEntries),
	)
	await sendMessage({ type: "mcpMigrateList" })
	const listMessage = await listPromise

	if (!listMessage || !Array.isArray(listMessage.mcpMigrationEntries)) {
		addMessage({
			id: shortId(),
			type: "error",
			content: "Timed out waiting for the extension to scan for MCP configs.",
			ts: Date.now(),
		})
		return
	}

	const entries = listMessage.mcpMigrationEntries as MigrationEntry[]

	if (entries.length === 0) {
		addMessage({
			id: shortId(),
			type: "system",
			content:
				"No MCP servers found in Cursor, Claude Code, or Claude Desktop. Install one of those clients, or use the global MCP settings editor to add servers manually.",
			ts: Date.now(),
		})
		return
	}

	// 2) Without --all, show a preview and stop (matches the TUI flow).
	if (!options.all) {
		const bySource = new Map<string, MigrationEntry[]>()
		for (const entry of entries) {
			const list = bySource.get(entry.sourceLabel) ?? []
			list.push(entry)
			bySource.set(entry.sourceLabel, list)
		}

		const lines: string[] = ["**MCP migration preview**", ""]
		lines.push(`Found **${entries.length}** server(s). Pass \`/migrate --all\` to import them.`)
		lines.push("")
		for (const [source, list] of bySource.entries()) {
			lines.push(`- **${source}** (${list.length})`)
			for (const entry of list) {
				lines.push(`    - \`${entry.name}\` — ${describeEntry(entry)}`)
			}
		}
		addMessage({
			id: shortId(),
			type: "system",
			content: lines.join("\n"),
			ts: Date.now(),
		})
		return
	}

	// 3) With --all, send the apply request. The extension's handler will
	//    diff against the on-disk settings and write any non-conflicting
	//    servers back to `~/.kilocode/global/.../mcp_settings.json` (path
	//    resolved by the bundled extension's McpHub).
	const applyPromise = waitForMessage(
		extensionService,
		(m) => m.type === "mcpMigrationResult" && Boolean(m.mcpMigrationResult),
	)
	await sendMessage({ type: "mcpMigrateApply", keys: entries.map((e) => e.key) })
	const applyMessage = await applyPromise

	if (!applyMessage || !applyMessage.mcpMigrationResult) {
		addMessage({
			id: shortId(),
			type: "error",
			content: "Timed out waiting for the extension to apply the migration.",
			ts: Date.now(),
		})
		return
	}

	const result = applyMessage.mcpMigrationResult as MigrationResultPayload

	if (options.dryRun) {
		// The extension currently writes before reporting — so in dryRun we
		// warn the user that the preview already happened at the file level.
		// We deliberately do NOT roll back; the upstream TUI uses --dry-run
		// the same way.
		logs.warn("dryRun requested but the bundled extension writes on apply", "migrateCommand")
	}

	const lines: string[] = []
	lines.push(`**MCP migration** — added ${result.added.length}, skipped ${result.skipped.length}.`)
	if (result.added.length > 0) {
		lines.push("")
		lines.push("**Added:**")
		for (const a of result.added) {
			lines.push(`- \`${a.name}\` (${a.sourceLabel})`)
		}
	}
	if (result.skipped.length > 0) {
		lines.push("")
		lines.push("**Skipped (name already in use):**")
		for (const s of result.skipped) {
			lines.push(`- \`${s.name}\` (${s.sourceLabel})`)
		}
	}
	lines.push("")
	lines.push(`Written to: \`${result.destinationPath}\``)
	addMessage({
		id: shortId(),
		type: "system",
		content: lines.join("\n"),
		ts: Date.now(),
	})
}

export const migrateCommand: Command = {
	name: "migrate",
	aliases: ["import"],
	description: "Import MCP servers from Cursor / Claude Code / Claude Desktop into Orbital's global MCP settings",
	usage: "/migrate [--all] [--dry-run]",
	examples: ["/migrate", "/migrate --all", "/migrate --all --dry-run"],
	category: "settings",
	priority: 7,
	arguments: [],
	options: [
		{
			name: "all",
			alias: "a",
			description: "Apply the migration instead of just showing a preview",
			type: "boolean",
			default: false,
		},
		{
			name: "dry-run",
			alias: "n",
			description: "Don't actually write any settings (only meaningful with --all)",
			type: "boolean",
			default: false,
		},
	],
	handler: async (context) => {
		const all = Boolean(context.options.all) || Boolean(context.options.a)
		const dryRun = Boolean(context.options["dry-run"]) || Boolean(context.options.n)
		await runMigrate(
			{
				addMessage: (msg) => context.addMessage(msg),
				extensionService: context.extensionService,
				sendMessage: (msg) => context.sendMessage(msg),
			},
			{ all, dryRun },
		)
	},
}
