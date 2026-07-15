import * as fs from "node:fs/promises"
import * as os from "node:os"
import * as path from "node:path"
import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { getCommand, getCommands } from "../commands"

describe("plugin commands", () => {
	let workspace: string

	beforeEach(async () => {
		workspace = await fs.mkdtemp(path.join(os.tmpdir(), "orbital-plugin-command-"))
		const commandsDir = path.join(workspace, ".orb", "plugins", "database", "commands")
		await fs.mkdir(commandsDir, { recursive: true })
		await fs.writeFile(
			path.join(commandsDir, "query.md"),
			"---\ndescription: Query the database\n---\n\nRun the requested query.",
		)
	})

	afterEach(async () => {
		await fs.rm(workspace, { recursive: true, force: true })
	})

	it("loads plugin slash commands with a plugin namespace", async () => {
		const command = await getCommand(workspace, "database:query")
		expect(command).toMatchObject({
			name: "database:query",
			source: "plugin",
			description: "Query the database",
		})
		expect((await getCommands(workspace)).some((entry) => entry.name === "database:query")).toBe(true)
	})
})
