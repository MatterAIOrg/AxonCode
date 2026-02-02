import path from "path"
import { promises as fs } from "fs"

import { DEFAULT_WRITE_DELAY_MS } from "@roo-code/types"

import { Task } from "../task/Task"
import { formatResponse } from "../prompts/responses"
import { HandleError, PushToolResult, RemoveClosingTag, ToolUse } from "../../shared/tools"
import { fileExistsAtPath } from "../../utils/fs"
import { getReadablePath } from "../../utils/path"
import { ClineSayTool } from "../../shared/ExtensionMessage"
import { experiments, EXPERIMENT_IDS } from "../../shared/experiments"
import { RecordSource } from "../context-tracking/FileContextTrackerTypes"

type ReplacementResult = {
	content: string
	replacements: number
}

type Replacer = (content: string, find: string) => Generator<string, void, undefined>

const PREVIEW_LIMIT = 500

export async function fileEditTool(
	cline: Task,
	block: ToolUse,
	handleError: HandleError,
	pushToolResult: PushToolResult,
	removeClosingTag: RemoveClosingTag,
): Promise<void> {
	// Support both file_path (new) and target_file (legacy)
	const filePath = (block.params as any).file_path || block.params.target_file
	const oldString = block.params.old_string
	// Handle case where LLM passes new_string as an object (e.g., when creating JSON files)
	const rawNewString = block.params.new_string
	const newString =
		typeof rawNewString === "object" && rawNewString !== null ? JSON.stringify(rawNewString, null, 2) : rawNewString
	const replaceAllFlag = block.params.replace_all
	const replaceAll = replaceAllFlag === "true" || replaceAllFlag === "1"

	try {
		if (block.partial) {
			const partialMessageProps: ClineSayTool = {
				tool: "fileEdit",
				path: getReadablePath(cline.cwd, removeClosingTag("file_path", filePath)),
				search: removeClosingTag("old_string", oldString),
				replace: removeClosingTag("new_string", newString),
				useRegex: false,
				ignoreCase: false,
				replaceAll,
				startLine: undefined,
				endLine: undefined,
			}

			await cline.ask("tool", JSON.stringify(partialMessageProps), block.partial).catch(() => {})
			return
		}

		if (!(await validateParams(cline, filePath, oldString, newString, pushToolResult))) {
			return
		}

		const relPath = filePath as string
		const readablePath = getReadablePath(cline.cwd, relPath)
		// Support absolute paths using cross-platform check
		const absolutePath = path.isAbsolute(relPath) ? relPath : path.resolve(cline.cwd, relPath)

		const accessAllowed = cline.rooIgnoreController?.validateAccess(relPath)
		if (!accessAllowed) {
			await cline.say("rooignore_error", relPath)
			pushToolResult(formatResponse.toolError(formatResponse.rooIgnoreError(relPath)))
			return
		}

		const isWriteProtected = cline.rooProtectedController?.isWriteProtected(relPath) || false
		const fileExists = await fileExistsAtPath(absolutePath)

		if (!fileExists && oldString) {
			const trimmedOld = oldString.trim()
			if (trimmedOld.length > 0) {
				// Create the file with newString content instead of erroring
				const provider = cline.providerRef.deref()
				const state = await provider?.getState()
				const diagnosticsEnabled = state?.diagnosticsEnabled ?? true
				const writeDelayMs = state?.writeDelayMs ?? DEFAULT_WRITE_DELAY_MS
				const isPreventFocusDisruptionEnabled = experiments.isEnabled(
					state?.experiments ?? {},
					EXPERIMENT_IDS.PREVENT_FOCUS_DISRUPTION,
				)

				cline.diffViewProvider.editType = "create"
				cline.diffViewProvider.originalContent = ""

				await cline.diffViewProvider.saveDirectly(
					relPath,
					newString ?? "",
					!isPreventFocusDisruptionEnabled,
					diagnosticsEnabled,
					writeDelayMs,
				)

				const sayMessageProps: ClineSayTool = {
					tool: "fileEdit",
					path: readablePath,
					isProtected: isWriteProtected,
					search: truncatePreview(oldString ?? "", PREVIEW_LIMIT),
					replace: truncatePreview(newString ?? "", PREVIEW_LIMIT),
					content: truncatePreview(newString ?? "", PREVIEW_LIMIT),
					useRegex: false,
					ignoreCase: false,
					replaceAll,
				}

				await cline.say("tool" as any, JSON.stringify(sayMessageProps))
				cline.fileEditReviewController.addEdit({
					relPath,
					absolutePath,
					originalContent: "",
					newContent: newString ?? "",
				})

				await cline.fileContextTracker.trackFileContext(relPath, "roo_edited" as RecordSource)
				cline.didEditFile = true
				cline.consecutiveMistakeCount = 0
				cline.recordToolUsage("file_edit")

				const message = await cline.diffViewProvider.pushToolWriteResult(cline, cline.cwd, true)
				pushToolResult(message)

				await cline.diffViewProvider.reset()
				cline.processQueuedMessages()
				return
			}
		}

		const originalContent = fileExists ? await fs.readFile(absolutePath, "utf-8") : ""
		let replacement: ReplacementResult

		try {
			replacement = performReplacement(originalContent, oldString ?? "", newString ?? "", replaceAll)
		} catch (error) {
			cline.consecutiveMistakeCount++
			cline.recordToolError("file_edit")
			const message = error instanceof Error ? error.message : String(error)
			const formattedError = formatResponse.toolError(message)
			await cline.say("error", formattedError)
			pushToolResult(formattedError)
			return
		}

		const newContent = replacement.content

		if (newContent === originalContent) {
			pushToolResult(`No changes needed for '${relPath}'.`)
			return
		}

		const provider = cline.providerRef.deref()
		const state = await provider?.getState()
		const diagnosticsEnabled = state?.diagnosticsEnabled ?? true
		const writeDelayMs = state?.writeDelayMs ?? DEFAULT_WRITE_DELAY_MS
		const isPreventFocusDisruptionEnabled = experiments.isEnabled(
			state?.experiments ?? {},
			EXPERIMENT_IDS.PREVENT_FOCUS_DISRUPTION,
		)

		cline.diffViewProvider.editType = fileExists ? "modify" : "create"
		cline.diffViewProvider.originalContent = originalContent

		await cline.diffViewProvider.saveDirectly(
			relPath,
			newContent,
			!isPreventFocusDisruptionEnabled,
			diagnosticsEnabled,
			writeDelayMs,
		)

		const sayMessageProps: ClineSayTool = {
			tool: "fileEdit",
			path: readablePath,
			isProtected: isWriteProtected,
			search: truncatePreview(oldString ?? "", PREVIEW_LIMIT),
			replace: truncatePreview(newString ?? "", PREVIEW_LIMIT),
			content: truncatePreview(newString ?? "", PREVIEW_LIMIT),
			useRegex: false,
			ignoreCase: false,
			replaceAll,
		}

		await cline.say("tool" as any, JSON.stringify(sayMessageProps))
		cline.fileEditReviewController.addEdit({
			relPath,
			absolutePath,
			originalContent,
			newContent,
		})

		await cline.fileContextTracker.trackFileContext(relPath, "roo_edited" as RecordSource)
		cline.didEditFile = true
		cline.consecutiveMistakeCount = 0
		cline.recordToolUsage("file_edit")

		const message = await cline.diffViewProvider.pushToolWriteResult(cline, cline.cwd, !fileExists)
		pushToolResult(message)

		await cline.diffViewProvider.reset()
		cline.processQueuedMessages()
	} catch (error) {
		await handleError("editing file content", error as Error)
		await cline.diffViewProvider.reset()
	}
}

