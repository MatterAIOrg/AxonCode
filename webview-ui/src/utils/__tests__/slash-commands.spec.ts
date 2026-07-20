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
})
