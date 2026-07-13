import { describe, expect, it } from "vitest"

import { formatMessageWithDocuments } from "../DocumentAttachments"

describe("formatMessageWithDocuments", () => {
	it("leaves messages without documents unchanged", () => {
		expect(formatMessageWithDocuments("  hello  ", [])).toBe("hello")
	})

	it("adds clearly delimited extracted text", () => {
		const result = formatMessageWithDocuments("Summarize this", [
			{ name: "report.pdf", text: "Extracted report text" },
			{ name: "data.csv", text: "name,value\nalpha,1" },
		])

		expect(result).toContain("Summarize this\n\nAttached files (parsed as text):")
		expect(result).toContain("--- BEGIN ATTACHED FILE: report.pdf ---\nExtracted report text")
		expect(result).toContain("--- END ATTACHED FILE: data.csv ---")
	})

	it("supports document-only messages and keeps filenames on one line", () => {
		const result = formatMessageWithDocuments("", [{ name: "unsafe\nname.txt", text: "content" }])

		expect(result).toContain("Attached files (parsed as text):")
		expect(result).toContain("BEGIN ATTACHED FILE: unsafe name.txt")
	})
})
