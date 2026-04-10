import React, { useEffect, useMemo, useState } from "react"
import { getIconForFilePath, getIconUrlByName } from "vscode-material-icons"

import { Folder01Icon } from "@/utils/customIcons"
import { vscode } from "../../utils/vscode"
import GitHubDiffView from "../chat/GitHubDiffView"
import { PendingDiffFile } from "./AgentFileViewerContext"

interface AgentPullRequestDiffViewProps {
	files: PendingDiffFile[]
}

const getFileName = (filePath: string) => filePath.split("/").pop() || filePath

const getDirectory = (filePath: string) => {
	const parts = filePath.split("/")
	return parts.length > 1 ? parts.slice(0, -1).join("/") : ""
}

const AgentPullRequestDiffView: React.FC<AgentPullRequestDiffViewProps> = ({ files }) => {
	const [materialIconsBaseUri, setMaterialIconsBaseUri] = useState("")

	useEffect(() => {
		const w = window as any
		const baseUri = w.MATERIAL_ICONS_BASE_URI || w.vscode?.getState?.()?.MATERIAL_ICONS_BASE_URI || ""
		setMaterialIconsBaseUri(baseUri)
	}, [])

	const totals = useMemo(
		() =>
			files.reduce(
				(acc, file) => ({
					additions: acc.additions + (file.stat?.additions || 0),
					deletions: acc.deletions + (file.stat?.deletions || 0),
				}),
				{ additions: 0, deletions: 0 },
			),
		[files],
	)

	const getFileIconUrl = (path: string): string => {
		const filename = getFileName(path)
		if (!filename.includes(".")) return ""
		const iconName = getIconForFilePath(filename)
		return getIconUrlByName(iconName, materialIconsBaseUri)
	}

	if (files.length === 0) {
		return (
			<div className="h-full flex items-center justify-center text-[var(--vscode-descriptionForeground)] opacity-60">
				<div className="text-center">
					<Folder01Icon className="w-12 h-12 mx-auto mb-3 opacity-40" />
					<p className="text-sm font-medium">No pending file edits</p>
					<p className="text-xs mt-1">Agent changes will appear here as a stacked diff review.</p>
				</div>
			</div>
		)
	}

	return (
		<div className="h-full flex flex-col bg-[var(--vscode-editor-background)]">
			<div
				className="px-4 py-3 border-b"
				style={{
					borderColor: "color-mix(in srgb, var(--vscode-panel-border) 78%, transparent)",
					background:
						"linear-gradient(180deg, color-mix(in srgb, var(--vscode-sideBar-background) 92%, transparent) 0%, color-mix(in srgb, var(--vscode-editor-background) 100%, transparent) 100%)",
				}}>
				<div className="flex items-center gap-2 text-sm font-semibold">
					<span className="codicon codicon-source-control text-sm opacity-80" />
					<span>{files.length} Uncommitted Changes</span>
					<div className="ml-auto flex items-center gap-2 text-xs font-semibold">
						<span style={{ color: "#3fa266" }}>+{totals.additions}</span>
						<span style={{ color: "#fc6b83" }}>-{totals.deletions}</span>
					</div>
				</div>
			</div>

			<div
				className="flex-1 overflow-auto p-3"
				style={{
					background:
						"linear-gradient(180deg, color-mix(in srgb, var(--vscode-sideBar-background) 18%, var(--vscode-editor-background)) 0%, var(--vscode-editor-background) 100%)",
				}}>
				<div className="flex flex-col gap-3">
					{files.map((file) => {
						const _fileName = getFileName(file.relPath)
						const directory = getDirectory(file.relPath)
						const fileIconUrl = getFileIconUrl(file.relPath)
						const statusLabel = file.status === "A" ? "New" : file.status === "D" ? "Deleted" : undefined

						return (
							<div
								key={file.relPath}
								className="overflow-hidden rounded-xl border"
								style={{
									borderColor:
										"color-mix(in srgb, var(--vscode-editorWidget-border) 85%, transparent)",
									background:
										"color-mix(in srgb, var(--vscode-sideBar-background) 16%, var(--vscode-editor-background))",
									boxShadow:
										"0 0 0 1px color-mix(in srgb, var(--vscode-editor-background) 60%, transparent)",
								}}>
								<div
									className="flex items-center justify-between gap-3 px-3 py-2 border-b"
									style={{
										borderColor:
											"color-mix(in srgb, var(--vscode-editorWidget-border) 60%, transparent)",
										background:
											"color-mix(in srgb, var(--vscode-sideBar-background) 38%, var(--vscode-editor-background))",
									}}>
									<div className="flex items-center gap-2 min-w-0">
										{fileIconUrl ? (
											<img src={fileIconUrl} className="w-4 h-4 shrink-0" alt="" />
										) : (
											<span className="codicon codicon-file-code text-sm shrink-0 opacity-80" />
										)}
										<div className="min-w-0 flex items-center gap-2">
											<button
												onClick={() =>
													vscode.postMessage({
														type: "openFile",
														text: file.absolutePath,
														values: file.firstLineNumber
															? { line: file.firstLineNumber }
															: undefined,
													})
												}
												className="truncate bg-transparent p-0 text-left text-sm font-medium hover:underline"
												title={file.absolutePath}>
												{file.relPath}
											</button>
											{statusLabel && (
												<span
													className="rounded-md px-1.5 py-0.5 text-[11px] font-medium"
													style={{
														color: "#3fa266",
														background:
															"color-mix(in srgb, var(--vscode-diffEditor-insertedLineBackground) 38%, transparent)",
													}}>
													{statusLabel}
												</span>
											)}
										</div>
									</div>

									<div className="flex items-center gap-3 shrink-0">
										<div className="flex items-center gap-1 text-xs font-semibold">
											<span
												style={{
													color: "#3fa266",
												}}>
												+{file.stat.additions}
											</span>
											<span
												style={{
													color: "#fc6b83",
												}}>
												-{file.stat.deletions}
											</span>
										</div>
										<button
											onClick={() =>
												vscode.postMessage({
													type: "openFile",
													text: file.absolutePath,
													values: file.firstLineNumber
														? { line: file.firstLineNumber }
														: undefined,
												})
											}
											className="rounded-md p-1.5 transition-colors hover:bg-[var(--vscode-toolbar-hoverBackground)]"
											title="Open in editor">
											<span className="codicon codicon-go-to-file text-sm" />
										</button>
									</div>
								</div>

								{directory && (
									<div
										className="px-3 py-1 text-xs border-b"
										style={{
											color: "var(--vscode-descriptionForeground)",
											borderColor:
												"color-mix(in srgb, var(--vscode-editorWidget-border) 42%, transparent)",
											background:
												"color-mix(in srgb, var(--vscode-editor-background) 86%, var(--vscode-sideBar-background))",
										}}>
										{directory}
									</div>
								)}

								<div className="px-2 pb-2">
									<GitHubDiffView
										diff={file.diff}
										filePath={file.relPath}
										isExpanded={true}
										maxHeight="none"
									/>
								</div>
							</div>
						)
					})}
				</div>
			</div>
		</div>
	)
}

export default AgentPullRequestDiffView
