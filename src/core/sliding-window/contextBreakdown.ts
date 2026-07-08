import { Anthropic } from "@anthropic-ai/sdk"
import { Tiktoken } from "tiktoken/lite"
import o200kBase from "tiktoken/encoders/o200k_base"

/**
 * Per-category token breakdown of the context window.
 *
 * The categories mirror the structure of the system prompt (and surrounding
 * context that ships with every API request), so the UI can show users exactly
 * where their context is going.
 */
/**
 * Per-category text fragments used to build a `ContextBreakdown`. The values
 * are the raw markdown the system prompt ships to the model for each section;
 * token counts are derived locally.
 */
export interface ContextBreakdownParts {
	/** Static system prompt (role definition, tool descriptions, etc.) */
	systemPrompt?: string
	/** Tool/function definitions surfaced to the model */
	toolDefinitions?: string
	/** User rules (`.orbital/rules/`, `AGENTS.md`, etc.) */
	rules?: string
	/** Skills section in the system prompt */
	skills?: string
	/** MCP server/tool definitions in the system prompt */
	mcp?: string
	/** Subagent (new_task) tool definitions, if applicable */
	subagentDefinitions?: string
}

export interface ContextBreakdown {
	/** Tokens consumed by the static system prompt (role definition, tool descriptions, etc.) */
	systemPrompt: number
	/** Tokens consumed by tool/function definitions surfaced to the model */
	toolDefinitions: number
	/** Tokens consumed by user rules (`.orbital/rules/`, `AGENTS.md`, etc.) */
	rules: number
	/** Tokens consumed by the skills section in the system prompt */
	skills: number
	/** Tokens consumed by MCP server/tool definitions in the system prompt */
	mcp: number
	/** Tokens consumed by subagent (new_task) tool definitions, if applicable */
	subagentDefinitions: number
	/**
	 * Tokens served from the provider's prompt cache (e.g. `prompt_tokens_details.cached_tokens`).
	 * Sourced directly from the LLM's usage chunk rather than counted locally.
	 */
	cacheReads: number
	/** Tokens consumed by the dynamic conversation (history + environment details + tool results) */
	conversation: number
}

const TOKEN_FUDGE_FACTOR = 1.5

let encoder: Tiktoken | null = null

function getEncoder(): Tiktoken {
	if (!encoder) {
		encoder = new Tiktoken(o200kBase.bpe_ranks, o200kBase.special_tokens, o200kBase.pat_str)
	}
	return encoder
}

/**
 * Count tokens for a free-form string using the local o200k_base encoder.
 * Returns 0 for empty strings. Mirrors `tiktoken()` fudge factor handling.
 */
export function countStringTokens(text: string): number {
	if (!text) {
		return 0
	}
	const tokens = getEncoder().encode(text, undefined, [])
	return Math.ceil(tokens.length * TOKEN_FUDGE_FACTOR)
}

/**
 * Count tokens for an array of Anthropic content blocks (text + image).
 * Mirrors the existing `tiktoken()` helper so behavior stays consistent.
 */
export function countContentBlocks(content: Anthropic.Messages.ContentBlockParam[]): number {
	if (!content || content.length === 0) {
		return 0
	}

	let totalTokens = 0

	for (const block of content) {
		if (block.type === "text") {
			const text = block.text || ""
			if (text.length > 0) {
				const tokens = getEncoder().encode(text, undefined, [])
				totalTokens += tokens.length
			}
		} else if (block.type === "image") {
			const imageSource = block.source
			if (imageSource && typeof imageSource === "object" && "data" in imageSource) {
				const base64Data = imageSource.data as string
				totalTokens += Math.ceil(Math.sqrt(base64Data.length))
			} else {
				totalTokens += 300
			}
		}
	}

	return Math.ceil(totalTokens * TOKEN_FUDGE_FACTOR)
}

const ZERO_BREAKDOWN: ContextBreakdown = {
	systemPrompt: 0,
	toolDefinitions: 0,
	rules: 0,
	skills: 0,
	mcp: 0,
	subagentDefinitions: 0,
	cacheReads: 0,
	conversation: 0,
}

/**
 * Compute a fresh `ContextBreakdown` from the supplied category text fragments
 * and the current model-reported total. The conversation slice is the residual
 * (clamped to 0) so the categories always add up to the reported total.
 *
 * `cacheReads` is taken from the LLM's usage chunk (e.g.
 * `prompt_tokens_details.cached_tokens`) and subtracted from the total before
 * computing the conversation slice, so cached tokens aren't double-counted.
 */
export function buildContextBreakdown(params: {
	categoryText: ContextBreakdownParts
	currentTokens: number
	cacheReads?: number
}): ContextBreakdown {
	const staticTokens = {
		systemPrompt: countStringTokens(params.categoryText.systemPrompt ?? ""),
		toolDefinitions: countStringTokens(params.categoryText.toolDefinitions ?? ""),
		rules: countStringTokens(params.categoryText.rules ?? ""),
		skills: countStringTokens(params.categoryText.skills ?? ""),
		mcp: countStringTokens(params.categoryText.mcp ?? ""),
		subagentDefinitions: countStringTokens(params.categoryText.subagentDefinitions ?? ""),
	}

	const staticTotal =
		staticTokens.systemPrompt +
		staticTokens.toolDefinitions +
		staticTokens.rules +
		staticTokens.skills +
		staticTokens.mcp +
		staticTokens.subagentDefinitions

	const cacheReads = Math.max(0, params.cacheReads ?? 0)
	const conversation = Math.max(0, params.currentTokens - staticTotal - cacheReads)

	return {
		...staticTokens,
		cacheReads,
		conversation,
	}
}

/**
 * Merge an existing breakdown (with a known conversation slice) with new
 * static-category token counts, e.g. after a fresh system-prompt rebuild.
 * Conversation is recomputed from the new static total. The previous
 * `cacheReads` value is preserved since it comes from the LLM, not the
 * system-prompt text.
 */
export function rebuildContextBreakdown(
	previous: ContextBreakdown,
	nextCategoryText: ContextBreakdownParts,
	currentTokens: number,
): ContextBreakdown {
	return buildContextBreakdown({
		categoryText: nextCategoryText,
		currentTokens,
		cacheReads: previous.cacheReads,
	})
}

/**
 * Empty fallback used when no breakdown has been computed yet.
 */
export function emptyContextBreakdown(): ContextBreakdown {
	return { ...ZERO_BREAKDOWN }
}
