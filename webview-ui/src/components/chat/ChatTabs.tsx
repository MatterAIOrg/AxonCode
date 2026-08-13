import React, { useState } from "react"
import { X, Plus } from "lucide-react"
import { MessageSquareIcon } from "@/utils/customIcons"

export type TabStatus = "in_progress" | "completed"

export interface TabInfo {
	taskId: string
	label: string
	isActive: boolean
	status?: TabStatus
}

export interface ChatTabsProps {
	tabs: TabInfo[]
	onSelect: (taskId: string) => void
	onClose: (taskId: string) => void
	onAddTab: () => void
	onReorder?: (newOrder: string[]) => void
}

const statusDotClass: Record<TabStatus, string> = {
	in_progress: "bg-[var(--vscode-charts-blue)] animate-pulse",
	completed: "bg-[var(--vscode-testing-iconPassed)]",
}

const ChatTabs: React.FC<ChatTabsProps> = ({ tabs, onSelect, onClose, onAddTab, onReorder }) => {
	const [draggedTaskId, setDraggedtaskId] = useState<string | null>(null)
	const [dragOverTaskId, setDragOvertaskId] = useState<string | null>(null)

	const handleDragStart = (e: React.DragEvent<HTMLDivElement>, taskId: string) => {
		setDraggedtaskId(taskId)
		e.dataTransfer.effectAllowed = "move"
		e.dataTransfer.setData("text/plain", taskId)
	}

	const handleDragOver = (e: React.DragEvent<HTMLDivElement>, taskId: string) => {
		e.preventDefault()
		e.dataTransfer.dropEffect = "move"
		if (draggedTaskId && draggedTaskId !== taskId) {
			setDragOvertaskId(taskId)
		}
	}

	const handleDragLeave = () => {
		setDragOvertaskId(null)
	}

	const handleDrop = (e: React.DragEvent<HTMLDivElement>, targetTaskId: string) => {
		e.preventDefault()
		setDragOvertaskId(null)
		if (!draggedTaskId || draggedTaskId === targetTaskId || !onReorder) {
			setDraggedtaskId(null)
			return
		}
		const ids = tabs.map((t) => t.taskId)
		const fromIdx = ids.indexOf(draggedTaskId)
		const toIdx = ids.indexOf(targetTaskId)
		if (fromIdx === -1 || toIdx === -1) {
			setDraggedtaskId(null)
			return
		}
		const next = [...ids]
		next.splice(fromIdx, 1)
		next.splice(toIdx, 0, draggedTaskId)
		onReorder(next)
		setDraggedtaskId(null)
	}

	const handleDragEnd = () => {
		setDraggedtaskId(null)
		setDragOvertaskId(null)
	}

	return (
		<div
			data-testid="chat-tabs"
			className="flex items-center bg-[var(--vscode-editor-background)] border-b border-[var(--vscode-panel-border)] h-9 overflow-x-auto scrollbar-hide shrink-0">
			{tabs.map((tab) => {
				const isDragOver = dragOverTaskId === tab.taskId
				const isDragging = draggedTaskId === tab.taskId
				return (
					<div
						key={tab.taskId}
						role="button"
						draggable={!!onReorder}
						onClick={() => onSelect(tab.taskId)}
						onDragStart={(e) => handleDragStart(e, tab.taskId)}
						onDragOver={(e) => handleDragOver(e, tab.taskId)}
						onDragLeave={handleDragLeave}
						onDrop={(e) => handleDrop(e, tab.taskId)}
						onDragEnd={handleDragEnd}
						className={`flex items-center gap-1.5 h-full pl-3 pr-2 border-r border-[var(--vscode-panel-border)] min-w-0 max-w-[220px] cursor-pointer group ${tab.isActive ? "bg-[var(--vscode-tab-activeBackground)] text-[var(--vscode-tab-activeForeground)] cursor-default" : "bg-transparent hover:bg-[var(--vscode-tab-hoverBackground)] text-[var(--vscode-tab-inactiveForeground)]"} ${isDragOver ? "border-l-2 border-l-[var(--vscode-focusBorder)]" : ""} ${isDragging ? "opacity-40" : ""}`}
						title={tab.label || "New Agent"}>
						{tab.status && (
							<span className={`w-1.5 h-1.5 rounded-full shrink-0 ${statusDotClass[tab.status]}`} />
						)}
						<MessageSquareIcon width={14} height={14} className={tab.isActive ? "" : "opacity-70"} />
						<span className="text-xs truncate flex-1 min-w-0">{tab.label || "New Agent"}</span>
						<button
							onClick={(e) => {
								e.stopPropagation()
								onClose(tab.taskId)
							}}
							className={`shrink-0 w-5 h-5 flex items-center justify-center rounded hover:bg-[var(--vscode-toolbar-hoverBackground)] ${tab.isActive ? "opacity-70 hover:opacity-100" : "opacity-0 group-hover:opacity-100"}`}
							title="Close tab"
							aria-label="Close tab">
							<X className="w-3 h-3" />
						</button>
					</div>
				)
			})}
			<button
				onClick={onAddTab}
				className="flex items-center justify-center h-full w-9 hover:bg-[var(--vscode-tab-hoverBackground)] text-[var(--vscode-tab-inactiveForeground)] shrink-0"
				title="New tab"
				aria-label="New tab"
				data-testid="chat-tabs-add">
				<Plus className="w-3.5 h-3.5" />
			</button>
		</div>
	)
}

export default ChatTabs
