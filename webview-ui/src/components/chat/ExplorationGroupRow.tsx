import React, { memo, useState, useCallback, useMemo, useEffect, useRef } from "react"
import { useSize } from "react-use"
import { useTranslation } from "react-i18next"
import type { ClineMessage, SuggestionItem } from "@roo-code/types"
import { safeJsonParse } from "@roo/safeJsonParse"
import { cn } from "@/lib/utils"
import { ArrowDown01Icon } from "@/utils/customIcons"
import ChatRow from "./ChatRow"
import { CHAT_CONTENT_HORIZONTAL_PADDING } from "./chatLayout"

// Types for exploration tools
export type ExplorationToolType =
	| "readFile"
	| "listFilesTopLevel"
	| "listFilesRecursive"
	| "listCodeDefinitionNames"
	| "searchFiles"
	| "codebaseSearch"
	| "lsp"
	| "webFetch"
	| "webSearch"
	| "fetchInstructions"
	| "checkPastChatMemories"
	| "useSkill"
	| "executeCommand"

export interface ExplorationGroup {
	_type: "explorationGroup"
	messages: ClineMessage[]
	isStreaming: boolean
}

// List of exploration (read-only) tools
// Includes both camelCase (stored in message) and snake_case (from LLM tool calls)
const EXPLORATION_TOOLS: string[] = [
	// camelCase variants (stored in messages after processing)
	"readFile",
	"listFilesTopLevel",
	"listFilesRecursive",
	"listCodeDefinitionNames",
	"searchFiles",
	"codebaseSearch",
	"lsp",
	"webFetch",
	"webSearch",
	"fetchInstructions",
	"checkPastChatMemories",
	"useSkill",
	"executeCommand",
	// snake_case variants (from LLM tool calls)
	"read_file",
	"list_files_top_level",
	"list_files_recursive",
	"list_code_definition_names",
	"search_files",
	"codebase_search",
	"web_fetch",
	"web_search",
	"fetch_instructions",
	"check_past_chat_memories",
	"use_skill",
	"execute_command",
]

// Helper to extract tool name from message
function getToolName(message: ClineMessage): string | null {
	const tool = safeJsonParse<{ tool?: string }>(message.text)
	return tool?.tool || null
}

// Check if a message is an exploration tool ASK (permission request)
export function isExplorationToolAsk(message: ClineMessage): boolean {
	if (message.type !== "ask" || message.ask !== "tool") {
		return false
	}
	const toolName = getToolName(message)
	return toolName !== null && EXPLORATION_TOOLS.includes(toolName)
}

// Check if a message is an exploration tool SAY (result)
export function isExplorationToolSay(message: ClineMessage): boolean {
	if (message.type !== "say" || (message.say as string) !== "tool") {
		return false
	}
	const toolName = getToolName(message)
	return toolName !== null && EXPLORATION_TOOLS.includes(toolName)
}

// Check if a message is an api_req_started message (pass-through for grouping)
function isApiReqStarted(message: ClineMessage): boolean {
	return message.type === "say" && message.say === "api_req_started"
}

// Check if a message is a checkpoint_saved message (pass-through for grouping)
function isCheckpointSaved(message: ClineMessage): boolean {
	return message.type === "say" && message.say === "checkpoint_saved"
}

// Check if a message is a whitespace-only text message (pass-through for grouping)
// The LLM may output empty or whitespace-only text between tool calls
function isWhitespaceText(message: ClineMessage): boolean {
	if (message.type !== "say" || message.say !== "text") {
		return false
	}
	const text = message.text ?? ""
	// Treat empty or whitespace-only text as pass-through
	return text.trim() === ""
}

// Check if a message is a reasoning message (pass-through for grouping)
// The LLM outputs reasoning/thinking blocks during exploration phases
function isReasoning(message: ClineMessage): boolean {
	return message.type === "say" && message.say === "reasoning"
}

