import { describe, expect, it } from "vitest"

import { addNativeToolCallsToParams } from "../nativeToolCallHelpers"

describe("addNativeToolCallsToParams", () => {
	it("preserves an explicitly empty mode tool list", () => {
		const params = { model: "test-model", messages: [] } as any

		addNativeToolCallsToParams(params, {} as any, { allowedTools: [] } as any)

		expect(params.tools).toBeUndefined()
		expect(params.parallel_tool_calls).toBeUndefined()
	})

	it("uses the default native tools when exposure metadata is absent", () => {
		const params = { model: "test-model", messages: [] } as any

		addNativeToolCallsToParams(params, {} as any)

		expect(params.tools.length).toBeGreaterThan(0)
		expect(params.parallel_tool_calls).toBe(true)
	})
})
