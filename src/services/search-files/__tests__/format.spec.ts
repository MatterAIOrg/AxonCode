import { formatSearchPage, truncateSearchLine } from "../format"
import { normalizeNullableSearchString, parseSearchCursor, serializeSearchCursor } from "../types"

describe("search_files compact output", () => {
	it("groups matches by file and emits a continuation cursor", () => {
		const output = formatSearchPage({
			engine: "fff",
			nextCursor: { engine: "fff", offset: 42 },
			matches: [
				{ file: "src/a.ts", line: 12, column: 4, text: "const value = 1", isDefinition: true },
				{ file: "src/a.ts", line: 18, column: 2, text: "value++" },
			],
		})

		expect(output).toContain("Engine: fff")
		expect(output).toContain("Matches: 2")
		expect(output).toContain("Next cursor: fff:42")
		expect(output.match(/# src\/a\.ts/g)).toHaveLength(1)
		expect(output).toContain("> 12:4 def | const value = 1")
	})

	it("deduplicates overlapping context lines", () => {
		const output = formatSearchPage({
			engine: "fff",
			nextCursor: null,
			matches: [
				{
					file: "src/a.ts",
					line: 2,
					column: 1,
					text: "match one",
					contextAfter: [{ line: 3, text: "shared" }],
				},
				{
					file: "src/a.ts",
					line: 4,
					column: 1,
					text: "match two",
					contextBefore: [{ line: 3, text: "shared" }],
				},
			],
		})

		expect(output.match(/3 \| shared/g)).toHaveLength(1)
	})

	it("truncates very long lines", () => {
		expect(truncateSearchLine("x".repeat(400))).toHaveLength(312)
		expect(truncateSearchLine("short")).toBe("short")
	})
})

describe("search cursor", () => {
	it("round trips engine-specific offsets", () => {
		const cursor = parseSearchCursor("ripgrep:120")
		expect(cursor).toEqual({ engine: "ripgrep", offset: 120 })
		expect(serializeSearchCursor(cursor)).toBe("ripgrep:120")
	})

	it("tolerates a quoted null from less reliable tool callers", () => {
		expect(parseSearchCursor("null")).toBeNull()
		expect(parseSearchCursor(" NULL ")).toBeNull()
		expect(normalizeNullableSearchString("null")).toBeUndefined()
		expect(normalizeNullableSearchString(" *.ts ")).toBe("*.ts")
	})

	it("rejects malformed cursors", () => {
		expect(() => parseSearchCursor("42")).toThrow(/format/)
	})
})
