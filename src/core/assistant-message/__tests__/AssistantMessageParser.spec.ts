import { beforeEach, describe, expect, it } from "vitest"

// npx vitest src/core/assistant-message/__tests__/AssistantMessageParser.spec.ts

import { AssistantMessageParser, tryParseToolArguments } from "../AssistantMessageParser"
import { AssistantMessageContent } from "../parseAssistantMessage"
import { TextContent, ToolUse } from "../../../shared/tools"

/**
 * Helper to filter out empty text content blocks.
 */
const isEmptyTextContent = (block: any) => block.type === "text" && (block as TextContent).content === ""

/**
 * Helper to simulate streaming by feeding the parser deterministic "random"-sized chunks (1-10 chars).
 * Uses a seeded pseudo-random number generator for deterministic chunking.
 */

// Simple linear congruential generator (LCG) for deterministic pseudo-random numbers
function createSeededRandom(seed: number) {
	let state = seed
	return {
		next: () => {
			// LCG parameters from Numerical Recipes
			state = (state * 1664525 + 1013904223) % 0x100000000
			return state / 0x100000000
		},
	}
}

function streamChunks(
	parser: AssistantMessageParser,
	message: string,
): ReturnType<AssistantMessageParser["getContentBlocks"]> {
	let result: AssistantMessageContent[] = []
	let i = 0
	const rng = createSeededRandom(42) // Fixed seed for deterministic tests
	while (i < message.length) {
		// Deterministic chunk size between 1 and 10, but not exceeding message length
		const chunkSize = Math.min(message.length - i, Math.floor(rng.next() * 10) + 1)
		const chunk = message.slice(i, i + chunkSize)
		result = parser.processChunk(chunk)
		i += chunkSize
	}
	return result
}

