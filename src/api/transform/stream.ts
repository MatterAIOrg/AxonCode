import { ApiStreamNativeToolCallsChunk } from "./kilocode/api-stream-native-tool-calls-chunk"

export type ApiStream = AsyncGenerator<ApiStreamChunk>

export type ApiStreamChunk =
	| ApiStreamTextChunk
	| ApiStreamUsageChunk
	| ApiStreamNativeToolCallsChunk // kilocode_change
	| ApiStreamReasoningChunk
	| ApiStreamGroundingChunk
	| ApiStreamKeepaliveChunk // kilocode_change: liveness signal for the stream idle timeout
	| ApiStreamRestartChunk // kilocode_change: signal to discard partial output before an auto-retry
	| ApiStreamError

export interface ApiStreamRestartChunk {
	// kilocode_change: emitted by attemptApiRequest when it auto-retries a transient
	// connection failure mid-stream. It tells the consumer to discard everything
	// streamed so far this attempt (reset accumulators + roll back partial UI) so the
	// fresh stream that follows replaces the partial output instead of appending to it.
	type: "stream_restart"
}

export interface ApiStreamKeepaliveChunk {
	// kilocode_change: emitted when the provider receives a chunk from the server that
	// carries no user-visible payload (e.g. keep-alive/heartbeat deltas). Consumers
	// ignore the content but use it to reset the stream idle timeout, so a live-but-quiet
	// connection isn't falsely torn down during long silent phases.
	type: "keepalive"
}

export interface ApiStreamError {
	type: "error"
	error: string
	message: string
}

export interface ApiStreamTextChunk {
	type: "text"
	text: string
}

export interface ApiStreamReasoningChunk {
	type: "reasoning"
	text: string
}

export interface ApiStreamUsageChunk {
	type: "usage"
	inputTokens: number
	outputTokens: number
	cacheWriteTokens?: number
	cacheReadTokens?: number
	reasoningTokens?: number
	totalCost?: number
	inferenceProvider?: string // kilocode_change
}

export interface ApiStreamGroundingChunk {
	type: "grounding"
	sources: GroundingSource[]
}

export interface GroundingSource {
	title: string
	url: string
	snippet?: string
}
