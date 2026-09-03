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

const statusDotClass: Partial<Record<TabStatus, string>> = {
	in_progress: "bg-[var(--vscode-charts-blue)] animate-pulse",
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
			className="flex items-end bg-[var(--vscode-editorGroupHeader-tabsBackground,var(--vscode-sideBar-background))] border-b border-[var(--vscode-panel-border)] h-9 px-1.5 pt-1 overflow-hidden shrink-0 gap-0.5">
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
						className={`flex items-center gap-1.5 h-[30px] pl-2.5 pr-1.5 rounded-t-sm min-w-0 max-w-[240px] cursor-pointer group select-none transition-colors duration-150 ${
							tab.isActive
								? "bg-[var(--vscode-tab-activeBackground,var(--vscode-editor-background))] text-[var(--vscode-tab-activeForeground,var(--vscode-foreground))] cursor-default shadow-xs border-t border-x border-[var(--vscode-panel-border)]/40 -mb-[1px] pb-[1px]"
								: "bg-transparent hover:bg-[var(--vscode-tab-hoverBackground)] text-[var(--vscode-tab-inactiveForeground)] hover:text-[var(--vscode-tab-activeForeground,var(--vscode-foreground))]"
						} ${isDragOver ? "ring-2 ring-[var(--vscode-focusBorder)]" : ""} ${isDragging ? "opacity-40" : ""}`}
						title={tab.label || "New Agent"}>
						{tab.status && statusDotClass[tab.status] && (
							<span className={`w-1.5 h-1.5 rounded-full shrink-0 ${statusDotClass[tab.status]}`} />
						)}
						<MessageSquareIcon
							width={14}
							height={14}
							className={tab.isActive ? "shrink-0" : "shrink-0 opacity-70"}
						/>
						<span className="text-xs truncate min-w-0">{tab.label || "New Agent"}</span>
						<button
							onClick={(e) => {
								e.stopPropagation()
								onClose(tab.taskId)
							}}
							className={`shrink-0 w-4.5 h-4.5 flex items-center justify-center rounded-full transition-colors hover:bg-[var(--vscode-toolbar-hoverBackground)] ${
								tab.isActive
									? "opacity-70 hover:opacity-100"
									: "opacity-0 group-hover:opacity-70 group-hover:hover:opacity-100"
							}`}
							title="Close tab"
							aria-label="Close tab">
							<X className="w-3 h-3" />
						</button>
					</div>
				)
			})}
			<button
				onClick={onAddTab}
				className="flex items-center justify-center h-6 w-6 my-auto ml-1 rounded-full hover:bg-[var(--vscode-toolbar-hoverBackground)] text-[var(--vscode-tab-inactiveForeground)] hover:text-[var(--vscode-tab-activeForeground,var(--vscode-foreground))] shrink-0 transition-colors"
				title="New tab"
				aria-label="New tab"
				data-testid="chat-tabs-add">
				<Plus className="w-3.5 h-3.5" />
			</button>
		</div>
	)
}

export default ChatTabs
