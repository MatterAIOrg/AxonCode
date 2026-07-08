import * as vscode from "vscode"

import { FileContextTracker } from "../FileContextTracker"

const { mockWatcher } = vi.hoisted(() => ({
	mockWatcher: {
		onDidChange: vi.fn(),
		dispose: vi.fn(),
	},
}))

vi.mock("vscode", () => ({
	workspace: {
		workspaceFolders: [{ uri: { fsPath: "/workspace" } }],
		createFileSystemWatcher: vi.fn(() => mockWatcher),
	},
	RelativePattern: vi.fn(function (base: string, pattern: string) {
		return { base, pattern }
	}),
	Uri: {
		file: vi.fn((fsPath: string) => ({ fsPath })),
	},
}))

describe("FileContextTracker", () => {
	let tracker: FileContextTracker
	let onDidChange: () => void = () => {
		throw new Error("onDidChange callback was not registered")
	}

	beforeEach(async () => {
		vi.useFakeTimers()
		vi.setSystemTime(new Date("2026-01-01T00:00:00Z"))
		vi.clearAllMocks()

		mockWatcher.onDidChange.mockImplementation((callback: () => void) => {
			onDidChange = callback
			return { dispose: vi.fn() }
		})

		tracker = new FileContextTracker({} as any, "task-id")
		await tracker.setupFileWatcher("src/file.ts")
		vi.spyOn(tracker, "trackFileContext").mockResolvedValue(undefined)
	})

	afterEach(() => {
		vi.useRealTimers()
	})

	it("suppresses multiple filesystem events from the same Roo edit burst", () => {
		tracker.markFileAsEditedByRoo("src/file.ts")

		onDidChange()
		onDidChange()

		expect(tracker.getAndClearRecentlyModifiedFiles()).toEqual([])
		expect(tracker.trackFileContext).not.toHaveBeenCalled()
	})

	it("tracks changes after the Roo edit suppression window expires", () => {
		tracker.markFileAsEditedByRoo("src/file.ts")
		vi.advanceTimersByTime(3_001)

		onDidChange()

		expect(tracker.getAndClearRecentlyModifiedFiles()).toEqual(["src/file.ts"])
		expect(tracker.trackFileContext).toHaveBeenCalledWith("src/file.ts", "user_edited")
	})

	it("clears a queued modified-file notification when a Roo edit is recorded", async () => {
		;(tracker as any).recentlyModifiedFiles.add("src/file.ts")
		vi.spyOn(tracker, "getTaskMetadata").mockResolvedValue({ files_in_context: [] })
		vi.spyOn(tracker, "saveTaskMetadata").mockResolvedValue(undefined)

		await tracker.addFileToFileContextTracker("task-id", "src/file.ts", "roo_edited")

		expect(tracker.getAndClearRecentlyModifiedFiles()).toEqual([])
	})

	it("creates one watcher per tracked file", () => {
		expect(vscode.workspace.createFileSystemWatcher).toHaveBeenCalledTimes(1)
		expect(mockWatcher.onDidChange).toHaveBeenCalledTimes(1)
	})
})