async function validateParams(
	cline: Task,
	targetFile: string | undefined,
	oldString: string | undefined,
	newString: string | undefined,
	pushToolResult: PushToolResult,
): Promise<boolean> {
	if (!targetFile) {
		cline.consecutiveMistakeCount++
		cline.recordToolError("file_edit")
		pushToolResult(await cline.sayAndCreateMissingParamError("file_edit", "file_path"))
		return false
	}

	if (oldString === undefined) {
		cline.consecutiveMistakeCount++
		cline.recordToolError("file_edit")
		pushToolResult(await cline.sayAndCreateMissingParamError("file_edit", "old_string"))
		return false
	}

	if (newString === undefined) {
		cline.consecutiveMistakeCount++
		cline.recordToolError("file_edit")
		pushToolResult(await cline.sayAndCreateMissingParamError("file_edit", "new_string"))
		return false
	}

	if (oldString === newString) {
		cline.consecutiveMistakeCount++
		cline.recordToolError("file_edit")
		const errorMessage = formatResponse.toolError(
			"`old_string` and `new_string` must be different to perform a replacement.",
		)
		await cline.say("error", errorMessage)
		pushToolResult(errorMessage)
		return false
	}

	return true
}

function performReplacement(
	content: string,
	oldString: string,
	newString: string,
	replaceAll: boolean,
): ReplacementResult {
	if (oldString === "") {
		return { content: newString, replacements: newString === content ? 0 : 1 }
	}

	let foundMatch = false
	let sawAmbiguousMatch = false

	for (const replacer of REPLACERS) {
		const candidates = Array.from(new Set(replacer(content, oldString)))
		for (const candidate of candidates) {
			if (!candidate) continue
			const firstIndex = content.indexOf(candidate)
			if (firstIndex === -1) continue

			foundMatch = true

			if (replaceAll) {
				const occurrences = countOccurrences(content, candidate)
				if (occurrences === 0) continue
				return {
					content: content.split(candidate).join(newString),
					replacements: occurrences,
				}
			}

			const lastIndex = content.lastIndexOf(candidate)
			if (firstIndex === lastIndex) {
				return {
					content: content.slice(0, firstIndex) + newString + content.slice(firstIndex + candidate.length),
					replacements: 1,
				}
			}

			sawAmbiguousMatch = true
		}
	}

	if (!foundMatch) {
		// Provide helpful debug info
		const preview = oldString.length > 100 ? oldString.slice(0, 100) + "..." : oldString
		const contentPreview = content.length > 200 ? content.slice(0, 200) + "..." : content
		throw new Error(
			`old_string not found in file content.\n` +
				`Searched for (${oldString.length} chars): ${JSON.stringify(preview)}\n` +
				`File starts with: ${JSON.stringify(contentPreview)}`,
		)
	}

	if (sawAmbiguousMatch && !replaceAll) {
		throw new Error("old_string matched multiple locations. Provide more context or set replace_all to true.")
	}

	throw new Error("Unable to apply replacement. Provide additional context for old_string.")
}

