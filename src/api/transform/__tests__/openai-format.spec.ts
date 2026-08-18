// npx vitest run api/transform/__tests__/openai-format.spec.ts

import { Anthropic } from "@anthropic-ai/sdk"
import OpenAI from "openai"

import { convertToOpenAiMessages } from "../openai-format"

describe("convertToOpenAiMessages", () => {
	it("should convert simple text messages", () => {
		const anthropicMessages: Anthropic.Messages.MessageParam[] = [
			{
				role: "user",
				content: "Hello",
			},
			{
				role: "assistant",
				content: "Hi there!",
			},
		]

		const openAiMessages = convertToOpenAiMessages(anthropicMessages)
		expect(openAiMessages).toHaveLength(2)
		expect(openAiMessages[0]).toEqual({
			role: "user",
			content: "Hello",
		})
		expect(openAiMessages[1]).toEqual({
			role: "assistant",
			content: "Hi there!",
		})
	})

	it("should handle messages with image content", () => {
		const anthropicMessages: Anthropic.Messages.MessageParam[] = [
			{
				role: "user",
				content: [
					{
						type: "text",
						text: "What is in this image?",
					},
					{
						type: "image",
						source: {
							type: "base64",
							media_type: "image/jpeg",
							data: "base64data",
						},
					},
				],
			},
		]

		const openAiMessages = convertToOpenAiMessages(anthropicMessages)
		expect(openAiMessages).toHaveLength(1)
		expect(openAiMessages[0].role).toBe("user")

		const content = openAiMessages[0].content as Array<{
			type: string
			text?: string
			image_url?: { url: string }
		}>

		expect(Array.isArray(content)).toBe(true)
		expect(content).toHaveLength(2)
		expect(content[0]).toEqual({ type: "text", text: "What is in this image?" })
		expect(content[1]).toEqual({
			type: "image_url",
			image_url: { url: "data:image/jpeg;base64,base64data" },
		})
	})

	it("should handle assistant messages with tool use", () => {
		const anthropicMessages: Anthropic.Messages.MessageParam[] = [
			{
				role: "assistant",
				content: [
					{
						type: "text",
						text: "Let me check the weather.",
					},
					{
						type: "tool_use",
						id: "weather-123",
						name: "get_weather",
						input: { city: "London" },
					},
				],
			},
		]

		const openAiMessages = convertToOpenAiMessages(anthropicMessages)
		expect(openAiMessages).toHaveLength(1)

		const assistantMessage = openAiMessages[0] as OpenAI.Chat.ChatCompletionAssistantMessageParam
		expect(assistantMessage.role).toBe("assistant")
		expect(assistantMessage.content).toBe("Let me check the weather.")
		expect(assistantMessage.tool_calls).toHaveLength(1)
		expect(assistantMessage.tool_calls![0]).toEqual({
			id: "weather-123",
			type: "function",
			function: {
				name: "get_weather",
				arguments: JSON.stringify({ city: "London" }),
			},
		})
	})

	it("should handle user messages with tool results", () => {
		const anthropicMessages: Anthropic.Messages.MessageParam[] = [
			{
				role: "user",
				content: [
					{
						type: "tool_result",
						tool_use_id: "weather-123",
						content: "Current temperature in London: 20°C",
					},
				],
			},
		]

		const openAiMessages = convertToOpenAiMessages(anthropicMessages)
		expect(openAiMessages).toHaveLength(1)

		const toolMessage = openAiMessages[0] as OpenAI.Chat.ChatCompletionToolMessageParam
		expect(toolMessage.role).toBe("tool")
		expect(toolMessage.tool_call_id).toBe("weather-123")
		expect(toolMessage.content).toBe("Current temperature in London: 20°C")
	})

	it("should forward tool result images as a follow-up user message", () => {
		const anthropicMessages: Anthropic.Messages.MessageParam[] = [
			{
				role: "user",
				content: [
					{
						type: "tool_result",
						tool_use_id: "attempt-1",
						content: [
							{ type: "text", text: "Feedback on the result" },
							{
								type: "image",
								source: {
									type: "base64",
									media_type: "image/png",
									data: "base64data",
								},
							},
						],
					},
				],
			},
		]

		const openAiMessages = convertToOpenAiMessages(anthropicMessages)
		expect(openAiMessages).toHaveLength(2)

		const toolMessage = openAiMessages[0] as OpenAI.Chat.ChatCompletionToolMessageParam
		expect(toolMessage.role).toBe("tool")
		expect(toolMessage.content).toBe("Feedback on the result\n(see following user message for image)")

		const imageMessage = openAiMessages[1] as OpenAI.Chat.ChatCompletionUserMessageParam
		expect(imageMessage.role).toBe("user")
		expect(imageMessage.content).toEqual([
			{
				type: "image_url",
				image_url: { url: "data:image/png;base64,base64data" },
			},
		])
	})

	describe("tool_call/tool_result pairing safety net", () => {
		it("backfills a placeholder tool message for an unanswered parallel tool_call", () => {
			// Assistant requested two tool calls but only the first was answered — the
			// exact shape that makes OpenAI-compatible providers reject the request.
			const anthropicMessages: Anthropic.Messages.MessageParam[] = [
				{
					role: "assistant",
					content: [
						{ type: "tool_use", id: "call_1", name: "read_file", input: { file_path: "App.tsx" } },
						{ type: "tool_use", id: "call_2", name: "read_file", input: { file_path: "index.css" } },
					],
				},
				{
					role: "user",
					content: [{ type: "tool_result", tool_use_id: "call_1", content: "App.tsx contents" }],
				},
			]

			const openAiMessages = convertToOpenAiMessages(anthropicMessages)

			// assistant + tool(call_1) + backfilled tool(call_2)
			expect(openAiMessages).toHaveLength(3)
			expect(openAiMessages[0].role).toBe("assistant")

			const first = openAiMessages[1] as OpenAI.Chat.ChatCompletionToolMessageParam
			expect(first.role).toBe("tool")
			expect(first.tool_call_id).toBe("call_1")
			expect(first.content).toBe("App.tsx contents")

			const backfilled = openAiMessages[2] as OpenAI.Chat.ChatCompletionToolMessageParam
			expect(backfilled.role).toBe("tool")
			expect(backfilled.tool_call_id).toBe("call_2")
			expect(backfilled.content).toBe("")
		})

		it("leaves a fully-answered parallel tool call untouched", () => {
			const anthropicMessages: Anthropic.Messages.MessageParam[] = [
				{
					role: "assistant",
					content: [
						{ type: "tool_use", id: "call_1", name: "read_file", input: { file_path: "a.ts" } },
						{ type: "tool_use", id: "call_2", name: "read_file", input: { file_path: "b.ts" } },
					],
				},
				{
					role: "user",
					content: [
						{ type: "tool_result", tool_use_id: "call_1", content: "a" },
						{ type: "tool_result", tool_use_id: "call_2", content: "b" },
					],
				},
			]

			const openAiMessages = convertToOpenAiMessages(anthropicMessages)

			expect(openAiMessages).toHaveLength(3)
			expect((openAiMessages[1] as OpenAI.Chat.ChatCompletionToolMessageParam).tool_call_id).toBe("call_1")
			expect((openAiMessages[2] as OpenAI.Chat.ChatCompletionToolMessageParam).tool_call_id).toBe("call_2")
		})
	})
})
