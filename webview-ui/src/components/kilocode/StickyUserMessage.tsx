// kilocode_change: new file - Sticky user message component for chat
import { memo, useState } from "react"
import type { ClineMessage } from "@roo-code/types"
import { ReadOnlyChatText } from "../chat/ReadOnlyChatText"
import { cn } from "@src/lib/utils"
import { useVSCodeTheme } from "@src/kilocode/hooks/useVSCodeTheme"

export interface StickyUserMessageProps {
	task: ClineMessage
	messages: (ClineMessage | ClineMessage[])[]
	stickyIndex: number | null
}

/**
 * StickyUserMessage - Displays the current "sticky" user message.
 *
 * This works like sticky headers on mobile UI:
 * - Shows the initial prompt (task.text) by default
 * - As user scrolls, it tracks which user message should be sticky
 * - Uses CSS position: sticky to stay at the top of the scroll container
 */
const StickyUserMessage = ({ task, messages, stickyIndex }: StickyUserMessageProps) => {
	const [isExpanded, setIsExpanded] = useState(false)
	const theme = useVSCodeTheme()
	const isLightTheme = theme === "vs" || theme?.includes("light")

	// Get the message to display based on stickyIndex
	// stickyIndex: null = task prompt, number = index in messages array (groupedMessages)
	const getStickyMessage = () => {
		// If stickyIndex is null, show the initial task prompt
		if (stickyIndex === null) {
			return {
				text: task?.text,
				images: task?.images,
			}
		}

		// Find the user_feedback message at the given index in groupedMessages
		const msg = messages[stickyIndex]

		if (!msg || Array.isArray(msg)) {
			return {
				text: task?.text,
				images: task?.images,
			}
		}

		if (msg.type === "say" && msg.say === "user_feedback") {
			return {
				text: msg.text,
				images: msg.images,
			}
		}

		// Fallback to task prompt
		return {
			text: task?.text,
			images: task?.images,
		}
	}

	const stickyMessage = getStickyMessage()

	if (!stickyMessage?.text && !stickyMessage?.images?.length) {
		return null
	}

	return (
		<div
			className={cn(
				"px-2 py-2 flex flex-col gap-1 relative ml-0.9",
				"rounded-lg",
				"border border-[var(--vscode-activityBar-border)]",
				"transition-all duration-150",
			)}
			style={{
				backgroundColor: "var(--vscode-editor-background)",
				boxShadow: isLightTheme ? "rgb(0 0 0 / 15%) 0px 7px 19px 0px" : "rgb(18 18 18 / 88%) 0px 7px 19px 0px",
			}}>
			<div
				className="flex items-center justify-between gap-2 cursor-pointer"
				onClick={() => setIsExpanded(!isExpanded)}>
				<div className={cn("grow min-w-0", !isExpanded && "overflow-hidden")}>
					{!isExpanded ? (
						<div
							style={{
								display: "-webkit-box",
								WebkitLineClamp: 2,
								WebkitBoxOrient: "vertical",
								overflow: "hidden",
								textOverflow: "ellipsis",
								opacity: 0.85,
								fontSize: "13px",
							}}>
							<ReadOnlyChatText value={stickyMessage.text || ""} />
						</div>
					) : (
						<div
							className="overflow-auto max-h-40 text-[13px]"
							style={{
								whiteSpace: "pre-wrap",
								wordBreak: "break-word",
							}}>
							<ReadOnlyChatText value={stickyMessage.text || ""} />
						</div>
					)}
				</div>
			</div>
			{isExpanded && stickyMessage.images && stickyMessage.images.length > 0 && (
				<div className="mt-0">
					{stickyMessage.images.slice(0, 4).map((img, i) => (
						<img
							key={i}
							src={img}
							alt={`Image ${i + 1}`}
							className="max-w-[60px] max-h-[60px] rounded object-cover inline-block mr-1"
						/>
					))}
					{stickyMessage.images.length > 4 && (
						<span className="text-xs opacity-60">+{stickyMessage.images.length - 4} more</span>
					)}
				</div>
			)}
		</div>
	)
}

export default memo(StickyUserMessage)
