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
	const label = partial ? t("chat:reasoning.thinking") : t("chat:reasoning.thought")
	const briefLabel = partial ? t("chat:reasoning.thinkingBriefly") : t("chat:reasoning.thoughtBriefly")

	const handleToggle = () => {
		setIsCollapsed(!isCollapsed)
	}

	return (
		<div className="group/reasoning">
			<div
				className="flex items-center justify-start gap-1 mt-0.5 pr-2 cursor-pointer select-none opacity-40 hover:opacity-100"
				onClick={handleToggle}>
				<div className="flex items-center gap-1">
					{/* <Lightbulb className="w-3" /> */}
					{displayElapsed > 0 ? (
						<span
							className={cn(
								"text-sm text-vscode-foreground hover:text-[var(--vscode-button-background)]",
								partial && "animate-shimmer",
							)}>
							{totalSeconds < 2 ? briefLabel : `${label} for ${timeLabel}`}
						</span>
					) : (
						<span
							className={cn(
								"text-sm text-vscode-foreground hover:text-[var(--vscode-button-background)]",
								partial && "animate-shimmer",
							)}>
							{label}
						</span>
					)}
				</div>
				<div className="flex items-center gap-1">
					<ArrowDown01Icon
						className={cn(
							"size-4 transition-all -rotate-90",
							!isCollapsed ? "opacity-100 rotate-0" : "opacity-0 group-hover/reasoning:opacity-100",
						)}
					/>
				</div>
			</div>
			{(content?.trim()?.length ?? 0) > 0 && !isCollapsed && (
				<div ref={contentRef} className="text-vscode-descriptionForeground max-h-[300px] overflow-y-auto mt-2">
					<MarkdownBlock markdown={content} />
				</div>
			)}
		</div>
	)
}
