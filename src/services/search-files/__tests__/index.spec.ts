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

	it("uses FFF by default", async () => {
		fffMock.mockResolvedValue({ engine: "fff", matches: [], nextCursor: null })

		const { text: output } = await searchFiles("/workspace", "/workspace/src", "needle")

		expect(output).toContain("Engine: fff")
		expect(fffMock).toHaveBeenCalledOnce()
		expect(ripgrepMock).not.toHaveBeenCalled()
	})

	it("falls back to ripgrep only when FFF errors", async () => {
		fffMock.mockRejectedValue(new Error("native unavailable"))
		ripgrepMock.mockResolvedValue({ engine: "ripgrep", matches: [], nextCursor: null })

		const { text: output } = await searchFiles("/workspace", "/workspace/src", "needle")

		expect(output).toContain("Engine: ripgrep")
		expect(output).toContain("FFF failed; used ripgrep fallback")
		expect(ripgrepMock).toHaveBeenCalledOnce()
	})

	it("continues a ripgrep cursor without attempting FFF", async () => {
		ripgrepMock.mockResolvedValue({ engine: "ripgrep", matches: [], nextCursor: null })

		await searchFiles("/workspace", "/workspace/src", "needle", undefined, undefined, {
			cursor: { engine: "ripgrep", offset: 50 },
		})

		// Return value is unused in this test; just verifying engine selection.

		expect(fffMock).not.toHaveBeenCalled()
		expect(ripgrepMock).toHaveBeenCalledOnce()
	})
})