function countOccurrences(haystack: string, needle: string): number {
	if (!needle) {
		return 0
	}

	let count = 0
	let index = 0
	while ((index = haystack.indexOf(needle, index)) !== -1) {
		count++
		index += needle.length
	}
	return count
}

function* simpleReplacer(content: string, find: string): Generator<string, void, undefined> {
	if (find.length === 0) return
	if (content.includes(find)) {
		yield find
	}
}

function* lineTrimmedReplacer(content: string, find: string): Generator<string, void, undefined> {
	const originalLines = content.split("\n")
	const searchLines = find.split("\n")

	if (searchLines[searchLines.length - 1] === "") {
		searchLines.pop()
	}

	for (let i = 0; i <= originalLines.length - searchLines.length; i++) {
		let matches = true

		for (let j = 0; j < searchLines.length; j++) {
			if (originalLines[i + j].trim() !== searchLines[j].trim()) {
				matches = false
				break
			}
		}

		if (!matches) continue

		let startIndex = 0
		for (let k = 0; k < i; k++) {
			startIndex += originalLines[k].length + 1
		}

		let endIndex = startIndex
		for (let k = 0; k < searchLines.length; k++) {
			endIndex += originalLines[i + k].length
			if (k < searchLines.length - 1) {
				endIndex += 1
			}
		}

		yield content.substring(startIndex, endIndex)
	}
}

