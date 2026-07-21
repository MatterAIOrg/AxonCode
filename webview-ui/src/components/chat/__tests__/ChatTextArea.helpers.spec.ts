import { describe, expect, it } from "vitest"

import { fileBaseName, fileExt } from "../ChatTextArea"

describe("fileExt", () => {
	it("returns a lowercased, dot-prefixed extension", () => {
		expect(fileExt("report.pdf")).toBe(".pdf")
		expect(fileExt("Report.PDF")).toBe(".pdf")
	})

	it("returns an empty string for files without an extension", () => {
		expect(fileExt("README")).toBe("")
		expect(fileExt(".gitignore")).toBe("")
	})
})

describe("fileBaseName", () => {
	it("strips a lowercase extension from a lowercase filename", () => {
		expect(fileBaseName("report.pdf", ".pdf")).toBe("report")
	})

	it("strips an uppercase extension while preserving the base name casing", () => {
		// Regression: previously name.endsWith(".pdf") was false for "Report.PDF",
		// leaving the extension in place and producing "Report.PDF.pdf" downstream.
		expect(fileBaseName("Report.PDF", ".pdf")).toBe("Report")
	})

	it("leaves the name untouched when the extension does not match", () => {
		expect(fileBaseName("report.docx", ".pdf")).toBe("report.docx")
	})

	it("returns the name unchanged for an empty extension", () => {
		expect(fileBaseName("README", "")).toBe("README")
	})
})
