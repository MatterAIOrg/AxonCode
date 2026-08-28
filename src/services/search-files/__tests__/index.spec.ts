import { beforeEach, vi } from "vitest"

import { searchFilesWithFff } from "../../fff"
import { searchFilesWithRipgrep } from "../../ripgrep"
import { searchFiles } from ".."

vi.mock("../../fff", () => ({ searchFilesWithFff: vi.fn() }))
vi.mock("../../ripgrep", () => ({ searchFilesWithRipgrep: vi.fn() }))

const fffMock = vi.mocked(searchFilesWithFff)
const ripgrepMock = vi.mocked(searchFilesWithRipgrep)

describe("search_files engine selection", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	it("uses ripgrep by default", async () => {
		ripgrepMock.mockResolvedValue({ engine: "ripgrep", matches: [], nextCursor: null })

		const { text: output } = await searchFiles("/workspace", "/workspace/src", "needle")

		expect(output).toContain("Engine: ripgrep")
		expect(ripgrepMock).toHaveBeenCalledOnce()
		expect(fffMock).not.toHaveBeenCalled()
	})

	it("falls back to FFF only when ripgrep errors", async () => {
		ripgrepMock.mockRejectedValue(new Error("ripgrep unavailable"))
		fffMock.mockResolvedValue({ engine: "fff", matches: [], nextCursor: null })

		const { text: output } = await searchFiles("/workspace", "/workspace/src", "needle")

		expect(output).toContain("Engine: fff")
		expect(output).toContain("ripgrep failed; used FFF fallback")
		expect(fffMock).toHaveBeenCalledOnce()
	})

	it("continues an engine-specific cursor without changing engines", async () => {
		fffMock.mockResolvedValue({ engine: "fff", matches: [], nextCursor: null })

		await searchFiles("/workspace", "/workspace/src", "needle", undefined, undefined, {
			cursor: { engine: "fff", offset: 50 },
		})

		// Return value is unused in this test; just verifying engine selection.

		expect(fffMock).toHaveBeenCalledOnce()
		expect(ripgrepMock).not.toHaveBeenCalled()
	})
})
