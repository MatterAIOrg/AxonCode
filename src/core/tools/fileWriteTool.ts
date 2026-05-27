import path from "path"
import delay from "delay"
import * as vscode from "vscode"
import fs from "fs/promises"

import { Task } from "../task/Task"
import { ClineSayTool } from "../../shared/ExtensionMessage"
import { formatResponse } from "../prompts/responses"
import { ToolUse, AskApproval, HandleError, PushToolResult, RemoveClosingTag } from "../../shared/tools"
import { RecordSource } from "../context-tracking/FileContextTrackerTypes"
import { fileExistsAtPath } from "../../utils/fs"
import { stripLineNumbers, everyLineHasLineNumbers } from "../../integrations/misc/extract-text"
import { getReadablePath } from "../../utils/path"
import { isPathOutsideWorkspace } from "../../utils/pathUtils"
import { detectCodeOmission } from "../../integrations/editor/detect-omission"
import { unescapeHtmlEntities } from "../../utils/text-normalization"
import { DEFAULT_WRITE_DELAY_MS, getActiveToolUseStyle } from "@roo-code/types"
import { EXPERIMENT_IDS, experiments } from "../../shared/experiments"

// Maximum content length to send to the webview during partial streaming.
// Sending full content for large files causes IPC bottlenecks and freezes
// the UI. The full content is preserved for the final write operation.
const MAX_PARTIAL_DISPLAY_CONTENT_LENGTH = 5000

// Analytics event types for file_write tool
interface FileWriteAnalytics {
	toolName: "file_write"
	operation: "create" | "update"
	filePath: string
	lineCount: number
	contentLength: number
	userModified?: boolean
	error?: string
}

/**
 * Log file_write analytics event
 */
function logFileWriteAnalytics(cline: Task, data: FileWriteAnalytics): void {
	// Record tool usage for analytics
	cline.recordToolUsage("file_write")

	// Log to any registered analytics sinks
	const eventData = {
		tool: data.toolName,
		operation: data.operation,
		path: data.filePath,
		lines: data.lineCount,
		bytes: data.contentLength,
		...(data.userModified && { userModified: true }),
		...(data.error && { error: data.error }),
	}

	// If there's an error, record it
	if (data.error) {
		cline.recordToolError("file_write")
	}
}

