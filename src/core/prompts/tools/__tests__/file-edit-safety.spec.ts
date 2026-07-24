import { describe, expect, it } from "vitest"

import { getFileEditDescription } from "../file-edit"
import fileEditTool from "../native-tools/file_edit"
import multiFileEditTool from "../native-tools/multi_file_edit"

describe("file edit model guidance", () => {
	it("requires evidence-based retries in the text tool description", () => {
		const description = getFileEditDescription()

		expect(description).toContain("Never invent, reconstruct, or guess file content")
		expect(description).toContain("A missing or multiple-match error means no edit was applied")
		expect(description).toContain("Never use it merely to bypass a multiple-match error")
	})

	it.each([
		["file_edit", fileEditTool],
		["multi_file_edit", multiFileEditTool],
	])("requires verbatim unique matches in the %s native schema", (_name, tool) => {
		const description = tool.function.description.toLowerCase()

		expect(description).toContain("never invent, reconstruct, or guess file content")
		expect(description).toMatch(/never (?:merely )?to bypass (?:an )?ambiguity/)
	})
})
