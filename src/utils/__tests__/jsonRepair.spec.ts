import { describe, expect, it } from "vitest"

// npx vitest src/utils/__tests__/jsonRepair.spec.ts

import { formatArgumentRepairNote, parseToolCallArguments } from "../jsonRepair"

const parse = (raw: string, options?: { repairTruncated?: boolean }) => parseToolCallArguments(raw, options)

describe("parseToolCallArguments — strict path", () => {
	it("parses valid JSON verbatim and reports repaired: false", () => {
		const result = parse('{"a": 1, "b": [1, 2, {"c": null}], "d": "text"}')
		expect(result).toEqual({ args: { a: 1, b: [1, 2, { c: null }], d: "text" }, repaired: false })
	})

	it("never touches tags inside valid JSON string values", () => {
		const raw = '{"content": "uses <b>bold</b> and <longcat_arg_value> inside a string"}'
		const result = parse(raw)
		expect(result!.repaired).toBe(false)
		expect(result!.args).toEqual({ content: "uses <b>bold</b> and <longcat_arg_value> inside a string" })
	})

	it("keeps keys that contain colons when the JSON is otherwise valid", () => {
		const raw = '{"Content-Type": "text/html", "X-Custom": "1"}'
		expect(parse(raw)).toEqual({ args: { "Content-Type": "text/html", "X-Custom": "1" }, repaired: false })
	})

	it("parses a valid array payload without unwrapping it", () => {
		const result = parse('[{"a": 1}, {"b": 2}]')
		expect(result!.repaired).toBe(false)
		expect(result!.args).toEqual([{ a: 1 }, { b: 2 }])
	})

	it("returns null for empty input", () => {
		expect(parse("")).toBeNull()
		expect(parse("   ")).toBeNull()
	})
})

describe("parseToolCallArguments — placeholder tags", () => {
	it("keeps the value that follows a placeholder tag", () => {
		const raw = '{"files": [{"file_path": "/tmp/a.ts", "offset": 70, "limit": <longcat_arg_value>180}]}'
		const result = parse(raw)
		expect(result!.repaired).toBe(true)
		expect(result!.args).toEqual({
			files: [{ file_path: "/tmp/a.ts", offset: 70, limit: 180 }],
		})
	})

	it("nulls a tag-only value so the tool default applies", () => {
		const raw = '{"files": [{"file_path": "/tmp/a.ts", "offset": 70, "limit": <longcat_arg_value>}]}'
		const result = parse(raw)
		expect(result!.repaired).toBe(true)
		expect(result!.args).toEqual({
			files: [{ file_path: "/tmp/a.ts", offset: 70, limit: null }],
		})
	})

	it("nulls a tag-only key followed by another member", () => {
		const result = parse('{"path": <longcat_arg_value>, "regex": "foo"}')
		expect(result!.repaired).toBe(true)
		expect(result!.args).toEqual({ path: null, regex: "foo" })
	})

	it("nulls a tag-only first key", () => {
		const result = parse('{"limit": <longcat_arg_value>, "offset": 5}')
		expect(result!.repaired).toBe(true)
		expect(result!.args).toEqual({ limit: null, offset: 5 })
	})

	it("keeps a string value that follows a placeholder tag", () => {
		const result = parse('{"file_path": <longcat_arg_value>"/tmp/a.ts"}')
		expect(result!.repaired).toBe(true)
		expect(result!.args).toEqual({ file_path: "/tmp/a.ts" })
	})

	it("quotes a bare scalar that follows a placeholder tag", () => {
		const result = parse('{"file_pattern": <longcat_arg_value>*.ts}')
		expect(result!.repaired).toBe(true)
		expect(result!.args).toEqual({ file_pattern: "*.ts" })
	})

	it("strips a tag that prefixes a key", () => {
		const result = parse('{"</longcat_arg_key>path": "src"}')
		expect(result!.repaired).toBe(true)
		expect(result!.args).toEqual({ path: "src" })
	})

	it("drops a key whose closing quote was replaced by a tag", () => {
		const result = parse('{"offset</longcat_arg_key>, "regex": "foo"}')
		expect(result!.repaired).toBe(true)
		expect(result!.args).toEqual({ regex: "foo" })
	})

	it("preserves tags inside string values of otherwise-broken JSON", () => {
		const result = parse('{"content": "uses <b>bold</b>", path: "src"}')
		expect(result!.repaired).toBe(true)
		expect(result!.args).toEqual({ content: "uses <b>bold</b>", path: "src" })
	})

	it("returns null for an incomplete buffer containing a tag (keep accumulating)", () => {
		const raw = '{"files": [{"file_path": "/tmp/a.ts", "limit": <longcat_arg_value>'
		expect(parse(raw)).toBeNull()
	})
})

describe("parseToolCallArguments — unquoted keys and values", () => {
	it("quotes bare keys", () => {
		const result = parse('{path: "src", regex: "foo"}')
		expect(result!.repaired).toBe(true)
		expect(result!.args).toEqual({ path: "src", regex: "foo" })
	})

	it("quotes bare scalar values", () => {
		const result = parse('{"file_pattern": *.ts}')
		expect(result!.repaired).toBe(true)
		expect(result!.args).toEqual({ file_pattern: "*.ts" })
	})

	it("keeps strict numbers as numbers", () => {
		const result = parse("{a: 1, b: 2.5, c: -3, d: 1e3}")
		expect(result!.args).toEqual({ a: 1, b: 2.5, c: -3, d: 1000 })
	})

	it("keeps JSON booleans and null unquoted", () => {
		const result = parse("{a: true, b: false, c: null}")
		expect(result!.args).toEqual({ a: true, b: false, c: null })
	})

	it("keeps colons inside bare values so URLs survive", () => {
		const result = parse('{"url": https://example.com/x}')
		expect(result!.args).toEqual({ url: "https://example.com/x" })
	})

	it("repairs nested structures", () => {
		const result = parse('{"files": [{path: "a.ts", offset: 5}]}')
		expect(result!.args).toEqual({ files: [{ path: "a.ts", offset: 5 }] })
	})
})

