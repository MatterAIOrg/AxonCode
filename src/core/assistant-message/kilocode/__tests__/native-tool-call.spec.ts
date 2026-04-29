import { describe, expect, it } from "vitest"

import { parseDoubleEncodedParams } from "../native-tool-call"

// npx vitest src/core/assistant-message/kilocode/__tests__/native-tool-call.spec.ts

describe("parseDoubleEncodedParams", () => {
	it("returns null and undefined unchanged", () => {
		expect(parseDoubleEncodedParams(null)).toBeNull()
		expect(parseDoubleEncodedParams(undefined)).toBeUndefined()
	})

	it("returns plain objects unchanged", () => {
		const input = { file_path: "/tmp/a.txt", line_count: 3 }
		expect(parseDoubleEncodedParams(input)).toEqual(input)
	})

	it("preserves string property values that look like JSON (regression: file_write package.json)", () => {
		// This is the user's bug: content is a literal package.json string. The old
		// implementation would JSON.parse the content into an object, silently
		// breaking the file_write tool which expects a string.
		const packageJsonContent = '{\n  "name": "orb-proxy-worker",\n  "version": "1.0.0"\n}\n'
		const input = {
			content: packageJsonContent,
			file_path: "/tmp/package.json",
			line_count: 4,
		}

		const result = parseDoubleEncodedParams(input)

		expect(typeof result.content).toBe("string")
		expect(result.content).toBe(packageJsonContent)
		expect(result.file_path).toBe("/tmp/package.json")
	})

	it("preserves string property values that look like JSON arrays", () => {
		const input = { content: "[1, 2, 3]", file_path: "/tmp/data.json" }
		const result = parseDoubleEncodedParams(input)
		expect(typeof result.content).toBe("string")
		expect(result.content).toBe("[1, 2, 3]")
	})

	it("does not recurse into nested object string values", () => {
		const input = {
			meta: { description: '{"x":1}' },
			file_path: "/tmp/a.txt",
		}
		const result = parseDoubleEncodedParams(input)
		expect(typeof result.meta.description).toBe("string")
		expect(result.meta.description).toBe('{"x":1}')
	})

	it("unwraps a top-level double-encoded JSON object string", () => {
		// Genuine double-encoding: the entire arguments was JSON-stringified twice.
		const inner = JSON.stringify({ file_path: "/tmp/a.txt", content: "hello" })
		const result = parseDoubleEncodedParams(inner)
		expect(result).toEqual({ file_path: "/tmp/a.txt", content: "hello" })
		// The inner `content` string must remain a string, not be re-decoded.
		expect(typeof result.content).toBe("string")
	})

	it("unwraps a top-level double-encoded JSON array string", () => {
		const inner = JSON.stringify(["a", "b", "c"])
		const result = parseDoubleEncodedParams(inner)
		expect(result).toEqual(["a", "b", "c"])
	})

	it("returns string-of-a-string unchanged (does not over-peel)", () => {
		// JSON.parse of a JSON-encoded string yields a string. We only recurse
		// when the parse produced ANOTHER object/array-shaped string. A single
		// quoted string like '"hello"' should not be turned into "hello" via
		// this function — that's not its job.
		const wrappedString = JSON.stringify("hello") // -> '"hello"'
		// Doesn't start with `{` or `[`, so we leave it alone.
		expect(parseDoubleEncodedParams(wrappedString)).toBe('"hello"')
	})

	it("returns plain strings (non-JSON-shaped) unchanged", () => {
		expect(parseDoubleEncodedParams("just text")).toBe("just text")
		expect(parseDoubleEncodedParams("Now I have the documentation.")).toBe("Now I have the documentation.")
	})

	it("returns malformed JSON-looking strings unchanged", () => {
		const malformed = "{not valid json}"
		expect(parseDoubleEncodedParams(malformed)).toBe(malformed)
	})

	it("returns primitives unchanged", () => {
		expect(parseDoubleEncodedParams(42)).toBe(42)
		expect(parseDoubleEncodedParams(true)).toBe(true)
		expect(parseDoubleEncodedParams(false)).toBe(false)
	})
})
