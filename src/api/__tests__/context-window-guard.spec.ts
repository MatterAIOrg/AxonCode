import { Anthropic } from "@anthropic-ai/sdk"
import type { ModelInfo, ProviderSettings } from "@roo-code/types"

import type { ApiHandler, ApiHandlerCreateMessageMetadata, SingleCompletionHandler } from "../index"
import { estimateApiRequestTokens, prepareApiRequest, withContextWindowGuard } from "../context-window-guard"

function createHandler({
	id = "test-model",
	contextWindow,
	maxTokens = 16_000,
	createMessage,
}: {
	id?: string
	contextWindow: number
	maxTokens?: number
	createMessage?: ApiHandler["createMessage"]
}): ApiHandler {
	const info: ModelInfo = {
		contextWindow,
		maxTokens,
		supportsPromptCache: false,
	}

	return {
		getModel: () => ({ id, info }),
		countTokens: vi.fn(async () => 0),
		createMessage:
			createMessage ??
			(() =>
				(async function* () {
					yield { type: "text", text: "ok" } as const
				})()),
	}
}

const settings = {
	apiProvider: "openai",
	openAiModelId: "test-model",
} as ProviderSettings

describe("context window request guard", () => {
	it("fits an oversized nested tool result inside a 200k model budget", async () => {
		const handler = createHandler({ contextWindow: 200_000, maxTokens: 32_000 })
		const hugeToolOutput = "abcdefghijklmnopqrstuvwxyz0123456789 ".repeat(60_000)
		const metadata: ApiHandlerCreateMessageMetadata = {
			taskId: "task-1",
			previousResponseId: "response-1",
			allowedTools: [],
		}
		const messages: Anthropic.Messages.MessageParam[] = [
			{
				role: "assistant",
				content: [{ type: "tool_use", id: "read-1", name: "read_file", input: { path: "huge.txt" } }],
			},
			{
				role: "user",
				content: [
					{
						type: "tool_result",
						tool_use_id: "read-1",
						content: [{ type: "text", text: hugeToolOutput }],
					},
				],
			},
		]

		const prepared = await prepareApiRequest({
			handler,
			settings,
			systemPrompt: "You are a coding assistant.",
			messages,
			metadata,
		})

		expect(prepared.wasTruncated).toBe(true)
		expect(prepared.originalEstimatedInputTokens).toBeGreaterThan(prepared.inputTokenBudget)
		expect(prepared.estimatedInputTokens).toBeLessThanOrEqual(prepared.inputTokenBudget)
		expect(prepared.contextWindow).toBe(200_000)
		expect(prepared.metadata?.suppressPreviousResponseId).toBe(true)
		expect(prepared.metadata?.previousResponseId).toBeUndefined()

		const finalToolResult = (prepared.messages.at(-1)?.content as Anthropic.Messages.ContentBlockParam[])[0]
		expect(finalToolResult.type).toBe("tool_result")
		if (finalToolResult.type === "tool_result" && Array.isArray(finalToolResult.content)) {
			expect(finalToolResult.content[0].type).toBe("text")
			if (finalToolResult.content[0].type === "text") {
				expect(finalToolResult.content[0].text).toContain("content truncated")
				expect(finalToolResult.content[0].text.length).toBeLessThan(hugeToolOutput.length)
			}
		}
	})

	it("uses the selected Axon 400k context when fetched model metadata agrees", async () => {
		const handler = createHandler({ id: "axon-eido-3-code-mini", contextWindow: 400_000, maxTokens: 64_000 })
		const selectedSettings = {
			apiProvider: "kilocode",
			kilocodeModel: "axon-eido-3-code-mini-400k",
		} as ProviderSettings

		const prepared = await prepareApiRequest({
			handler,
			settings: selectedSettings,
			systemPrompt: "system",
			messages: [{ role: "user", content: "hello" }],
			metadata: { taskId: "task-400k", allowedTools: [] },
		})

		expect(prepared.contextWindow).toBe(400_000)
		expect(prepared.inputTokenBudget).toBe(296_000)
	})

	it("does not let an Axon alias raise a smaller fetched context limit", async () => {
		const handler = createHandler({ id: "axon-eido-3-code-mini", contextWindow: 200_000, maxTokens: 64_000 })
		const selectedSettings = {
			apiProvider: "kilocode",
			kilocodeModel: "axon-eido-3-code-mini-400k",
		} as ProviderSettings

		const prepared = await prepareApiRequest({
			handler,
			settings: selectedSettings,
			systemPrompt: "system",
			messages: [{ role: "user", content: "hello" }],
			metadata: { taskId: "lower-fetched-limit", allowedTools: [] },
		})

		expect(prepared.contextWindow).toBe(200_000)
	})

	it("ignores stale model fields belonging to a different provider", async () => {
		const handler = createHandler({ id: "openai-model", contextWindow: 200_000, maxTokens: 32_000 })
		const selectedSettings = {
			apiProvider: "openai",
			openAiModelId: "openai-model",
			kilocodeModel: "axon-eido-3-code-mini-400k",
		} as ProviderSettings

		const prepared = await prepareApiRequest({
			handler,
			settings: selectedSettings,
			systemPrompt: "system",
			messages: [{ role: "user", content: "hello" }],
			metadata: { taskId: "stale-field", allowedTools: [] },
		})

		expect(prepared.contextWindow).toBe(200_000)
	})

	it("refreshes dynamic model metadata before choosing the request budget", async () => {
		let contextWindow = 200_000
		const handler = Object.assign(createHandler({ contextWindow, maxTokens: 1_000 }), {
			fetchModel: vi.fn(async () => {
				contextWindow = 8_000
			}),
			getModel: () => ({
				id: "small-router-model",
				info: { contextWindow, maxTokens: 1_000, supportsPromptCache: false },
			}),
		})
		const selectedSettings = {
			apiProvider: "openrouter",
			openRouterModelId: "small-router-model",
		} as ProviderSettings

		const prepared = await prepareApiRequest({
			handler,
			settings: selectedSettings,
			systemPrompt: "system",
			messages: [{ role: "user", content: "hello" }],
			metadata: { taskId: "dynamic-model", allowedTools: [] },
		})

		expect(handler.fetchModel).toHaveBeenCalledTimes(1)
		expect(prepared.contextWindow).toBe(8_000)
	})

	it("counts tool schemas as part of the provider request", async () => {
		const messages: Anthropic.Messages.MessageParam[] = [{ role: "user", content: "hello" }]
		const small = await estimateApiRequestTokens({
			systemPrompt: "system",
			messages,
			tools: [],
		})
		const withLargeSchema = await estimateApiRequestTokens({
			systemPrompt: "system",
			messages,
			tools: [
				{
					type: "function",
					function: {
						name: "large_tool",
						description: "schema description ".repeat(20_000),
						parameters: { type: "object", properties: {} },
					},
				},
			],
		})

		expect(withLargeSchema).toBeGreaterThan(small + 10_000)
	})

	it.each(["file_content", "attachment"])(
		"fits oversized initial %s content even when there is no previous token usage",
		async (tag) => {
			const handler = createHandler({ contextWindow: 40_000, maxTokens: 8_000 })
			const payload = `0123456789abcdefghijklmnopqrstuvwxyz `.repeat(20_000)
			const prepared = await prepareApiRequest({
				handler,
				settings,
				systemPrompt: "system instructions",
				messages: [{ role: "user", content: `<${tag}>${payload}</${tag}>` }],
				metadata: { taskId: `initial-${tag}`, allowedTools: [] },
			})

			expect(prepared.wasTruncated).toBe(true)
			expect(prepared.estimatedInputTokens).toBeLessThanOrEqual(prepared.inputTokenBudget)
			expect(String(prepared.messages[0].content)).toContain("content truncated")
		},
	)

	it("guards the final handler boundary before invoking the provider", async () => {
		let receivedMessages: Anthropic.Messages.MessageParam[] | undefined
		const providerCall = vi.fn((_systemPrompt: string, messages: Anthropic.Messages.MessageParam[]) =>
			(async function* () {
				receivedMessages = messages
				yield { type: "text", text: "ok" } as const
			})(),
		)
		const handler = createHandler({
			contextWindow: 20_000,
			maxTokens: 2_000,
			createMessage: providerCall,
		})
		withContextWindowGuard(handler, settings)

		const stream = handler.createMessage("system", [{ role: "user", content: "large input ".repeat(100_000) }], {
			taskId: "task-final-boundary",
			allowedTools: [],
		})
		for await (const _chunk of stream) {
			// Drain the stream so the lazy guard and provider call execute.
		}

		expect(providerCall).toHaveBeenCalledTimes(1)
		expect(receivedMessages).toBeDefined()
		const guardedEstimate = await estimateApiRequestTokens({
			systemPrompt: "system",
			messages: receivedMessages!,
			tools: [],
		})
		expect(guardedEstimate).toBeLessThanOrEqual(16_000)
	})

	it("guards one-shot completePrompt calls at the same final boundary", async () => {
		const completePrompt = vi.fn(async (_prompt: string) => "ok")
		const handler = Object.assign(createHandler({ contextWindow: 20_000, maxTokens: 2_000 }), {
			completePrompt,
		}) as ApiHandler & SingleCompletionHandler
		withContextWindowGuard(handler, settings)

		await handler.completePrompt("large input ".repeat(100_000))

		expect(completePrompt).toHaveBeenCalledTimes(1)
		const guardedPrompt = completePrompt.mock.calls[0][0]
		expect(guardedPrompt).toContain("content truncated")
		expect(guardedPrompt.length).toBeLessThan(100_000)
	})

	it("makes no provider call when even the minimum request cannot fit", async () => {
		const providerCall = vi.fn(() =>
			(async function* () {
				yield { type: "text", text: "should not run" } as const
			})(),
		)
		const handler = createHandler({ contextWindow: 300, maxTokens: 60, createMessage: providerCall })
		withContextWindowGuard(handler, settings)

		const stream = handler.createMessage("system", [{ role: "user", content: "hello" }], {
			taskId: "too-small",
			allowedTools: [],
		})

		await expect(stream.next()).rejects.toThrow("No LLM call was made")
		expect(providerCall).not.toHaveBeenCalled()
	})
})
