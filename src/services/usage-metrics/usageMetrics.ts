import { execFileSync } from "child_process"
import { randomUUID } from "crypto"
import * as path from "path"
import * as vscode from "vscode"

import { getKiloUrlFromToken } from "@roo-code/types"

import { Package } from "../../shared/package"
import { X_AXON_REPO, X_CLIENT_USER_AGENT, X_DEVICE_OS, X_KILOCODE_VERSION } from "../../shared/kilocode/headers"
import { getGitRepositoryInfo } from "../../utils/git"

export interface UsageEvent {
	eventId?: string
	eventType: "user_message" | "committed_code" | "client_heartbeat"
	taskId?: string
	model?: string
	repo?: string
	linesAdded?: number
	linesModified?: number
	linesDeleted?: number
	commitHash?: string
	timestamp?: string
}

export interface AcceptedLineMetrics {
	taskId: string
	model?: string
	repo: string
	language: string
	linesAdded: number
	linesModified: number
	linesDeleted: number
}

export interface GitCommitMetrics {
	hash: string
	linesAdded: number
	linesDeleted: number
	timestamp: string
	authorEmail: string
}

export interface ObservedGitCommits {
	head?: string
	commits: GitCommitMetrics[]
}

export function getOrbitalClientMetadata() {
	const ideName = vscode.env.appName?.trim() || ""
	const ideVersion = vscode.version?.trim() || ""
	const ideUserAgent = [ideName, ideVersion]
		.filter(Boolean)
		.join("/")
		.replace(/[^\x20-\x7E]/g, "")

	return {
		client: "orbital",
		clientVersion: Package.version,
		ideName,
		ideVersion,
		clientUserAgent: `Axon-Code/${Package.version}${ideUserAgent ? ` (${ideUserAgent})` : ""}`,
	}
}

/** Remove credentials/query data and normalize common SSH remotes. */
export function normalizeGitRemote(remote: string): string {
	const value = remote.trim()
	const scpMatch = value.match(/^(?:[^@]+@)?([^:]+):(.+)$/)
	if (scpMatch && !value.includes("://")) {
		return `https://${scpMatch[1]}/${scpMatch[2]}`
	}

	try {
		const url = new URL(value)
		url.username = ""
		url.password = ""
		url.search = ""
		url.hash = ""
		return url.toString().replace(/\/$/, "")
	} catch {
		return ""
	}
}

export async function detectGitRepo(cwd: string): Promise<string> {
	try {
		const remote = execFileSync("git", ["config", "--get", "remote.origin.url"], {
			cwd,
			stdio: ["ignore", "pipe", "ignore"],
		})
			.toString()
			.trim()
		const normalized = normalizeGitRemote(remote)
		if (normalized) return normalized
	} catch {
		// Fall back to the extension's config reader below.
	}

	try {
		const gitInfo = await getGitRepositoryInfo(cwd)
		const normalized = normalizeGitRemote(gitInfo.repositoryUrl || "")
		if (normalized) return normalized
	} catch {
		// fall through to the workspace name
	}
	return path.basename(cwd)
}

function usageHeaders(token: string, repo: string): Record<string, string> {
	const metadata = getOrbitalClientMetadata()
	return {
		"Content-Type": "application/json",
		Authorization: `Bearer ${token}`,
		"User-Agent": `Axon-Code/${Package.version}`,
		[X_KILOCODE_VERSION]: Package.version,
		[X_AXON_REPO]: repo,
		[X_DEVICE_OS]: process.platform,
		[X_CLIENT_USER_AGENT]: metadata.clientUserAgent,
	}
}

/** Report a metadata-only event. User prompt content is never transmitted. */
export async function reportUsageEvent(token: string | undefined, cwd: string, event: UsageEvent): Promise<void> {
	if (!token) return
	const repo = event.repo || (await detectGitRepo(cwd))
	const metadata = getOrbitalClientMetadata()
	const url = getKiloUrlFromToken("https://api.matterai.so/axoncode/usage/events", token)

	try {
		await fetch(url, {
			method: "POST",
			headers: usageHeaders(token, repo),
			body: JSON.stringify({
				...event,
				eventId: event.eventId || randomUUID(),
				repo,
				client: metadata.client,
				clientVersion: metadata.clientVersion,
				ideName: metadata.ideName,
				ideVersion: metadata.ideVersion,
			}),
			signal: AbortSignal.timeout(10000),
		})
	} catch {
		// Metrics are best-effort and must never affect an agent turn.
	}
}

