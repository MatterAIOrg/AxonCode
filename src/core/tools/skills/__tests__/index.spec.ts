import * as fs from "fs/promises"
import * as os from "os"
import * as path from "path"
import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { discoverSkills, getSkillByName } from "../index"

function skillFile(name: string, description = `${name} description`): string {
	return `---\nname: ${name}\ndescription: ${description}\n---\n\n# ${name}\n\nInstructions.`
}

describe("skill discovery", () => {
	let workspacePath: string

	beforeEach(async () => {
		workspacePath = await fs.mkdtemp(path.join(os.tmpdir(), "orbital-skills-test-"))
	})

	afterEach(async () => {
		await fs.rm(workspacePath, { recursive: true, force: true })
	})

	it("returns an empty array when no skill directories exist", async () => {
		expect(await discoverSkills({ workspacePath })).toEqual([])
	})

	it("discovers personal skills from .orb/skills", async () => {
		const skillDir = path.join(workspacePath, ".orb", "skills", "review")
		await fs.mkdir(skillDir, { recursive: true })
		await fs.writeFile(path.join(skillDir, "SKILL.md"), skillFile("review"))

		const skills = await discoverSkills({ workspacePath })
		expect(skills.map((skill) => skill.metadata.name)).toEqual(["review"])
	})

	it("discovers and namespaces every skill in an installed plugin", async () => {
		const pluginDir = path.join(workspacePath, ".orb", "plugins", "clickhouse", "skills")
		await fs.mkdir(path.join(pluginDir, "clickhouse-best-practices"), { recursive: true })
		await fs.mkdir(path.join(pluginDir, "setup"), { recursive: true })
		await fs.writeFile(
			path.join(pluginDir, "clickhouse-best-practices", "SKILL.md"),
			skillFile("clickhouse-best-practices"),
		)
		await fs.writeFile(path.join(pluginDir, "setup", "SKILL.md"), skillFile("setup"))

		const skills = await discoverSkills({ workspacePath })
		expect(skills.map((skill) => skill.metadata.name).sort()).toEqual([
			"clickhouse:clickhouse-best-practices",
			"clickhouse:setup",
		])
		expect(await getSkillByName("clickhouse:setup", { workspacePath })).not.toBeNull()
	})

	it("skips invalid and missing SKILL.md files", async () => {
		const skillsDir = path.join(workspacePath, ".orb", "skills")
		await fs.mkdir(path.join(skillsDir, "missing"), { recursive: true })
		await fs.mkdir(path.join(skillsDir, "invalid"), { recursive: true })
		await fs.writeFile(path.join(skillsDir, "invalid", "SKILL.md"), "# Missing frontmatter")

		expect(await discoverSkills({ workspacePath })).toEqual([])
	})
})