function* blockAnchorReplacer(content: string, find: string): Generator<string, void, undefined> {
	const originalLines = content.split("\n")
	const searchLines = find.split("\n")

	if (searchLines.length < 3) return
	if (searchLines[searchLines.length - 1] === "") {
		searchLines.pop()
	}

	const firstLineSearch = searchLines[0].trim()
	const lastLineSearch = searchLines[searchLines.length - 1].trim()
	const searchBlockSize = searchLines.length

	const candidates: Array<{ start: number; end: number }> = []

	for (let i = 0; i < originalLines.length; i++) {
		if (originalLines[i].trim() !== firstLineSearch) continue

		for (let j = i + 2; j < originalLines.length; j++) {
			if (originalLines[j].trim() === lastLineSearch) {
				candidates.push({ start: i, end: j })
				break
			}
		}
	}

	if (candidates.length === 0) return

	if (candidates.length === 1) {
		const { start, end } = candidates[0]
		let similarity = 0
		const actualSize = end - start + 1
		const linesToCheck = Math.min(searchBlockSize - 2, actualSize - 2)

		if (linesToCheck > 0) {
			for (let j = 1; j < searchBlockSize - 1 && j < actualSize - 1; j++) {
				const originalLine = originalLines[start + j].trim()
				const searchLine = searchLines[j].trim()
				const maxLen = Math.max(originalLine.length, searchLine.length)
				if (maxLen === 0) continue
				const distance = levenshtein(originalLine, searchLine)
				similarity += (1 - distance / maxLen) / linesToCheck
				if (similarity >= SINGLE_CANDIDATE_SIMILARITY_THRESHOLD) {
					break
				}
			}
		} else {
			similarity = 1
		}

		if (similarity >= SINGLE_CANDIDATE_SIMILARITY_THRESHOLD) {
			yield extractBlock(content, originalLines, start, end)
		}
		return
	}

	let bestMatch: { start: number; end: number } | null = null
	let maxSimilarity = -1

	for (const candidate of candidates) {
		const { start, end } = candidate
		let similarity = 0
		const actualSize = end - start + 1
		const linesToCheck = Math.min(searchBlockSize - 2, actualSize - 2)

		if (linesToCheck > 0) {
			for (let j = 1; j < searchBlockSize - 1 && j < actualSize - 1; j++) {
				const originalLine = originalLines[start + j].trim()
				const searchLine = searchLines[j].trim()
				const maxLen = Math.max(originalLine.length, searchLine.length)
				if (maxLen === 0) continue
				const distance = levenshtein(originalLine, searchLine)
				similarity += 1 - distance / maxLen
			}
			similarity /= linesToCheck
		} else {
			similarity = 1
		}

		if (similarity > maxSimilarity) {
			maxSimilarity = similarity
			bestMatch = candidate
		}
	}

	if (bestMatch && maxSimilarity >= MULTIPLE_CANDIDATES_SIMILARITY_THRESHOLD) {
		yield extractBlock(content, originalLines, bestMatch.start, bestMatch.end)
	}
}

function* whitespaceNormalizedReplacer(content: string, find: string): Generator<string, void, undefined> {
	const normalizeWhitespace = (text: string) => text.replace(/\s+/g, " ").trim()
	const normalizedFind = normalizeWhitespace(find)

	const lines = content.split("\n")

	for (const line of lines) {
		const normalizedLine = normalizeWhitespace(line)
		if (normalizedLine === normalizedFind) {
			yield line
		} else if (normalizedLine.includes(normalizedFind)) {
			const words = find.trim().split(/\s+/)
			if (words.length === 0) continue
			const pattern = words.map((word) => escapeRegExp(word)).join("\\s+")
			try {
				const regex = new RegExp(pattern)
				const match = line.match(regex)
				if (match) {
					yield match[0]
				}
			} catch {
				// ignore invalid pattern
			}
		}
	}

	const findLines = find.split("\n")
	if (findLines.length > 1) {
		for (let i = 0; i <= lines.length - findLines.length; i++) {
			const block = lines.slice(i, i + findLines.length).join("\n")
			if (normalizeWhitespace(block) === normalizedFind) {
				yield block
			}
		}
	}
}

