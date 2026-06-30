import fs from "fs/promises"
import os from "os"
import path from "path"

/**
 * Linked repositories.
 *
 * The `/link` command points this repo at other repos on the user's machine
 * that are coupled to it. Links are persisted per-project in `.orb/links.json`
 * — the same file the OrbCode CLI uses — and injected into the agent's
 * environment details so a change here can be checked for impact on, or
 * propagated to, the linked repos.
 *
 * The schema is intentionally tolerant: each entry needs only an `input` (the
 * folder path the user entered); `path` is an optional pre-resolved absolute
 * path. Resolution happens here at read time, so links written by either tool
 * work.
 */

export interface LinkedRepo {
	/** The folder path the user entered (absolute, `~/path`, or relative). */
	input: string
	/** Optional pre-resolved absolute path (the CLI writes this; agents may omit it). */
	path?: string
}

const MAX_AGENTS_CHARS = 4000
const MAX_LINKED_REPOS = 8
/** Where a linked repo's AGENTS.md might live, in precedence order. */
const AGENTS_LOCATIONS = [
	path.join(".orb", "AGENTS.md"),
	path.join(".orbital", "AGENTS.md"),
	path.join(".orbcode", "AGENTS.md"),
	"AGENTS.md",
]

/**
 * The repo-level OrbCode directory for shared, tool-neutral data like AGENTS.md
 * and links.json — always `.orb`. This is the folder the extension and the CLI
 * both read/write, so they stay in sync.
 */
export function resolveProjectDir(cwd: string): string {
	return path.join(cwd, ".orb")
}

export function linksFilePath(cwd: string): string {
	return path.join(resolveProjectDir(cwd), "links.json")
}

async function isDir(p: string): Promise<boolean> {
	try {
		return (await fs.stat(p)).isDirectory()
	} catch {
		return false
	}
}

/**
 * Turn the folder path the user entered — absolute, `~/path`, or relative to
 * cwd — into an absolute filesystem path. Returns undefined for empty input.
 */
export function resolveLinkTarget(input: string): string | undefined {
	let value = input.trim()
	if (!value) return undefined
	if (value.startsWith("~/")) value = path.join(os.homedir(), value.slice(2))
	return path.resolve(value)
}

/** Read the linked repos for a project (empty array if none / unreadable). */
export async function loadLinks(cwd: string): Promise<LinkedRepo[]> {
	try {
		const parsed = JSON.parse(await fs.readFile(linksFilePath(cwd), "utf8"))
		if (!Array.isArray(parsed?.links)) return []
		return parsed.links
			.filter((l: unknown): l is Partial<LinkedRepo> => {
				const v = l as Partial<LinkedRepo>
				return !!v && (typeof v.input === "string" || typeof v.path === "string")
			})
			.map((l: Partial<LinkedRepo>) => ({
				input: typeof l.input === "string" ? l.input : (l.path as string),
				path: typeof l.path === "string" ? l.path : undefined,
			}))
	} catch {
		return []
	}
}

/** First AGENTS.md found inside a linked repo, or undefined. */
async function readLinkedAgents(repo: string): Promise<string | undefined> {
	for (const rel of AGENTS_LOCATIONS) {
		try {
			const text = await fs.readFile(path.join(repo, rel), "utf8")
			if (text.trim()) return text
		} catch {
			// try the next location
		}
	}
	return undefined
}

function truncate(text: string, max: number): string {
	return text.length <= max ? text : text.slice(0, max) + "\n… (truncated)"
}

/**
 * Render the linked-repos block for the agent's environment details. Returns ""
 * when nothing is linked. Each repo's AGENTS.md is pulled in (when present) so
 * the model knows the linked codebase without exploring it first.
 */
export async function renderLinkedReposSection(cwd: string): Promise<string> {
	const links = (await loadLinks(cwd)).slice(0, MAX_LINKED_REPOS)
	if (links.length === 0) return ""

	const parts: string[] = [
		"## Linked Repositories",
		"",
		"This repository is linked to the repositories below — separate codebases on disk that are coupled to this one. When you change this repo, consider whether the change ripples into a linked repo: inspect the linked code for impact and, when relevant, propose (or make, if the user asks) the matching changes there. You can read and edit files in these repos directly by their absolute paths.",
		"",
	]
	for (const link of links) {
		const resolved = link.path && (await isDir(link.path)) ? link.path : resolveLinkTarget(link.input)
		if (!resolved) continue
		const exists = await isDir(resolved)
		parts.push(`### ${path.basename(resolved)} — \`${resolved}\`${exists ? "" : "  (path not found)"}`)
		if (!exists) {
			parts.push("")
			continue
		}
		const agents = await readLinkedAgents(resolved)
		parts.push("")
		if (agents) {
			parts.push("Its AGENTS.md:")
			parts.push("")
			parts.push(truncate(agents.trim(), MAX_AGENTS_CHARS))
		} else {
			parts.push("(no AGENTS.md found — explore the repo directly if you need its structure)")
		}
		parts.push("")
	}
	return parts.join("\n")
}
