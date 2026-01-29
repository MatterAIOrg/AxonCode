import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import * as fs from "fs/promises"
import { discoverSkills, getSkillByName } from "../index"

// Mock fs module
vi.mock("fs/promises", () => ({
	access: vi.fn(),
	readdir: vi.fn(),
	readFile: vi.fn(),
}))

describe("discoverSkills", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	it("should return empty array when skills directory does not exist", async () => {
		vi.mocked(fs.access).mockRejectedValue(new Error("Directory not found"))

		const result = await discoverSkills({ workspacePath: "/workspace" })

		expect(result).toEqual([])
		expect(fs.access).toHaveBeenCalledWith("/workspace/.agent/skills")
	})

	it("should discover skills from valid directory structure", async () => {
		vi.mocked(fs.access).mockResolvedValue(undefined)
		vi.mocked(fs.readdir).mockResolvedValue([
			{ name: "skill1", isDirectory: () => true },
			{ name: "skill2", isDirectory: () => true },
		] as any)
		vi.mocked(fs.readFile).mockResolvedValueOnce(`---
name: skill-one
description: First skill
---

Content of skill one`).mockResolvedValueOnce(`---
name: skill-two
description: Second skill
---

Content of skill two`)

		const result = await discoverSkills({ workspacePath: "/workspace" })

		expect(result).toHaveLength(2)
		expect(result[0].metadata.name).toBe("skill-one")
		expect(result[1].metadata.name).toBe("skill-two")
	})

	it("should skip folders without SKILL.md", async () => {
		vi.mocked(fs.access).mockResolvedValue(undefined)
		vi.mocked(fs.readdir).mockResolvedValue([
			{ name: "valid-skill", isDirectory: () => true },
			{ name: "invalid-skill", isDirectory: () => true },
		] as any)
		vi.mocked(fs.readFile)
			.mockResolvedValueOnce(
				`---
name: valid-skill
description: Valid skill
---

Valid content`,
			)
			.mockRejectedValueOnce(new Error("File not found"))

		const result = await discoverSkills({ workspacePath: "/workspace" })

		expect(result).toHaveLength(1)
		expect(result[0].metadata.name).toBe("valid-skill")
	})

	it("should skip invalid SKILL.md files", async () => {
		vi.mocked(fs.access).mockResolvedValue(undefined)
		vi.mocked(fs.readdir).mockResolvedValue([
			{ name: "valid-skill", isDirectory: () => true },
			{ name: "invalid-skill", isDirectory: () => true },
		] as any)
		vi.mocked(fs.readFile).mockResolvedValueOnce(`---
name: valid-skill
description: Valid skill
---

Valid content`).mockResolvedValueOnce(`---
description: Missing name
---

Invalid content`)

		const result = await discoverSkills({ workspacePath: "/workspace" })

		expect(result).toHaveLength(1)
		expect(result[0].metadata.name).toBe("valid-skill")
	})

	it("should handle empty skills directory", async () => {
		vi.mocked(fs.access).mockResolvedValue(undefined)
		vi.mocked(fs.readdir).mockResolvedValue([])

		const result = await discoverSkills({ workspacePath: "/workspace" })

		expect(result).toEqual([])
	})

	it("should handle readdir errors gracefully", async () => {
		vi.mocked(fs.access).mockResolvedValue(undefined)
		vi.mocked(fs.readdir).mockRejectedValue(new Error("Permission denied"))

		const result = await discoverSkills({ workspacePath: "/workspace" })

		expect(result).toEqual([])
	})
})

describe("getSkillByName", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	it("should return skill when found", async () => {
		vi.mocked(fs.access).mockResolvedValue(undefined)
		vi.mocked(fs.readdir).mockResolvedValue([{ name: "skill1", isDirectory: () => true }] as any)
		vi.mocked(fs.readFile).mockResolvedValue(`---
name: target-skill
description: Target skill
---

Target content`)

		const result = await getSkillByName("target-skill", { workspacePath: "/workspace" })

		expect(result).not.toBeNull()
		expect(result?.metadata.name).toBe("target-skill")
	})

	it("should return null when skill not found", async () => {
		vi.mocked(fs.access).mockResolvedValue(undefined)
		vi.mocked(fs.readdir).mockResolvedValue([{ name: "skill1", isDirectory: () => true }] as any)
		vi.mocked(fs.readFile).mockResolvedValue(`---
name: other-skill
description: Other skill
---

Other content`)

		const result = await getSkillByName("target-skill", { workspacePath: "/workspace" })

		expect(result).toBeNull()
	})

	it("should return null when skills directory does not exist", async () => {
		vi.mocked(fs.access).mockRejectedValue(new Error("Directory not found"))

		const result = await getSkillByName("any-skill", { workspacePath: "/workspace" })

		expect(result).toBeNull()
	})
})
