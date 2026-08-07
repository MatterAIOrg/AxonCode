import { describe, expect, test } from "vitest"
import {
	assertChatMessagesFit,
	compileChatMessages,
	countTokens,
	encodingForModel,
	pruneFimPrompt,
	pruneRawPromptFromTop,
} from "./countTokens"
import { llamaTokenizer } from "./llamaTokenizer.js"
import { encodingForModel as tiktokenEncodingForModel } from "js-tiktoken"
import { MockLLM } from "./llms/Mock.js"

describe("encodingForModel()", () => {
	const sample = "Hello, world! 12345\nThe quick brown fox jumps."

	test("uses js-tiktoken for GPT/OpenAI/Claude-like models", () => {
		const encs = [
			"gpt-4",
			"o3-mini",
			"o4",
			"claude-3",
			"claude-3-7-sonnet-20250219",
			"amazon-nova-pro",
			"command-r",
			"gemini-1.5-pro",
			"grok-beta",
			"moonshot-v1",
			"mercury-chat",
			"pplx-70b",
			"chat-bison",
		]

		const tiktoken = tiktokenEncodingForModel("gpt-4")

		for (const name of encs) {
			const enc = encodingForModel(name)
			const got = enc.encode(sample).length
			const expected = tiktoken.encode(sample).length
			expect(got).toBe(expected)
		}
	})

	test("uses llama tokenizer for Llama-family and similar local models", () => {
		const encs = [
			"llama2",
			"llama-2",
			"llama3",
			"llama-3-8b-instruct",
			"mistral-7b",
			"mixtral-8x7b",
			"deepseek-coder",
			"tinyllama",
			"xwin-coder",
			"zephyr-7b",
			"openchat",
			"neural-chat",
			"granite2:8b",
		]

		for (const name of encs) {
			const enc = encodingForModel(name)
			const got = enc.encode(sample).length
			const expected = llamaTokenizer.encode(sample).length
			expect(got).toBe(expected)
		}
	})
})

describe("countTokens()", () => {
	test("uses llama tokenizer path when appropriate", () => {
		const s = "A llama-friendly test string: symbols • unicode ✓ accents café 🌟"
		const expected = llamaTokenizer.encode(s).length

		expect(countTokens(s, "llama2")).toBe(expected)
		expect(countTokens(s, "llama-3")).toBe(expected)
		// DeepSeek and many open-source models default to llama tokenizer here
		expect(countTokens(s, "deepseek")).toBe(expected)
	})

	test("uses js-tiktoken for GPT-like models", () => {
		const s = "Testing GPT token route: inline checks with numbers 12345."
		const tiktoken = tiktokenEncodingForModel("gpt-4")
		const expected = tiktoken.encode(s).length

		expect(countTokens(s, "gpt-4")).toBe(expected)
		expect(countTokens(s, "o3-mini")).toBe(expected)
		expect(countTokens(s, "claude-3")).toBe(expected)
	})
})

describe("context window guards", () => {
	test("uses the pruning fallback consistently when model context length is unknown", async () => {
		const llm = new MockLLM({ model: "unknown-context-model" })
		const messages = [{ role: "user" as const, content: "token ".repeat(40_000) }]
		let completion = ""

		for await (const chunk of llm.streamChat(messages, new AbortController().signal)) {
			completion += chunk.content
		}

		expect(llm._contextLength).toBeUndefined()
		expect(completion).toBe("Test Completion")
	})

	test("compileChatMessages reserves the full requested output", () => {
		const result = compileChatMessages({
			modelName: "gpt-4",
			msgs: [
				{ role: "user", content: "token ".repeat(5_000) },
				{ role: "assistant", content: "older response" },
				{ role: "user", content: "latest request" },
			],
			knownContextLength: 10_000,
			maxTokens: 6_000,
		})

		expect(result.didPrune).toBe(true)
		expect(result.contextPercentage).toBeLessThanOrEqual(1)
	})

	test("rejects an oversized non-negotiable message before a chat call", () => {
		expect(() =>
			compileChatMessages({
				modelName: "gpt-4",
				msgs: [{ role: "user", content: "token ".repeat(600) }],
				knownContextLength: 2_000,
				maxTokens: 1_500,
			}),
		).toThrow(/No LLM call was made/)
	})

	test("validates precompiled chat messages against input plus output", () => {
		expect(() =>
			assertChatMessagesFit({
				modelName: "gpt-4",
				msgs: [{ role: "user", content: "token ".repeat(600) }],
				contextLength: 2_000,
				maxTokens: 1_500,
			}),
		).toThrow(/unsafe request/)
	})

	test("rejects raw completion output reservations that consume the context", () => {
		expect(() => pruneRawPromptFromTop("gpt-4", 2_000, "prompt", 1_980)).toThrow(/No LLM call was made/)
	})

	test("prunes both sides of a FIM request to the remaining input budget", () => {
		const result = pruneFimPrompt({
			modelName: "gpt-4",
			contextLength: 2_000,
			prefix: "prefix ".repeat(1_000),
			suffix: "suffix ".repeat(1_000),
			tokensForCompletion: 1_000,
		})
		const safety = 40

		expect(countTokens(result.prefix, "gpt-4") + countTokens(result.suffix, "gpt-4")).toBeLessThanOrEqual(
			2_000 - 1_000 - safety,
		)
	})
})