describe("AssistantMessageParser (streaming)", () => {
	let parser: AssistantMessageParser

	beforeEach(() => {
		parser = new AssistantMessageParser()
	})

	describe("text content streaming", () => {
		it("should accumulate a simple text message chunk by chunk", () => {
			const message = "Hello, this is a test."
			const result = streamChunks(parser, message)
			expect(result).toHaveLength(1)
			expect(result[0]).toEqual({
				type: "text",
				content: message,
				partial: true,
			})
		})

		it("should accumulate multi-line text message chunk by chunk", () => {
			const message = "Line 1\nLine 2\nLine 3"
			const result = streamChunks(parser, message)
			expect(result).toHaveLength(1)
			expect(result[0]).toEqual({
				type: "text",
				content: message,
				partial: true,
			})
		})
	})

	describe("tool use streaming", () => {
		it("should parse a tool use with parameter, streamed char by char", () => {
			const message = "<read_file><path>src/file.ts</path></read_file>"
			const result = streamChunks(parser, message).filter((block) => !isEmptyTextContent(block))
			expect(result).toHaveLength(1)
			const toolUse = result[0] as ToolUse
			expect(toolUse.type).toBe("tool_use")
			expect(toolUse.name).toBe("read_file")
			expect(toolUse.params.path).toBe("src/file.ts")
			expect(toolUse.partial).toBe(false)
		})

		it("should mark tool use as partial when not closed", () => {
			const message = "<read_file><path>src/file.ts</path>"
			const result = streamChunks(parser, message).filter((block) => !isEmptyTextContent(block))
			expect(result).toHaveLength(1)
			const toolUse = result[0] as ToolUse
			expect(toolUse.type).toBe("tool_use")
			expect(toolUse.name).toBe("read_file")
			expect(toolUse.params.path).toBe("src/file.ts")
			expect(toolUse.partial).toBe(true)
		})

		it("should handle a partial parameter in a tool use", () => {
			const message = "<read_file><path>src/file"
			const result = streamChunks(parser, message).filter((block) => !isEmptyTextContent(block))
			expect(result).toHaveLength(1)
			const toolUse = result[0] as ToolUse
			expect(toolUse.type).toBe("tool_use")
			expect(toolUse.name).toBe("read_file")
			expect(toolUse.params.path).toBe("src/file")
			expect(toolUse.partial).toBe(true)
		})

		it("should handle tool use with multiple parameters streamed", () => {
			const message =
				"<read_file><path>src/file.ts</path><start_line>10</start_line><end_line>20</end_line></read_file>"
			const result = streamChunks(parser, message).filter((block) => !isEmptyTextContent(block))
			expect(result).toHaveLength(1)
			const toolUse = result[0] as ToolUse
			expect(toolUse.type).toBe("tool_use")
			expect(toolUse.name).toBe("read_file")
			expect(toolUse.params.path).toBe("src/file.ts")
			expect(toolUse.params.start_line).toBe("10")
			expect(toolUse.params.end_line).toBe("20")
			expect(toolUse.partial).toBe(false)
		})
	})

	describe("mixed content streaming", () => {
		it("should parse text followed by a tool use, streamed", () => {
			const message = "Text before tool <read_file><path>src/file.ts</path></read_file>"
			const result = streamChunks(parser, message)
			expect(result).toHaveLength(2)
			const textContent = result[0] as TextContent
			expect(textContent.type).toBe("text")
			expect(textContent.content).toBe("Text before tool")
			expect(textContent.partial).toBe(false)
			const toolUse = result[1] as ToolUse
			expect(toolUse.type).toBe("tool_use")
			expect(toolUse.name).toBe("read_file")
			expect(toolUse.params.path).toBe("src/file.ts")
			expect(toolUse.partial).toBe(false)
		})

		it("should parse a tool use followed by text, streamed", () => {
			const message = "<read_file><path>src/file.ts</path></read_file>Text after tool"
			const result = streamChunks(parser, message).filter((block) => !isEmptyTextContent(block))
			expect(result).toHaveLength(2)
			const toolUse = result[0] as ToolUse
			expect(toolUse.type).toBe("tool_use")
			expect(toolUse.name).toBe("read_file")
			expect(toolUse.params.path).toBe("src/file.ts")
			expect(toolUse.partial).toBe(false)
			const textContent = result[1] as TextContent
			expect(textContent.type).toBe("text")
			expect(textContent.content).toBe("Text after tool")
			expect(textContent.partial).toBe(true)
		})

		it("should parse multiple tool uses separated by text, streamed", () => {
			const message =
				"First: <read_file><path>file1.ts</path></read_file>Second: <read_file><path>file2.ts</path></read_file>"
			const result = streamChunks(parser, message)
			expect(result).toHaveLength(4)
			expect(result[0].type).toBe("text")
			expect((result[0] as TextContent).content).toBe("First:")
			expect(result[1].type).toBe("tool_use")
			expect((result[1] as ToolUse).name).toBe("read_file")
			expect((result[1] as ToolUse).params.path).toBe("file1.ts")
			expect(result[2].type).toBe("text")
			expect((result[2] as TextContent).content).toBe("Second:")
			expect(result[3].type).toBe("tool_use")
			expect((result[3] as ToolUse).name).toBe("read_file")
			expect((result[3] as ToolUse).params.path).toBe("file2.ts")
		})

		it("should retain multiple native tool calls from one assistant response", () => {
			parser.processChunk("Let me inspect this.")

			const yielded = [
				...parser.processNativeToolCalls([
					{
						index: 0,
						id: "search_files:0",
						type: "function",
						function: {
							name: "search_files",
							arguments: '{"path":"src","regex":"JSON\\\\\\\\.parse","file_pattern":"*.ts"}',
						},
					},
					{
						index: 1,
						id: "read_file:1",
						type: "function",
						function: {
							name: "read_file",
							arguments: '{"file_path":"src/one.ts"}',
						},
					},
					{
						index: 2,
						id: "read_file:2",
						type: "function",
						function: {
							name: "read_file",
							arguments: '{"file_path":"src/two.ts"}',
						},
					},
				]),
			]

			const result = parser.getContentBlocks().filter((block) => !isEmptyTextContent(block))

			expect(yielded).toHaveLength(6)
			expect(result).toHaveLength(4)
			expect(result[0]).toEqual({
				type: "text",
				content: "Let me inspect this.",
				partial: false,
			})
			expect(result[1]).toMatchObject({
				type: "tool_use",
				name: "search_files",
				partial: false,
				toolUseId: "search_files:0",
			})
			expect((result[1] as ToolUse).params).toEqual({
				path: "src",
				regex: "JSON\\\\.parse",
				file_pattern: "*.ts",
			})
			expect(result[2]).toMatchObject({
				type: "tool_use",
				name: "read_file",
				partial: false,
				toolUseId: "read_file:1",
			})
			expect((result[2] as ToolUse).params).toEqual({ file_path: "src/one.ts" })
			expect(result[3]).toMatchObject({
				type: "tool_use",
				name: "read_file",
				partial: false,
				toolUseId: "read_file:2",
			})
			expect((result[3] as ToolUse).params).toEqual({ file_path: "src/two.ts" })
		})
	})

	describe("special and edge cases", () => {
		it("should handle the file_write tool with content that contains closing tags", () => {
			const message = `<file_write><path>src/file.ts</path><content>
	function example() {
	// This has XML-like content: </content>
	return true;
	}
	</content><line_count>5</line_count></file_write>`

			const result = streamChunks(parser, message).filter((block) => !isEmptyTextContent(block))

			expect(result).toHaveLength(1)
			const toolUse = result[0] as ToolUse
			expect(toolUse.type).toBe("tool_use")
			expect(toolUse.name).toBe("file_write")
			expect(toolUse.params.path).toBe("src/file.ts")
			expect(toolUse.params.line_count).toBe("5")
			expect(toolUse.params.content).toContain("function example()")
			expect(toolUse.params.content).toContain("// This has XML-like content: </content>")
			expect(toolUse.params.content).toContain("return true;")
			expect(toolUse.partial).toBe(false)
		})
		it("should handle empty messages", () => {
			const message = ""
			const result = streamChunks(parser, message)
			expect(result).toHaveLength(0)
		})

		it("should handle malformed tool use tags as plain text", () => {
			const message = "This has a <not_a_tool>malformed tag</not_a_tool>"
			const result = streamChunks(parser, message)
			expect(result).toHaveLength(1)
			expect(result[0].type).toBe("text")
			expect((result[0] as TextContent).content).toBe(message)
		})

		it("should handle tool use with no parameters", () => {
			const message = "<browser_action></browser_action>"
			const result = streamChunks(parser, message).filter((block) => !isEmptyTextContent(block))
			expect(result).toHaveLength(1)
			const toolUse = result[0] as ToolUse
			expect(toolUse.type).toBe("tool_use")
			expect(toolUse.name).toBe("browser_action")
			expect(Object.keys(toolUse.params).length).toBe(0)
			expect(toolUse.partial).toBe(false)
		})

		it("should handle a tool use with a parameter containing XML-like content", () => {
			const message = "<search_files><regex><div>.*</div></regex><path>src</path></search_files>"
			const result = streamChunks(parser, message).filter((block) => !isEmptyTextContent(block))
			expect(result).toHaveLength(1)
			const toolUse = result[0] as ToolUse
			expect(toolUse.type).toBe("tool_use")
			expect(toolUse.name).toBe("search_files")
			expect(toolUse.params.regex).toBe("<div>.*</div>")
			expect(toolUse.params.path).toBe("src")
			expect(toolUse.partial).toBe(false)
		})

		it("should handle consecutive tool uses without text in between", () => {
			const message = "<read_file><path>file1.ts</path></read_file><read_file><path>file2.ts</path></read_file>"
			const result = streamChunks(parser, message).filter((block) => !isEmptyTextContent(block))
			expect(result).toHaveLength(2)
			const toolUse1 = result[0] as ToolUse
			expect(toolUse1.type).toBe("tool_use")
			expect(toolUse1.name).toBe("read_file")
			expect(toolUse1.params.path).toBe("file1.ts")
			expect(toolUse1.partial).toBe(false)
			const toolUse2 = result[1] as ToolUse
			expect(toolUse2.type).toBe("tool_use")
			expect(toolUse2.name).toBe("read_file")
			expect(toolUse2.params.path).toBe("file2.ts")
			expect(toolUse2.partial).toBe(false)
		})

		it("should handle whitespace in parameters", () => {
			const message = "<read_file><path>  src/file.ts  </path></read_file>"
			const result = streamChunks(parser, message).filter((block) => !isEmptyTextContent(block))
			expect(result).toHaveLength(1)
			const toolUse = result[0] as ToolUse
			expect(toolUse.type).toBe("tool_use")
			expect(toolUse.name).toBe("read_file")
			expect(toolUse.params.path).toBe("src/file.ts")
			expect(toolUse.partial).toBe(false)
		})

		it("should handle multi-line parameters", () => {
			const message = `<file_write><path>file.ts</path><content>
	line 1
	line 2
	line 3
	</content><line_count>3</line_count></file_write>`
			const result = streamChunks(parser, message).filter((block) => !isEmptyTextContent(block))

			expect(result).toHaveLength(1)
			const toolUse = result[0] as ToolUse
			expect(toolUse.type).toBe("tool_use")
			expect(toolUse.name).toBe("file_write")
			expect(toolUse.params.path).toBe("file.ts")
			expect(toolUse.params.content).toContain("line 1")
			expect(toolUse.params.content).toContain("line 2")
			expect(toolUse.params.content).toContain("line 3")
			expect(toolUse.params.line_count).toBe("3")
			expect(toolUse.partial).toBe(false)
		})
		it("should handle a complex message with multiple content types", () => {
			const message = `I'll help you with that task.

	<read_file><path>src/index.ts</path></read_file>

	Now let's modify the file:

	<file_write><path>src/index.ts</path><content>
	// Updated content
	console.log("Hello world");
	</content><line_count>2</line_count></file_write>

	Let's run the code:

	<execute_command><command>node src/index.ts</command></execute_command>`

			const result = streamChunks(parser, message)

			expect(result).toHaveLength(6)

			// First text block
			expect(result[0].type).toBe("text")
			expect((result[0] as TextContent).content).toBe("I'll help you with that task.")

			// First tool use (read_file)
			expect(result[1].type).toBe("tool_use")
			expect((result[1] as ToolUse).name).toBe("read_file")

			// Second text block
			expect(result[2].type).toBe("text")
			expect((result[2] as TextContent).content).toContain("Now let's modify the file:")

			// Second tool use (file_write)
			expect(result[3].type).toBe("tool_use")
			expect((result[3] as ToolUse).name).toBe("file_write")

			// Third text block
			expect(result[4].type).toBe("text")
			expect((result[4] as TextContent).content).toContain("Let's run the code:")

			// Third tool use (execute_command)
			expect(result[5].type).toBe("tool_use")
			expect((result[5] as ToolUse).name).toBe("execute_command")
		})
	})

	describe("native tool calls with content", () => {
		it("should handle tool calls with natural language text in arguments (streaming)", () => {
			// Simulate LLM sending content text in tool call arguments initially
			// This can happen when both delta.content and delta.tool_calls are present
			parser.processChunk("Now I have the documentation. Let me create the Cloudflare Worker project.")

			// First delta: content text in arguments (should not crash)
			const yielded1 = [
				...parser.processNativeToolCalls([
					{
						index: 0,
						id: "file_write:0",
						type: "function",
						function: {
							name: "file_write",
							// Natural language text instead of JSON - should be handled gracefully
							arguments: "Now I have the documentation. Let me create the Cloudflare Worker project.",
						},
					},
				]),
			]

			// Should not yield anything yet since arguments don't look like JSON
			expect(yielded1).toHaveLength(0)

			// Second delta: actual JSON arguments
			const yielded2 = [
				...parser.processNativeToolCalls([
					{
						index: 0,
						function: {
							name: "file_write",
							arguments: '{"file_path": "/Users/xblack/Documents/gravity/reflare/package.json"}',
						},
					},
				]),
			]

			// Should yield the complete tool use
			expect(yielded2.length).toBeGreaterThan(0)

			const result = parser.getContentBlocks().filter((block) => !isEmptyTextContent(block))

			// Should have text content and the tool use
			expect(result.length).toBeGreaterThanOrEqual(2)
			expect(result[0].type).toBe("text")
			expect((result[0] as TextContent).content).toContain("Now I have the documentation")
		})

		it("should not crash when tool call arguments don't look like JSON", () => {
			// This simulates the exact error scenario from the bug report
			parser.processChunk("Let me create the files.")

			// Tool call with natural language arguments (not JSON)
			expect(() => {
				parser.processNativeToolCalls([
					{
						index: 0,
						id: "file_write:0",
						type: "function",
						function: {
							name: "file_write",
							arguments: "Now I have the documentation...",
						},
					},
				])
			}).not.toThrow()

			// Now provide valid JSON arguments
			const yielded = [
				...parser.processNativeToolCalls([
					{
						index: 0,
						function: {
							name: "file_write",
							arguments: '{"file_path": "test.json", "content": "{}"}',
						},
					},
				]),
			]

			expect(yielded.length).toBeGreaterThan(0)
		})

		it("should preserve string content that happens to be valid JSON (file_write package.json)", () => {
			// Regression: parseDoubleEncodedParams used to recurse into string property
			// values and JSON.parse anything that looked like JSON, which corrupted
			// file_write content for files that themselves contain JSON (e.g. package.json,
			// tsconfig.json). The tool then received `content` as an object instead of a
			// string and silently dropped the call.
			const packageJsonContent =
				'{\n  "name": "orb-proxy-worker",\n  "version": "1.0.0",\n  "main": "src/index.ts"\n}\n'

			const yielded = [
				...parser.processNativeToolCalls([
					{
						index: 0,
						id: "call_pkg",
						type: "function",
						function: {
							name: "file_write",
							arguments: JSON.stringify({
								content: packageJsonContent,
								file_path: "/tmp/package.json",
								line_count: 5,
							}),
						},
					},
				]),
			]

			expect(yielded.length).toBeGreaterThan(0)

			const toolUse = parser
				.getContentBlocks()
				.find((b) => b.type === "tool_use" && (b as ToolUse).name === "file_write") as ToolUse
			expect(toolUse).toBeDefined()
			expect(toolUse.partial).toBe(false)
			// Critical: content must remain a string with the original JSON text intact.
			expect(typeof toolUse.params.content).toBe("string")
			expect(toolUse.params.content).toBe(packageJsonContent)
			expect(toolUse.params.file_path).toBe("/tmp/package.json")
		})

		it("should handle parallel file_write tool calls in a single delta", () => {
			// Mirrors the user's bug: two file_write calls arrive in one delta, both
			// with content that is itself JSON. parseDoubleEncodedParams used to walk
			// into the `content` strings and JSON.parse them, turning content into an
			// object and silently dropping the calls.
			const pkgContent = '{\n  "name": "orb-proxy-worker"\n}\n'
			const tsConfigContent = '{\n  "compilerOptions": { "target": "ES2021" }\n}\n'

			void [
				...parser.processNativeToolCalls([
					{
						index: 0,
						id: "call_pkg",
						type: "function",
						function: {
							name: "file_write",
							arguments: JSON.stringify({
								content: pkgContent,
								file_path: "/tmp/package.json",
								line_count: 3,
							}),
						},
					},
					{
						index: 1,
						id: "call_tsconfig",
						type: "function",
						function: {
							name: "file_write",
							arguments: JSON.stringify({
								content: tsConfigContent,
								file_path: "/tmp/tsconfig.json",
								line_count: 3,
							}),
						},
					},
				]),
			]

			const toolUses = parser
				.getContentBlocks()
				.filter((b) => b.type === "tool_use" && (b as ToolUse).name === "file_write") as ToolUse[]
			expect(toolUses).toHaveLength(2)
			// Both calls must be marked complete so they actually execute.
			expect(toolUses.every((t) => t.partial === false)).toBe(true)
			// Critical: content must remain a string with the original JSON text intact,
			// not be re-decoded into an object by parseDoubleEncodedParams.
			const pkgUse = toolUses.find((t) => t.params.file_path === "/tmp/package.json")
			const tsUse = toolUses.find((t) => t.params.file_path === "/tmp/tsconfig.json")
			expect(typeof pkgUse?.params.content).toBe("string")
			expect(typeof tsUse?.params.content).toBe("string")
			expect(pkgUse?.params.content).toBe(pkgContent)
			expect(tsUse?.params.content).toBe(tsConfigContent)
		})

		it("should accumulate a tool call whose deltas carry an index but never an id", () => {
			// Some OpenAI-compatible providers never send an id per tool call. The
			// parser used to drop the first delta ("has index but no id") and then
			// every argument fragment for that index ("arguments for unknown tool
			// call"), so the whole tool call silently vanished.
			const yielded1 = [
				...parser.processNativeToolCalls([
					{
						index: 2,
						type: "function",
						function: {
							name: "read_file",
							arguments: '{"file_path": "src/a.ts"',
						},
					},
				]),
			]
			// Name known, JSON incomplete: only the partial block is emitted.
			expect(yielded1).toHaveLength(1)

			const yielded2 = [
				...parser.processNativeToolCalls([
					{
						index: 2,
						function: { arguments: "}" },
					},
				]),
			]
			expect(yielded2).toHaveLength(1)
			expect(yielded2[0].id).toBe("native-tool-call-2")

			const toolUse = parser
				.getContentBlocks()
				.find((b) => b.type === "tool_use" && (b as ToolUse).toolUseId === "native-tool-call-2") as ToolUse
			expect(toolUse).toBeDefined()
			expect(toolUse.partial).toBe(false)
			expect(toolUse.params.file_path).toBe("src/a.ts")
		})
	})

	describe("placeholder-tag repair (forked_change)", () => {
		it("keeps the value that follows a placeholder tag", () => {
			const raw = '{"files": [{"file_path": "/tmp/a.ts", "offset": 70, "limit": <longcat_arg_value>180}]}'
			const result = tryParseToolArguments(raw)
			expect(result).toBeDefined()
			expect(result!.repaired).toBe(true)
			expect(result!.parsed.files[0].limit).toBe(180)
			expect(result!.parsed.files[0].offset).toBe(70)
			expect(result!.parsed.files[0].file_path).toBe("/tmp/a.ts")
		})

		it("nulls a tag-only value so the tool default applies", () => {
			const raw = '{"files": [{"file_path": "/tmp/a.ts", "offset": 70, "limit": <longcat_arg_value>}]}'
			const result = tryParseToolArguments(raw)
			expect(result).toBeDefined()
			expect(result!.parsed.files[0]).toEqual({ file_path: "/tmp/a.ts", offset: 70, limit: null })
		})

		it("nulls a tag-only key followed by another member", () => {
			const result = tryParseToolArguments('{"path": <longcat_arg_value>, "regex": "foo"}')
			expect(result).toBeDefined()
			expect(result!.parsed).toEqual({ path: null, regex: "foo" })
		})

		it("nulls a tag-only first key", () => {
			const result = tryParseToolArguments('{"limit": <longcat_arg_value>, "offset": 5}')
			expect(result).toBeDefined()
			expect(result!.parsed).toEqual({ limit: null, offset: 5 })
		})

		it("keeps a string value that follows a placeholder tag", () => {
			const result = tryParseToolArguments('{"file_path": <longcat_arg_value>"/tmp/a.ts"}')
			expect(result).toBeDefined()
			expect(result!.parsed).toEqual({ file_path: "/tmp/a.ts" })
		})

		it("composes with the bare-scalar repair", () => {
			const result = tryParseToolArguments('{"file_pattern": <longcat_arg_value>*.ts}')
			expect(result).toBeDefined()
			expect(result!.parsed).toEqual({ file_pattern: "*.ts" })
		})

		it("still repairs bare scalars when no tags are present (regression)", () => {
			const result = tryParseToolArguments('{"file_pattern": *.ts}')
			expect(result).toBeDefined()
			expect(result!.parsed).toEqual({ file_pattern: "*.ts" })
		})

		it("never touches tags inside valid JSON string values", () => {
			const raw = '{"content": "uses <b>bold</b> and <longcat_arg_value> inside a string"}'
			const result = tryParseToolArguments(raw)
			expect(result).toBeDefined()
			expect(result!.parsed.content).toBe("uses <b>bold</b> and <longcat_arg_value> inside a string")
		})

		it("returns undefined for an incomplete buffer containing a tag (keep accumulating)", () => {
			const raw = '{"files": [{"file_path": "/tmp/a.ts", "limit": <longcat_arg_value>'
			expect(tryParseToolArguments(raw)).toBeUndefined()
		})

		it("reports repaired: false for well-formed JSON", () => {
			const result = tryParseToolArguments('{"path": "src"}')
			expect(result).toEqual({ parsed: { path: "src" }, repaired: false })
		})

		it("reports repaired: true when the repair pass ran", () => {
			const result = tryParseToolArguments('{"path": <longcat_arg_value>"src"}')
			expect(result!.repaired).toBe(true)
		})

		it("recovers a truncated buffer only at finalization", () => {
			const truncated = '{"path": "src'
			expect(tryParseToolArguments(truncated)).toBeUndefined()
			expect(tryParseToolArguments(truncated, { repairTruncated: true })).toEqual({
				parsed: { path: "src" },
				repaired: true,
			})
		})

		it("recovers a braceless body only at finalization", () => {
			expect(tryParseToolArguments('path: "src"')).toBeUndefined()
			expect(tryParseToolArguments('path: "src"', { repairTruncated: true })).toEqual({
				parsed: { path: "src" },
				repaired: true,
			})
		})
	})

	describe("native tool calls with placeholder tags", () => {
		const tagWithValueArgs =
			'{"files": [{"file_path": "/tmp/a.ts", "offset": 70, "limit": <longcat_arg_value>180}]}'
		const tagOnlyArgs = '{"files": [{"file_path": "/tmp/a.ts", "offset": 70, "limit": <longcat_arg_value>}]}'

		it("repairs a read_file call whose limit is prefixed by a placeholder tag", () => {
			const yielded = [
				...parser.processNativeToolCalls([
					{
						index: 0,
						id: "read_file:0",
						type: "function",
						function: { name: "read_file", arguments: tagWithValueArgs },
					},
				]),
			]
			// Partial (with tag-stripped display params) + complete.
			expect(yielded).toHaveLength(2)
			expect((yielded[0].input as Record<string, string>).limit).toBe("180")
			const toolUse = parser.getContentBlocks().find((b) => b.type === "tool_use") as ToolUse
			expect(toolUse.partial).toBe(false)
			expect(toolUse.repaired).toBe(true)
			expect((toolUse.params.files as unknown as Array<Record<string, unknown>>)[0]).toEqual({
				file_path: "/tmp/a.ts",
				offset: 70,
				limit: 180,
			})
		})

		it("nulls a tag-only limit so the read_file default applies", () => {
			const yielded = [
				...parser.processNativeToolCalls([
					{
						index: 0,
						id: "read_file:0",
						type: "function",
						function: { name: "read_file", arguments: tagOnlyArgs },
					},
				]),
			]
			expect(yielded).toHaveLength(2)
			const toolUse = parser.getContentBlocks().find((b) => b.type === "tool_use") as ToolUse
			expect(toolUse.partial).toBe(false)
			expect(toolUse.repaired).toBe(true)
			expect((toolUse.params.files as unknown as Array<Record<string, unknown>>)[0]).toEqual({
				file_path: "/tmp/a.ts",
				offset: 70,
				limit: null,
			})
		})

		it.each([1, 7, 64, tagWithValueArgs.length])(
			"completes a tag-repaired call streamed in small deltas (chunkSize=%i)",
			(chunkSize) => {
				let first = true
				for (let i = 0; i < tagWithValueArgs.length; i += chunkSize) {
					const call = first
						? {
								index: 0,
								id: "call_1",
								type: "function",
								function: { name: "read_file", arguments: tagWithValueArgs.slice(i, i + chunkSize) },
							}
						: { index: 0, function: { arguments: tagWithValueArgs.slice(i, i + chunkSize) } }
					first = false
					for (const _ of parser.processNativeToolCalls([call as any])) {
						/* consume */
					}
				}
				parser.finalizeContentBlocks()
				const toolUses = parser.getContentBlocks().filter((b) => b.type === "tool_use") as ToolUse[]
				expect(toolUses).toHaveLength(1)
				expect(toolUses[0].partial).toBe(false)
				expect((toolUses[0].params.files as unknown as Array<Record<string, unknown>>)[0]).toEqual({
					file_path: "/tmp/a.ts",
					offset: 70,
					limit: 180,
				})
			},
		)

		it.each([1, 7, 64, tagOnlyArgs.length])(
			"completes a tag-only streamed call with the value nulled (chunkSize=%i)",
			(chunkSize) => {
				let first = true
				for (let i = 0; i < tagOnlyArgs.length; i += chunkSize) {
					const call = first
						? {
								index: 0,
								id: "call_1",
								type: "function",
								function: { name: "read_file", arguments: tagOnlyArgs.slice(i, i + chunkSize) },
							}
						: { index: 0, function: { arguments: tagOnlyArgs.slice(i, i + chunkSize) } }
					first = false
					for (const _ of parser.processNativeToolCalls([call as any])) {
						/* consume */
					}
				}
				parser.finalizeContentBlocks()
				const toolUses = parser.getContentBlocks().filter((b) => b.type === "tool_use") as ToolUse[]
				expect(toolUses).toHaveLength(1)
				expect(toolUses[0].partial).toBe(false)
				expect((toolUses[0].params.files as unknown as Array<Record<string, unknown>>)[0]).toEqual({
					file_path: "/tmp/a.ts",
					offset: 70,
					limit: null,
				})
			},
		)
	})

	describe("size limit handling", () => {
		it("should throw an error when MAX_ACCUMULATOR_SIZE is exceeded", () => {
			// Create a message that exceeds 1MB (MAX_ACCUMULATOR_SIZE)
			const largeMessage = "x".repeat(1024 * 1024 + 1) // 1MB + 1 byte

			expect(() => {
				parser.processChunk(largeMessage)
			}).toThrow("Assistant message exceeds maximum allowed size")
		})

		it("should gracefully handle a parameter that exceeds MAX_PARAM_LENGTH", () => {
			// Create a parameter value that exceeds 100KB (MAX_PARAM_LENGTH)
			const largeParamValue = "x".repeat(1024 * 100 + 1) // 100KB + 1 byte
			const message = `<file_write><path>test.txt</path><content>${largeParamValue}</content></file_write>After tool`

			// Process the message in chunks to simulate streaming
			let result: AssistantMessageContent[] = []
			let error: Error | null = null

			try {
				// Process the opening tags
				result = parser.processChunk("<file_write><path>test.txt</path><content>")

				// Process the large parameter value in chunks
				const chunkSize = 1000
				for (let i = 0; i < largeParamValue.length; i += chunkSize) {
					const chunk = largeParamValue.slice(i, i + chunkSize)
					result = parser.processChunk(chunk)
				}

				// Process the closing tags and text after
				result = parser.processChunk("</content></file_write>After tool")
			} catch (e) {
				error = e as Error
			}

			// Should not throw an error
			expect(error).toBeNull()

			// Should have processed the content
			expect(result.length).toBeGreaterThan(0)

			// The tool use should exist but the content parameter should be reset/empty
			const toolUse = result.find((block) => block.type === "tool_use") as ToolUse
			expect(toolUse).toBeDefined()
			expect(toolUse.name).toBe("file_write")
			expect(toolUse.params.path).toBe("test.txt")

			// The text after the tool should still be parsed
			const textAfter = result.find(
				(block) => block.type === "text" && (block as TextContent).content.includes("After tool"),
			)
			expect(textAfter).toBeDefined()
		})
	})

	describe("finalizeContentBlocks", () => {
		it("should mark all partial blocks as complete", () => {
			const message = "<read_file><path>src/file.ts"
			streamChunks(parser, message)
			let blocks = parser.getContentBlocks()
			// The block may already be partial or not, depending on chunking.
			// To ensure the test is robust, we only assert after finalizeContentBlocks.
			parser.finalizeContentBlocks()
			blocks = parser.getContentBlocks()
			expect(blocks[0].partial).toBe(false)
		})
	})
})