describe("parseToolCallArguments — single quotes and Python literals", () => {
	it("converts single-quoted keys and values", () => {
		const result = parse("{'path': 'src'}")
		expect(result!.repaired).toBe(true)
		expect(result!.args).toEqual({ path: "src" })
	})

	it("unescapes escaped single quotes inside values", () => {
		const result = parse("{'text': 'it\\'s'}")
		expect(result!.args).toEqual({ text: "it's" })
	})

	it("maps Python literals to JSON", () => {
		const result = parse("{show_line_numbers: True, include_summary: False, cursor: None}")
		expect(result!.repaired).toBe(true)
		expect(result!.args).toEqual({ show_line_numbers: true, include_summary: false, cursor: null })
	})
})

describe("parseToolCallArguments — comments and separators", () => {
	it("strips line and block comments", () => {
		const raw = [
			"{",
			"  // search for the parser",
			'  "path": "src",',
			'  "regex": "foo" /* trailing */',
			"}",
		].join("\n")
		const result = parse(raw)
		expect(result!.repaired).toBe(true)
		expect(result!.args).toEqual({ path: "src", regex: "foo" })
	})

	it("drops trailing commas before closers", () => {
		const result = parse('{"a": 1, "b": [1, 2,],}')
		expect(result!.repaired).toBe(true)
		expect(result!.args).toEqual({ a: 1, b: [1, 2] })
	})

	it("inserts a missing comma between members", () => {
		const result = parse('{"a": 1 "b": 2}')
		expect(result!.repaired).toBe(true)
		expect(result!.args).toEqual({ a: 1, b: 2 })
	})
})

describe("parseToolCallArguments — dropped key quotes", () => {
	it("recovers a key whose closing quote was lost to a colon split", () => {
		const result = parse('{"offset: 600, "regex": "foo"}')
		expect(result!.repaired).toBe(true)
		expect(result!.args).toEqual({ offset: 600, regex: "foo" })
	})

	it("recovers a dangling key with its value on truncation", () => {
		const result = parse('{"offset: 600', { repairTruncated: true })
		expect(result!.repaired).toBe(true)
		expect(result!.args).toEqual({ offset: 600 })
	})
})

describe("parseToolCallArguments — truncation repair", () => {
	it("closes a dangling string value", () => {
		const result = parse('{"path": "src/foo', { repairTruncated: true })
		expect(result!.repaired).toBe(true)
		expect(result!.args).toEqual({ path: "src/foo" })
	})

	it("appends null after a dangling colon", () => {
		const result = parse('{"path": "src", "offset":', { repairTruncated: true })
		expect(result!.repaired).toBe(true)
		expect(result!.args).toEqual({ path: "src", offset: null })
	})

	it("closes unclosed containers innermost-first", () => {
		const result = parse('{"files": [{"file_path": "/tmp/a.ts"', { repairTruncated: true })
		expect(result!.repaired).toBe(true)
		expect(result!.args).toEqual({ files: [{ file_path: "/tmp/a.ts" }] })
	})

	it("drops a dangling key and its trailing comma", () => {
		const result = parse('{"a": 1, "b"', { repairTruncated: true })
		expect(result!.repaired).toBe(true)
		expect(result!.args).toEqual({ a: 1 })
	})

	it("closes an unclosed array", () => {
		const result = parse("[1, 2", { repairTruncated: true })
		expect(result!.repaired).toBe(true)
		expect(result!.args).toEqual([1, 2])
	})

	it("drops a trailing comma at end of input", () => {
		const result = parse('{"a": 1,', { repairTruncated: true })
		expect(result!.repaired).toBe(true)
		expect(result!.args).toEqual({ a: 1 })
	})

	it("returns null for incomplete input without repairTruncated", () => {
		expect(parse('{"path": "src/foo')).toBeNull()
		expect(parse('{"a": 1')).toBeNull()
		expect(parse("[1, 2")).toBeNull()
	})
})

describe("parseToolCallArguments — braceless bodies", () => {
	it("wraps a braceless body when repairing a finalized buffer", () => {
		const result = parse('path: "src", regex: "foo"', { repairTruncated: true })
		expect(result!.repaired).toBe(true)
		expect(result!.args).toEqual({ path: "src", regex: "foo" })
	})

	it("returns null for a braceless buffer while still streaming", () => {
		expect(parse('path: "src"')).toBeNull()
	})
})

describe("parseToolCallArguments — single-object arrays", () => {
	it("unwraps a repaired single-object array", () => {
		const result = parse("[{path: 'src'}]")
		expect(result!.repaired).toBe(true)
		expect(result!.args).toEqual({ path: "src" })
	})
})

describe("parseToolCallArguments — unrecoverable input", () => {
	it("returns null for prose", () => {
		expect(parse("just some prose")).toBeNull()
		expect(parse("just some prose", { repairTruncated: true })).toBeNull()
	})

	it("returns null for a key not followed by a colon", () => {
		expect(parse('{"a" 1}')).toBeNull()
	})
})

describe("formatArgumentRepairNote", () => {
	it("includes the executed arguments", () => {
		const note = formatArgumentRepairNote('{"path": "src"}')
		expect(note).toContain("malformed JSON")
		expect(note).toContain('{"path": "src"}')
	})

	it("truncates very long arguments", () => {
		const note = formatArgumentRepairNote("x".repeat(3000))
		expect(note).toContain("...(truncated)")
		expect(note.length).toBeLessThan(2200)
	})
})
