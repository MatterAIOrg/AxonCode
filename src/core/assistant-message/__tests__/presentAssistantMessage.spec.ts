import { describe, expect, it, vi } from "vitest"

vi.mock("vscode", () => ({}))

vi.mock("@roo-code/telemetry", () => ({
	TelemetryService: {
		instance: {
			captureToolUsage: vi.fn(),
			captureConsecutiveMistakeError: vi.fn(),
		},
	},
}))

vi.mock("../../tools/accessMcpResourceTool", () => ({ accessMcpResourceTool: vi.fn() }))
vi.mock("../../tools/attemptCompletionTool", () => ({ attemptCompletionTool: vi.fn() }))
vi.mock("../../tools/askFollowupQuestionTool", () => ({ askFollowupQuestionTool: vi.fn() }))
vi.mock("../../tools/browserActionTool", () => ({ browserActionTool: vi.fn() }))
vi.mock("../../tools/codebaseSearchTool", () => ({ codebaseSearchTool: vi.fn() }))
vi.mock("../../tools/condenseTool", () => ({ condenseTool: vi.fn() }))
vi.mock("../../tools/executeCommandTool", () => ({ executeCommandTool: vi.fn() }))
vi.mock("../../tools/fetchInstructionsTool", () => ({ fetchInstructionsTool: vi.fn() }))
vi.mock("../../tools/fileEditTool", () => ({ fileEditTool: vi.fn() }))
vi.mock("../../tools/fileWriteTool", () => ({ fileWriteTool: vi.fn() }))
vi.mock("../../tools/generateImageTool", () => ({ generateImageTool: vi.fn() }))
vi.mock("../../tools/listCodeDefinitionNamesTool", () => ({ listCodeDefinitionNamesTool: vi.fn() }))
vi.mock("../../tools/listFilesTool", () => ({ listFilesTool: vi.fn() }))
vi.mock("../../tools/lspTool", () => ({ lspTool: vi.fn() }))
vi.mock("../../tools/mcpAuthenticateTool", () => ({ mcpAuthenticateTool: vi.fn() }))
vi.mock("../../tools/multiFileEditTool", () => ({ multiFileEditTool: vi.fn() }))
vi.mock("../../tools/newRuleTool", () => ({ newRuleTool: vi.fn() }))
vi.mock("../../tools/newTaskTool", () => ({ newTaskTool: vi.fn() }))
vi.mock("../../tools/reportBugTool", () => ({ reportBugTool: vi.fn() }))
vi.mock("../../tools/runSlashCommandTool", () => ({ runSlashCommandTool: vi.fn() }))
vi.mock("../../tools/switchModeTool", () => ({ switchModeTool: vi.fn() }))
vi.mock("../../tools/updateTodoListTool", () => ({ updateTodoListTool: vi.fn() }))
vi.mock("../../tools/useMcpToolTool", () => ({ useMcpToolTool: vi.fn() }))
vi.mock("../../tools/useSkillTool", () => ({ useSkillTool: vi.fn() }))
vi.mock("../../tools/validateToolUse", () => ({ validateToolUse: vi.fn() }))
vi.mock("../../tools/webFetchTool", () => ({ webFetchTool: vi.fn() }))
vi.mock("../../tools/webSearchTool", () => ({ webSearchTool: vi.fn() }))

vi.mock("../../tools/readFileTool", () => ({
	getReadFileToolDescription: vi.fn(
		(_name: string, params: Record<string, string>) => `[read_file for '${params.path}']`,
	),
	readFileTool: vi.fn(async (_cline: any, block: any, _ask: any, _handleError: any, pushToolResult: any) => {
		pushToolResult(`read:${block.params.file_path ?? block.params.path}`)
	}),
}))

vi.mock("../../tools/searchFilesTool", () => ({
	searchFilesTool: vi.fn(async (_cline: any, block: any, _ask: any, _handleError: any, pushToolResult: any) => {
		pushToolResult(`search:${block.params.regex}`)
	}),
}))

vi.mock("../../task/Task", () => ({
	Task: class {},
}))

import { presentAssistantMessage } from "../presentAssistantMessage"
import { readFileTool } from "../../tools/readFileTool"
import { searchFilesTool } from "../../tools/searchFilesTool"
import { TelemetryService } from "@roo-code/telemetry"