export async function reportAcceptedLineMetrics(
	token: string | undefined,
	metrics: AcceptedLineMetrics,
): Promise<void> {
	if (!token) return
	const metadata = getOrbitalClientMetadata()
	const url = getKiloUrlFromToken(`https://api.matterai.so/axoncode/meta/${metrics.taskId}/lines`, token)

	try {
		await fetch(url, {
			method: "POST",
			headers: usageHeaders(token, metrics.repo),
			body: JSON.stringify({
				eventId: randomUUID(),
				language: metrics.language,
				linesAdded: metrics.linesAdded,
				linesUpdated: metrics.linesModified,
				linesDeleted: metrics.linesDeleted,
				model: metrics.model,
				client: metadata.client,
				clientVersion: metadata.clientVersion,
				ideName: metadata.ideName,
				ideVersion: metadata.ideVersion,
			}),
			signal: AbortSignal.timeout(10000),
		})
	} catch {
		// Metrics are best-effort and must never affect an edit acceptance.
	}
}

export function getGitHead(cwd: string): string | undefined {
	try {
		return execFileSync("git", ["rev-parse", "HEAD"], {
			cwd,
			stdio: ["ignore", "pipe", "ignore"],
		})
			.toString()
			.trim()
	} catch {
		return undefined
	}
}

/**
 * Return descendant commits since the previous HEAD. A branch switch or
 * rewritten history becomes a new baseline and is not treated as new code.
 */
export function observeGitCommits(cwd: string, previousHead?: string): ObservedGitCommits {
	const head = getGitHead(cwd)
	if (!head || !previousHead || head === previousHead) return { head, commits: [] }

	try {
		execFileSync("git", ["merge-base", "--is-ancestor", previousHead, head], {
			cwd,
			stdio: "ignore",
		})
	} catch {
		return { head, commits: [] }
	}

	try {
		let configuredAuthorEmail = ""
		try {
			configuredAuthorEmail = execFileSync("git", ["config", "--get", "user.email"], {
				cwd,
				stdio: ["ignore", "pipe", "ignore"],
			})
				.toString()
				.trim()
				.toLowerCase()
		} catch {
			// A repository can still have commits when identity comes from env vars.
		}
		const hashes = execFileSync("git", ["rev-list", "--reverse", `${previousHead}..${head}`], {
			cwd,
			stdio: ["ignore", "pipe", "ignore"],
		})
			.toString()
			.trim()
			.split("\n")
			.filter(Boolean)

		const commits = hashes
			.map((hash) => {
				const authorEmail = execFileSync("git", ["show", "-s", "--format=%ae", hash], {
					cwd,
					stdio: ["ignore", "pipe", "ignore"],
				})
					.toString()
					.trim()
				const numstat = execFileSync("git", ["show", "--numstat", "--format=", "--no-renames", hash], {
					cwd,
					stdio: ["ignore", "pipe", "ignore"],
				}).toString()
				let linesAdded = 0
				let linesDeleted = 0
				for (const line of numstat.split("\n")) {
					const [added, deleted] = line.split("\t")
					if (/^\d+$/.test(added)) linesAdded += Number(added)
					if (/^\d+$/.test(deleted)) linesDeleted += Number(deleted)
				}
				const timestamp = execFileSync("git", ["show", "-s", "--format=%cI", hash], {
					cwd,
					stdio: ["ignore", "pipe", "ignore"],
				})
					.toString()
					.trim()
				return { hash, linesAdded, linesDeleted, timestamp, authorEmail }
			})
			.filter((commit) => !configuredAuthorEmail || commit.authorEmail.toLowerCase() === configuredAuthorEmail)

		return { head, commits }
	} catch {
		return { head, commits: [] }
	}
}
