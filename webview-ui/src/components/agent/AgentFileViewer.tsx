import React, { memo, useMemo } from "react"
import { useAgentFileViewer } from "./AgentFileViewerContext"
import { vscode } from "../../utils/vscode"
import { Folder01Icon } from "@/utils/customIcons"
import AgentPullRequestDiffView from "./AgentPullRequestDiffView"
import GitHubDiffView from "../chat/GitHubDiffView"

interface DiffStats {
	added: number
	removed: number
}

const computeDiffStats = (diff: string): DiffStats | null => {
	if (!diff) return null
	let added = 0
	let removed = 0
	const lines = diff.split("\n")
	for (const line of lines) {
		if (line.startsWith("+") && !line.startsWith("+++")) {
			added++
		} else if (line.startsWith("-") && !line.startsWith("---")) {
			removed++
		}
	}
	return { added, removed }
}

const extractFirstLineNumberFromDiff = (diff: string): number | undefined => {
	const match = diff.match(/@@ -\d+(?:,\d+)? \+(\d+)/)
	return match ? parseInt(match[1], 10) : undefined
}

const badgeClassName = "inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-medium leading-4"

const ContentLine = memo(({ line, lineNumber }: { line: string; lineNumber: number }) => (
	<div
		className="flex min-w-max font-mono text-xs leading-6"
		style={{
			borderTop:
				lineNumber === 1
					? "none"
					: "1px solid color-mix(in srgb, var(--vscode-editorWidget-border) 22%, transparent)",
		}}>
		<span
			className="w-14 shrink-0 select-none pr-3 pt-0.5 text-right"
			style={{
				color: "var(--vscode-editorLineNumber-foreground)",
				background: "color-mix(in srgb, var(--vscode-sideBar-background) 52%, var(--vscode-editor-background))",
				fontVariantNumeric: "tabular-nums",
			}}>
			{lineNumber}
		</span>
		<span className="flex-1 whitespace-pre px-3 pt-0.5" style={{ color: "var(--vscode-editor-foreground)" }}>
			{line || " "}
		</span>
	</div>
))

ContentLine.displayName = "ContentLine"

