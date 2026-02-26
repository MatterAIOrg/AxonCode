import type { HistoryItem } from "@roo-code/types"
import { memo } from "react"

import { Checkbox } from "@/components/ui/checkbox"
import { StandardTooltip } from "@/components/ui/standard-tooltip"
import { cn } from "@/lib/utils"
import { formatTimeAgo } from "@/utils/format"
import { vscode } from "@/utils/vscode"
import { ReadOnlyChatText } from "@/components/chat/ReadOnlyChatText"
import { CopyButton } from "./CopyButton"
import { DeleteButton } from "./DeleteButton"

interface TaskItemProps {
	item: HistoryItem
	variant: "compact" | "full"
	showWorkspace?: boolean
	isSelectionMode?: boolean
	isSelected?: boolean
	onToggleSelection?: (taskId: string, isSelected: boolean) => void
	onDelete?: (taskId: string) => void
	className?: string
}

const TaskItem = ({
	item,
	variant,
	// showWorkspace = false,
	isSelectionMode = false,
	isSelected = false,
	onToggleSelection,
	onDelete,
	className,
}: TaskItemProps) => {
	const handleClick = () => {
		if (isSelectionMode && onToggleSelection) {
			onToggleSelection(item.id, !isSelected)
		} else {
			vscode.postMessage({ type: "showTaskWithId", text: item.id })
		}
	}

	const isCompact = variant === "compact"

	return (
		<div
			key={item.id}
			data-testid={`task-item-${item.id}`}
			className={cn(
				"cursor-pointer group rounded-md relative overflow-hidden hover:bg-vscode-list-hoverBackground transition-colors",
				{
					"bg-red-900 text-white": item.fileNotfound,
				},
				className,
			)}
			onClick={handleClick}>
			<div
				className={cn("flex items-center gap-3 px-3 py-1", {
					"pl-3": !isCompact && isSelectionMode,
				})}>
				{/* Selection checkbox - only in full variant */}
				{!isCompact && isSelectionMode && (
					<div
						className="task-checkbox"
						onClick={(e) => {
							e.stopPropagation()
						}}>
						<Checkbox
							checked={isSelected}
							onCheckedChange={(checked: boolean) => onToggleSelection?.(item.id, checked === true)}
							variant="description"
						/>
					</div>
				)}

				{/* Task text */}
				<ReadOnlyChatText
					value={item.title || item.task || ""}
					className={cn(
						"flex-1 overflow-hidden whitespace-pre-wrap text-vscode-foreground text-ellipsis line-clamp-1 opacity-70",
						{
							"text-base": !isCompact,
						},
					)}
				/>

				{/* Time and buttons container */}
				<div className="flex items-center gap-1 shrink-0">
					{/* Time - always visible */}
					<StandardTooltip content={new Date(item.ts).toLocaleString()}>
						<span className="text-xs text-vscode-descriptionForeground/60 first-letter:uppercase">
							{formatTimeAgo(item.ts)}
						</span>
					</StandardTooltip>

					{/* Model - always visible if available */}
					{item.apiModelId && (
						<StandardTooltip content={`Model: ${item.apiModelId}`}>
							<div className="ml-0.5 flex items-center gap-1.5">
								<div className="w-1 h-1 rounded-full bg-vscode-descriptionForeground/30" />
								<span className="text-xs text-vscode-descriptionForeground/60 truncate max-w-[100px]">
									{item.apiModelId}
								</span>
							</div>
						</StandardTooltip>
					)}

					{/* Action buttons - only visible on hover, no space when hidden */}
					{!isSelectionMode && (
						<div className="flex items-center gap-1 hidden group-hover:flex transition-transform duration-200 ease-in-out origin-right">
							<CopyButton itemTask={item.task} />
							{onDelete && <DeleteButton itemId={item.id} onDelete={onDelete} />}
						</div>
					)}
				</div>
			</div>
		</div>
	)
}

export default memo(TaskItem)
