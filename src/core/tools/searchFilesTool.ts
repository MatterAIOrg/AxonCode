import path from "path"

import { Task } from "../task/Task"
import { ToolUse, AskApproval, HandleError, PushToolResult, RemoveClosingTag } from "../../shared/tools"
import { ClineSayTool } from "../../shared/ExtensionMessage"
import { getReadablePath } from "../../utils/path"
import { isPathOutsideWorkspace } from "../../utils/pathUtils"
import { searchFiles, normalizeNullableSearchString, parseSearchCursor } from "../../services/search-files"

export async function searchFilesTool(
	cline: Task,
	block: ToolUse,
	askApproval: AskApproval,
	handleError: HandleError,
	pushToolResult: PushToolResult,
	removeClosingTag: RemoveClosingTag,
) {
	const relDirPath: string | undefined = block.params.path
	const regex: string | undefined = block.params.regex
	const filePattern = normalizeNullableSearchString(block.params.file_pattern)

	const absolutePath = relDirPath ? path.resolve(cline.cwd, relDirPath) : cline.cwd
	const isOutsideWorkspace = isPathOutsideWorkspace(absolutePath)

	const sharedMessageProps: ClineSayTool = {
		tool: "searchFiles",
		path: getReadablePath(cline.cwd, removeClosingTag("path", relDirPath)),
		regex: removeClosingTag("regex", regex),
		filePattern: removeClosingTag("file_pattern", filePattern),
		isOutsideWorkspace,
	}

	try {
		if (block.partial) {
			const partialMessage = JSON.stringify({ ...sharedMessageProps, content: "" } satisfies ClineSayTool)
			await cline.ask("tool", partialMessage, block.partial).catch(() => {})
			return
		} else {
			const cursor = parseSearchCursor(block.params.cursor as unknown)
			const rawMaxResults = block.params.max_results as unknown
			const rawContextLines = block.params.context_lines as unknown
			const maxResults = rawMaxResults == null ? undefined : Number(rawMaxResults)
			const contextLines = rawContextLines == null ? undefined : Number(rawContextLines)

			if (!relDirPath) {
				cline.consecutiveMistakeCount++
				cline.recordToolError("search_files")
				pushToolResult(await cline.sayAndCreateMissingParamError("search_files", "path"))
				return
			}

			if (!regex) {
				cline.consecutiveMistakeCount++
				cline.recordToolError("search_files")
				pushToolResult(await cline.sayAndCreateMissingParamError("search_files", "regex"))
				return
			}

			cline.consecutiveMistakeCount = 0

			const { text: results, matchCount } = await searchFiles(
				cline.cwd,
				absolutePath,
				regex,
				filePattern,
				cline.rooIgnoreController,
				{
					cursor,
					maxResults: Number.isFinite(maxResults) ? maxResults : undefined,
					contextLines: Number.isFinite(contextLines) ? contextLines : undefined,
				},
			)

			// forked_change: append guidance when a search returns no matches,
			// steering the model toward tightening/loosening the regex or scoping
			// the path instead of blindly retrying with a slightly different pattern.
			let output = results
			if (matchCount === 0) {
				output +=
					"\n\nNo matches found. Change the regex, path, or file_pattern before retrying; do not repeat this unchanged search."
			}

			const completeMessage = JSON.stringify({ ...sharedMessageProps, content: results } satisfies ClineSayTool)
			const didApprove = await askApproval("tool", completeMessage)

			if (!didApprove) {
				return
			}

			pushToolResult(output)

			return
		}
	} catch (error) {
		await handleError("searching files", error)
		return
	}
}
