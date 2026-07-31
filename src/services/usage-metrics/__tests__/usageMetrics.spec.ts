import { execFileSync } from "child_process"
import { mkdtempSync, rmSync, writeFileSync } from "fs"
import { tmpdir } from "os"
import path from "path"

import { afterEach, describe, expect, it, vi } from "vitest"

vi.mock("vscode", () => ({
	env: { appName: "Visual Studio Code" },
	version: "1.102.0",
}))

import { getGitHead, getOrbitalClientMetadata, normalizeGitRemote, observeGitCommits } from "../usageMetrics"

const temporaryRepos: string[] = []

afterEach(() => {
	for (const repo of temporaryRepos.splice(0)) {
		rmSync(repo, { recursive: true, force: true })
	}
})

describe("usage metrics", () => {
	it("captures extension and IDE versions separately", () => {
		expect(getOrbitalClientMetadata()).toMatchObject({
			client: "orbital",
			ideName: "Visual Studio Code",
			ideVersion: "1.102.0",
		})
	})

	it("removes credentials and query data from Git remotes", () => {
		expect(normalizeGitRemote("https://token:secret@example.com/acme/repo.git?key=value#ref")).toBe(
			"https://example.com/acme/repo.git",
		)
		expect(normalizeGitRemote("git@example.com:acme/repo.git")).toBe("https://example.com/acme/repo.git")
	})

	it("observes descendant commits and numstat totals", () => {
		const repo = mkdtempSync(path.join(tmpdir(), "orbital-metrics-"))
		temporaryRepos.push(repo)
		execFileSync("git", ["init", "-q"], { cwd: repo })
		execFileSync("git", ["config", "user.name", "Metrics Test"], { cwd: repo })
		execFileSync("git", ["config", "user.email", "metrics@example.com"], { cwd: repo })
		writeFileSync(path.join(repo, "sample.ts"), "one\n")
		execFileSync("git", ["add", "sample.ts"], { cwd: repo })
		execFileSync("git", ["commit", "-q", "-m", "initial"], { cwd: repo })

		const baseline = getGitHead(repo)
		writeFileSync(path.join(repo, "sample.ts"), "one\ntwo\nthree\n")
		execFileSync("git", ["add", "sample.ts"], { cwd: repo })
		execFileSync("git", ["commit", "-q", "-m", "add lines"], { cwd: repo })

		const observed = observeGitCommits(repo, baseline)
		expect(observed.commits).toHaveLength(1)
		expect(observed.commits[0]).toMatchObject({
			linesAdded: 2,
			linesDeleted: 0,
		})
	})
})
