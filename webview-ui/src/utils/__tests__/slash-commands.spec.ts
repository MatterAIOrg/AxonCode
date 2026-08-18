import { describe, expect, it } from "vitest"

import { getMatchingSlashCommands, getSupportedSlashCommands, validateSlashCommand } from "../slash-commands"

describe("slash command discovery", () => {
	it("includes create-skill in the chat textarea commands", () => {
		const commands = getSupportedSlashCommands()
		const createSkill = commands.find((command) => command.name === "create-skill")

		expect(createSkill).toEqual({
			name: "create-skill",
			description: "Create or update a repo-local skill from a plain-language description",
		})
	})

	it("matches and validates create-skill autocomplete input", () => {
		expect(getMatchingSlashCommands("create-s").map((command) => command.name)).toContain("create-skill")
		expect(validateSlashCommand("create-skill")).toBe("full")
	})

	it("includes usage in the chat textarea commands", () => {
		const commands = getSupportedSlashCommands()
		const usage = commands.find((command) => command.name === "usage")

		expect(usage).toEqual({
			name: "usage",
			description: "Print current task token usage (if active) and plan details",
		})
	})

	it("matches and validates usage autocomplete input", () => {
		expect(getMatchingSlashCommands("us").map((command) => command.name)).toContain("usage")
		expect(validateSlashCommand("usage")).toBe("full")
	})
})
