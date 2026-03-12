import { describe, expect, it } from "vitest"

import { rankWorkspaceSearchResults, type FileResult } from "../file-search"

describe("rankWorkspaceSearchResults", () => {
	it("prefers exact basename and extension matches over similarly named siblings", () => {
		const results: FileResult[] = [
			{ path: "src/components/ChatTextArea.ts", type: "file", label: "ChatTextArea.ts" },
			{ path: "src/components/ChatTextArea.tsx", type: "file", label: "ChatTextArea.tsx" },
			{ path: "src/components/ChatTextArea.test.tsx", type: "file", label: "ChatTextArea.test.tsx" },
		]

		const ranked = rankWorkspaceSearchResults(results, "ChatTextArea.tsx")

		expect(ranked[0]?.path).toBe("src/components/ChatTextArea.tsx")
	})

	it("prefers the file when the query includes the file extension", () => {
		const results: FileResult[] = [
			{ path: "src/components/button", type: "folder", label: "button" },
			{ path: "src/components/button.tsx", type: "file", label: "button.tsx" },
		]

		const ranked = rankWorkspaceSearchResults(results, "button.tsx")

		expect(ranked[0]?.path).toBe("src/components/button.tsx")
	})
})
