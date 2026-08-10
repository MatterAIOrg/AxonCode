import type { ClineAsk } from "@roo-code/types"

export function isCompletionQueueBoundary(type: ClineAsk, partial?: boolean): boolean {
	return type === "completion_result" && partial !== true
}

/**
 * taskRequestCount spans the complete agent turn, including tool execution and
 * the non-streaming gaps between provider requests.
 */
export function isTaskIdleForQueuedMessages({
	taskRequestCount,
	isStreaming,
	isWaitingForAskResponse,
}: {
	taskRequestCount: number
	isStreaming: boolean
	isWaitingForAskResponse: boolean
}): boolean {
	return taskRequestCount === 0 && !isStreaming && !isWaitingForAskResponse
}