// Check if a message is a command ask
function isCommandAsk(message: ClineMessage): boolean {
	return message.type === "ask" && message.ask === "command"
}

// Check if a message is command output
function isCommandOutput(message: ClineMessage): boolean {
	return message.type === "say" && message.say === "command_output"
}

// Check if a message should be included in an exploration group
// This includes: ask:tool (for exploration tools, including partial), say:tool (for exploration tools),
// api_req_started, checkpoint_saved, whitespace-only text, and reasoning
// These messages appear between tool calls and shouldn't break the group
// IMPORTANT: Any non-empty text content from the LLM should BREAK the group
export function isExplorationRelatedMessage(message: ClineMessage): boolean {
	// Include partial ask:tool messages for streaming exploration tools
	if (isExplorationToolAsk(message)) return true
	// Include say:tool for exploration tools
	if (isExplorationToolSay(message)) return true
	// Include command asks and outputs
	if (isCommandAsk(message)) return true
	if (isCommandOutput(message)) return true
	// Include api_req_started messages (pass-through)
	if (isApiReqStarted(message)) return true
	// Include checkpoint_saved messages (pass-through)
	if (isCheckpointSaved(message)) return true
	// Include whitespace-only text messages (pass-through)
	if (isWhitespaceText(message)) return true
	// Include reasoning messages (pass-through)
	if (isReasoning(message)) return true
	return false
}

// Check if a message is the "final" exploration tool message
// For read-only tools (exploration), this is ask:tool (complete, not partial)
// For write tools (edits), this is say:tool
// Used to determine if exploration is complete and for counting tool results
export function isExplorationToolResult(message: ClineMessage): boolean {
	// Exploration tools only use ask:tool, never say:tool
	if (isExplorationToolAsk(message) && message.partial !== true) {
		return true
	}
	// Command asks are results when complete (not partial)
	if (isCommandAsk(message) && message.partial !== true) {
		return true
	}
	// Write tools use say:tool
	if (isExplorationToolSay(message)) {
		return true
	}
	return false
}

// Legacy function kept for backwards compatibility
// Check if a message is an exploration (read-only) tool
export function isExplorationTool(message: ClineMessage): boolean {
	return isExplorationToolSay(message)
}

// Normalize tool name to camelCase for consistent counting
function normalizeToolName(toolName: string): string {
	// Map snake_case to camelCase
	const toolNameMap: Record<string, string> = {
		read_file: "readFile",
		list_files_top_level: "listFilesTopLevel",
		list_files_recursive: "listFilesRecursive",
		list_code_definition_names: "listCodeDefinitionNames",
		search_files: "searchFiles",
		codebase_search: "codebaseSearch",
		web_fetch: "webFetch",
		web_search: "webSearch",
		fetch_instructions: "fetchInstructions",
		check_past_chat_memories: "checkPastChatMemories",
		use_skill: "useSkill",
		execute_command: "executeCommand",
	}
	return toolNameMap[toolName] || toolName
}

// Count tool types in a group
// For exploration tools, count complete ask:tool messages (not partial)
// For write tools, count say:tool messages
function getToolCounts(messages: ClineMessage[]): { files: number; searches: number; commands: number; other: number } {
	let files = 0
	let searches = 0
	let commands = 0
	let other = 0

	for (const message of messages) {
		// Exploration tools: count complete ask:tool messages
		if (message.type === "ask" && message.ask === "tool" && message.partial !== true) {
			const tool = safeJsonParse<{ tool?: string }>(message.text || "{}")
			if (tool?.tool && EXPLORATION_TOOLS.includes(tool.tool)) {
				const normalizedTool = normalizeToolName(tool.tool)
				if (
					normalizedTool === "readFile" ||
					normalizedTool === "listFilesTopLevel" ||
					normalizedTool === "listFilesRecursive"
				) {
					files++
				} else if (
					normalizedTool === "searchFiles" ||
					normalizedTool === "codebaseSearch" ||
					normalizedTool === "webSearch"
				) {
					searches++
				} else if (normalizedTool === "executeCommand") {
					commands++
				} else {
					other++
				}
			}
		}
		// Count command asks (separate from tool-based commands)
		if (message.type === "ask" && message.ask === "command" && message.partial !== true) {
			commands++
		}
		// Write tools: count say:tool messages (not exploration tools)
		if (message.type === "say" && (message.say as string) === "tool") {
			const tool = safeJsonParse<{ tool?: string }>(message.text || "{}")
			if (tool?.tool && !EXPLORATION_TOOLS.includes(tool.tool)) {
				other++
			}
		}
	}

	return { files, searches, commands, other }
}

