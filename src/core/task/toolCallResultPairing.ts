import { Anthropic } from "@anthropic-ai/sdk"

/**
 * Helpers that keep an assistant turn's tool_calls and the following user turn's
 * tool_results paired 1:1 — the contract every OpenAI-compatible provider enforces
 * (and which parallel native tool calls can otherwise break).
 *
 * These are pure functions so the invariant can be unit-tested in isolation,
 * separate from the streaming machinery in Task.ts.
 */

type UserContentBlock = Anthropic.TextBlockParam | Anthropic.ImageBlockParam | Anthropic.ToolResultBlockParam

/**
 * Reconcile the tool calls accumulated while streaming with the finalized,
 * *executable* tool-use blocks, returning the authoritative list to put in the
 * assistant message.
 *
 * Why this is needed: during streaming a native tool call is yielded as a partial
 * as soon as its name is known, so it lands in the streamed list immediately. If
 * that call's JSON arguments never become valid it is dropped from the finalized
 * content blocks (AssistantMessageParser.finalizeNativeToolCalls) and therefore is
 * never executed. Leaving it in the assistant message produces an orphan tool_call
 * that can never get a tool_result.
 *
 * The finalized blocks are the source of truth: keep the streamed entries that
 * survived finalization (preserving their streamed order), then append any calls
 * that only finalized at end-of-stream (e.g. a native call delivered in a single
 * complete chunk). The result contains exactly the tool calls that will be
 * executed, so each is guaranteed to produce a tool_result.
 */
export function reconcileAssistantToolUses(
	streamedToolUses: Anthropic.Messages.ToolUseBlockParam[],
	finalizedToolUses: Anthropic.Messages.ToolUseBlockParam[],
): Anthropic.Messages.ToolUseBlockParam[] {
	const finalizedIds = new Set(finalizedToolUses.map((tu) => tu.id))
	return [
		...streamedToolUses.filter((tu) => finalizedIds.has(tu.id)),
		...finalizedToolUses.filter((tu) => !streamedToolUses.some((existing) => existing.id === tu.id)),
	]
}

/**
 * The subset of tool-use ids that require a matching tool_result. Tool uses with
 * an empty id (e.g. legacy XML tool calls that carry no tool_use_id) do not emit a
 * `tool_result` block and so are not awaited.
 */
export function toolUseIdsRequiringResults(toolUses: Anthropic.Messages.ToolUseBlockParam[]): string[] {
	return toolUses.map((tu) => tu.id).filter((id): id is string => typeof id === "string" && id.length > 0)
}

/**
 * True once every expected tool-use id has a matching tool_result among the
 * collected user content. Used to gate the next API request so it never fires with
 * an assistant turn whose tool_calls outnumber the collected tool_results.
 */
export function allToolResultsCollected(expectedToolUseIds: string[], collectedContent: UserContentBlock[]): boolean {
	if (expectedToolUseIds.length === 0) {
		return true
	}
	const collectedIds = new Set(
		collectedContent
			.filter((block): block is Anthropic.ToolResultBlockParam => block.type === "tool_result")
			.map((block) => block.tool_use_id),
	)
	return expectedToolUseIds.every((id) => collectedIds.has(id))
}
