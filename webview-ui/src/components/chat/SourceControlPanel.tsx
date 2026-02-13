import { ChatSpark01Icon, Copy01Icon, Tick02Icon, TickDouble02Icon } from "@/utils/customIcons"
import { vscode } from "@/utils/vscode"
import { VSCodeButton } from "@vscode/webview-ui-toolkit/react"
import React, { useEffect, useMemo, useState } from "react"
import { getIconForFilePath, getIconUrlByName } from "vscode-material-icons"
import MarkdownBlock from "../common/MarkdownBlock"
import { MatterProgressIndicator } from "./ProgressIndicator"

const LOADING_STATES = ["Analyzing...", "Digesting...", "Reviewing...", "Thinking..."]

const AnimatedLoadingText: React.FC = () => {
	const [currentIndex, setCurrentIndex] = useState(0)
	const [opacity, setOpacity] = useState(1)

	useEffect(() => {
		const interval = setInterval(() => {
			setOpacity(0)
			setTimeout(() => {
				setCurrentIndex((prev) => (prev + 1) % LOADING_STATES.length)
				setOpacity(1)
			}, 300)
		}, 3000)

		return () => clearInterval(interval)
	}, [])

	return (
		<span className="text-xs transition-opacity duration-300 ease-in-out" style={{ opacity }}>
			{LOADING_STATES[currentIndex]}
		</span>
	)
}

interface FileChange {
	relPath: string
	absolutePath: string
	stat?: {
		additions: number
		deletions: number
	}
	status?: string // 'M' for modified, 'A' for added, 'D' for deleted, etc.
}

interface CodeReviewComment {
	path: string
	body: string
	suggestion: string
	startLine: number
	endLine: number
}

interface CodeReviewResult {
	reviewBody: string
	reviewComments: CodeReviewComment[]
}

interface SourceControlPanelProps {
	fileChanges: FileChange[]
	codeReviewResult: CodeReviewResult | null
	codeReviewError?: string | null
	isLoading: boolean
	onRunCodeReview: () => void
	onClose: () => void
	hasKilocodeToken?: boolean
}

// Get file name from path
const getFileName = (filePath: string): string => {
	return filePath.split("/").pop() || filePath
}

// Get directory from path
const getDirectory = (filePath: string): string => {
	const parts = filePath.split("/")
	if (parts.length <= 1) return ""
	return parts.slice(0, -1).join("/")
}

