import { VSCodeProgressRing } from "@vscode/webview-ui-toolkit/react"
import { getLanguageFromPath } from "@src/utils/getLanguageFromPath"
import { getHighlighter, isLanguageLoaded, normalizeLanguage } from "@src/utils/highlighter"
import { memo, type CSSProperties, useEffect, useMemo, useState } from "react"
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

type ParsedDiffRow =
	| { kind: "spacer"; key: string }
	| { kind: "hunk"; key: string; oldStart: number; newStart: number }
	| {
			kind: "line"
			key: string
			type: "context" | "addition" | "deletion"
			content: string
			oldLine?: number
			newLine?: number
	  }

const HUNK_HEADER_REGEX = /^@@\s*-(\d+)(?:,\d+)?\s+\+(\d+)(?:,\d+)?\s*@@/

const parseUnifiedDiff = (diff: string): ParsedDiffRow[] => {
	if (!diff) return []

	const rows: ParsedDiffRow[] = []
	const lines = diff.split(/\r?\n/)
	let oldLine = 0
	let newLine = 0
	let previousVisibleNewLine: number | undefined
	let hunkIndex = 0

	for (const rawLine of lines) {
		if (rawLine.startsWith("diff --git") || rawLine.startsWith("--- ") || rawLine.startsWith("+++ ")) {
			continue
		}

		const hunkMatch = rawLine.match(HUNK_HEADER_REGEX)
		if (hunkMatch) {
			const nextOldLine = parseInt(hunkMatch[1], 10)
			const nextNewLine = parseInt(hunkMatch[2], 10)

			if (
				previousVisibleNewLine !== undefined &&
				nextNewLine > previousVisibleNewLine + 1 &&
				rows[rows.length - 1]?.kind !== "spacer"
			) {
				rows.push({ kind: "spacer", key: `spacer-${hunkIndex}` })
			}

			oldLine = nextOldLine
			newLine = nextNewLine
			rows.push({ kind: "hunk", key: `hunk-${hunkIndex}`, oldStart: nextOldLine, newStart: nextNewLine })
			hunkIndex += 1
			continue
		}

		if (rawLine.startsWith("\\")) {
			continue
		}

		if (rawLine.startsWith("+")) {
			rows.push({
				kind: "line",
				key: `add-${newLine}-${rows.length}`,
				type: "addition",
				content: rawLine.slice(1),
				newLine,
			})
			previousVisibleNewLine = newLine
			newLine += 1
			continue
		}

		if (rawLine.startsWith("-")) {
			rows.push({
				kind: "line",
				key: `del-${oldLine}-${rows.length}`,
				type: "deletion",
				content: rawLine.slice(1),
				oldLine,
			})
			oldLine += 1
			continue
		}

		rows.push({
			kind: "line",
			key: `ctx-${newLine}-${rows.length}`,
			type: "context",
			content: rawLine.startsWith(" ") ? rawLine.slice(1) : rawLine,
			oldLine,
			newLine,
		})
		previousVisibleNewLine = newLine
		oldLine += 1
		newLine += 1
	}

	return rows
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
		const language = useMemo(() => getLanguageFromPath(filePath || "") || "text", [filePath])
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
								<span style={{ color: "var(--vscode-gitDecoration-addedResourceForeground)" }}>
									+{diffStats.added}
								</span>
								<span style={{ color: "var(--vscode-gitDecoration-deletedResourceForeground)" }}>
									-{diffStats.removed}
								</span>
							</span>
						) : null}
					</div>
					<div className="flex-grow-1" />
					<span
						className={`ml-1 opacity-50 group-hover:opacity-100 codicon codicon-chevron-${isExpanded ? "up" : "down"}`}
					/>
				</ToolUseBlockHeader>

				{isExpanded && (
					<div className="w-full mt-1 -ml-7">
						<div
							className="rounded-xl overflow-auto scrollbar-hide min-w-0"
							style={{
								maxHeight: "28rem",
								border: "1px solid var(--vscode-editorWidget-border)",
								background: "var(--vscode-editorWidget-background)",
								boxShadow:
									"inset 0 1px 0 color-mix(in srgb, var(--vscode-editorWidget-border) 20%, transparent)",
							}}>
							{/* Diff content */}
							<div
								style={{
									background:
										"linear-gradient(180deg, color-mix(in srgb, var(--vscode-sideBar-background) 58%, var(--vscode-editor-background)) 0%, var(--vscode-editorWidget-background) 100%)",
								}}>
								<UnifiedDiffView diff={diff} language={language} />
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
const DiffSyntaxLine = memo(({ content, language }: { content: string; language: string }) => {
	const normalizedLanguage = useMemo(() => normalizeLanguage(language), [language])
	const normalizedContent = useMemo(() => (content || " ").replace(/\t/g, "  "), [content])
	const [tokens, setTokens] = useState<Array<{ content: string; color?: string }>>([{ content: normalizedContent }])

	useEffect(() => {
		let isMounted = true
		const fallback = [{ content: normalizedContent }]

		const highlight = async () => {
			if (!normalizedContent.trim()) {
				if (isMounted) setTokens([{ content: " " }])
				return
			}

			if (!isLanguageLoaded(normalizedLanguage) && isMounted) {
				setTokens(fallback)
			}

			const highlighter = await getHighlighter(normalizedLanguage)
			if (!isMounted) return

			const tokenResult = (await highlighter.codeToTokens(normalizedContent, {
				lang: normalizedLanguage,
				theme: document.body.className.toLowerCase().includes("light") ? "github-light" : "github-dark",
			})) as { tokens?: Array<Array<{ content: string; color?: string }>> }
			if (!isMounted) return

			const firstLine = tokenResult.tokens?.[0]
			if (!firstLine?.length) {
				if (isMounted) setTokens([{ content: normalizedContent }])
				return
			}

			if (isMounted) {
				setTokens(
					firstLine.map((token: { content: string; color?: string }) => ({
						content: token.content,
						color: token.color,
					})),
				)
			}
		}

		highlight().catch(() => {
			if (isMounted) setTokens(fallback)
		})

		return () => {
			isMounted = false
		}
	}, [normalizedContent, normalizedLanguage])

	return (
		<span
			style={{
				color: "var(--vscode-editor-foreground)",
			}}>
			{tokens.map((token, index) => (
				<span key={`${index}-${token.content}`} style={{ color: token.color || "inherit" }}>
					{token.content}
				</span>
			))}
		</span>
	)
})

DiffSyntaxLine.displayName = "DiffSyntaxLine"

const UnifiedDiffView = memo(({ diff, language }: { diff: string; language: string }) => {
	const rows = parseUnifiedDiff(diff)
	const lineNumberStyle: CSSProperties = {
		width: "3.75rem",
		flexShrink: 0,
		paddingRight: "0.625rem",
		textAlign: "right",
		userSelect: "none",
		fontVariantNumeric: "tabular-nums",
		color: "var(--vscode-editorLineNumber-foreground)",
	}

	return (
		<div className="font-mono text-xs min-w-max">
			{rows.map((row) => {
				if (row.kind === "spacer") {
					return (
						<div
							key={row.key}
							className="flex items-center w-full"
							style={{
								minHeight: "1.65rem",
								color: "var(--vscode-descriptionForeground)",
								background: "color-mix(in srgb, var(--vscode-editor-background) 78%, transparent)",
								borderTop:
									"1px solid color-mix(in srgb, var(--vscode-editorWidget-border) 50%, transparent)",
								borderBottom:
									"1px solid color-mix(in srgb, var(--vscode-editorWidget-border) 50%, transparent)",
							}}>
							<span style={lineNumberStyle} />
							<span
								className="pl-2"
								style={{
									letterSpacing: "0.08em",
									opacity: 0.7,
								}}>
								...
							</span>
						</div>
					)
				}

				if (row.kind === "hunk") {
					return null
				}

				const isAddition = row.type === "addition"
				const isDeletion = row.type === "deletion"
				const displayLineNumber = row.newLine ?? row.oldLine

				let background = "transparent"
				const textColor = "var(--vscode-editor-foreground)"
				let accent = "transparent"
				let lineNumberBackground: string | undefined

				if (isAddition) {
					background =
						"color-mix(in srgb, var(--vscode-diffEditor-insertedLineBackground) 22%, var(--vscode-editor-background))"
					accent = "var(--vscode-gitDecoration-addedResourceForeground)"
					lineNumberBackground =
						"color-mix(in srgb, var(--vscode-diffEditor-insertedLineBackground) 36%, var(--vscode-editor-background))"
				} else if (isDeletion) {
					background =
						"color-mix(in srgb, var(--vscode-diffEditor-removedLineBackground) 22%, var(--vscode-editor-background))"
					accent = "var(--vscode-gitDecoration-deletedResourceForeground)"
					lineNumberBackground =
						"color-mix(in srgb, var(--vscode-diffEditor-removedLineBackground) 36%, var(--vscode-editor-background))"
				}

				return (
					<div
						key={row.key}
						className="flex w-full"
						style={{
							minHeight: "1.65rem",
							background,
							color: textColor,
							boxShadow: accent === "transparent" ? undefined : `inset 1px 0 0 ${accent}`,
						}}>
						<span
							style={{
								...lineNumberStyle,
								color: isAddition
									? "color-mix(in srgb, var(--vscode-gitDecoration-addedResourceForeground) 82%, var(--vscode-editor-foreground))"
									: isDeletion
										? "color-mix(in srgb, var(--vscode-gitDecoration-deletedResourceForeground) 82%, var(--vscode-editor-foreground))"
										: "var(--vscode-editorLineNumber-activeForeground)",
								background: lineNumberBackground,
							}}>
							{displayLineNumber ?? ""}
						</span>
						<span className="flex-grow pl-2 pr-4 whitespace-pre">
							<DiffSyntaxLine content={row.content || " "} language={language} />
						</span>
					</div>
				)
			})}
		</div>
	)
})

UnifiedDiffView.displayName = "UnifiedDiffView"

export default GitHubDiffView
