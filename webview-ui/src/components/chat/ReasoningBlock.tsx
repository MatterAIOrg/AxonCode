import { useExtensionState } from "@src/context/ExtensionStateContext"
import { useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"

import { cn } from "@/lib/utils"
import { ArrowDown01Icon } from "@/utils/customIcons"
import MarkdownBlock from "../common/MarkdownBlock"

interface ReasoningBlockProps {
	content: string
	ts: number
	isStreaming: boolean
	_isLast: boolean
	partial?: boolean
	metadata?: any
}

export const ReasoningBlock = ({ content, ts, isStreaming, _isLast, partial, metadata }: ReasoningBlockProps) => {
	const { t } = useTranslation()
	const { reasoningBlockCollapsed } = useExtensionState()

	const [isCollapsed, setIsCollapsed] = useState(reasoningBlockCollapsed)

	const [elapsed, setElapsed] = useState<number>(0)
	const contentRef = useRef<HTMLDivElement>(null)
	const collapseTimeoutRef = useRef<NodeJS.Timeout | null>(null)
	const wasLastRef = useRef<boolean>(false)

	// Get stored duration from metadata (if available)
	const storedDuration = metadata?.kiloCode?.reasoningDuration as number | undefined

	useEffect(() => {
		setIsCollapsed(reasoningBlockCollapsed)
	}, [reasoningBlockCollapsed])

	// Expand while streaming for the current (last) reasoning block only
	// Collapse with a delay when streaming completes
	useEffect(() => {
		// Only auto-expand if this is the last reasoning block and streaming is active
		if (isStreaming && _isLast) {
			wasLastRef.current = true
			setIsCollapsed(false)
			// Clear any pending collapse timeout
			if (collapseTimeoutRef.current) {
				clearTimeout(collapseTimeoutRef.current)
				collapseTimeoutRef.current = null
			}
		} else if (wasLastRef.current && !isStreaming) {
			// This block was the last one but streaming stopped
			// Delay collapse by 2 seconds
			collapseTimeoutRef.current = setTimeout(() => {
				setIsCollapsed(true)
			}, 2000)
			wasLastRef.current = false
		}

		return () => {
			if (collapseTimeoutRef.current) {
				clearTimeout(collapseTimeoutRef.current)
			}
		}
	}, [isStreaming, _isLast])

	useEffect(() => {
		if (partial) {
			const tick = () => setElapsed(Date.now() - ts)
			tick()
			const id = setInterval(tick, 1000)
			return () => {
				clearInterval(id)
				setElapsed(0) // Reset elapsed to stop counting
			}
		}
	}, [partial, ts])

	// Auto-scroll to bottom when streaming adds new content
	useEffect(() => {
		if (isStreaming && contentRef.current) {
			contentRef.current.scrollTop = contentRef.current.scrollHeight
		}
	}, [content, isStreaming])

	// Derive displayElapsed - use stored metadata if available, otherwise use live elapsed
	const displayElapsed = storedDuration !== undefined ? storedDuration : elapsed
	const totalSeconds = Math.floor(displayElapsed / 1000)

	const formatTime = (seconds: number): string => {
		if (seconds < 60) {
			return `${seconds}s`
		}
		const minutes = Math.floor(seconds / 60)
		const remainingSeconds = seconds % 60
		return remainingSeconds > 0 ? `${minutes}m${remainingSeconds}s` : `${minutes}m`
	}

	const timeLabel = formatTime(totalSeconds)
	// Brief (sub-2s) reasoning keeps its standalone phrasing; otherwise show the
	// base label ("Thinking"/"Thought") and break the duration out into a pill.
	const isBrief = displayElapsed > 0 && totalSeconds < 2
	const baseLabel = partial ? t("chat:reasoning.thinking") : t("chat:reasoning.thought")
	const briefLabel = partial ? t("chat:reasoning.thinkingBriefly") : t("chat:reasoning.thoughtBriefly")
	const labelText = isBrief ? briefLabel : baseLabel
	const showTime = !isBrief && totalSeconds >= 1

	const handleToggle = () => {
		setIsCollapsed(!isCollapsed)
	}

	const hasContent = (content?.trim()?.length ?? 0) > 0

	return (
		<div className="group/reasoning">
			{/* Header */}
			<div
				className="flex w-fit cursor-pointer select-none items-center gap-2 rounded-md pr-1.5 text-vscode-descriptionForeground transition-colors hover:text-vscode-foreground"
				onClick={handleToggle}>
				<span className={cn("text-sm font-medium", partial && "animate-shimmer")}>{labelText}</span>
				{showTime && (
					<span className="font-mono text-[11px] tabular-nums text-vscode-descriptionForeground/60">
						{timeLabel}
					</span>
				)}
				{hasContent && (
					<ArrowDown01Icon
						className={cn(
							"size-4 shrink-0 transition-all",
							!isCollapsed
								? "rotate-0 opacity-100"
								: "-rotate-90 opacity-0 group-hover/reasoning:opacity-100",
						)}
					/>
				)}
			</div>

			{/* Reasoning stream */}
			{hasContent && !isCollapsed && (
				<div className="mt-1 rounded-lg bg-vscode-textCodeBlock-background">
					<div
						ref={contentRef}
						className="scrollbar-hide max-h-[300px] overflow-y-auto px-3 py-2 text-sm text-vscode-descriptionForeground">
						<MarkdownBlock markdown={content} />
					</div>
				</div>
			)}
		</div>
	)
}
