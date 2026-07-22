import { EventEmitter } from "events"
import { PassThrough } from "stream"

import * as childProcess from "child_process"

import { searchFilesWithRipgrep } from "../index"

vi.mock("vscode", () => ({ env: { appRoot: "/mock/app" } }))
vi.mock("../../../utils/fs", () => ({ fileExistsAtPath: vi.fn().mockResolvedValue(true) }))
vi.mock("child_process", () => ({ spawn: vi.fn() }))

function jsonLine(type: string, data: Record<string, unknown>): string {
	return JSON.stringify({ type, data })
}

function matchLine(line: number): string {
	return jsonLine("match", {
		line_number: line,
		lines: { text: `needle ${line}\n` },
		submatches: [{ start: 0 }],
	})
}

describe("ripgrep compact fallback", () => {
	beforeEach(() => vi.clearAllMocks())

	it("caps matches per file and advances the cursor past skipped matches", async () => {
		const stdout = new PassThrough()
		const stderr = new PassThrough()
		const process = Object.assign(new EventEmitter(), {
			stdout,
			stderr,
			kill: vi.fn(),
		})
		process.kill.mockImplementation(() => {
			queueMicrotask(() => process.emit("close", null))
			return true
		})
		vi.mocked(childProcess.spawn).mockReturnValue(process as never)

		const resultPromise = searchFilesWithRipgrep("/workspace", "/workspace", "needle", "*.ts", undefined, {
			maxResults: 4,
		})

		stdout.write(
			[
				jsonLine("begin", { path: { text: "/workspace/a.ts" } }),
				...Array.from({ length: 5 }, (_, index) => matchLine(index + 1)),
				jsonLine("end", {}),
				jsonLine("begin", { path: { text: "/workspace/b.ts" } }),
				matchLine(1),
			].join("\n") + "\n",
		)

		const result = await resultPromise

		expect(result.matches.map((match) => match.file)).toEqual(["a.ts", "a.ts", "a.ts", "b.ts"])
		expect(result.nextCursor).toEqual({ engine: "ripgrep", offset: 6 })
		expect(process.kill).toHaveBeenCalledOnce()
	})
})
