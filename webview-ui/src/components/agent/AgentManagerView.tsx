import React, { useCallback, useMemo, useEffect, useState } from "react"
import { useTaskSearch } from "../history/useTaskSearch"
import { vscode } from "../../utils/vscode"
import { Folder01Icon, Folder02Icon, ArrowDown01Icon, AddCircleHalfDotIcon } from "@/utils/customIcons"
import { AgentFileViewerProvider, useAgentFileViewer } from "./AgentFileViewerContext"
import AgentFileViewer from "./AgentFileViewer"

interface AgentManagerViewProps {
	children: React.ReactNode
	isOpen: boolean
}

const AGENT_SIDEBAR_WIDTH = 260
const FILE_VIEWER_DEFAULT_WIDTH = 420
const FILE_VIEWER_MIN_WIDTH = 320
const FILE_VIEWER_MAX_WIDTH = 760
const CHAT_MIN_WIDTH = 360

const clampFileViewerWidth = (width: number) => {
	const viewportMax = Math.max(FILE_VIEWER_MIN_WIDTH, window.innerWidth - AGENT_SIDEBAR_WIDTH - CHAT_MIN_WIDTH)
	return Math.min(Math.max(width, FILE_VIEWER_MIN_WIDTH), Math.min(FILE_VIEWER_MAX_WIDTH, viewportMax))
}

export const AgentManagerView: React.FC<AgentManagerViewProps> = ({ children, isOpen }) => {
	const { tasks } = useTaskSearch()

	const workspaces = useMemo(() => {
		const groups: Record<string, typeof tasks> = {}
		tasks.forEach((task) => {
			const ws = task.workspace || "matteraiorg/docs"
			if (!groups[ws]) groups[ws] = []
			groups[ws].push(task)
		})
		return groups
	}, [tasks])

	// Initialize with all workspaces expanded by default
	const [expandedWorkspaces, setExpandedWorkspaces] = useState<Set<string>>(() => new Set(Object.keys(workspaces)))

	// Update expanded workspaces when new workspaces are added
	useEffect(() => {
		setExpandedWorkspaces((prev) => {
			const next = new Set(prev)
			Object.keys(workspaces).forEach((ws) => next.add(ws))
			return next
		})
	}, [workspaces])

	const toggleWorkspace = (ws: string) => {
		setExpandedWorkspaces((prev) => {
			const next = new Set(prev)
			if (next.has(ws)) {
				next.delete(ws)
			} else {
				next.add(ws)
			}
			return next
		})
	}

	if (!isOpen) {
		return <>{children}</>
	}

	// Format timestamp like "30d", "5min", etc.
	const formatCompactTime = (ts: number): string => {
		const now = Date.now()
		const diffMs = Math.max(0, now - ts)
		const diffMins = Math.floor(diffMs / (1000 * 60))
		if (diffMins < 60) return `${Math.max(1, diffMins)}m`
		const diffHours = Math.floor(diffMins / 60)
		if (diffHours < 24) return `${diffHours}h`
		const diffDays = Math.floor(diffHours / 24)
		if (diffDays < 30) return `${diffDays}d`
		const diffMonths = Math.floor(diffDays / 30)
		return `${diffMonths}mo`
	}

	return (
		<AgentFileViewerProvider>
			<div className="absolute inset-0 flex overflow-hidden bg-[var(--vscode-editor-background)]">
				{/* Left Side: Agent Manager Sidebar */}
				<div className="w-[260px] h-full bg-[var(--vscode-sideBar-background)] border-r border-[var(--vscode-panel-border)] flex flex-col shrink-0 overflow-hidden">
					<div className="px-2 py-1 flex flex-col gap-2 border-b border-[var(--vscode-panel-border)]">
						<div
							className="flex items-center cursor-pointer hover:bg-[var(--vscode-list-hoverBackground)] transition-colors rounded-md p-2"
							onClick={() => vscode.postMessage({ type: "clearTask" })}>
							<AddCircleHalfDotIcon className="w-4 h-4 shrink-0 mr-2" />
							<span className="text-left">New Agent</span>
						</div>
					</div>

					<div className="flex-1 overflow-y-auto w-full">
						<div className="p-3">
							{Object.entries(workspaces).map(([ws, wsTasks]) => {
								const isExpanded = expandedWorkspaces.has(ws)
								return (
									<div key={ws} className="mb-4">
										<div
											className="flex items-center gap-2 mb-1 opacity-70 font-medium text-sm text-[var(--vscode-foreground)] cursor-pointer hover:bg-[var(--vscode-list-hoverBackground)] transition-colors rounded-md p-1"
											onClick={() => toggleWorkspace(ws)}>
											{isExpanded ? (
												<Folder02Icon className="w-4 h-4 shrink-0" />
											) : (
												<Folder01Icon className="w-4 h-4 shrink-0" />
											)}
											<span className="truncate">{ws.split(/[/\\]/).pop()}</span>
											<ArrowDown01Icon
												className={`w-3 h-3 shrink-0 transition-transform ${isExpanded ? "rotate-180" : ""}`}
											/>
										</div>
										{isExpanded && (
											<>
												{wsTasks.length === 0 ? (
													<div className="text-sm opacity-60 ml-0.5">- No agents yet</div>
												) : (
													<div className="flex flex-col gap-1">
														{wsTasks.map((task) => (
															<div
																key={task.id}
																className="cursor-pointer group rounded-md py-1 px-2 hover:bg-[var(--vscode-list-hoverBackground)] transition-colors flex items-center justify-between"
																onClick={() =>
																	vscode.postMessage({
																		type: "showTaskWithId",
																		text: task.id,
																	})
																}>
																<span className="text-sm text-[var(--vscode-foreground)] truncate opacity-90 font-medium">
																	{task.title || task.task}
																</span>
																<span className="text-xs text-[var(--vscode-descriptionForeground)] opacity-70 shrink-0 ml-2">
																	{formatCompactTime(task.ts)}
																</span>
															</div>
														))}
													</div>
												)}
											</>
										)}
									</div>
								)
							})}
						</div>
					</div>
				</div>

				{/* Center: Chat View Container */}
				<div className="flex-1 flex flex-col h-full overflow-hidden relative min-w-0 bg-[var(--vscode-sideBar-background)]">
					{children}
				</div>

				<ResizableAgentFileViewer />
			</div>
		</AgentFileViewerProvider>
	)
}

