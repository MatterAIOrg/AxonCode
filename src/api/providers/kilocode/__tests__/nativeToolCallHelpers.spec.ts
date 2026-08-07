import type OpenAI from "openai"
import type { ProviderSettings } from "@roo-code/types"

import { addNativeToolCallsToParams } from "../nativeToolCallHelpers"

function requestParams(): OpenAI.Chat.ChatCompletionCreateParamsNonStreaming {
	return {
		model: "test-model",
		messages: [{ role: "user", content: "hello" }],
	}
}

describe("addNativeToolCallsToParams", () => {
	it("honors an explicitly empty allowed-tools list", () => {
		const params = requestParams()

		addNativeToolCallsToParams(params, {} as ProviderSettings, { taskId: "task-1", allowedTools: [] })

		expect(params.tools).toBeUndefined()
		expect(params.tool_choice).toBeUndefined()
	})

	it("keeps the default native tools when metadata does not specify a list", () => {
		const params = requestParams()

		addNativeToolCallsToParams(params, {} as ProviderSettings)

		expect(params.tools?.length).toBeGreaterThan(0)
		expect(params.tool_choice).toBe("auto")
	})
})
