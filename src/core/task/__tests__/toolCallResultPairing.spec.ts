// npx vitest core/task/__tests__/toolCallResultPairing.spec.ts

import { describe, expect, it } from "vitest"
import { Anthropic } from "@anthropic-ai/sdk"

import {
	allToolResultsCollected,
	reconcileAssistantToolUses,
	toolUseIdsRequiringResults,
} from "../toolCallResultPairing"

const toolUse = (id: string, name = "read_file"): Anthropic.Messages.ToolUseBlockParam => ({
	type: "tool_use",
	id,
	name,
	input: { file_path: `${id}.ts` },
})

const toolResult = (id: string): Anthropic.ToolResultBlockParam => ({
	type: "tool_result",
	tool_use_id: id,
	content: [{ type: "text", text: "ok" }],
})

describe("reconcileAssistantToolUses", () => {
	it("keeps the streamed order for calls that survived finalization", () => {
		const streamed = [toolUse("call_1"), toolUse("call_2")]
		const finalized = [toolUse("call_1"), toolUse("call_2")]

		const result = reconcileAssistantToolUses(streamed, finalized)

		expect(result.map((t) => t.id)).toEqual(["call_1", "call_2"])
	})

	it("drops a streamed partial that was dropped at finalization (orphan tool_call)", () => {
		// call_2 streamed a partial whose JSON never became valid, so it is absent
		// from the finalized/executable set and must not appear in the assistant turn.
		const streamed = [toolUse("call_1"), toolUse("call_2")]
		const finalized = [toolUse("call_1")]

		const result = reconcileAssistantToolUses(streamed, finalized)

		expect(result.map((t) => t.id)).toEqual(["call_1"])
	})

	it("appends calls that only finalized at end-of-stream", () => {
		// A native call delivered in a single complete chunk may be missing from the
		// streamed list but present in the finalized content.
		const streamed = [toolUse("call_1")]
		const finalized = [toolUse("call_1"), toolUse("call_2")]

		const result = reconcileAssistantToolUses(streamed, finalized)

		expect(result.map((t) => t.id)).toEqual(["call_1", "call_2"])
	})

	it("returns the finalized set when nothing was streamed", () => {
		const result = reconcileAssistantToolUses([], [toolUse("call_1"), toolUse("call_2")])
		expect(result.map((t) => t.id)).toEqual(["call_1", "call_2"])
	})
})

describe("toolUseIdsRequiringResults", () => {
	it("returns ids for tool uses that have a non-empty id", () => {
		expect(toolUseIdsRequiringResults([toolUse("call_1"), toolUse("call_2")])).toEqual(["call_1", "call_2"])
	})

	it("ignores tool uses with an empty id (e.g. legacy XML tool calls)", () => {
		expect(toolUseIdsRequiringResults([toolUse(""), toolUse("call_1")])).toEqual(["call_1"])
	})

	it("returns an empty array when there are no tool uses", () => {
		expect(toolUseIdsRequiringResults([])).toEqual([])
	})
})

describe("allToolResultsCollected", () => {
	it("is true only once every expected id has a matching tool_result", () => {
		const expected = ["call_1", "call_2"]

		// The reported bug: assistant has 2 tool_calls, only the first result collected.
		expect(allToolResultsCollected(expected, [toolResult("call_1")])).toBe(false)

		// Once both results are present the request may fire.
		expect(allToolResultsCollected(expected, [toolResult("call_1"), toolResult("call_2")])).toBe(true)
	})

	it("ignores non-tool_result blocks and result ordering", () => {
		const expected = ["call_1", "call_2"]
		const collected: (Anthropic.TextBlockParam | Anthropic.ToolResultBlockParam)[] = [
			toolResult("call_2"),
			{ type: "text", text: "some interleaved note" },
			toolResult("call_1"),
		]
		expect(allToolResultsCollected(expected, collected)).toBe(true)
	})

	it("is true when no results are expected", () => {
		expect(allToolResultsCollected([], [])).toBe(true)
	})

	it("stays false while a result for an expected id is still missing", () => {
		expect(
			allToolResultsCollected(["call_1", "call_2", "call_3"], [toolResult("call_1"), toolResult("call_3")]),
		).toBe(false)
	})
})