describe("presentAssistantMessage", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	it("executes every complete tool_use block in a native multi-tool response", async () => {
		const getState = vi.fn().mockResolvedValue({ mode: "code", customModes: [] })
		const cline = {
			abort: false,
			taskId: "task-1",
			instanceId: "instance-1",
			presentAssistantMessageLocked: false,
			presentAssistantMessageHasPendingUpdates: false,
			currentStreamingContentIndex: 0,
			assistantMessageContent: [
				{
					type: "text",
					content: "Looking at the error, let me investigate the parsing logic.",
					partial: false,
				},
				{
					type: "tool_use",
					name: "search_files",
					params: {
						path: "src",
						regex: "JSON\\\\.parse",
						file_pattern: "*.ts",
					},
					partial: false,
					toolUseId: "search_files:0",
				},
				{
					type: "tool_use",
					name: "read_file",
					params: {
						file_path:
							"/Users/xblack/Documents/gravity/mattercode/src/api/transform/kilocode/api-stream-native-tool-calls-chunk.ts",
					},
					partial: false,
					toolUseId: "read_file:1",
				},
				{
					type: "tool_use",
					name: "read_file",
					params: {
						file_path:
							"/Users/xblack/Documents/gravity/mattercode/src/core/assistant-message/presentAssistantMessage.ts",
					},
					partial: false,
					toolUseId: "read_file:2",
				},
			],
			didCompleteReadingStream: true,
			userMessageContentReady: false,
			userMessageContent: [],
			didRejectTool: false,
			didAlreadyUseTool: false,
			currentStreamingDidCheckpoint: false,
			diffEnabled: false,
			autoApproveAllCommands: false,
			consecutiveMistakeCount: 0,
			providerRef: {
				deref: () => ({
					getState,
				}),
			},
			browserSession: {
				closeBrowser: vi.fn().mockResolvedValue(undefined),
			},
			say: vi.fn().mockResolvedValue(undefined),
			ask: vi.fn().mockResolvedValue({ response: "yesButtonClicked" }),
			processQueuedMessages: vi.fn(),
			getToolCallSignature: vi.fn((name: string, params: unknown) => JSON.stringify({ name, params })),
			checkAndRegisterToolCall: vi.fn().mockReturnValue(false),
			recordToolUsage: vi.fn(),
			toolRepetitionDetector: {
				check: vi.fn().mockReturnValue({ allowExecution: true }),
			},
			checkpointSave: vi.fn().mockResolvedValue(undefined),
			removeStalePartialToolAskMessage: vi.fn().mockResolvedValue(undefined),
			checkAndCondenseContext: vi.fn().mockResolvedValue(undefined),
		} as any

		await presentAssistantMessage(cline)

		expect(searchFilesTool).toHaveBeenCalledTimes(1)
		expect(readFileTool).toHaveBeenCalledTimes(2)
		expect(cline.checkpointSave).toHaveBeenCalledTimes(1)
		expect(cline.say).toHaveBeenCalledWith(
			"text",
			"Looking at the error, let me investigate the parsing logic.",
			undefined,
			false,
		)
		expect(cline.userMessageContent).toEqual([
			{
				type: "tool_result",
				tool_use_id: "search_files:0",
				content: [{ type: "text", text: "search:JSON\\\\.parse" }],
			},
			{
				type: "tool_result",
				tool_use_id: "read_file:1",
				content: [
					{
						type: "text",
						text: "read:/Users/xblack/Documents/gravity/mattercode/src/api/transform/kilocode/api-stream-native-tool-calls-chunk.ts",
					},
				],
			},
			{
				type: "tool_result",
				tool_use_id: "read_file:2",
				content: [
					{
						type: "text",
						text: "read:/Users/xblack/Documents/gravity/mattercode/src/core/assistant-message/presentAssistantMessage.ts",
					},
				],
			},
		])
		expect(cline.currentStreamingContentIndex).toBe(4)
		expect(cline.userMessageContentReady).toBe(true)
	})

	it("merges multiple pushes for one tool_use into a single tool_result (handleError + tool output)", async () => {
		// Mirror the readFileTool failure path: a per-file read error calls
		// handleError (which pushes a toolError result) and the tool then pushes
		// its aggregated "--- path ---\n[error] ..." output. Both must land in ONE
		// tool_result block — duplicate tool_results for the same tool_use_id make
		// providers reject the next request.
		vi.mocked(readFileTool).mockImplementationOnce(
			async (_cline: any, _block: any, _ask: any, handleError: any, pushToolResult: any) => {
				await handleError("reading file missing.js", new Error("File not found: missing.js"))
				pushToolResult("--- missing.js ---\n[error] File not found: missing.js")
			},
		)

		const getState = vi.fn().mockResolvedValue({ mode: "code", customModes: [] })
		const cline = {
			abort: false,
			taskId: "task-1",
			instanceId: "instance-1",
			presentAssistantMessageLocked: false,
			presentAssistantMessageHasPendingUpdates: false,
			currentStreamingContentIndex: 0,
			assistantMessageContent: [
				{
					type: "tool_use",
					name: "read_file",
					params: { file_path: "missing.js" },
					partial: false,
					toolUseId: "read_file:0",
				},
			],
			didCompleteReadingStream: true,
			userMessageContentReady: false,
			userMessageContent: [],
			didRejectTool: false,
			didAlreadyUseTool: false,
			currentStreamingDidCheckpoint: false,
			diffEnabled: false,
			autoApproveAllCommands: false,
			consecutiveMistakeCount: 0,
			providerRef: {
				deref: () => ({
					getState,
				}),
			},
			browserSession: {
				closeBrowser: vi.fn().mockResolvedValue(undefined),
			},
			say: vi.fn().mockResolvedValue(undefined),
			ask: vi.fn().mockResolvedValue({ response: "yesButtonClicked" }),
			processQueuedMessages: vi.fn(),
			getToolCallSignature: vi.fn((name: string, params: unknown) => JSON.stringify({ name, params })),
			checkAndRegisterToolCall: vi.fn().mockReturnValue(false),
			recordToolUsage: vi.fn(),
			toolRepetitionDetector: {
				check: vi.fn().mockReturnValue({ allowExecution: true }),
			},
			checkpointSave: vi.fn().mockResolvedValue(undefined),
			removeStalePartialToolAskMessage: vi.fn().mockResolvedValue(undefined),
			checkAndCondenseContext: vi.fn().mockResolvedValue(undefined),
		} as any

		await presentAssistantMessage(cline)

		const toolResults = cline.userMessageContent.filter((item: any) => item.type === "tool_result")
		expect(toolResults).toHaveLength(1)
		expect(toolResults[0].tool_use_id).toBe("read_file:0")
		expect(toolResults[0].content).toHaveLength(2)
		expect(toolResults[0].content[0].text).toContain("File not found: missing.js")
		expect(toolResults[0].content[1].text).toBe("--- missing.js ---\n[error] File not found: missing.js")
		expect(cline.userMessageContentReady).toBe(true)
	})

	it("sets toolRepetitionAutoRetry flag and does not call ask() on tool repetition", async () => {
		const getState = vi.fn().mockResolvedValue({ mode: "code", customModes: [] })
		const cline = {
			abort: false,
			taskId: "task-1",
			instanceId: "instance-1",
			presentAssistantMessageLocked: false,
			presentAssistantMessageHasPendingUpdates: false,
			currentStreamingContentIndex: 0,
			assistantMessageContent: [
				{
					type: "tool_use",
					name: "read_file",
					params: { path: "test.txt" },
					partial: false,
					toolUseId: "read_file:0",
				},
			],
			didCompleteReadingStream: true,
			userMessageContentReady: false,
			userMessageContent: [],
			didRejectTool: false,
			didAlreadyUseTool: false,
			currentStreamingDidCheckpoint: false,
			diffEnabled: false,
			autoApproveAllCommands: false,
			consecutiveMistakeCount: 0,
			toolRepetitionAutoRetry: false,
			providerRef: {
				deref: () => ({
					getState,
				}),
			},
			browserSession: {
				closeBrowser: vi.fn().mockResolvedValue(undefined),
			},
			say: vi.fn().mockResolvedValue(undefined),
			ask: vi.fn().mockResolvedValue({ response: "yesButtonClicked" }),
			processQueuedMessages: vi.fn(),
			getToolCallSignature: vi.fn((name: string, params: unknown) => JSON.stringify({ name, params })),
			checkAndRegisterToolCall: vi.fn().mockReturnValue(false),
			recordToolUsage: vi.fn(),
			toolRepetitionDetector: {
				check: vi.fn().mockReturnValue({
					allowExecution: false,
					askUser: {
						messageKey: "mistake_limit_reached",
						messageDetail: "Model stuck in a loop with {toolName}",
					},
				}),
			},
			checkpointSave: vi.fn().mockResolvedValue(undefined),
			removeStalePartialToolAskMessage: vi.fn().mockResolvedValue(undefined),
			checkAndCondenseContext: vi.fn().mockResolvedValue(undefined),
		} as any

		await presentAssistantMessage(cline)

		// cline.ask should NOT be called — we auto-retry instead
		expect(cline.ask).not.toHaveBeenCalled()

		// cline.say should be called with "error" to show the message in UI
		expect(cline.say).toHaveBeenCalledWith("error", "Model stuck in a loop with read_file")

		// The auto-retry flag should be set
		expect(cline.toolRepetitionAutoRetry).toBe(true)

		// Telemetry should be captured
		expect(TelemetryService.instance.captureConsecutiveMistakeError).toHaveBeenCalledWith("task-1")

		// A tool error result should be pushed for the tool_use
		const toolResults = cline.userMessageContent.filter((item: any) => item.type === "tool_result")
		expect(toolResults).toHaveLength(1)
		expect(toolResults[0].tool_use_id).toBe("read_file:0")
		expect(toolResults[0].content[0].text).toContain("Tool call repetition limit reached")

		// The tool should NOT have been executed
		expect(readFileTool).not.toHaveBeenCalled()
	})
})
