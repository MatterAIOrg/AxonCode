import { getLanguageFromPath } from "@src/utils/getLanguageFromPath"
import { getHighlighter, isLanguageLoaded, normalizeLanguage } from "@src/utils/highlighter"
import { memo, type CSSProperties, useEffect, useMemo, useRef, useState } from "react"

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
	onToggleExpand?: () => void
	onOpenFile?: () => void
	maxHeight?: string
}

type ParsedDiffRow =
	| { kind: "spacer"; key: string; hiddenLineCount: number }
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
		if (
			rawLine.startsWith("diff --git") ||
			rawLine.startsWith("--- ") ||
			rawLine.startsWith("+++ ") ||
			rawLine.startsWith("Index: ") ||
			/^=+$/.test(rawLine)
		) {
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
				rows.push({
					kind: "spacer",
					key: `spacer-${hunkIndex}`,
					hiddenLineCount: nextNewLine - previousVisibleNewLine - 1,
				})
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

const GitHubDiffView = memo(({ diff, filePath, isExpanded, maxHeight = "20rem" }: GitHubDiffViewProps) => {
	const language = useMemo(() => getLanguageFromPath(filePath || "") || "text", [filePath])
	const headerRef = useRef<HTMLDivElement>(null)
	const containerRef = useRef<HTMLDivElement>(null)
	const [diffMarginLeft, setDiffMarginLeft] = useState(0)

	// Calculate the negative margin needed to align diff content with the left edge
	useEffect(() => {
		if (isExpanded && headerRef.current && containerRef.current) {
			const headerRect = headerRef.current.getBoundingClientRect()
			const containerRect = containerRef.current.getBoundingClientRect()
			// Calculate how much the header is offset from the container's left edge
			const offset = headerRect.left - containerRect.left
			// Use negative margin to pull the diff content back to the left edge, minus 4px for spacing
			setDiffMarginLeft(-(offset - 4))
		}
	}, [isExpanded])

	return (
		<div>
			{isExpanded && (
				<div className="w-full mt-2" style={{ marginLeft: `${diffMarginLeft}px` }}>
					<div
						className="rounded-md overflow-auto scrollbar-hide min-w-0"
						style={{
							maxHeight,
							border: "1px solid var(--vscode-activityBar-border)",
							background: "var(--vscode-editorWidget-background)",
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
		</div>
	)
})

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
		width: "2.15rem",
		flexShrink: 0,
		paddingRight: "0.625rem",
		paddingTop: "0.375rem",
		paddingLeft: "0.375rem",
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
								className="pl-2 text-xs"
								style={{
									opacity: 0.76,
								}}>
								{row.hiddenLineCount} unmodified {row.hiddenLineCount === 1 ? "line" : "lines"}
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
					background = "color-mix(in srgb, #3fa266 12%, var(--vscode-editor-background))"
					accent = "#3fa266"
					lineNumberBackground = "color-mix(in srgb, #3fa266 26%, var(--vscode-editor-background))"
				} else if (isDeletion) {
					background = "color-mix(in srgb, #fc6b83 12%, var(--vscode-editor-background))"
					accent = "#fc6b83"
					lineNumberBackground = "color-mix(in srgb, #fc6b83 26%, var(--vscode-editor-background))"
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
									? "color-mix(in srgb, #3fa266 82%, var(--vscode-editor-foreground))"
									: isDeletion
										? "color-mix(in srgb, #fc6b83 82%, var(--vscode-editor-foreground))"
										: "var(--vscode-editorLineNumber-activeForeground)",
								background: lineNumberBackground,
							}}>
							{displayLineNumber ?? ""}
						</span>
						<span className="flex-grow pl-0 pt-1.5 pr-4 whitespace-pre">
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