function* indentationFlexibleReplacer(content: string, find: string): Generator<string, void, undefined> {
	const removeIndentation = (text: string) => {
		const lines = text.split("\n")
		const nonEmpty = lines.filter((line) => line.trim().length > 0)
		if (nonEmpty.length === 0) return text
		const minIndent = Math.min(
			...nonEmpty.map((line) => {
				const match = line.match(/^(\s*)/)
				return match ? match[1].length : 0
			}),
		)
		return lines.map((line) => (line.trim().length === 0 ? line : line.slice(minIndent))).join("\n")
	}

	const normalizedFind = removeIndentation(find)
	const contentLines = content.split("\n")
	const findLines = find.split("\n")

	for (let i = 0; i <= contentLines.length - findLines.length; i++) {
		const block = contentLines.slice(i, i + findLines.length).join("\n")
		if (removeIndentation(block) === normalizedFind) {
			yield block
		}
	}
}

function* escapeNormalizedReplacer(content: string, find: string): Generator<string, void, undefined> {
	const unescapeString = (str: string): string =>
		str.replace(/\\(n|t|r|'|"|`|\\|\n|\$)/g, (match, captured) => {
			switch (captured) {
				case "n":
					return "\n"
				case "t":
					return "\t"
				case "r":
					return "\r"
				case "'":
					return "'"
				case '"':
					return '"'
				case "`":
					return "`"
				case "\\":
					return "\\"
				case "\n":
					return "\n"
				case "$":
					return "$"
				default:
					return match
			}
		})

	const unescapedFind = unescapeString(find)

	if (content.includes(unescapedFind)) {
		yield unescapedFind
	}

	const lines = content.split("\n")
	const findLines = unescapedFind.split("\n")

	for (let i = 0; i <= lines.length - findLines.length; i++) {
		const block = lines.slice(i, i + findLines.length).join("\n")
		const unescapedBlock = unescapeString(block)
		if (unescapedBlock === unescapedFind) {
			yield block
		}
	}
}

/**
 * Handles the case where old_string contains actual newlines/tabs/quotes but the file
 * contains their escape sequence representations (e.g., source code with string literals).
 * This is common when editing string literals in source files.
 *
 * Strategy: Find string quote positions and convert actual special characters
 * within quoted portions to their escape sequence representations.
 */