const ResizableAgentFileViewer: React.FC = () => {
	const { fileViewerState, pendingDiffFiles } = useAgentFileViewer()
	const [fileViewerWidth, setFileViewerWidth] = useState(FILE_VIEWER_DEFAULT_WIDTH)
	const shouldShowFileViewer = Boolean(fileViewerState) || pendingDiffFiles.length > 0

	useEffect(() => {
		const handleResize = () => {
			setFileViewerWidth((currentWidth) => clampFileViewerWidth(currentWidth))
		}

		window.addEventListener("resize", handleResize)
		return () => window.removeEventListener("resize", handleResize)
	}, [])

	const handleFileViewerResizeStart = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
		event.preventDefault()

		const previousCursor = document.body.style.cursor
		const previousUserSelect = document.body.style.userSelect
		document.body.style.cursor = "col-resize"
		document.body.style.userSelect = "none"

		const handlePointerMove = (moveEvent: PointerEvent) => {
			setFileViewerWidth(clampFileViewerWidth(window.innerWidth - moveEvent.clientX))
		}

		const handlePointerUp = () => {
			document.body.style.cursor = previousCursor
			document.body.style.userSelect = previousUserSelect
			window.removeEventListener("pointermove", handlePointerMove)
			window.removeEventListener("pointerup", handlePointerUp)
		}

		window.addEventListener("pointermove", handlePointerMove)
		window.addEventListener("pointerup", handlePointerUp)
	}, [])

	if (!shouldShowFileViewer) {
		return null
	}

	return (
		<>
			<div
				role="separator"
				aria-orientation="vertical"
				aria-label="Resize file viewer"
				className="group relative h-full w-1 shrink-0 cursor-col-resize bg-transparent"
				onPointerDown={handleFileViewerResizeStart}
				onDoubleClick={() => setFileViewerWidth(FILE_VIEWER_DEFAULT_WIDTH)}>
				<div className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-[var(--vscode-panel-border)] group-hover:bg-[var(--vscode-focusBorder)]" />
			</div>

			<div className="h-full flex flex-col shrink-0 overflow-hidden" style={{ width: `${fileViewerWidth}px` }}>
				<AgentFileViewer />
			</div>
		</>
	)
}
