import { Anthropic } from "@anthropic-ai/sdk"
import { Tiktoken } from "tiktoken/lite"
import o200kBase from "tiktoken/encoders/o200k_base"

const TOKEN_FUDGE_FACTOR = 1.5

// Keep a small structural allowance for non-text content blocks. Provider
// wire formats add field names, roles, ids, and JSON punctuation around the
// user-visible content. Counting those values here also prevents a very large
// tool input from being treated as free context.
const CONTENT_BLOCK_OVERHEAD_TOKENS = 8

let encoder: Tiktoken | null = null

export async function tiktoken(content: Anthropic.Messages.ContentBlockParam[]): Promise<number> {
	if (content.length === 0) {
		return 0
	}

	let totalTokens = 0

	// Lazily create and cache the encoder if it doesn't exist.
	if (!encoder) {
		encoder = new Tiktoken(o200kBase.bpe_ranks, o200kBase.special_tokens, o200kBase.pat_str)
	}

	// Process every content block, including nested tool results. Previously the
	// counter only handled top-level text and images, so read_file, MCP, terminal,
	// browser, and other tool outputs inside a `tool_result` counted as zero.
	for (const block of content) {
		totalTokens += countContentBlockTokens(block, encoder)
	}

	// Add a fudge factor to account for the fact that tiktoken is not always
	// accurate.
	return Math.ceil(totalTokens * TOKEN_FUDGE_FACTOR)
}

function countTextTokens(text: unknown, currentEncoder: Tiktoken): number {
	if (typeof text !== "string" || text.length === 0) {
		return 0
	}

	return currentEncoder.encode(text, undefined, []).length
}

function countImageTokens(block: Anthropic.Messages.ImageBlockParam): number {
	const imageSource = block.source

	if (imageSource && typeof imageSource === "object" && "data" in imageSource) {
		const base64Data = imageSource.data as string
		return Math.ceil(Math.sqrt(base64Data.length))
	}

	return 300 // Conservative estimate for URL or malformed images.
}

function countJsonTokens(value: unknown, currentEncoder: Tiktoken): number {
	try {
		return countTextTokens(JSON.stringify(value), currentEncoder)
	} catch {
		return countTextTokens(String(value), currentEncoder)
	}
}

function countDocumentTokens(block: Anthropic.Messages.DocumentBlockParam, currentEncoder: Tiktoken): number {
	const source = block.source
	let tokens = CONTENT_BLOCK_OVERHEAD_TOKENS

	if (source.type === "text") {
		tokens += countTextTokens(source.data, currentEncoder)
	} else if (source.type === "content") {
		const nested =
			typeof source.content === "string" ? [{ type: "text" as const, text: source.content }] : source.content
		tokens += nested.reduce((sum, item) => sum + countContentBlockTokens(item, currentEncoder), 0)
	} else if (source.type === "base64") {
		// PDFs are tokenized from their extracted pages by providers. Using the
		// encoded byte size is intentionally conservative when page count is unknown.
		tokens += Math.ceil(source.data.length / 4)
	} else {
		tokens += countTextTokens(source.url, currentEncoder) + 300
	}

	tokens += countTextTokens(block.title, currentEncoder)
	tokens += countTextTokens(block.context, currentEncoder)
	return tokens
}

function countContentBlockTokens(block: Anthropic.Messages.ContentBlockParam, currentEncoder: Tiktoken): number {
	switch (block.type) {
		case "text":
			return countTextTokens(block.text, currentEncoder)
		case "image":
			return countImageTokens(block)
		case "tool_result": {
			let tokens = CONTENT_BLOCK_OVERHEAD_TOKENS + countTextTokens(block.tool_use_id, currentEncoder)
			if (typeof block.content === "string") {
				tokens += countTextTokens(block.content, currentEncoder)
			} else if (Array.isArray(block.content)) {
				tokens += block.content.reduce((sum, item) => sum + countContentBlockTokens(item, currentEncoder), 0)
			}
			return tokens
		}
		case "tool_use":
			return (
				CONTENT_BLOCK_OVERHEAD_TOKENS +
				countTextTokens(block.id, currentEncoder) +
				countTextTokens(block.name, currentEncoder) +
				countJsonTokens(block.input, currentEncoder)
			)
		case "thinking":
			return (
				CONTENT_BLOCK_OVERHEAD_TOKENS +
				countTextTokens(block.thinking, currentEncoder) +
				countTextTokens(block.signature, currentEncoder)
			)
		case "document":
			return countDocumentTokens(block, currentEncoder)
		case "redacted_thinking":
			return CONTENT_BLOCK_OVERHEAD_TOKENS + countTextTokens(block.data, currentEncoder)
		default:
			// Covers server tool-use and web-search result variants introduced by
			// newer SDKs. Serializing unknown structured content is safer than
			// silently assigning it zero tokens.
			return CONTENT_BLOCK_OVERHEAD_TOKENS + countJsonTokens(block, currentEncoder)
	}
}
