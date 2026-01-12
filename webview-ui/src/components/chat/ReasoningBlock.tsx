import { useExtensionState } from "@src/context/ExtensionStateContext"
import { useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"

import { cn } from "@/lib/utils"
import { ChevronUp } from "lucide-react"
import MarkdownBlock from "../common/MarkdownBlock"

interface ReasoningBlockProps {
	content: string
	ts: number
	isStreaming: boolean
	_isLast: boolean
	partial?: boolean
	metadata?: any
}

export const ReasoningBlock = ({ content, ts, isStreaming, _isLast, partial }: ReasoningBlockProps) => {
	const { t } = useTranslation()
	const { reasoningBlockCollapsed } = useExtensionState()

	const [isCollapsed, setIsCollapsed] = useState(reasoningBlockCollapsed)

	const [elapsed, setElapsed] = useState<number>(0)
	const [finalElapsed, setFinalElapsed] = useState<number>(0)
	const hasStoredFinalRef = useRef<boolean>(false)
	const contentRef = useRef<HTMLDivElement>(null)

	useEffect(() => {
		setIsCollapsed(reasoningBlockCollapsed)
	}, [reasoningBlockCollapsed])

	useEffect(() => {
		if (partial) {
			hasStoredFinalRef.current = false
			const tick = () => setElapsed(Date.now() - ts)
			tick()
			const id = setInterval(tick, 1000)
			return () => {
				clearInterval(id)
				// Capture final elapsed time when streaming stops
				const finalTime = Date.now() - ts
				setFinalElapsed(finalTime)
				setElapsed(0) // Reset elapsed to stop counting
				hasStoredFinalRef.current = true
			}
		}
	}, [partial, ts])

	const displayElapsed = isStreaming ? elapsed : finalElapsed
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

	const handleToggle = () => {
		setIsCollapsed(!isCollapsed)
	}

	return (
		<div className="group">
			<div
				className="flex items-center justify-start gap-1 pr-2 mt-1 cursor-pointer select-none opacity-40 hover:opacity-100"
				onClick={handleToggle}>
				<div className="flex items-center gap-1">
					{/* <Lightbulb className="w-3" /> */}
					{displayElapsed > 0 ? (
						<span className="text-vscode-foreground hover:text-[var(--color-matterai-green)]">
							{label} for {timeLabel}
						</span>
					) : (
						<span className="text-vscode-foreground hover:text-[var(--color-matterai-green)]">{label}</span>
					)}
				</div>
				<div className="flex items-center gap-1">
					<ChevronUp
						className={cn("w-4 transition-all group-hover:opacity-100", isCollapsed && "-rotate-180")}
					/>
				</div>
			</div>
			{(content?.trim()?.length ?? 0) > 0 && !isCollapsed && (
				<div ref={contentRef} className="text-vscode-descriptionForeground">
					<MarkdownBlock markdown={content} />
				</div>
			)}
		</div>
	)
}