export const SourceControlPanel: React.FC<SourceControlPanelProps> = ({
	fileChanges,
	codeReviewResult,
	codeReviewError,
	isLoading,
	onRunCodeReview,
	onClose,
	hasKilocodeToken = true,
}) => {
	const [materialIconsBaseUri, setMaterialIconsBaseUri] = useState("")
	const [isExpanded, setIsExpanded] = useState(true)
	const [copyButtonText, setCopyButtonText] = useState<"Copy All" | "Copied!">("Copy All")

	// Get the icons base uri on mount
	useEffect(() => {
		const w = window as any
		const baseUri = w.MATERIAL_ICONS_BASE_URI || w.vscode?.getState?.()?.MATERIAL_ICONS_BASE_URI || ""
		setMaterialIconsBaseUri(baseUri)
	}, [])

	const handleFileClick = (filePath: string) => {
		vscode.postMessage({
			type: "openFile",
			text: filePath,
		})
	}

	const handleCommentClick = (comment: CodeReviewComment) => {
		vscode.postMessage({
			type: "openFile",
			text: comment.path,
			values: { line: comment.startLine },
		})
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

	// Calculate total stats
	const totalStats = useMemo(() => {
		return fileChanges.reduce(
			(acc, file) => ({
				additions: acc.additions + (file.stat?.additions || 0),
				deletions: acc.deletions + (file.stat?.deletions || 0),
			}),
			{ additions: 0, deletions: 0 },
		)
	}, [fileChanges])

	const handleApplyFix = (fixIndex: number) => {
		if (!codeReviewResult || !codeReviewResult.reviewComments[fixIndex]) return
		const comment = codeReviewResult.reviewComments[fixIndex]
		vscode.postMessage({
			type: "applyCodeReviewFix",
			payload: { fixIndex, comment },
		})
		// Refresh pending edits to get updated state after applying fix
		setTimeout(() => {
			vscode.postMessage({ type: "getPendingFileEdits" })
		}, 500)
	}

	const handleCopyPrompt = async (comment: CodeReviewComment) => {
		const promptText = `File: ${comment.path}
Line: ${comment.startLine}${comment.endLine !== comment.startLine ? `-${comment.endLine}` : ""}

Issue:
${comment.body}

Suggested Fix:
${comment.suggestion}`

		try {
			await navigator.clipboard.writeText(promptText)
		} catch (error) {
			console.error("Failed to copy to clipboard:", error)
			// Fallback for older browsers
			const textArea = document.createElement("textarea")
			textArea.value = promptText
			document.body.appendChild(textArea)
			textArea.select()
			try {
				document.execCommand("copy")
			} catch (fallbackError) {
				console.error("Fallback copy failed:", fallbackError)
			}
			document.body.removeChild(textArea)
		}
	}

	const handleApplyAllFixes = () => {
		if (!codeReviewResult) return
		vscode.postMessage({
			type: "applyAllCodeReviewFixes",
			payload: {
				fixIndices: codeReviewResult.reviewComments.map((_, i) => i),
				comments: codeReviewResult.reviewComments,
			},
		})
		// We can't close the panel directly from here as state is in parent,
		// but typically "Fix All" implies we are done with this review session.
		// For now, we just apply.
		// If we want to close, we should call onClose(), but maybe user wants to see confirmation.
		// Let's just apply for now.
		onClose()
	}

	const handleCopyAllPrompts = async () => {
		if (!codeReviewResult) return

		// Build the prompts text
		const promptsText = codeReviewResult.reviewComments
			.map((comment, index) => {
				return `Prompt ${index + 1}:
File: ${comment.path}
Line: ${comment.startLine}${comment.endLine !== comment.startLine ? `-${comment.endLine}` : ""}

Issue:
${comment.body}

Suggested Fix:
${comment.suggestion}
`
			})
			.join("\n" + "=".repeat(80) + "\n\n")

		try {
			await navigator.clipboard.writeText(promptsText)
			setCopyButtonText("Copied!")
			// Reset back to "Copy All" after 2 seconds
			setTimeout(() => {
				setCopyButtonText("Copy All")
			}, 2000)
		} catch (error) {
			console.error("Failed to copy to clipboard:", error)
			// Fallback for older browsers
			const textArea = document.createElement("textarea")
			textArea.value = promptsText
			document.body.appendChild(textArea)
			textArea.select()
			try {
				document.execCommand("copy")
				setCopyButtonText("Copied!")
				setTimeout(() => {
					setCopyButtonText("Copy All")
				}, 2000)
			} catch (fallbackError) {
				console.error("Fallback copy failed:", fallbackError)
			}
			document.body.removeChild(textArea)
		}
	}

	return (
		<div
			className="flex flex-col w-full border border-[var(--color-matterai-border)] rounded-lg overflow-hidden bg-vscode-editor-background"
			style={{
				width: "100%",
				boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)",
			}}>
			{/* Header */}
			<div className="flex items-center justify-between px-3 py-2 bg-vscode-editorWidget-background border-b border-vscode-editorWidget-border">
				<div className="flex items-center gap-2">
					<span className="codicon codicon-sparkle text-vscode-foreground" />
					<span className="text-sm font-semibold text-vscode-foreground">AI Code Review</span>
				</div>
				<div className="flex items-center gap-2">
					{/* Always show the run/retry button when there are file changes */}
					{fileChanges.length > 0 && !isLoading && (
						<VSCodeButton appearance="primary" onClick={onRunCodeReview}>
							<div className="flex items-center gap-1">
								<span className="codicon codicon-sparkle mr-1" />
								<span className="text-xs">{codeReviewError ? "Retry Review" : "Run Review"}</span>
							</div>
						</VSCodeButton>
					)}
					{/* Show loading state */}
					{fileChanges.length > 0 && isLoading && (
						<VSCodeButton appearance="primary" disabled={true}>
							<div className="flex items-center gap-1">
								<MatterProgressIndicator />
								<AnimatedLoadingText />
							</div>
						</VSCodeButton>
					)}
					<VSCodeButton appearance="icon" onClick={onClose} title="Close">
						<span className="codicon codicon-close" />
					</VSCodeButton>
				</div>
			</div>

			{/* File List - Expandable */}
			{fileChanges.length > 0 && (
				<div className="flex flex-col">
					{/* Expand/Collapse Header */}
					<div
						className="flex items-center gap-2 px-3 py-1.5 cursor-pointer select-none hover:bg-vscode-list-hoverBackground border-b border-vscode-editorWidget-border"
						onClick={() => setIsExpanded(!isExpanded)}>
						<span className={`codicon codicon-chevron-${isExpanded ? "down" : "right"} text-xs`} />
						<span className="text-xs text-vscode-foreground opacity-80">
							Changes ({fileChanges.length})
						</span>
						<div className="flex gap-1 text-xs ml-auto">
							{totalStats.additions > 0 && (
								<span style={{ color: "var(--vscode-charts-green)" }}>+{totalStats.additions}</span>
							)}
							{totalStats.deletions > 0 && (
								<span style={{ color: "var(--vscode-charts-red)" }}>-{totalStats.deletions}</span>
							)}
						</div>
					</div>

					{/* File List */}
					{isExpanded && (
						<div className="flex flex-col max-h-48 overflow-y-auto">
							{fileChanges.map((file, index) => {
								const fileIconUrl = getFileIconUrl(file.relPath)
								const fileName = getFileName(file.relPath)
								const directory = getDirectory(file.relPath)

								return (
									<div
										key={index}
										className="flex items-center gap-1 px-3 py-1.5 hover:bg-vscode-list-hoverBackground cursor-pointer group"
										onClick={() => handleFileClick(file.absolutePath)}
										title={file.absolutePath}>
										{/* File Icon */}
										{fileIconUrl ? (
											<img src={fileIconUrl} className="w-4 h-4 flex-shrink-0" alt="" />
										) : (
											<span className="codicon codicon-file w-4 h-4 flex-shrink-0" />
										)}

										{/* Diff Stats */}
										<div className="flex gap-0.5 text-xs font-mono flex-shrink-0 w-fit">
											<span style={{ color: "var(--vscode-charts-green)" }}>
												+{file.stat?.additions || 0}
											</span>
											<span style={{ color: "var(--vscode-charts-red)" }}>
												-{file.stat?.deletions || 0}
											</span>
										</div>

										{/* File Name & Path */}
										<div className="flex items-center gap-1 flex-1 min-w-0">
											<span className="text-sm font-medium text-vscode-foreground truncate">
												{fileName}
											</span>
											{directory && (
												<span className="text-xs text-vscode-foreground opacity-60 truncate">
													{directory}
												</span>
											)}
										</div>

										{/* Chevron on hover */}
										<span className="codicon codicon-chevron-right text-xs opacity-0 group-hover:opacity-60 flex-shrink-0" />
									</div>
								)
							})}
						</div>
					)}
				</div>
			)}

			{/* Empty State */}
			{fileChanges.length === 0 && !codeReviewResult && !codeReviewError && (
				<div className="flex flex-col items-center justify-center py-8 px-4">
					<span
						className="codicon codicon-check text-2xl mb-2"
						style={{ color: "var(--vscode-charts-green)" }}
					/>
					<span className="text-sm text-vscode-foreground font-medium">All changes reviewed</span>
					<span className="text-xs text-vscode-foreground opacity-60">No uncommitted changes to review</span>
				</div>
			)}

			{/* Error State */}
			{codeReviewError && (
				<div className="border-t border-vscode-editorWidget-border">
					<div className="flex items-center gap-2 px-3 py-2 bg-vscode-editorWidget-background border-b border-vscode-editorWidget-border">
						<span className="codicon codicon-error text-vscode-errorForeground" />
						<span className="text-sm font-medium text-vscode-foreground">Review Failed</span>
					</div>
					<div className="px-3 py-2.5 text-sm text-vscode-errorForeground whitespace-pre-wrap bg-vscode-editor-background">
						{codeReviewError}
					</div>
				</div>
			)}

			{/* Code Review Results Section */}
			{codeReviewResult && (
				<div className="border-t border-vscode-editorWidget-border">
					{/* Review Header */}
					<div className="flex items-center justify-between px-3 py-2 bg-vscode-editorWidget-background border-b border-vscode-editorWidget-border">
						<div className="flex items-center gap-2">
							<ChatSpark01Icon className="size-4 text-white" />
							<span className="text-md font-medium text-vscode-foreground">Review Results</span>
							{codeReviewResult.reviewComments?.length > 0 && (
								<span className="text-xs font-bold w-5 h-5 flex items-center justify-center rounded-xs bg-[var(--color-matterai-chip-blue)] border border-[var(--color-matterai-blue)] text-vscode-badge-foreground">
									{codeReviewResult.reviewComments.length}
								</span>
							)}
						</div>
						{codeReviewResult.reviewComments?.length > 0 && (
							<>
								{hasKilocodeToken ? (
									<div className="flex gap-1">
										<VSCodeButton appearance="secondary" onClick={handleCopyAllPrompts}>
											<Copy01Icon className="size-4" />
										</VSCodeButton>
										<VSCodeButton appearance="secondary" onClick={handleApplyAllFixes}>
											<TickDouble02Icon className="size-4 mr-1" />
											Fix All
										</VSCodeButton>
									</div>
								) : (
									<VSCodeButton appearance="secondary" onClick={handleCopyAllPrompts}>
										<Copy01Icon className="size-4 mr-1" />
										{copyButtonText}
									</VSCodeButton>
								)}
							</>
						)}
					</div>

					{/* Review Summary */}
					{codeReviewResult.reviewBody && (
						<div className="px-3 py-2.5 text-md font-semibold text-vscode-foreground whitespace-pre-wrap bg-vscode-editor-background border-b border-vscode-editorWidget-border">
							{codeReviewResult.reviewBody}
						</div>
					)}

					{/* Review Comments */}
					{codeReviewResult.reviewComments?.length > 0 ? (
						<div className="flex flex-col max-h-64 overflow-y-auto">
							{codeReviewResult.reviewComments.map((comment, index) => {
								const commentFileIconUrl = getFileIconUrl(comment.path)
								return (
									<div
										key={index}
										className="px-3 py-2.5 border-b border-vscode-editorWidget-border last:border-b-0 hover:bg-vscode-list-hoverBackground">
										<div className="flex items-center justify-between mb-1.5">
											<button
												className="flex items-center gap-1.5 text-sm hover:underline cursor-pointer bg-transparent border-none p-0"
												style={{ color: "var(--color-matterai-green)" }}
												onClick={() => handleCommentClick(comment)}>
												{commentFileIconUrl ? (
													<img src={commentFileIconUrl} className="w-3.5 h-3.5" alt="" />
												) : (
													<span className="codicon codicon-go-to-file" />
												)}
												{getFileName(comment.path)}:{comment.startLine}
												{comment.endLine !== comment.startLine && `-${comment.endLine}`}
											</button>

											{hasKilocodeToken ? (
												<div className="flex gap-1">
													<VSCodeButton
														appearance="primary"
														onClick={() => handleCopyPrompt(comment)}>
														<Copy01Icon className="size-4" />
													</VSCodeButton>
													<VSCodeButton
														appearance="primary"
														onClick={() => handleApplyFix(index)}>
														<Tick02Icon className="size-4 mr-1" />
														Fix Issue
													</VSCodeButton>
												</div>
											) : (
												<VSCodeButton
													appearance="primary"
													onClick={() => handleCopyPrompt(comment)}>
													<Copy01Icon className="size-4 mr-1" />
													Copy
												</VSCodeButton>
											)}
										</div>
										<div className="text-sm text-vscode-foreground mb-1.5">
											<MarkdownBlock markdown={comment.body} />
										</div>
										{comment.suggestion && (
											<div
												className="text-xs p-2 rounded-r border-l-2"
												style={{
													backgroundColor: "var(--vscode-diffEditor-insertedTextBackground)",
													borderColor: "var(--vscode-gitDecoration-addedResourceForeground)",
												}}>
												<div
													className="flex items-center gap-1 font-medium mb-1"
													style={{
														color: "var(--vscode-gitDecoration-addedResourceForeground)",
													}}>
													<span className="codicon codicon-lightbulb" />
													Suggestion
												</div>
												<code className="text-vscode-foreground">{comment.suggestion}</code>
											</div>
										)}
									</div>
								)
							})}
						</div>
					) : (
						<div className="flex flex-col items-center justify-center py-6 px-4">
							<span
								className="codicon codicon-check text-xl mb-1.5"
								style={{ color: "var(--vscode-charts-green)" }}
							/>
							<span className="text-sm text-vscode-foreground font-medium">Looking good!</span>
							<span className="text-xs text-vscode-foreground opacity-60">
								No issues found in your changes
							</span>
						</div>
					)}
				</div>
			)}
		</div>
	)
}