// Format duration in Xs/Ym format (e.g., "5s", "1m30s", "2m")
function formatDuration(seconds: number): string {
	if (seconds < 60) {
		return `${Math.floor(seconds)}s`
	}
	const mins = Math.floor(seconds / 60)
	const secs = Math.floor(seconds % 60)
	if (secs === 0) {
		return `${mins}m`
	}
	return `${mins}m${secs}s`
}

// Get exploration start time from the first message timestamp
function getExplorationStartTime(messages: ClineMessage[]): number | null {
	if (messages.length === 0) return null
	// Use the timestamp of the first message in the group
	return messages[0].ts
}

// Get exploration end time from the last message timestamp (for completed exploration)
function getExplorationEndTime(messages: ClineMessage[]): number | null {
	if (messages.length === 0) return null
	// Use the timestamp of the last message in the group
	return messages[messages.length - 1].ts
}

// Calculate elapsed time in seconds
// When exploring: use current time for live updates
// When completed: use the last message timestamp as end time
function getElapsedTime(startTime: number | null, endTime: number | null, isExploring: boolean): number {
	if (!startTime) return 0
	const end = isExploring ? Date.now() : endTime || Date.now()
	return Math.floor((end - startTime) / 1000)
}

// Generate summary text with time
function getGroupSummary(
	messages: ClineMessage[],
	t: (key: string, options?: Record<string, unknown>) => string,
	elapsedSeconds: number,
): string {
	const counts = getToolCounts(messages)
	const parts: string[] = []

	if (counts.files > 0) {
		parts.push(t("chat:exploration.filesCount", { count: counts.files }))
	}
	if (counts.searches > 0) {
		parts.push(t("chat:exploration.searchesCount", { count: counts.searches }))
	}
	if (counts.commands > 0) {
		parts.push(t("chat:exploration.commandsCount", { count: counts.commands }))
	}
	if (counts.other > 0) {
		parts.push(t("chat:exploration.othersCount", { count: counts.other }))
	}

	const timeStr = formatDuration(elapsedSeconds)

	if (parts.length === 0) {
		return `${t("chat:exploration.explored")} for ${timeStr}`
	}

	return `${t("chat:exploration.explored")} ${parts.join(", ")} for ${timeStr}`
}

// Generate exploring progress text with counts and time
function getExploringProgress(
	messages: ClineMessage[],
	t: (key: string, options?: Record<string, unknown>) => string,
	elapsedSeconds: number,
): string {
	const counts = getToolCounts(messages)
	const parts: string[] = []

	if (counts.files > 0) {
		parts.push(t("chat:exploration.filesCount", { count: counts.files }))
	}
	if (counts.searches > 0) {
		parts.push(t("chat:exploration.searchesCount", { count: counts.searches }))
	}
	if (counts.commands > 0) {
		parts.push(t("chat:exploration.commandsCount", { count: counts.commands }))
	}
	if (counts.other > 0) {
		parts.push(t("chat:exploration.othersCount", { count: counts.other }))
	}

	const timeStr = formatDuration(elapsedSeconds)

	if (parts.length === 0) {
		return `${t("chat:exploration.exploring")} for ${timeStr}`
	}

	return `${t("chat:exploration.exploring")} ${parts.join(", ")} for ${timeStr}`
}

