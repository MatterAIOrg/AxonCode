import { Button } from "@/components/ui"
import { vscode } from "@/utils/vscode"
import { useCallback, useEffect, useState } from "react"
import { getIconForFilePath, getIconUrlByName } from "vscode-material-icons"

type FileChange = {
	relPath: string
	absolutePath: string
	stat: {
		additions: number
		deletions: number
	}
	firstLineNumber?: number
}

export const AcceptRejectButtons = ({ onDismiss }: { onDismiss?: () => void }) => {
	const [files, setFiles] = useState<FileChange[]>([])
	const [isLoading, setIsLoading] = useState(true)
	const [isExpanded, setIsExpanded] = useState(false)
	const [materialIconsBaseUri, setMaterialIconsBaseUri] = useState("")

	useEffect(() => {
		const handleMessage = (event: MessageEvent) => {
			const message = event.data
			if (message?.type !== "pendingFileEdits") return

			const payload = message?.payload
			const messageFiles: FileChange[] | undefined = payload?.files

			setFiles(Array.isArray(messageFiles) ? messageFiles : [])
			setIsLoading(false)
		}
		window.addEventListener("message", handleMessage)

		// Request the pending file edits
		setIsLoading(true)
		vscode.postMessage({
			type: "getPendingFileEdits",
		})

		// Get the icons base uri on mount
		const w = window as any
		const baseUri = w.MATERIAL_ICONS_BASE_URI || w.vscode?.getState?.()?.MATERIAL_ICONS_BASE_URI || ""
		setMaterialIconsBaseUri(baseUri)

		// Poll for updates every 2 seconds to catch new edits
		const pollInterval = setInterval(() => {
			vscode.postMessage({
				type: "getPendingFileEdits",
			})
		}, 2000)

		return () => {
			window.removeEventListener("message", handleMessage)
			clearInterval(pollInterval)
		}
	}, [])

	const acceptCallback = useCallback(() => {
		// "Accept all" means keep changes AND clear any pending inline file review (CodeLens).
		vscode.postMessage({ type: "fileEditReviewAcceptAll" })
		onDismiss?.()
		setFiles([])
	}, [onDismiss])

	const rejectCallback = useCallback(() => {
		// Reject all edits - this will restore original content for all files
		vscode.postMessage({ type: "fileEditReviewRejectAll" })
		onDismiss?.()
		setFiles([])
	}, [onDismiss])

	const viewDiffCallback = useCallback(() => {
		// View diffs for all pending file edits in VS Code
		vscode.postMessage({ type: "viewPendingFileDiffs" })
	}, [])

	// Helper to format path
	const getFileName = (path: string) => path.split("/").pop() || path
	const getDir = (path: string) => {
		const parts = path.split("/")
		return parts.length > 1 ? parts.slice(0, -1).join("/") : ""
	}

	// Get file icon URL using vscode-material-icons
	const getFileIconUrl = (path: string): string => {
		const filename = path.split("/").pop() || ""
		if (filename.includes(".")) {
			const iconName = getIconForFilePath(filename)
			return getIconUrlByName(iconName, materialIconsBaseUri)
		}
		return ""
	}

	// Show nothing until we have data.
	if (isLoading || files.length === 0) {
		return null
	}

	return (
		<div
			className="flex flex-col w-full border border-vscode-editorWidget-border rounded-lg overflow-hidden bg-vscode-editor-background"
			style={{
				boxShadow: "rgb(18 18 18 / 88%) 0px 7px 29px 0px",
			}}>
			{/* File List - Only show when expanded */}
			{isExpanded && (
				<div className="flex flex-col">
					{/* View Diff Button at the top */}
					<div className="flex items-center justify-between px-2 py-1.5 border-b border-vscode-editorWidget-border bg-vscode-editorWidget-background">
						<span className="text-xs text-vscode-foreground opacity-80">View changes in editor</span>
						<Button
							type="button"
							size="sm"
							className="rounded-md text-sm px-3 py-1"
							onClick={viewDiffCallback}
							style={{
								background: "var(--vscode-button-secondaryBackground)",
								color: "var(--vscode-button-secondaryForeground)",
							}}>
							View Diff
						</Button>
					</div>
					{files.map((file) => {
						const fileIconUrl = getFileIconUrl(file.relPath)
						return (
							<div
								key={file.relPath}
								className="flex items-center gap-1.5 px-2 py-1 border-b border-vscode-editorWidget-border hover:bg-vscode-list-hoverBackground cursor-pointer"
								onClick={() =>
									vscode.postMessage({
										type: "openFile",
										text: file.relPath,
										values: file.firstLineNumber ? { line: file.firstLineNumber } : undefined,
									})
								}
								title={file.absolutePath}>
								{/* File Icon - Use actual file icon */}
								{fileIconUrl ? (
									<img src={fileIconUrl} className="w-4 h-4" alt="" />
								) : (
									<div
										className="flex items-center justify-center w-4 h-4 text-[10px] font-bold rounded"
										style={{
											backgroundColor: "var(--vscode-editorWidget-background)",
											color: "var(--vscode-descriptionForeground)",
										}}>
										{getFileName(file.relPath).split(".").pop()?.slice(0, 2).toUpperCase() || "F"}
									</div>
								)}

								{/* Diff Stats */}
								<div className="flex gap-0.5 text-sm font-medium">
									<span style={{ color: "var(--vscode-charts-green)" }}>+{file.stat.additions}</span>
									<span style={{ color: "var(--vscode-charts-red)" }}>-{file.stat.deletions}</span>
								</div>

								{/* File Name */}
								<div className="flex flex-row gap-2.5 flex-1 min-w-0 items-center justify-start">
									<span className="text-sm flex-shrink-0 font-medium text-vscode-foreground truncate">
										{getFileName(file.relPath)}
									</span>
									<span className="text-xs text-vscode-foreground opacity-80 truncate">
										{getDir(file.absolutePath)}
									</span>
								</div>
							</div>
						)
					})}
				</div>
			)}

			{/* Footer with Collapse/Expand and Actions */}
			<div className="flex items-center justify-between px-2 py-1 bg-vscode-editorWidget-background border-vscode-editorWidget-border">
				{/* Left side: collapse button and file count */}
				<div
					className="flex items-center gap-1 cursor-pointer select-none"
					onClick={() => setIsExpanded(!isExpanded)}>
					<span className={`text-sm codicon codicon-chevron-${isExpanded ? "up" : "down"}`} />

					<span className="text-xs text-vscode-foreground opacity-80">
						{files.length} {files.length === 1 ? "File" : "Files"} with changes
					</span>
				</div>

				{/* Right side: action buttons */}
				<div className="flex items-center gap-2">
					<Button
						type="button"
						size="sm"
						className="rounded-md text-sm px-3 py-1"
						onClick={rejectCallback}
						style={{
							background: "var(--vscode-button-secondaryBackground)",
							color: "var(--vscode-button-secondaryForeground)",
						}}>
						Reject all
					</Button>

					<Button
						type="button"
						size="sm"
						className="rounded-md text-sm px-3 py-1"
						onClick={acceptCallback}
						style={{
							background: "#1f932f",
							color: "#ffffff",
							fontWeight: 600,
						}}>
						Accept all
					</Button>
				</div>
			</div>
		</div>
	)
}
