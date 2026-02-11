import { VSCodeProgressRing } from "@vscode/webview-ui-toolkit/react"
import { memo } from "react"
import { extractFirstLineNumberFromDiff } from "../common/CodeAccordian"
import { ToolUseBlock, ToolUseBlockHeader } from "../common/ToolUseBlock"

interface DiffStats {
	added: number
	removed: number
}

interface GitHubDiffViewProps {
	diff: string
	filePath?: string
	isProtected?: boolean
	isOutsideWorkspace?: boolean
	diffStats?: DiffStats | null
	isLoading?: boolean
	isExpanded: boolean
	onToggleExpand: () => void
	onOpenFile?: () => void
}

const GitHubDiffView = memo(
	({
		diff,
		filePath,
		isProtected,
		diffStats,
		isLoading,
		isExpanded,
		onToggleExpand,
		onOpenFile,
	}: GitHubDiffViewProps) => {
		const firstLineNumber = extractFirstLineNumberFromDiff(diff)

		const fileName = filePath?.split("/").pop() || filePath || "file"

		return (
			<ToolUseBlock className="w-full">
				<ToolUseBlockHeader onClick={onToggleExpand} className="group">
					{isLoading && <VSCodeProgressRing className="size-3 mr-2" />}
					<div className="flex items-center gap-2 w-fit">
						{isProtected ? (
							<span
								className="codicon codicon-lock"
								style={{
									color: "var(--vscode-editorWarning-foreground)",
									marginBottom: "-1.5px",
								}}
							/>
						) : null}
						{filePath ? (
							<span
								className="cursor-pointer hover:underline"
								role="button"
								tabIndex={0}
								title={filePath + (firstLineNumber ? `:${firstLineNumber}` : "")}
								aria-label={filePath}
								onClick={(e) => {
									e.stopPropagation()
									onOpenFile?.()
								}}
								onKeyDown={(e) => {
									if (e.key === "Enter" || e.key === " ") {
										e.preventDefault()
										e.stopPropagation()
										onOpenFile?.()
									}
								}}>
								{fileName}
							</span>
						) : null}
						{diffStats ? (
							<span className="text-xs text-vscode-descriptionForeground flex gap-1 ml-0">
								<span style={{ color: "var(--vscode-charts-green)" }}>+{diffStats.added}</span>
								<span style={{ color: "var(--vscode-charts-red)" }}>-{diffStats.removed}</span>
							</span>
						) : null}
					</div>
					<div className="flex-grow-1" />
					<span
						className={`ml-1 opacity-50 group-hover:opacity-100 codicon codicon-chevron-${isExpanded ? "up" : "down"}`}
					/>
				</ToolUseBlockHeader>

				{isExpanded && (
					<div className="overflow-x-auto overflow-y-hidden w-full mt-1 -ml-7">
						<div className="border border-vscode-editorWidget-border rounded-md overflow-hidden min-w-full">
							{/* Diff content */}
							<div className="bg-vscode-editor-background">
								<UnifiedDiffView diff={diff} />
							</div>
						</div>
					</div>
				)}
			</ToolUseBlock>
		)
	},
)

GitHubDiffView.displayName = "GitHubDiffView"

// Unified diff view component
const UnifiedDiffView = memo(({ diff }: { diff: string }) => {
	const lines = diff.split("\n")

	return (
		<div className="font-mono text-xs w-full">
			{lines.map((line, index) => {
				const isHeader = line.startsWith("---") || line.startsWith("+++") || line.startsWith("diff --git")
				const isHunk = line.startsWith("@@")
				const isAddition = line.startsWith("+")
				const isDeletion = line.startsWith("-")

				let lineClass = ""
				let bgClass = ""

				if (isHeader) {
					lineClass = "text-vscode-descriptionForeground"
				} else if (isHunk) {
					lineClass = "text-vscode-editorInfo-foreground bg-vscode-editorInfo-background"
				} else if (isAddition) {
					bgClass = "bg-[var(--vscode-diffEditor-insertedTextBackground)]"
				} else if (isDeletion) {
					bgClass = "bg-[var(--vscode-diffEditor-removedTextBackground)]"
				}

				return (
					<div
						key={index}
						className={`flex w-full ${lineClass} ${bgClass} hover:bg-[var(--vscode-editor-hoverHighlight)]`}>
						{/* Line number column */}
						<span className="w-12 flex-shrink-0 text-right pr-2 text-vscode-descriptionForeground select-none border-r border-vscode-editorWidget-border">
							{isHeader || isHunk ? "" : index + 1}
						</span>
						{/* Content */}
						<span className="flex-grow pl-2 whitespace-pre">{line}</span>
					</div>
				)
			})}
		</div>
	)
})

UnifiedDiffView.displayName = "UnifiedDiffView"

export default GitHubDiffView