interface ExplorationGroupRowProps {
	messages: ClineMessage[]
	isLast: boolean
	isStreaming: boolean
	lastModifiedMessage?: ClineMessage
	onToggleExpand: (ts: number) => void
	isExpanded: boolean
	onHeightChange: (isTaller: boolean) => void
	// Props to pass to ChatRow
	expandedRows: Record<number, boolean>
	toggleRowExpansion: (ts: number) => void
	handleSuggestionClickInRow: (suggestion: SuggestionItem, event?: React.MouseEvent) => void
	handleBatchFileResponse: (response: { [key: string]: boolean }) => void
	highlightedMessageIndex: number | null | undefined
	enableCheckpoints: boolean | undefined
	handleFollowUpUnmount: () => void
	currentFollowUpTs: number | null
	enableButtons: boolean | undefined
	handlePrimaryButtonClick: () => void
	handleSecondaryButtonClick: () => void
	isAgentManagerMode: boolean | undefined
}

export const ExplorationGroupRow = memo((props: ExplorationGroupRowProps) => {
	const {
		messages,
		isLast,
		isStreaming,
		lastModifiedMessage,
		onToggleExpand,
		isExpanded,
		onHeightChange,
		expandedRows,
		toggleRowExpansion,
		handleSuggestionClickInRow,
		handleBatchFileResponse,
		highlightedMessageIndex,
		enableCheckpoints,
		handleFollowUpUnmount,
		currentFollowUpTs,
		enableButtons,
		handlePrimaryButtonClick,
		handleSecondaryButtonClick,
		isAgentManagerMode,
	} = props

	const { t } = useTranslation()
	const [localExpanded, setLocalExpanded] = useState(true)
	const [elapsedTime, setElapsedTime] = useState(0)
	const prevHeightRef = useRef(0)

	// Determine if this group is currently being explored (last message is partial or streaming)
	// For parallel tools, each group must independently check if it's still streaming
	const isExploring = useMemo(() => {
		const lastMsg = messages[messages.length - 1]
		// Check if this group's last message is partial (still being streamed)
		if (lastMsg?.partial === true) return true
		// For the last group, also check global streaming state
		if (isLast && isStreaming) return true
		return false
	}, [isLast, messages, isStreaming])

	// Get start and end times for this exploration group
	const startTime = useMemo(() => getExplorationStartTime(messages), [messages])
	const endTime = useMemo(() => getExplorationEndTime(messages), [messages])

	// Timer effect for live elapsed time updates during exploration
	useEffect(() => {
		if (!isExploring) {
			// When exploration ends, calculate final elapsed time using last message timestamp
			if (startTime) {
				setElapsedTime(getElapsedTime(startTime, endTime, false))
			}
			return
		}

		// Update elapsed time immediately (using current time for live updates)
		setElapsedTime(getElapsedTime(startTime, endTime, true))

		// Set up interval to update elapsed time every second while exploring
		const intervalId = setInterval(() => {
			setElapsedTime(getElapsedTime(startTime, endTime, true))
		}, 1000)

		return () => clearInterval(intervalId)
	}, [isExploring, startTime, endTime])

	const wasLastRef = useRef(isLast)

	// A streaming pause between tool calls does not end the group. Keep the local
	// expansion state until another, non-group row is appended after this one.
	useEffect(() => {
		if (wasLastRef.current && !isLast) {
			setLocalExpanded(false)
		}
		wasLastRef.current = isLast
	}, [isLast])

	// The last group owns its expansion state across all of its entries. Once a
	// row outside the group arrives, fall back to the persisted/manual state.
	const expanded = isLast ? localExpanded : isExpanded

	// Keep a pending command approval visible even when its exploration group
	// would otherwise collapse.
	const hasPendingCommandAsk = useMemo(() => {
		const lastMessage = messages[messages.length - 1]
		return enableButtons && isLast && lastMessage?.type === "ask" && lastMessage.ask === "command"
	}, [enableButtons, isLast, messages])

	useEffect(() => {
		if (hasPendingCommandAsk) {
			if (!expanded) {
				setLocalExpanded(true)
			}
		}
	}, [hasPendingCommandAsk, expanded])

	const handleToggle = useCallback(() => {
		if (isLast) {
			setLocalExpanded((prev) => !prev)
		} else {
			// Use the timestamp of the first message for the expanded state
			if (messages[0]) {
				onToggleExpand(messages[0].ts)
			}
		}
	}, [isLast, onToggleExpand, messages])

	// Generate summary text with elapsed time
	const summary = useMemo(() => getGroupSummary(messages, t, elapsedTime), [messages, t, elapsedTime])

	// Generate exploring progress text with live elapsed time
	const exploringText = useMemo(() => getExploringProgress(messages, t, elapsedTime), [messages, t, elapsedTime])

	// Wrap the entire component with useSize to track height changes for scroll adjustment
	const [rowElement, { height: rowHeight }] = useSize(
		<div className="group/exploration">
			{/* Header - matches ReasoningBlock style */}
			<div
				className={cn(
					CHAT_CONTENT_HORIZONTAL_PADDING,
					"mb-0.5 flex cursor-pointer select-none items-center justify-start gap-1.5 text-vscode-descriptionForeground transition-colors hover:text-vscode-foreground",
				)}
				onClick={handleToggle}>
				<div className="flex items-center gap-1">
					<span className={cn("text-sm font-medium", isExploring && "animate-shimmer")}>
						{isExploring ? exploringText : summary}
					</span>
				</div>
				<div className="flex items-center gap-1">
					<ArrowDown01Icon
						className={cn(
							"size-4 transition-all -rotate-90",
							expanded ? "opacity-100 rotate-0" : "opacity-0 group-hover/exploration:opacity-100",
						)}
					/>
				</div>
			</div>

			{/* Expandable content - renders ChatRow for each message */}
			{expanded && (
				<div className="mt-1 flex min-w-0 flex-col rounded-xs py-1">
					{messages.map((message, idx) => (
						<ChatRow
							key={message.ts}
							message={message}
							isExpanded={expandedRows[message.ts] || false}
							onToggleExpand={toggleRowExpansion}
							lastModifiedMessage={lastModifiedMessage}
							isLast={isLast && idx === messages.length - 1}
							onHeightChange={onHeightChange}
							isStreaming={isStreaming}
							disableReasoningAutoExpand
							onSuggestionClick={handleSuggestionClickInRow}
							onBatchFileResponse={handleBatchFileResponse}
							highlighted={highlightedMessageIndex !== null && highlightedMessageIndex === idx}
							enableCheckpoints={enableCheckpoints}
							onFollowUpUnmount={handleFollowUpUnmount}
							isFollowUpAnswered={message.isAnswered === true || message.ts === currentFollowUpTs}
							editable={false}
							onPrimaryButtonClick={handlePrimaryButtonClick}
							onSecondaryButtonClick={handleSecondaryButtonClick}
							enableButtons={enableButtons && isLast && idx === messages.length - 1}
							isAgentManagerMode={isAgentManagerMode}
						/>
					))}
				</div>
			)}
		</div>,
	)

	// Call onHeightChange when height changes (for scroll adjustment in parent)
	useEffect(() => {
		const isInitialRender = prevHeightRef.current === 0
		if (isLast && rowHeight !== 0 && rowHeight !== Infinity && rowHeight !== prevHeightRef.current) {
			if (!isInitialRender) {
				onHeightChange(rowHeight > prevHeightRef.current)
			}
			prevHeightRef.current = rowHeight
		}
	}, [rowHeight, isLast, onHeightChange])

	return rowElement
})

export default ExplorationGroupRow
