import { describe, expect, it } from "vitest"

import { AssistantMessageParser } from "../AssistantMessageParser"
import { ToolUse } from "../../../shared/tools"
import { performReplacement } from "../../tools/fileEditTool"

// npx vitest src/core/assistant-message/__tests__/NativeToolCallEscapes.spec.ts

/**
 * Regression test for the \n corruption bug.
 *
 * A native tool call whose new_string contains code like `"Content-Type": mimeType,`
 * must survive parsing with its newlines decoded to REAL newlines (not literal "\n").
 */
describe("native tool call escape handling", () => {
	const argsString = JSON.stringify({
		file_path: "/tmp/indexController.ts",
		old_string: "  );\n\n  // AxonCode Inline Completion API",
		new_string:
			'  );\n\n  // Audio to Text Transcription API\n  fastify.post(\n    "/axoncode/audio/transcribe",\n    async function (request, reply) {\n      const headers = {\n        "Content-Type": mimeType,\n      };\n    },\n  );\n\n  // AxonCode Inline Completion API',
	})

	const expectedNewString = JSON.parse(argsString).new_string

	function runComplete(): ToolUse {
		const parser = new AssistantMessageParser()
		const gen = parser.processNativeToolCalls([
			{ index: 0, id: "call_1", type: "function", function: { name: "file_edit", arguments: argsString } },
		])
		// drain generator
		for (const _ of gen) {
			/* consume */
		}
		parser.finalizeContentBlocks()
		const blocks = parser.getContentBlocks()
		const toolUse = blocks.find((b) => b.type === "tool_use") as ToolUse
		return toolUse
	}

	// Replicates Task.ts end-of-stream ordering: stream deltas, then flip any
	// remaining partial blocks to partial:false (Task.ts:2710-2711), THEN
	// finalizeContentBlocks (Task.ts:2717). Returns ALL tool_use blocks so we
	// can detect duplicate/stale corrupt blocks.
	function runStreamedAsTaskDoes(chunkSize: number): ToolUse[] {
		const parser = new AssistantMessageParser()
		let first = true
		for (let i = 0; i < argsString.length; i += chunkSize) {
			const slice = argsString.slice(i, i + chunkSize)
			const call = first
				? { index: 0, id: "call_1", type: "function", function: { name: "file_edit", arguments: slice } }
				: { index: 0, function: { name: "", arguments: slice } }
			first = false
			for (const _ of parser.processNativeToolCalls([call as any])) {
				/* consume */
			}
		}
		// Task.ts:2710-2711 — flip leftover partials to complete BEFORE finalize.
		parser.getContentBlocks().forEach((b) => {
			if (b.partial) b.partial = false
		})
		parser.finalizeContentBlocks()
		return parser.getContentBlocks().filter((b) => b.type === "tool_use") as ToolUse[]
	}

	function runStreamed(chunkSize: number): ToolUse {
		const parser = new AssistantMessageParser()
		let first = true
		for (let i = 0; i < argsString.length; i += chunkSize) {
			const slice = argsString.slice(i, i + chunkSize)
			const call = first
				? { index: 0, id: "call_1", type: "function", function: { name: "file_edit", arguments: slice } }
				: { index: 0, function: { name: "", arguments: slice } }
			first = false
			for (const _ of parser.processNativeToolCalls([call as any])) {
				/* consume */
			}
		}
		parser.finalizeContentBlocks()
		const blocks = parser.getContentBlocks()
		return blocks.find((b) => b.type === "tool_use") as ToolUse
	}

	it("decodes \\n to real newlines (single complete delta)", () => {
		const toolUse = runComplete()
		expect(toolUse).toBeDefined()
		expect(toolUse.partial).toBe(false)
		const newString = toolUse.params.new_string as string
		expect(newString).toBe(expectedNewString)
		expect(newString.includes("\\n")).toBe(false)
	})

	it.each([1, 3, 7, 16, 64, 256])("decodes \\n to real newlines (streamed, chunkSize=%i)", (chunkSize) => {
		const toolUse = runStreamed(chunkSize)
		expect(toolUse).toBeDefined()
		expect(toolUse.partial).toBe(false)
		const newString = toolUse.params.new_string as string
		expect(newString.includes("\\n"), "new_string must NOT contain a literal backslash-n").toBe(false)
		expect(newString).toBe(expectedNewString)
	})

	// This is the real end-to-end ordering Task.ts uses. It catches the bug where
	// a corrupt partial (literal-\n params from extractPartialParams) survives into
	// the executable content blocks.
	it.each([1, 3, 7, 16, 64, 256, argsString.length])(
		"produces exactly one correct, non-literal block (Task ordering, chunkSize=%i)",
		(chunkSize) => {
			const toolUses = runStreamedAsTaskDoes(chunkSize)
			expect(toolUses.length, "must be exactly one executable file_edit block").toBe(1)
			const newString = toolUses[0].params.new_string as string
			const oldString = toolUses[0].params.old_string as string
			expect(newString.includes("\\n"), "new_string must NOT contain a literal backslash-n").toBe(false)
			expect(oldString.includes("\\n"), "old_string must NOT contain a literal backslash-n").toBe(false)
			expect(newString).toBe(expectedNewString)
		},
	)

	// FULL PIPELINE: parser output -> performReplacement -> final file bytes.
	// Proves the actual file content gets REAL newlines, not literal "\n".
	it.each([1, 7, 64, argsString.length])(
		"writes real newlines into the file (full pipeline, chunkSize=%i)",
		(chunkSize) => {
			const toolUses = runStreamedAsTaskDoes(chunkSize)
			expect(toolUses).toHaveLength(1)
			const { old_string, new_string } = toolUses[0].params as { old_string: string; new_string: string }

			// A realistic file that contains the region old_string targets.
			const fileBefore = ["export function register(fastify) {", old_string, "}", ""].join("\n")

			// Execute every parsed block exactly as presentAssistantMessage would.
			let content = fileBefore
			for (const tu of toolUses) {
				const p = tu.params as { old_string: string; new_string: string; replace_all?: string }
				content = performReplacement(content, p.old_string, p.new_string, p.replace_all === "true").content
			}

			// The transcribe route we inserted must be present as real lines.
			expect(content).toContain('"/axoncode/audio/transcribe"')
			expect(content).toContain("Audio to Text Transcription API")
			// And there must be NO literal backslash-n anywhere in the written file.
			expect(content.includes("\\n"), "file content must not contain a literal backslash-n").toBe(false)
			// The replacement actually changed the file.
			expect(content).not.toBe(fileBefore)
			expect(content.startsWith("export function register(fastify) {\n")).toBe(true)
		},
	)
})