export async function fileWriteTool(
	cline: Task,
	block: ToolUse,
	askApproval: AskApproval,
	handleError: HandleError,
	pushToolResult: PushToolResult,
	removeClosingTag: RemoveClosingTag,
) {
	const filePath: string | undefined = block.params.file_path
	let content: string | undefined = block.params.content
	let predictedLineCount: number | undefined = parseInt(block.params.line_count ?? "0")

	if (block.partial && (!filePath || content === undefined)) {
		// Wait for complete data
		return
	}

	if (!filePath) {
		cline.consecutiveMistakeCount++
		cline.recordToolError("file_write")
		pushToolResult(await cline.sayAndCreateMissingParamError("file_write", "file_path"))
		await cline.diffViewProvider.reset()
		return
	}

	if (content === undefined) {
		cline.consecutiveMistakeCount++
		cline.recordToolError("file_write")
		pushToolResult(await cline.sayAndCreateMissingParamError("file_write", "content"))
		await cline.diffViewProvider.reset()
		return
	}

	// For partial blocks, only update the UI message - don't open diff view or access file system
	// as the file_path may be truncated during streaming
	if (block.partial) {
		// Check if preventFocusDisruption experiment is enabled
		const provider = cline.providerRef.deref()
		const state = await provider?.getState()
		const isPreventFocusDisruptionEnabled = experiments.isEnabled(
			state?.experiments ?? {},
			EXPERIMENT_IDS.PREVENT_FOCUS_DISRUPTION,
		)

		if (!isPreventFocusDisruptionEnabled) {
			// Pre-processing content for display
			let displayContent = content
			if (displayContent.startsWith("```")) {
				displayContent = displayContent.split("").slice(1).join("")
			}
			if (displayContent.endsWith("```")) {
				displayContent = displayContent.split("").slice(0, -1).join("")
			}

			// Truncate large content for UI preview during streaming to prevent
			// IPC and rendering bottlenecks. The full content is preserved for
			// the final write operation.
			if (displayContent.length > MAX_PARTIAL_DISPLAY_CONTENT_LENGTH) {
				const truncatedLength = MAX_PARTIAL_DISPLAY_CONTENT_LENGTH
				const lastNewline = displayContent.lastIndexOf("", truncatedLength)
				if (lastNewline > truncatedLength * 0.8) {
					displayContent = displayContent.slice(0, lastNewline) + "... (content truncated during streaming)"
				} else {
					displayContent = displayContent.slice(0, truncatedLength) + "..."
				}
			}

			// For partial display, use the filePath as-is (may be incomplete)
			// Don't resolve or validate paths during streaming
			const displayPath = filePath || "..."

			// Determine if the path is outside the workspace for partial display
			// Use the same logic as complete blocks for consistency
			const partialFullPath = filePath ? path.resolve(cline.cwd, filePath) : ""
			const isOutsideWorkspace = isPathOutsideWorkspace(partialFullPath)

			const sharedMessageProps: ClineSayTool = {
				tool: "newFileCreated", // Default for partial display
				path: displayPath,
				content: displayContent,
				isOutsideWorkspace,
				isProtected: false,
			}

			// Update GUI message only - don't open diff view during partial streaming
			const partialMessage = JSON.stringify(sharedMessageProps)
			await cline.ask("tool", partialMessage, block.partial).catch(() => {})
		}

		return
	}

	// --- Complete block handling below ---

	const accessAllowed = cline.rooIgnoreController?.validateAccess(filePath)

	if (!accessAllowed) {
		await cline.say("rooignore_error", filePath)
		pushToolResult(formatResponse.toolError(formatResponse.rooIgnoreError(filePath)))
		return
	}

	// Check if file is write-protected
	const isWriteProtected = cline.rooProtectedController?.isWriteProtected(filePath) || false

	// Check if file exists
	let fileExists: boolean
	const absolutePath = path.resolve(cline.cwd, filePath)

	if (cline.diffViewProvider.editType !== undefined) {
		fileExists = cline.diffViewProvider.editType === "modify"
	} else {
		fileExists = await fileExistsAtPath(absolutePath)
		cline.diffViewProvider.editType = fileExists ? "modify" : "create"
	}

	// Pre-processing content
	if (content.startsWith("```")) {
		content = content.split("\n").slice(1).join("\n")
	}

	if (content.endsWith("```")) {
		content = content.split("\n").slice(0, -1).join("\n")
	}

	if (!cline.api.getModel().id.includes("claude")) {
		content = unescapeHtmlEntities(content)
	}

	// Determine if the path is outside the workspace
	const fullPath = filePath ? path.resolve(cline.cwd, removeClosingTag("file_path", filePath)) : ""
	const isOutsideWorkspace = isPathOutsideWorkspace(fullPath)

	const sharedMessageProps: ClineSayTool = {
		tool: fileExists ? "editedExistingFile" : "newFileCreated",
		path: getReadablePath(cline.cwd, removeClosingTag("file_path", filePath)),
		content,
		isOutsideWorkspace,
		isProtected: isWriteProtected,
	}

	try {
		if (predictedLineCount === undefined) {
			cline.consecutiveMistakeCount++
			cline.recordToolError("file_write")

			const actualLineCount = content.split("\n").length
			const isNewFile = !fileExists
			const diffStrategyEnabled = !!cline.diffStrategy

			await cline.say(
				"error",
				`Axon Code tried to use file_write${
					filePath ? ` for '${filePath}'` : ""
				} but the required parameter 'line_count' was missing or truncated after ${actualLineCount} lines of content were written. Retrying...`,
			)

			pushToolResult(
				formatResponse.toolError(
					formatResponse.lineCountTruncationError(
						actualLineCount,
						isNewFile,
						diffStrategyEnabled,
						getActiveToolUseStyle(cline.apiConfiguration),
					),
				),
			)
			await cline.diffViewProvider.revertChanges()
			return
		}

		cline.consecutiveMistakeCount = 0

		// Get settings
		const provider = cline.providerRef.deref()
		const state = await provider?.getState()
		const diagnosticsEnabled = state?.diagnosticsEnabled ?? true
		const writeDelayMs = state?.writeDelayMs ?? DEFAULT_WRITE_DELAY_MS
		const isPreventFocusDisruptionEnabled = experiments.isEnabled(
			state?.experiments ?? {},
			EXPERIMENT_IDS.PREVENT_FOCUS_DISRUPTION,
		)

		// Check for code omissions
		const originalContent = fileExists ? await fs.readFile(absolutePath, "utf-8") : ""
		if (detectCodeOmission(originalContent, content, predictedLineCount)) {
			if (cline.diffStrategy) {
				pushToolResult(
					formatResponse.toolError(
						`Content appears to be truncated (file has ${
							content.split("\n").length
						} lines but was predicted to have ${predictedLineCount} lines), and found comments indicating omitted code. Please provide the complete file content without any omissions, or use the 'file_edit' tool for partial edits.`,
					),
				)
				return
			} else {
				vscode.window
					.showWarningMessage(
						"Potential code truncation detected. This happens when the AI reaches its max output limit.",
						"Follow guide to fix the issue",
					)
					.then((selection) => {
						if (selection === "Follow guide to fix the issue") {
							vscode.env.openExternal(
								vscode.Uri.parse(
									"https://github.com/cline/cline/wiki/Troubleshooting-%E2%80%90-Cline-Deleting-Code-with-%22Rest-of-Code-Here%22-Comments",
								),
							)
						}
					})
			}
		}

		// Prepare complete message for approval
		const completeMessage = JSON.stringify({
			...sharedMessageProps,
			content,
		} satisfies ClineSayTool)

		// Ask for approval (accept/reject flow)
		const didApprove = await askApproval("tool", completeMessage, undefined, isWriteProtected)

		if (!didApprove) {
			// User rejected the operation
			logFileWriteAnalytics(cline, {
				toolName: "file_write",
				operation: fileExists ? "update" : "create",
				filePath: filePath,
				lineCount: content.split("\n").length,
				contentLength: content.length,
				userModified: false,
				error: "user_rejected",
			})
			// Always push a result so the LLM receives a response
			pushToolResult(formatResponse.toolError("User rejected the file write operation."))
			await cline.diffViewProvider.reset()
			return
		}

		// Set up diffViewProvider properties
		cline.diffViewProvider.editType = fileExists ? "modify" : "create"
		cline.diffViewProvider.originalContent = originalContent

		if (isPreventFocusDisruptionEnabled) {
			// Save directly without showing diff view
			await cline.diffViewProvider.saveDirectly(filePath, content, false, diagnosticsEnabled, writeDelayMs)
		} else {
			// Original behavior with diff view
			if (!cline.diffViewProvider.isEditing) {
				const partialMessage = JSON.stringify(sharedMessageProps)
				await cline.ask("tool", partialMessage, true).catch(() => {})
				await cline.diffViewProvider.open(filePath)
			}

			await cline.diffViewProvider.update(
				everyLineHasLineNumbers(content) ? stripLineNumbers(content) : content,
				true,
			)

			await delay(300)
			cline.diffViewProvider.scrollToFirstDiff()

			await cline.diffViewProvider.saveChanges(diagnosticsEnabled, writeDelayMs)
		}

		// Add to file edit review controller so it shows in AcceptRejectButtons
		cline.fileEditReviewController.addEdit({
			relPath: filePath,
			absolutePath,
			originalContent,
			newContent: content,
		})

		// Track file operation
		if (filePath) {
			await cline.fileContextTracker.trackFileContext(filePath, "roo_edited" as RecordSource)
		}

		cline.didEditFile = true

		// Log successful analytics
		logFileWriteAnalytics(cline, {
			toolName: "file_write",
			operation: fileExists ? "update" : "create",
			filePath: filePath,
			lineCount: content.split("\n").length,
			contentLength: content.length,
			userModified: false,
		})

		// Get the formatted response message
		const message = await cline.diffViewProvider.pushToolWriteResult(cline, cline.cwd, !fileExists)

		pushToolResult(message)

		await cline.diffViewProvider.reset()

		// Process any queued messages after file write completes
		cline.processQueuedMessages()

		return
	} catch (error) {
		// Log error analytics
		logFileWriteAnalytics(cline, {
			toolName: "file_write",
			operation: fileExists ? "update" : "create",
			filePath: filePath || "unknown",
			lineCount: content?.split("\n").length || 0,
			contentLength: content?.length || 0,
			error: error instanceof Error ? error.message : String(error),
		})

		await handleError("writing file", error)
		await cline.diffViewProvider.reset()
		return
	}
}
