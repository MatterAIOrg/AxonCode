import React, { memo, useState, useEffect } from "react"
import { VSCodeTextField } from "@vscode/webview-ui-toolkit/react"
import { Button } from "@/components/ui"
import { useAppTranslation } from "@/i18n/TranslationContext"
import { Tab, TabHeader, TabContent } from "../common/Tab"
import { Virtuoso } from "react-virtuoso"
import { vscode } from "@/utils/vscode"
import type { MemoryItem } from "@roo/WebviewMessage"

type MemoriesViewProps = {
	onDone: () => void
}

const MemoriesView = ({ onDone }: MemoriesViewProps) => {
	const { t } = useAppTranslation()

	const [memories, setMemories] = useState<MemoryItem[]>([])
	const [searchQuery, setSearchQuery] = useState("")
	const [loading, setLoading] = useState(true)
	const [showAllWorkspaces, setShowAllWorkspaces] = useState(false)

	// Fetch memories on mount
	useEffect(() => {
		vscode.postMessage({
			type: "get_memories",
			showAllWorkspaces,
		})
	}, [showAllWorkspaces])

	// Listen for memories response
	useEffect(() => {
		const handleMessage = (event: MessageEvent) => {
			const message = event.data
			if (message.type === "memories_response") {
				setMemories(message.memories || [])
				setLoading(false)
			} else if (message.type === "memory_deleted") {
				// Refresh memories after deletion
				vscode.postMessage({
					type: "get_memories",
					showAllWorkspaces,
				})
			}
		}

		window.addEventListener("message", handleMessage)
		return () => window.removeEventListener("message", handleMessage)
	}, [showAllWorkspaces])

	// Filter memories by search query
	const filteredMemories = memories.filter((memory) => {
		if (!searchQuery) return true
		const query = searchQuery.toLowerCase()
		return (
			memory?.taskTitle?.toLowerCase().includes(query) ||
			memory?.content?.toLowerCase().includes(query) ||
			memory?.workspace?.toLowerCase().includes(query)
		)
	})

	// Format timestamp
	const formatTimestamp = (timestamp: string) => {
		const date = new Date(timestamp)
		return date.toLocaleString()
	}

	// Truncate content for preview
	const truncateContent = (content: string, maxLength = 200) => {
		if (content.length <= maxLength) return content
		return content.substring(0, maxLength) + "..."
	}

	// Handle delete memory
	const handleDeleteMemory = (memoryId: string) => {
		vscode.postMessage({
			type: "delete_memory",
			memoryId,
		})
	}

	return (
		<Tab>
			<TabHeader className="flex flex-col gap-2">
				<div className="flex justify-between items-center">
					<h3 className="text-vscode-foreground m-0 flex items-center gap-2">
						<span className="codicon codicon-book" />
						{t("memories:title")}
					</h3>
					<Button onClick={onDone}>{t("memories:done")}</Button>
				</div>
				<div className="flex flex-col gap-2">
					<VSCodeTextField
						className="w-full"
						placeholder={t("memories:searchPlaceholder")}
						value={searchQuery}
						onInput={(e) => {
							setSearchQuery((e.target as HTMLInputElement)?.value)
						}}>
						<div slot="start" className="codicon codicon-search mt-0.5 opacity-80 text-sm! mr-1" />
						{searchQuery && (
							<div
								className="input-icon-button codicon codicon-close flex justify-center items-center h-full"
								aria-label="Clear search"
								onClick={() => setSearchQuery("")}
								slot="end"
							/>
						)}
					</VSCodeTextField>
					<div className="flex gap-2">
						<Button
							variant={showAllWorkspaces ? "default" : "secondary"}
							onClick={() => setShowAllWorkspaces(!showAllWorkspaces)}
							className="flex-1">
							<span
								className={`codicon ${showAllWorkspaces ? "codicon-folder-opened" : "codicon-folder"} mr-1`}
							/>
							{showAllWorkspaces ? t("memories:allWorkspaces") : t("memories:currentWorkspace")}
						</Button>
					</div>
					<div className="text-vscode-descriptionForeground text-xs">
						{t("memories:count", { count: filteredMemories.length })}
					</div>
				</div>
			</TabHeader>

			<TabContent className="px-2 py-0">
				{loading ? (
					<div className="flex items-center justify-center h-full text-vscode-descriptionForeground">
						{t("memories:loading")}
					</div>
				) : filteredMemories.length === 0 ? (
					<div className="flex flex-col items-center justify-center h-full text-vscode-descriptionForeground gap-2">
						<span className="codicon codicon-book text-4xl opacity-50" />
						<p>{searchQuery ? t("memories:noResults") : t("memories:noMemories")}</p>
					</div>
				) : (
					<Virtuoso
						className="flex-1 overflow-y-scroll"
						data={filteredMemories}
						initialTopMostItemIndex={0}
						components={{
							List: React.forwardRef((props, ref) => <div {...props} ref={ref} />),
						}}
						itemContent={(_index, memory) => (
							<div
								key={memory.id}
								className="m-2 p-3 border border-vscode-panel-border rounded bg-vscode-editor-background hover:bg-vscode-toolbar-hoverBackground transition-colors">
								<div className="flex justify-between items-start mb-2">
									<h4 className="text-vscode-foreground font-medium m-0 flex-1">
										{memory.taskTitle || t("memories:untitled")}
									</h4>
									<div className="flex items-center gap-2">
										{memory.mode && (
											<span className="text-xs text-vscode-descriptionForeground">
												{memory.mode}
											</span>
										)}
										<Button
											variant="ghost"
											size="sm"
											onClick={() => handleDeleteMemory(memory.id)}
											className="p-1 h-auto min-w-0"
											title={t("memories:delete")}>
											<span className="codicon codicon-trash" />
										</Button>
									</div>
								</div>
								<div className="text-xs text-vscode-descriptionForeground mb-2">
									<div className="flex items-center gap-2">
										<span className="codicon codicon-folder" />
										<span className="truncate">{memory.workspace}</span>
									</div>
									<div className="flex items-center gap-2 mt-1">
										<span className="codicon codicon-clock" />
										<span>{formatTimestamp(memory.timestamp)}</span>
									</div>
								</div>
								<div className="text-vscode-foreground text-sm whitespace-pre-wrap">
									{truncateContent(memory.content)}
								</div>
							</div>
						)}
					/>
				)}
			</TabContent>
		</Tab>
	)
}

export default memo(MemoriesView)