function* sourceCodeEscapeReplacer(content: string, find: string): Generator<string, void, undefined> {
	// Find the first quote character (", ', or `) that starts string content
	const quoteMatch = find.match(/["'`]/)
	if (!quoteMatch || quoteMatch.index === undefined) {
		// No quotes found, try simple full escape as fallback
		const withEscapedNewlines = find.replace(/\n/g, "\\n")
		if (withEscapedNewlines !== find && content.includes(withEscapedNewlines)) {
			yield withEscapedNewlines
		}
		return
	}

	const quoteIndex = quoteMatch.index
	const quoteChar = quoteMatch[0]

	// Split into structural part (before quote) and content part (from quote onwards)
	const structuralPart = find.substring(0, quoteIndex + 1) // Include the opening quote
	const contentPart = find.substring(quoteIndex + 1)

	// Create a regex to match the detected quote character
	const quoteRegex = new RegExp(escapeRegExp(quoteChar), "g")
	const escapedQuote = "\\" + quoteChar

	// Escape special characters in the content part for string literals
	// Order matters: escape backslashes first, then other characters
	const escapeForStringLiteral = (str: string): string => {
		return str
			.replace(/\\/g, "\\\\") // Backslashes first
			.replace(/\n/g, "\\n") // Newlines
			.replace(/\t/g, "\\t") // Tabs
			.replace(/\r/g, "\\r") // Carriage returns
			.replace(quoteRegex, escapedQuote) // Escape the detected quote type
	}

	// Try full escape (all special chars)
	const fullyEscaped = escapeForStringLiteral(contentPart)
	if (fullyEscaped !== contentPart) {
		const hybrid = structuralPart + fullyEscaped
		if (content.includes(hybrid)) {
			yield hybrid
		}
	}

	// Try escaping just newlines and quotes (most common case for string literals)
	const escapedNewlinesAndQuotes = contentPart.replace(/\n/g, "\\n").replace(quoteRegex, escapedQuote)
	if (escapedNewlinesAndQuotes !== contentPart && escapedNewlinesAndQuotes !== fullyEscaped) {
		const hybrid = structuralPart + escapedNewlinesAndQuotes
		if (content.includes(hybrid)) {
			yield hybrid
		}
	}

	// Try escaping just newlines (simpler case)
	const escapedNewlinesOnly = contentPart.replace(/\n/g, "\\n")
	if (
		escapedNewlinesOnly !== contentPart &&
		escapedNewlinesOnly !== fullyEscaped &&
		escapedNewlinesOnly !== escapedNewlinesAndQuotes
	) {
		const hybrid = structuralPart + escapedNewlinesOnly
		if (content.includes(hybrid)) {
			yield hybrid
		}
	}
}

/**
 * Flexible substring replacer that handles cases where old_string is a true substring
 * of the content (e.g., missing trailing characters like quotes or commas).
 * This normalizes line endings and tries multiple matching strategies.
 */
function* flexibleSubstringReplacer(content: string, find: string): Generator<string, void, undefined> {
	if (find.length === 0) return

	// Normalize line endings for comparison
	const normalizeLineEndings = (str: string) => str.replace(/\r\n/g, "\n").replace(/\r/g, "\n")

	/**
	 * Maps a position in normalized content back to the original content position.
	 * Accounts for CRLF sequences that were normalized to LF.
	 * Accepts optional start parameters to resume scanning from a known position.
	 */
	const mapNormalizedIndexToOriginal = (
		normalizedTargetPos: number,
		startOriginalIndex = 0,
		startNormalizedPos = 0,
	): number => {
		let originalIndex = startOriginalIndex
		let normalizedPos = startNormalizedPos
		while (normalizedPos < normalizedTargetPos && originalIndex < content.length) {
			if (content[originalIndex] === "\r" && content[originalIndex + 1] === "\n") {
				originalIndex += 2
				normalizedPos += 1
			} else {
				originalIndex += 1
				normalizedPos += 1
			}
		}
		return originalIndex
	}

	const normalizedContent = normalizeLineEndings(content)
	const normalizedFind = normalizeLineEndings(find)

	// Direct substring match with normalized line endings
	if (normalizedContent.includes(normalizedFind)) {
		const normalizedIndex = normalizedContent.indexOf(normalizedFind)
		if (normalizedIndex !== -1) {
			const originalStart = mapNormalizedIndexToOriginal(normalizedIndex)
			// Resume scanning from originalStart to avoid redundant iteration
			const originalEnd = mapNormalizedIndexToOriginal(
				normalizedIndex + normalizedFind.length,
				originalStart,
				normalizedIndex,
			)
			yield content.substring(originalStart, originalEnd)
		}
	}

	// Try with trimmed find (handles trailing/leading whitespace differences)
	const trimmedFind = normalizedFind.trim()
	if (trimmedFind !== normalizedFind && trimmedFind.length > 0) {
		const trimmedIndex = normalizedContent.indexOf(trimmedFind)
		if (trimmedIndex !== -1) {
			const originalStart = mapNormalizedIndexToOriginal(trimmedIndex)
			// Resume scanning from originalStart to avoid redundant iteration
			const originalEnd = mapNormalizedIndexToOriginal(
				trimmedIndex + trimmedFind.length,
				originalStart,
				trimmedIndex,
			)
			yield content.substring(originalStart, originalEnd)
		}
	}
}

function* multiOccurrenceReplacer(content: string, find: string): Generator<string, void, undefined> {
	if (find.length === 0) return
	let startIndex = 0
	while (true) {
		const index = content.indexOf(find, startIndex)
		if (index === -1) break
		yield find
		startIndex = index + find.length
	}
}

function* trimmedBoundaryReplacer(content: string, find: string): Generator<string, void, undefined> {
	const trimmed = find.trim()
	if (trimmed === find) return

	if (content.includes(trimmed)) {
		yield trimmed
	}

	const lines = content.split("\n")
	const findLines = find.split("\n")

	for (let i = 0; i <= lines.length - findLines.length; i++) {
		const block = lines.slice(i, i + findLines.length).join("\n")
		if (block.trim() === trimmed) {
			yield block
		}
	}
}

function* contextAwareReplacer(content: string, find: string): Generator<string, void, undefined> {
	const findLines = find.split("\n")
	if (findLines.length < 3) return
	if (findLines[findLines.length - 1] === "") {
		findLines.pop()
	}

	const contentLines = content.split("\n")
	const firstLine = findLines[0].trim()
	const lastLine = findLines[findLines.length - 1].trim()

	for (let i = 0; i < contentLines.length; i++) {
		if (contentLines[i].trim() !== firstLine) continue

		for (let j = i + 2; j < contentLines.length; j++) {
			if (contentLines[j].trim() !== lastLine) continue
			const blockLines = contentLines.slice(i, j + 1)
			if (blockLines.length !== findLines.length) continue

			let matchingLines = 0
			let totalNonEmpty = 0
			for (let k = 1; k < blockLines.length - 1; k++) {
				const blockLine = blockLines[k].trim()
				const findLine = findLines[k].trim()
				if (blockLine.length > 0 || findLine.length > 0) {
					totalNonEmpty++
					if (blockLine === findLine) {
						matchingLines++
					}
				}
			}

			if (totalNonEmpty === 0 || matchingLines / totalNonEmpty >= 0.5) {
				yield blockLines.join("\n")
				break
			}
		}
	}
}

function extractBlock(content: string, lines: string[], start: number, end: number): string {
	let startIndex = 0
	for (let i = 0; i < start; i++) {
		startIndex += lines[i].length + 1
	}

	let endIndex = startIndex
	for (let i = start; i <= end; i++) {
		endIndex += lines[i].length
		if (i < end) {
			endIndex += 1
		}
	}

	return content.substring(startIndex, endIndex)
}

function truncatePreview(value: string, limit: number): string {
	if (value.length <= limit) {
		return value
	}
	return value.slice(0, limit) + "\n...(truncated)"
}

function levenshtein(a: string, b: string): number {
	if (a === "" || b === "") {
		return Math.max(a.length, b.length)
	}

	const matrix = Array.from({ length: a.length + 1 }, (_, i) =>
		Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
	)

	for (let i = 1; i <= a.length; i++) {
		for (let j = 1; j <= b.length; j++) {
			const cost = a[i - 1] === b[j - 1] ? 0 : 1
			matrix[i][j] = Math.min(matrix[i - 1][j] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j - 1] + cost)
		}
	}

	return matrix[a.length][b.length]
}

function escapeRegExp(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

const SINGLE_CANDIDATE_SIMILARITY_THRESHOLD = 0
const MULTIPLE_CANDIDATES_SIMILARITY_THRESHOLD = 0.3

const REPLACERS: Replacer[] = [
	simpleReplacer,
	sourceCodeEscapeReplacer,
	flexibleSubstringReplacer,
	lineTrimmedReplacer,
	blockAnchorReplacer,
	whitespaceNormalizedReplacer,
	indentationFlexibleReplacer,
	escapeNormalizedReplacer,
	trimmedBoundaryReplacer,
	contextAwareReplacer,
	multiOccurrenceReplacer,
]
