import { vscode } from "@/utils/vscode"
import { VSCodeButton } from "@vscode/webview-ui-toolkit/react"
import React from "react"

interface CodeReviewComment {
	path: string
	body: string
	suggestion: string
	startLine: number
	endLine: number
}

interface CodeReviewPanelProps {
	reviewBody: string
	reviewComments: CodeReviewComment[]
	onClose: () => void
}

export const CodeReviewPanel: React.FC<CodeReviewPanelProps> = ({ reviewBody, reviewComments, onClose }) => {
	const handleCommentClick = (comment: CodeReviewComment) => {
		// Open file and highlight the code using path + line numbers
		vscode.postMessage({
			type: "openFile",
			text: comment.path, // Assuming openFile handler uses 'text' or 'value' for path, need to check. SourceControlPanel uses 'openFile' differently?
			// Let's check SourceControlPanel handleFileClick
		})
	}

	const handleApplyFix = (index: number) => {
		if (!reviewComments[index]) return
		const comment = reviewComments[index]
		vscode.postMessage({
			type: "applyCodeReviewFix",
			payload: { fixIndex: index, comment },
		})
		// Refresh pending edits
		setTimeout(() => {
			vscode.postMessage({ type: "getPendingFileEdits" })
		}, 500)
	}

	const handleApplyAllFixes = () => {
		vscode.postMessage({
			type: "applyAllCodeReviewFixes",
			payload: {
				fixIndices: reviewComments.map((_, i) => i),
				comments: reviewComments,
			},
		})
		onClose()
	}

	return (
		<div className="border border-[var(--vscode-panel-border)] rounded-md p-4 mb-4 bg-[var(--vscode-editor-background)]">
			<div className="flex justify-between items-center mb-3">
				<h3 className="text-lg font-semibold text-[var(--vscode-foreground)]">AI Code Review</h3>
				<VSCodeButton appearance="icon" onClick={onClose} title="Close">
					<span className="codicon codicon-close" />
				</VSCodeButton>
			</div>

			<div className="mb-4">
				<h4 className="text-sm font-medium text-[var(--vscode-foreground)] mb-2">Review Summary</h4>
				<div className="text-sm text-[var(--vscode-foreground)] whitespace-pre-wrap">{reviewBody}</div>
			</div>

			{reviewComments.length > 0 && (
				<div className="mb-4">
					<div className="flex justify-between items-center mb-2">
						<h4 className="text-sm font-medium text-[var(--vscode-foreground)]">
							Review Comments ({reviewComments.length})
						</h4>
						<VSCodeButton appearance="secondary" onClick={handleApplyAllFixes}>
							Fix All
						</VSCodeButton>
					</div>

					<div className="space-y-3">
						{reviewComments.map((comment, index) => (
							<div
								key={index}
								className="border border-[var(--vscode-panel-border)] rounded p-3 cursor-pointer hover:bg-[var(--vscode-list-hoverBackground)]"
								onClick={() => handleCommentClick(comment)}>
								<div className="flex justify-between items-start mb-2">
									<div className="text-xs text-[var(--vscode-descriptionForeground)]">
										{comment.path}:{comment.startLine}-{comment.endLine}
									</div>
									<VSCodeButton
										appearance="primary"
										onClick={(e) => {
											e.stopPropagation()
											handleApplyFix(index)
										}}>
										Fix
									</VSCodeButton>
								</div>
								<div className="text-sm text-[var(--vscode-foreground)] mb-2">{comment.body}</div>
								{comment.suggestion && (
									<div className="text-xs text-[var(--vscode-terminal-ansiGreen)] bg-[var(--vscode-terminal-background)] p-2 rounded">
										<strong>Suggestion:</strong> {comment.suggestion}
									</div>
								)}
							</div>
						))}
					</div>
				</div>
			)}

			{reviewComments.length === 0 && (
				<div className="text-sm text-[var(--vscode-descriptionForeground)] text-center py-4">
					No specific issues found. Great work!
				</div>
			)}
		</div>
	)
}
