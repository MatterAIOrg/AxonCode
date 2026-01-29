import { describe, it, expect, vi, beforeEach } from "vitest"
import { useSkillTool } from "../useSkillTool"
import { Task } from "../../task/Task"
import { formatResponse } from "../../prompts/responses"

// Mock dependencies
vi.mock("../../prompts/responses", () => ({
	formatResponse: {
		toolError: vi.fn((msg) => `<error>${msg}</error>`),
	},
}))

describe("useSkillTool", () => {
	let mockCline: any
	let mockAskApproval: any
	let mockHandleError: any
	let mockPushToolResult: any

	beforeEach(() => {
		mockPushToolResult = vi.fn()
		mockAskApproval = vi.fn().mockResolvedValue(true)
		mockHandleError = vi.fn()

		mockCline = {
			workspacePath: "/workspace",
			consecutiveMistakeCount: 0,
			recordToolError: vi.fn(),
			sayAndCreateMissingParamError: vi.fn().mockResolvedValue("Missing param error"),
			ask: vi.fn().mockResolvedValue({ text: "", images: [] }),
		} as const
	})

	it("should handle partial tool call", async () => {
		const block = {
			type: "tool_use",
			id: "test-id-1",
			name: "use_skill",
			params: {},
			partial: true,
		} as const

		await useSkillTool(mockCline, block, mockAskApproval, mockHandleError, mockPushToolResult)

		expect(mockCline.ask).toHaveBeenCalledWith("tool", expect.any(String), true)
		expect(mockPushToolResult).not.toHaveBeenCalled()
	})

	it("should return error when skill_name is missing", async () => {
		const block = {
			type: "tool_use",
			name: "use_skill",
			params: {},
			partial: false,
		} as const

		await useSkillTool(mockCline, block, mockAskApproval, mockHandleError, mockPushToolResult)

		expect(mockCline.consecutiveMistakeCount).toBe(1)
		expect(mockCline.recordToolError).toHaveBeenCalledWith("use_skill")
		expect(mockCline.sayAndCreateMissingParamError).toHaveBeenCalledWith("use_skill", "skill_name")
		expect(mockPushToolResult).toHaveBeenCalledWith("Missing param error")
	})

	it("should return error when skill is not found", async () => {
		const block = {
			type: "tool_use",
			name: "use_skill",
			params: { skill_name: "non-existent-skill" },
			partial: false,
		} as const

		await useSkillTool(mockCline, block, mockAskApproval, mockHandleError, mockPushToolResult)

		expect(mockAskApproval).toHaveBeenCalled()
		expect(mockPushToolResult).toHaveBeenCalledWith(
			'<error>Skill "non-existent-skill" not found. Make sure the skill exists in .agent/skills/<skill-name>/SKILL.md</error>',
		)
	})

	it("should return skill content when skill is found", async () => {
		const block = {
			type: "tool_use",
			name: "use_skill",
			params: { skill_name: "test-skill" },
			partial: false,
		} as const

		// Mock the skill discovery to return a skill
		vi.doMock(
			"../skills",
			() =>
				({
					getSkillByName: vi.fn().mockResolvedValue({
						metadata: { name: "test-skill", description: "Test skill" },
						content: "# Test Skill\n\nThis is the skill content.",
						folderName: "test",
						path: "/workspace/.agent/skills/test/SKILL.md",
					} as const),
				}) as const,
		)

		await useSkillTool(mockCline, block, mockAskApproval, mockHandleError, mockPushToolResult)

		expect(mockAskApproval).toHaveBeenCalled()
		expect(mockPushToolResult).toHaveBeenCalledWith(
			"You are requested to follow the below instructions\n\n# Test Skill\n\nThis is the skill content.",
		)
	})

	it("should not execute when approval is denied", async () => {
		mockAskApproval.mockResolvedValue(false)

		const block = {
			type: "tool_use",
			name: "use_skill",
			params: { skill_name: "test-skill" },
			partial: false,
		} as const

		await useSkillTool(mockCline, block, mockAskApproval, mockHandleError, mockPushToolResult)

		expect(mockAskApproval).toHaveBeenCalled()
		expect(mockPushToolResult).not.toHaveBeenCalled()
	})

	it("should handle errors gracefully", async () => {
		const block = {
			type: "tool_use",
			name: "use_skill",
			params: { skill_name: "test-skill" },
			partial: false,
		} as const

		// Mock an error in skill discovery
		vi.doMock(
			"../skills",
			() =>
				({
					getSkillByName: vi.fn().mockRejectedValue(new Error("Discovery error")),
				}) as const,
		)

		await useSkillTool(mockCline, block, mockAskApproval, mockHandleError, mockPushToolResult)

		expect(mockHandleError).toHaveBeenCalledWith("using skill", expect.any(Error))
	})
})
