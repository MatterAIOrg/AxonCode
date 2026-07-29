import { beforeEach, describe, expect, it, vi } from "vitest"

import { fileWriteTool } from "../fileWriteTool"

vi.mock("vscode", () => ({
	workspace: {
		workspaceFolders: [{ uri: { fsPath: "/workspace" } }],
	},
	window: {
		showWarningMessage: vi.fn(),
	},
	env: {
		openExternal: vi.fn(),
	},
	Uri: {
		parse: vi.fn(),
	},
}))

vi.mock("delay", () => ({
	default: vi.fn().mockResolvedValue(undefined),
}))

vi.mock("fs/promises", () => ({
	default: {
		readFile: vi.fn(),
	},
}))

vi.mock("../../../utils/fs", () => ({
	fileExistsAtPath: vi.fn().mockResolvedValue(false),
}))

vi.mock("../../../integrations/editor/detect-omission", () => ({
	detectCodeOmission: vi.fn().mockReturnValue(false),
}))

vi.mock("../../../shared/experiments", () => ({
	EXPERIMENT_IDS: {
		PREVENT_FOCUS_DISRUPTION: "preventFocusDisruption",
	},
	experiments: {
		isEnabled: vi.fn().mockReturnValue(false),
	},
}))

describe("fileWriteTool", () => {
	let cline: any

	beforeEach(() => {
		cline = {
			cwd: "/workspace",
			api: {
				getModel: vi.fn().mockReturnValue({ id: "test-model" }),
			},
			apiConfiguration: {},
			providerRef: {
				deref: vi.fn().mockReturnValue({
					getState: vi.fn().mockResolvedValue({ diagnosticsEnabled: false, writeDelayMs: 0 }),
				}),
			},
			rooIgnoreController: {
				validateAccess: vi.fn().mockReturnValue(true),
			},
			rooProtectedController: {
				isWriteProtected: vi.fn().mockReturnValue(false),
			},
			diffStrategy: undefined,
			diffViewProvider: {
				editType: undefined,
				isEditing: false,
				reset: vi.fn().mockResolvedValue(undefined),
				open: vi.fn().mockResolvedValue(undefined),
				update: vi.fn().mockResolvedValue(undefined),
				scrollToFirstDiff: vi.fn(),
				saveChanges: vi.fn().mockResolvedValue(undefined),
				pushToolWriteResult: vi.fn().mockResolvedValue("file created"),
			},
			fileEditReviewController: {
				addEdit: vi.fn(),
			},
			fileContextTracker: {
				trackFileContext: vi.fn().mockResolvedValue(undefined),
			},
			ask: vi.fn(),
			setLastToolAskMessagePartial: vi.fn().mockResolvedValue(true),
			say: vi.fn().mockResolvedValue(undefined),
			recordToolUsage: vi.fn(),
			recordToolError: vi.fn(),
			processQueuedMessages: vi.fn(),
			consecutiveMistakeCount: 0,
			didEditFile: false,
		}
	})

	it("keeps one tool row partial while saving and settles it on completion", async () => {
		const askApproval = vi.fn().mockResolvedValue(true)
		const pushToolResult = vi.fn()

		await fileWriteTool(
			cline,
			{
				type: "tool_use",
				name: "file_write",
				params: {
					file_path: "docs/a-very-long-file-name-that-used-to-show-twice.md",
					content: "hello",
					line_count: "1",
				},
				partial: false,
			} as any,
			askApproval,
			vi.fn(),
			pushToolResult,
			(_tag, value) => value ?? "",
		)

		expect(askApproval).toHaveBeenCalledTimes(1)
		expect(cline.ask).not.toHaveBeenCalled()
		expect(cline.setLastToolAskMessagePartial.mock.calls.map((call: any[]) => call[1])).toEqual([true, false])
		expect(cline.diffViewProvider.open).toHaveBeenCalledTimes(1)
		expect(cline.diffViewProvider.saveChanges).toHaveBeenCalledTimes(1)
		expect(pushToolResult).toHaveBeenCalledWith("file created")
	})
})
