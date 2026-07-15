import { execFileSync } from "node:child_process"
import * as fs from "node:fs"
import * as os from "node:os"
import * as path from "node:path"
import { afterEach, beforeEach, describe, expect, it } from "vitest"

import type { PluginMarketplaceItem } from "@roo-code/types"

import { getInstalledPluginMetadata, installPlugin, uninstallPlugin } from "../PluginInstaller"

function runGit(cwd: string, ...args: string[]): string {
	return execFileSync("git", args, { cwd, encoding: "utf8" }).trim()
}

describe("PluginInstaller", () => {
	let root: string
	let repository: string
	let workspace: string

	beforeEach(() => {
		root = fs.mkdtempSync(path.join(os.tmpdir(), "orbital-plugin-test-"))
		repository = path.join(root, "source")
		workspace = path.join(root, "workspace")
		fs.mkdirSync(repository, { recursive: true })
		fs.mkdirSync(workspace, { recursive: true })
		for (const skill of ["clickhouse-best-practices", "setup"]) {
			const skillDir = path.join(repository, "skills", skill)
			fs.mkdirSync(skillDir, { recursive: true })
			fs.writeFileSync(
				path.join(skillDir, "SKILL.md"),
				`---\nname: ${skill}\ndescription: ${skill}\n---\n\nInstructions.\n`,
			)
		}
		fs.writeFileSync(
			path.join(repository, ".mcp.json"),
			JSON.stringify({
				mcpServers: {
					clickhouse: { command: "node", args: ["${CLAUDE_PLUGIN_ROOT}/server.js"] },
				},
			}),
		)
		fs.writeFileSync(path.join(repository, "server.js"), "// test server\n")
		runGit(repository, "init", "--quiet")
		runGit(repository, "add", ".")
		runGit(
			repository,
			"-c",
			"user.name=Orbital Tests",
			"-c",
			"user.email=tests@example.com",
			"commit",
			"--quiet",
			"-m",
			"fixture",
		)
	})

	afterEach(() => {
		fs.rmSync(root, { recursive: true, force: true })
	})

	it("installs and removes a complete plugin bundle with namespaced MCP", async () => {
		const item: PluginMarketplaceItem = {
			id: "clickhouse",
			name: "ClickHouse",
			description: "ClickHouse plugin",
			marketplace: "claude-plugins-official",
			source: { source: "url", url: repository, sha: runGit(repository, "rev-parse", "HEAD") },
		}
		const pluginDir = await installPlugin(item, workspace)

		expect(fs.existsSync(path.join(pluginDir, "skills", "setup", "SKILL.md"))).toBe(true)
		expect(getInstalledPluginMetadata(workspace).clickhouse.inventory).toMatchObject({
			skills: 2,
			mcpServers: 1,
		})
		const mcpConfig = JSON.parse(fs.readFileSync(path.join(workspace, ".orbital", "mcp.json"), "utf8"))
		expect(mcpConfig.mcpServers["clickhouse:clickhouse"].args[0]).toBe(path.join(pluginDir, "server.js"))

		uninstallPlugin("clickhouse", workspace)
		expect(fs.existsSync(pluginDir)).toBe(false)
		const removedConfig = JSON.parse(fs.readFileSync(path.join(workspace, ".orbital", "mcp.json"), "utf8"))
		expect(removedConfig.mcpServers["clickhouse:clickhouse"]).toBeUndefined()
	})
})
