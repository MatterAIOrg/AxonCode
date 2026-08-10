import { promises as fs } from "fs"
import path from "path"

import { DEFAULT_WRITE_DELAY_MS } from "@roo-code/types"

import { ClineSayTool } from "../../shared/ExtensionMessage"
import { HandleError, PushToolResult, RemoveClosingTag, ToolUse } from "../../shared/tools"
import { fileExistsAtPath } from "../../utils/fs"
import { getReadablePath } from "../../utils/path"
import { RecordSource } from "../context-tracking/FileContextTrackerTypes"
import { formatResponse } from "../prompts/responses"
import { Task } from "../task/Task"
import { calculateEditLineNumber, performReplacement, truncatePreview } from "./fileEditTool"

type ReplacementResult = {
	content: string
	replacements: number
}

type EditItem = {
	file_path: string
	old_string: string
	new_string: string
	replace_all?: boolean
}

type EditResult = {
	index: number
	success: boolean
	file_path: string
	error?: string
	lines_changed?: number
}

type FileEditSummary = {
	relPath: string
	absolutePath: string
	originalContent: string
	newContent: string
	fileExists: boolean
	isWriteProtected: boolean
}

const PREVIEW_LIMIT = 500

export async function multiFileEditTool(
	cline: Task,
	block: ToolUse,
	handleError: HandleError,
	pushToolResult: PushToolResult,
	removeClosingTag: RemoveClosingTag,
): Promise<void> {
	let editsRaw = block.params.edits

	// Defensive fallback: if the model sent single-edit params (file_path, old_string, new_string)
	// directly to multi_file_edit without wrapping in edits array, auto-wrap them.
	if (
		(editsRaw === undefined || editsRaw === null) &&
		(block.params as any).file_path &&
		(block.params as any).old_string !== undefined
	) {
		editsRaw = JSON.stringify([
			{
				file_path: (block.params as any).file_path,
				old_string: (block.params as any).old_string,
				new_string: (block.params as any).new_string ?? "",
				replace_all: (block.params as any).replace_all,
			},
		])
	}

	// Handle partial streaming - return early without processing
	if (block.partial) {
		const editCount = Array.isArray(editsRaw) ? editsRaw.length : 0
		const partialMessageProps: ClineSayTool = {
			tool: "fileEdit",
			path: cline.cwd,
			content: `Processing ${editCount} file edits...`,
		}
		await cline.ask("tool", JSON.stringify(partialMessageProps), block.partial).catch(() => {})
		return
	}

	// Validate edits parameter exists and is not empty
	if (editsRaw === undefined || editsRaw === null) {
		cline.consecutiveMistakeCount++
		cline.recordToolError("multi_file_edit")
		const errorMessage = formatResponse.toolError("edits parameter is required")
		await cline.say("error", errorMessage)
		pushToolResult(errorMessage)
		return
	}

	// Parse edits - handle both string (JSON) and array formats
	let edits: EditItem[]
	try {
		if (typeof editsRaw === "string") {
			const parsed = JSON.parse(editsRaw)
			if (!Array.isArray(parsed)) {
				throw new Error(`edits must be an array, got ${typeof parsed}`)
			}
			edits = parsed
		} else if (Array.isArray(editsRaw)) {
			edits = editsRaw as EditItem[]
		} else {
			throw new Error(`edits must be an array, got ${typeof editsRaw}`)
		}
	} catch (e) {
		cline.consecutiveMistakeCount++
		cline.recordToolError("multi_file_edit")
		const errorMessage = formatResponse.toolError(
			`Invalid edits parameter: expected an array of edit objects. ${e instanceof Error ? e.message : String(e)}`,
		)
		await cline.say("error", errorMessage)
		pushToolResult(errorMessage)
		return
	}

	if (!Array.isArray(edits) || edits.length === 0) {
		cline.consecutiveMistakeCount++
		cline.recordToolError("multi_file_edit")
		const errorMessage = formatResponse.toolError("edits array must contain at least one edit operation")
		await cline.say("error", errorMessage)
		pushToolResult(errorMessage)
		return
	}

	const results: EditResult[] = []
	const provider = cline.providerRef.deref()
	const state = await provider?.getState()
	const diagnosticsEnabled = state?.diagnosticsEnabled ?? true
	const writeDelayMs = state?.writeDelayMs ?? DEFAULT_WRITE_DELAY_MS

	// Group edits by file for efficient processing
	const editsByFile = new Map<string, { edits: Array<{ index: number; edit: EditItem }>; absolutePath: string }>()

	for (let i = 0; i < edits.length; i++) {
		const edit = edits[i]
		const filePath = edit.file_path

		if (!filePath) {
			results.push({
				index: i,
				success: false,
				file_path: "",
				error: "file_path is required",
			})
			continue
		}

		if (edit.old_string === undefined) {
			results.push({
				index: i,
				success: false,
				file_path: filePath,
				error: "old_string is required",
			})
			continue
		}

		if (edit.new_string === undefined) {
			results.push({
				index: i,
				success: false,
				file_path: filePath,
				error: "new_string is required",
			})
			continue
		}

		if (edit.old_string === edit.new_string) {
			results.push({
				index: i,
				success: false,
				file_path: filePath,
				error: "old_string and new_string must be different",
			})
			continue
		}

		const absolutePath = path.isAbsolute(filePath) ? filePath : path.resolve(cline.cwd, filePath)

		// Check access
		const accessAllowed = cline.rooIgnoreController?.validateAccess(filePath)
		if (!accessAllowed) {
			results.push({
				index: i,
				success: false,
				file_path: filePath,
				error: formatResponse.rooIgnoreError(filePath),
			})
			continue
		}

		if (!editsByFile.has(absolutePath)) {
			editsByFile.set(absolutePath, { edits: [], absolutePath })
		}
		editsByFile.get(absolutePath)!.edits.push({ index: i, edit })
	}

	// Track file edits for emitting individual fileEdit messages
	const fileEditSummaries: FileEditSummary[] = []

	// Process each file
	for (const [absolutePath, { edits: fileEdits }] of editsByFile) {
		const relPath = fileEdits[0].edit.file_path
		const readablePath = getReadablePath(cline.cwd, relPath)
		const isWriteProtected = cline.rooProtectedController?.isWriteProtected(relPath) || false

		try {
			const fileExists = await fileExistsAtPath(absolutePath)
			let originalContent = fileExists ? await fs.readFile(absolutePath, "utf-8") : ""
			let currentContent = originalContent

			// Sort edits by position in file (descending) for same-file edits
			// This ensures earlier edits don't affect line numbers of later ones
			const editPositions: Array<{ index: number; edit: EditItem; position: number }> = []
			for (const { index, edit } of fileEdits) {
				// Best-effort position for bottom-to-top ordering only; the
				// authoritative match happens in performReplacement below.
				// Use the raw string verbatim — escape sequences were already
				// decoded at the transport boundary (JSON.parse for native tool
				// calls), so re-decoding here would corrupt literal escapes.
				const pos = currentContent.indexOf(edit.old_string)
				editPositions.push({ index, edit, position: pos >= 0 ? pos : Infinity })
			}

			// Sort by position descending (bottom to top)
			editPositions.sort((a, b) => b.position - a.position)

			// Tracks new_string values already written to this file so we can
			// reject a later edit whose old_string targets text a prior edit just
			// inserted (which would mean the edit matched freshly-added content
			// rather than the original file). Mirrors Claude Code's guard.
			const appliedNewStrings: string[] = []

			// Apply edits in order
			for (const { index, edit } of editPositions) {
				const replaceAll =
					edit.replace_all === true || String(edit.replace_all) === "true" || String(edit.replace_all) === "1"

				try {
					// Guard: an old_string that is a substring of a previously-applied
					// new_string almost certainly matches inserted text, not the
					// original file. Fail this edit loudly rather than corrupt.
					const oldStringToCheck = edit.old_string.replace(/\n+$/, "")
					if (oldStringToCheck !== "" && appliedNewStrings.some((s) => s.includes(oldStringToCheck))) {
						throw new Error(
							"old_string is a substring of a new_string from a previous edit to this file. " +
								"Edits must each target the original file content; reorder or rewrite this edit.",
						)
					}

					// Pass old_string and new_string VERBATIM. Escape sequences were
					// already decoded once at the transport boundary (JSON.parse for
					// native tool calls; raw text for XML). Decoding again here would
					// turn a literal "\n" in source code into a real newline and vice
					// versa. performReplacement locates old_string leniently (it tries
					// escaped/unescaped variants) and writes new_string byte-for-byte,
					// so this matches the single-edit file_edit tool exactly.
					const replacement = performReplacement(currentContent, edit.old_string, edit.new_string, replaceAll)
					const newContent = replacement.content

					// Record what we wrote so the substring guard above can vet
					// subsequent edits against freshly-inserted text.
					appliedNewStrings.push(edit.new_string)

					if (newContent === currentContent) {
						results.push({
							index,
							success: true,
							file_path: edit.file_path,
							lines_changed: 0,
						})
					} else {
						const oldLineCount = currentContent.split("\n").length
						currentContent = newContent
						const newLineCount = currentContent.split("\n").length
						const linesChanged = Math.abs(newLineCount - oldLineCount)
						results.push({
							index,
							success: true,
							file_path: edit.file_path,
							lines_changed: linesChanged,
						})
					}
				} catch (error) {
					results.push({
						index,
						success: false,
						file_path: edit.file_path,
						error: error instanceof Error ? error.message : String(error),
					})
				}
			}

			// Track file edit for emitting individual fileEdit message
			if (currentContent !== originalContent) {
				fileEditSummaries.push({
					relPath,
					absolutePath,
					originalContent,
					newContent: currentContent,
					fileExists,
					isWriteProtected,
				})
			}
		} catch (error) {
			// Mark all edits for this file as failed
			for (const { index, edit } of fileEdits) {
				if (!results.find((r) => r.index === index)) {
					results.push({
						index,
						success: false,
						file_path: edit.file_path,
						error: error instanceof Error ? error.message : String(error),
					})
				}
			}
		}
	}

	// Sort results by index for consistent output
	results.sort((a, b) => a.index - b.index)

	// Record usage
	cline.consecutiveMistakeCount = 0
	cline.recordToolUsage("multi_file_edit")

	// Emit individual fileEdit messages for each file (this creates the fileEdit UI per file)
	for (const fileEdit of fileEditSummaries) {
		const diff = formatResponse.createPrettyPatch(fileEdit.relPath, fileEdit.originalContent, fileEdit.newContent)
		const editLineNumber = calculateEditLineNumber(fileEdit.originalContent, fileEdit.originalContent)

		const sayMessageProps: ClineSayTool = {
			tool: "fileEdit",
			path: fileEdit.relPath,
			isProtected: fileEdit.isWriteProtected,
			diff,
			content: truncatePreview(fileEdit.newContent, PREVIEW_LIMIT),
			startLine: editLineNumber,
		}

		await cline.say("tool" as any, JSON.stringify(sayMessageProps))

		// Write the file
		cline.diffViewProvider.editType = fileEdit.fileExists ? "modify" : "create"
		cline.diffViewProvider.originalContent = fileEdit.originalContent

		await cline.diffViewProvider.saveDirectly(
			fileEdit.relPath,
			fileEdit.newContent,
			false,
			diagnosticsEnabled,
			writeDelayMs,
		)

		cline.fileEditReviewController.addEdit({
			relPath: fileEdit.relPath,
			absolutePath: fileEdit.absolutePath,
			originalContent: fileEdit.originalContent,
			newContent: fileEdit.newContent,
			createdByAgent: !fileEdit.fileExists,
		})

		await cline.fileContextTracker.trackFileContext(fileEdit.relPath, "roo_edited" as RecordSource)
		cline.didEditFile = true
	}

	// Build result message
	const successCount = results.filter((r) => r.success).length
	const failCount = results.filter((r) => !r.success).length

	let resultMessage = `Applied ${successCount} of ${results.length} edits.\n\n`
	resultMessage += "Results:\n"

	for (const result of results) {
		if (result.success) {
			resultMessage += `[${result.index}] ✓ ${result.file_path}${result.lines_changed ? ` (${result.lines_changed} lines)` : ""}\n`
		} else {
			resultMessage += `[${result.index}] ✗ ${result.file_path}: ${result.error}\n`
		}
	}

	pushToolResult(resultMessage)
	await cline.diffViewProvider.reset()
	cline.processQueuedMessages()
}
