import { getBuiltInCommands, getBuiltInCommand, getBuiltInCommandNames } from "../built-in-commands"

const EXPECTED_COMMANDS = ["commit", "migrate", "init", "create-skill", "link"]

describe("Built-in Commands", () => {
	describe("getBuiltInCommands", () => {
		it("should return all built-in commands", async () => {
			const commands = await getBuiltInCommands()

			expect(commands).toHaveLength(EXPECTED_COMMANDS.length)
			expect(commands.map((cmd) => cmd.name)).toEqual(expect.arrayContaining(EXPECTED_COMMANDS))

			// Verify all commands have required properties
			commands.forEach((command) => {
				expect(command.name).toBeDefined()
				expect(typeof command.name).toBe("string")
				expect(command.content).toBeDefined()
				expect(typeof command.content).toBe("string")
				expect(command.source).toBe("built-in")
				expect(command.filePath).toMatch(/^<built-in:.+>$/)
				expect(command.description).toBeDefined()
				expect(typeof command.description).toBe("string")
			})
		})

		it("should return commands with proper content", async () => {
			const commands = await getBuiltInCommands()

			const initCommand = commands.find((cmd) => cmd.name === "init")
			expect(initCommand).toBeDefined()
			expect(initCommand!.content).toContain("AGENTS.md")
			expect(initCommand!.content).toContain(".orb/AGENTS.md")
			expect(initCommand!.description).toBe(
				"Analyze the codebase and create a concise AGENTS.md to reduce cold-start",
			)

			const linkCommand = commands.find((cmd) => cmd.name === "link")
			expect(linkCommand).toBeDefined()
			expect(linkCommand!.content).toContain(".orb/links.json")
			expect(linkCommand!.content).toContain("Linked Repositories")
			expect(linkCommand!.description).toBe("Link other repos so changes here are checked against them")

			const createSkillCommand = commands.find((cmd) => cmd.name === "create-skill")
			expect(createSkillCommand).toBeDefined()
			expect(createSkillCommand!.content).toContain(".orb/skills/<skill-name>/SKILL.md")
			expect(createSkillCommand!.argumentHint).toBe("<describe the skill you want>")
			expect(createSkillCommand!.description).toBe(
				"Create or update a repo-local skill from a plain-language description",
			)

			const commitCommand = commands.find((cmd) => cmd.name === "commit")
			expect(commitCommand).toBeDefined()
			expect(commitCommand!.content).toContain("pending changes")
			expect(commitCommand!.content).toContain("commit messages")
			expect(commitCommand!.content).toContain("matterai-app[bot]")
			expect(commitCommand!.description).toBe("Check pending changes and generate detailed commit messages")
		})
	})

	describe("getBuiltInCommand", () => {
		it("should return specific built-in command by name", async () => {
			const initCommand = await getBuiltInCommand("init")

			expect(initCommand).toBeDefined()
			expect(initCommand!.name).toBe("init")
			expect(initCommand!.source).toBe("built-in")
			expect(initCommand!.filePath).toBe("<built-in:init>")
			expect(initCommand!.content).toContain("AGENTS.md")
			expect(initCommand!.description).toBe(
				"Analyze the codebase and create a concise AGENTS.md to reduce cold-start",
			)
		})

		it("should return undefined for non-existent command", async () => {
			const nonExistentCommand = await getBuiltInCommand("non-existent")
			expect(nonExistentCommand).toBeUndefined()
		})

		it("should handle empty string command name", async () => {
			const emptyCommand = await getBuiltInCommand("")
			expect(emptyCommand).toBeUndefined()
		})
	})

	describe("getBuiltInCommandNames", () => {
		it("should return all built-in command names", async () => {
			const names = await getBuiltInCommandNames()

			expect(names).toHaveLength(EXPECTED_COMMANDS.length)
			expect(names).toEqual(expect.arrayContaining(EXPECTED_COMMANDS))
			expect(names.sort()).toEqual([...EXPECTED_COMMANDS].sort())
		})

		it("should return array of strings", async () => {
			const names = await getBuiltInCommandNames()

			names.forEach((name) => {
				expect(typeof name).toBe("string")
				expect(name.length).toBeGreaterThan(0)
			})
		})
	})

	describe("Command Content Validation", () => {
		it("init command targets a concise, cold-start AGENTS.md in .orb/", async () => {
			const command = await getBuiltInCommand("init")
			const content = command!.content

			expect(content).toContain("Analyze this codebase")
			expect(content).toContain(".orb/AGENTS.md")
			expect(content).toContain("cold-start")
			expect(content).toContain("Architecture")
			expect(content).toContain("Business-logic")
		})

		it("link command manages the shared .orb/links.json file", async () => {
			const command = await getBuiltInCommand("link")
			const content = command!.content

			expect(content).toContain(".orb/links.json")
			expect(content).toContain("ask_followup_question")
			expect(content).toContain("folder path")
		})

		it("create-skill command keeps every generated skill artifact in .orb/skills", async () => {
			const command = await getBuiltInCommand("create-skill")
			const content = command!.content

			expect(content).toContain("user's text after /create-skill")
			expect(content).toContain(".orb/skills/<skill-name>/SKILL.md")
			expect(content).toContain("Supporting scripts, references, and assets")
			expect(content).toContain("frontmatter containing exactly name and description")
			expect(content).toContain("Do not create the skill in .orbcode")
			expect(content).toContain("do not modify any file outside that skill directory")
		})
	})
})
