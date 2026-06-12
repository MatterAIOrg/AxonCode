import { memo, type ReactNode, useMemo } from "react"
import { type ToolProgressStatus } from "@roo-code/types"
import { getLanguageFromPath } from "@src/utils/getLanguageFromPath"
import { removeLeadingNonAlphanumeric } from "@src/utils/removeLeadingNonAlphanumeric"

import { MatterProgressIndicator } from "../chat/ProgressIndicator"
import { ToolUseBlock, ToolUseBlockHeader } from "./ToolUseBlock"
import CodeBlock from "../kilocode/common/CodeBlock" // kilocode_change

/**
 * Extract the first line number from a unified diff string.
 * Looks for @@ -oldStart,oldCount +newStart,newCount @@ patterns.
 * Returns the newStart line number (where changes appear in the new file).
 */
export function extractFirstLineNumberFromDiff(diff?: string): number | undefined {
	if (!diff) return undefined
	// Match unified diff hunk headers: @@ -start,count +start,count @@
	const match = diff.match(/@@\s*-\d+(?:,\d+)?\s+\+(\d+)(?:,\d+)?\s*@@/)
	if (match) {
		return parseInt(match[1], 10)
	}
	return undefined
}

interface CodeAccordianProps {
	path?: string
	code?: string
	language: string
	progressStatus?: ToolProgressStatus
	isLoading?: boolean
	isExpanded: boolean
	isFeedback?: boolean
	onToggleExpand: () => void
	header?: string
	headerContent?: ReactNode
	onJumpToFile?: (line?: number) => void
}

const CodeAccordian = ({
	path,
	code = "",
	language,
	progressStatus,
	isLoading,
	isExpanded,
	isFeedback,
	onToggleExpand,
	header,
	headerContent,
	onJumpToFile,
}: CodeAccordianProps) => {
	const inferredLanguage = useMemo(() => language ?? (path ? getLanguageFromPath(path) : "txt"), [path, language])
	const source = useMemo(() => String(code).trim() /*kilocode_change: coerce to string*/, [code])
	const hasHeader = Boolean(path || isFeedback || header || headerContent)
	// Extract line number from diff if this is a diff view
	const firstLineNumber = useMemo(() => extractFirstLineNumberFromDiff(code), [code])

	return (
		<ToolUseBlock>
			{hasHeader && (
				<ToolUseBlockHeader onClick={onToggleExpand} className="group">
					{isLoading && <MatterProgressIndicator className="mr-2" />}
					{headerContent ? (
						headerContent
					) : header ? (
						<div className="flex items-center">
							<span className="codicon codicon-server mr-1.5"></span>
							<span className="whitespace-nowrap overflow-hidden text-ellipsis mr-2">{header}</span>
						</div>
					) : isFeedback ? (
						<div className="flex items-center">
							<span className={`codicon codicon-${isFeedback ? "feedback" : "codicon-output"} mr-1.5`} />
							<span className="whitespace-nowrap overflow-hidden text-ellipsis mr-2 rtl">
								{isFeedback ? "User Edits" : "Console Logs"}
							</span>
						</div>
					) : (
						<>
							{path?.startsWith(".") && <span>.</span>}
							<span className="whitespace-nowrap overflow-hidden text-ellipsis text-left rtl">
								{removeLeadingNonAlphanumeric(path ?? "") + "\u200E"}
							</span>
						</>
					)}
					<div className="flex-grow-1" />
					{progressStatus && progressStatus.text && (
						<>
							{progressStatus.icon && <span className={`codicon codicon-${progressStatus.icon} mr-1`} />}
							<span className="mr-1 ml-auto text-vscode-descriptionForeground">
								{progressStatus.text}
							</span>
						</>
					)}
					{onJumpToFile && path && (
						<span
							className="codicon codicon-link-external mr-0"
							style={{ fontSize: 13.5 }}
							onClick={(e) => {
								e.stopPropagation()
								onJumpToFile(firstLineNumber)
							}}
							aria-label={`Open file: ${path}${firstLineNumber ? `:${firstLineNumber}` : ""}`}
						/>
					)}
					{!onJumpToFile && (
						<span
							className={`ml-1 opacity-50 group-hover:opacity-100 codicon codicon-chevron-${isExpanded ? "up" : "down"}`}></span>
					)}
				</ToolUseBlockHeader>
			)}
			{(!hasHeader || isExpanded) && (
				<div className="overflow-x-auto overflow-y-hidden max-w-full">
					<CodeBlock source={source} language={inferredLanguage} />
				</div>
			)}
		</ToolUseBlock>
	)
}

export default memo(CodeAccordian)
