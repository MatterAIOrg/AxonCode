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

// Small mono micro-label pill used for the task meta row. Built entirely from
// VSCode theme tokens so it adapts to any installed theme.
const MetaPill = ({ icon, children, title }: { icon?: string; children: React.ReactNode; title?: string }) => (
	<span
		title={title}
		className="inline-flex max-w-[140px] items-center gap-1 rounded-full border border-vscode-panel-border bg-vscode-textCodeBlock-background px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider text-vscode-descriptionForeground">
		{icon && <span className={cn("codicon text-[10px]!", icon)} />}
		<span className="truncate">{children}</span>
	</span>
)

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

	// Compact variant keeps the lightweight inline-row look used by the
	// welcome-screen history preview.
	if (isCompact) {
		return (
			<div
				key={item.id}
				data-testid={`task-item-${item.id}`}
				className={cn(
					"cursor-pointer group rounded-md relative overflow-hidden hover:bg-vscode-list-hoverBackground transition-colors",
					{ "bg-red-900 text-white": item.fileNotfound },
					className,
				)}
				onClick={handleClick}>
				<div className="flex items-center gap-3 px-3 py-1">
					<ReadOnlyChatText
						value={item.title || item.task || ""}
						className="flex-1 overflow-hidden whitespace-pre-wrap text-vscode-foreground text-ellipsis line-clamp-1 opacity-70"
					/>
					<div className="flex items-center gap-1 shrink-0">
						<StandardTooltip content={new Date(item.ts).toLocaleString()}>
							<span className="text-xs text-vscode-descriptionForeground/60 first-letter:uppercase">
								{formatTimeAgo(item.ts)}
							</span>
						</StandardTooltip>
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
					</div>
				</div>
			</div>
		)
	}

	// Full variant: modern bordered card matching the MCP server cards.
	return (
		<div
			key={item.id}
			data-testid={`task-item-${item.id}`}
			className={cn(
				"group relative mb-2 cursor-pointer overflow-hidden rounded-xl border bg-vscode-editor-background transition-colors",
				isSelected ? "border-vscode-focusBorder" : "border-vscode-panel-border hover:border-vscode-focusBorder",
				item.fileNotfound && "!border-vscode-errorForeground",
				className,
			)}
			onClick={handleClick}>
			<div className="flex items-start gap-3 p-3">
				{/* Selection checkbox */}
				{isSelectionMode && (
					<div className="task-checkbox mt-0.5" onClick={(e) => e.stopPropagation()}>
						<Checkbox
							checked={isSelected}
							onCheckedChange={(checked: boolean) => onToggleSelection?.(item.id, checked === true)}
							variant="description"
						/>
					</div>
				)}

				<div className="min-w-0 flex-1">
					{/* Task text */}
					<ReadOnlyChatText
						value={item.title || item.task || ""}
						className="overflow-hidden whitespace-pre-wrap text-sm leading-snug text-vscode-foreground line-clamp-2"
					/>

					{/* Meta row */}
					<div className="mt-2 flex flex-wrap items-center gap-1.5">
						<StandardTooltip content={new Date(item.ts).toLocaleString()}>
							<span className="first-letter:uppercase">
								<MetaPill icon="codicon-history">{formatTimeAgo(item.ts)}</MetaPill>
							</span>
						</StandardTooltip>
						{item.apiModelId && (
							<StandardTooltip content={`Model: ${item.apiModelId}`}>
								<span>
									<MetaPill icon="codicon-chip">{item.apiModelId}</MetaPill>
								</span>
							</StandardTooltip>
						)}
						{item.isFavorited && (
							<span className="codicon codicon-star-full text-[11px]! text-vscode-descriptionForeground/70" />
						)}
					</div>
				</div>

				{/* Action buttons - reveal on hover */}
				{!isSelectionMode && (
					<div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
						<CopyButton itemTask={item.task} />
						{onDelete && <DeleteButton itemId={item.id} onDelete={onDelete} />}
					</div>
				)}
			</div>
		</div>
	)
}

export default memo(TaskItem)