const AgentFileViewer: React.FC = () => {
	const { fileViewerState, closeFileViewer, pendingDiffFiles } = useAgentFileViewer()

	// Compute parentPath at the top level to avoid conditional hook calls
	const parentPath = useMemo(() => {
		if (!fileViewerState?.filePath) return ""
		const parts = fileViewerState.filePath.split("/")
		return parts.slice(0, -1).join("/")
	}, [fileViewerState?.filePath])

	if (!fileViewerState) {
		if (pendingDiffFiles.length > 0) {
			return <AgentPullRequestDiffView files={pendingDiffFiles} />
		}

		return (
			<div className="h-full flex items-center justify-center text-[var(--vscode-descriptionForeground)] opacity-60">
				<div className="text-center">
					<Folder01Icon className="w-12 h-12 mx-auto mb-3 opacity-40" />
					<p className="text-sm">Select a file to view</p>
				</div>
			</div>
		)
	}

	const { filePath, diff, content, line, isOutsideWorkspace, isProtected } = fileViewerState
	const fileName = filePath?.split("/").pop() || filePath || "file"
	const diffStats = diff ? computeDiffStats(diff) : null
	const firstLine = line ?? (diff ? extractFirstLineNumberFromDiff(diff) : undefined)

	const displayContent = content || ""
	const displayLines = displayContent.split("\n")

	const handleOpenInEditor = () => {
		const pathToOpen = isOutsideWorkspace ? filePath : "./" + filePath
		vscode.postMessage({
			type: "openFile",
			text: pathToOpen,
			values: firstLine ? { line: firstLine } : undefined,
		})
	}

	return (
		<div className="h-full flex flex-col bg-[var(--vscode-editor-background)]">
			<div
				className="border-b px-4 py-3"
				style={{
					borderColor: "color-mix(in srgb, var(--vscode-panel-border) 75%, transparent)",
					background:
						"linear-gradient(180deg, color-mix(in srgb, var(--vscode-sideBar-background) 88%, transparent) 0%, color-mix(in srgb, var(--vscode-editor-background) 100%, transparent) 100%)",
				}}>
				<div className="flex items-start justify-between gap-3">
					<div className="min-w-0 flex-1">
						<div className="flex items-center gap-2 min-w-0">
							<span
								className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border"
								style={{
									borderColor:
										"color-mix(in srgb, var(--vscode-editorWidget-border) 70%, transparent)",
									background:
										"color-mix(in srgb, var(--vscode-sideBar-background) 65%, var(--vscode-editor-background))",
								}}>
								<span className="codicon codicon-file-code text-sm opacity-80" />
							</span>
							<div className="min-w-0">
								<button
									onClick={handleOpenInEditor}
									className="block max-w-full truncate bg-transparent p-0 text-left text-sm font-semibold hover:underline"
									title={filePath}>
									{fileName}
								</button>
								{parentPath && (
									<div
										className="truncate text-xs"
										style={{ color: "var(--vscode-descriptionForeground)" }}
										title={filePath}>
										{parentPath}
									</div>
								)}
							</div>
						</div>

						<div className="mt-2 flex flex-wrap items-center gap-2">
							{diffStats && (
								<span
									className={badgeClassName}
									style={{
										borderColor:
											"color-mix(in srgb, var(--vscode-editorWidget-border) 75%, transparent)",
										background:
											"color-mix(in srgb, var(--vscode-sideBar-background) 58%, var(--vscode-editor-background))",
									}}>
									<span style={{ color: "#3fa266" }}>+{diffStats.added}</span>
									<span className="mx-1 opacity-30">/</span>
									<span style={{ color: "#fc6b83" }}>-{diffStats.removed}</span>
								</span>
							)}
							{isProtected && (
								<span
									className={badgeClassName}
									style={{
										borderColor:
											"color-mix(in srgb, var(--vscode-editorWarning-foreground) 45%, transparent)",
										color: "var(--vscode-editorWarning-foreground)",
										background:
											"color-mix(in srgb, var(--vscode-editorWarning-foreground) 10%, transparent)",
									}}>
									<span className="codicon codicon-lock mr-1 text-[10px]" />
									Protected
								</span>
							)}
							{isOutsideWorkspace && (
								<span
									className={badgeClassName}
									style={{
										borderColor:
											"color-mix(in srgb, var(--vscode-editorInfo-foreground) 35%, transparent)",
										color: "var(--vscode-editorInfo-foreground)",
										background:
											"color-mix(in srgb, var(--vscode-editorInfo-foreground) 10%, transparent)",
									}}>
									Outside workspace
								</span>
							)}
						</div>
					</div>

					<div className="flex items-center gap-1 shrink-0">
						<button
							onClick={handleOpenInEditor}
							className="rounded-md p-1.5 transition-colors hover:bg-[var(--vscode-toolbar-hoverBackground)]"
							title="Open in Editor">
							<span className="codicon codicon-go-to-file text-sm" />
						</button>
						<button
							onClick={closeFileViewer}
							className="rounded-md p-1.5 transition-colors hover:bg-[var(--vscode-toolbar-hoverBackground)]"
							title="Close">
							<span className="codicon codicon-close text-sm" />
						</button>
					</div>
				</div>
			</div>

			<div className="flex-1 overflow-auto p-3">
				{diff ? (
					<div className="h-full">
						<GitHubDiffView diff={diff} filePath={filePath} isExpanded={true} maxHeight="none" />
					</div>
				) : displayLines.length > 0 ? (
					<div
						className="overflow-auto rounded-xl border"
						style={{
							borderColor: "var(--vscode-editorWidget-border)",
							background: "var(--vscode-editorWidget-background)",
							boxShadow:
								"inset 0 1px 0 color-mix(in srgb, var(--vscode-editorWidget-border) 20%, transparent)",
						}}>
						<div
							style={{
								background:
									"linear-gradient(180deg, color-mix(in srgb, var(--vscode-sideBar-background) 58%, var(--vscode-editor-background)) 0%, var(--vscode-editorWidget-background) 100%)",
							}}>
							{displayLines.map((line, idx) => (
								<ContentLine key={idx} line={line} lineNumber={idx + 1} />
							))}
						</div>
					</div>
				) : (
					<div className="h-full flex items-center justify-center text-[var(--vscode-descriptionForeground)] opacity-60">
						<p className="text-sm">No content to display</p>
					</div>
				)}
			</div>
		</div>
	)
}

export default AgentFileViewer
