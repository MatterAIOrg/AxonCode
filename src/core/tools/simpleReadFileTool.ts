import path from "path"
import { isBinaryFile } from "isbinaryfile"

import { Task } from "../task/Task"
import { ClineSayTool } from "../../shared/ExtensionMessage"
import { formatResponse } from "../prompts/responses"
import { t } from "../../i18n"
import { ToolUse, AskApproval, HandleError, PushToolResult, RemoveClosingTag } from "../../shared/tools"
import { RecordSource } from "../context-tracking/FileContextTrackerTypes"
import { isPathOutsideWorkspace } from "../../utils/pathUtils"
import { getReadablePath } from "../../utils/path"
import { countFileLines } from "../../integrations/misc/line-counter"
import { readLines } from "../../integrations/misc/read-lines"
import { extractTextFromFile, addLineNumbers, getSupportedBinaryFormats } from "../../integrations/misc/extract-text"
import { parseSourceCodeDefinitionsForFile } from "../../services/tree-sitter"
import {
	DEFAULT_MAX_IMAGE_FILE_SIZE_MB,
	DEFAULT_MAX_TOTAL_IMAGE_SIZE_MB,
	isSupportedImageFormat,
	validateImageForProcessing,
	processImageFile,
} from "./helpers/imageHelpers"

/**
 * Simplified read file tool for models that only support single file reads
 * Uses the format: <read_file><path>file/path.ext</path></read_file>
 *
 * This is a streamlined version of readFileTool that:
 * - Only accepts a single path parameter
 * - Does not support multiple files
 * - Does not support line ranges
 * - Has simpler XML parsing
 */
export async function simpleReadFileTool(
	cline: Task,
	block: ToolUse,
	askApproval: AskApproval,
	handleError: HandleError,
	pushToolResult: PushToolResult,
	_removeClosingTag: RemoveClosingTag,
) {
	// Support both file_path (new) and path (legacy)
	const filePath: string | undefined = (block.params as any).file_path || block.params.path

	// Check if the current model supports images
	const modelInfo = cline.api.getModel().info
	const supportsImages = modelInfo.supportsImages ?? false

	// Handle partial message
	if (block.partial) {
		// Support absolute paths using cross-platform check
		const fullPath = filePath ? (path.isAbsolute(filePath) ? filePath : path.resolve(cline.cwd, filePath)) : ""
		const sharedMessageProps: ClineSayTool = {
			tool: "readFile",
			path: getReadablePath(cline.cwd, filePath || ""),
			isOutsideWorkspace: filePath ? isPathOutsideWorkspace(fullPath) : false,
		}
		const partialMessage = JSON.stringify({
			...sharedMessageProps,
			content: undefined,
		} satisfies ClineSayTool)
		await cline.ask("tool", partialMessage, block.partial).catch(() => {})
		return
	}

	// Validate path parameter
	if (!filePath) {
		cline.consecutiveMistakeCount++
		cline.recordToolError("read_file")
		const errorMsg = await cline.sayAndCreateMissingParamError("read_file", "file_path")
		pushToolResult(`--- read_file ---\n[error] ${errorMsg}`)
		return
	}

	const relPath = filePath
	// Support absolute paths using cross-platform check
	const fullPath = path.isAbsolute(relPath) ? relPath : path.resolve(cline.cwd, relPath)

	try {
		// Check RooIgnore validation
		const accessAllowed = cline.rooIgnoreController?.validateAccess(relPath)
		if (!accessAllowed) {
			await cline.say("rooignore_error", relPath)
			const errorMsg = formatResponse.rooIgnoreError(relPath)
			pushToolResult(`<file><path>${relPath}</path><error>${errorMsg}</error></file>`)
			return
		}

		// Get max read file line setting
		const { maxReadFileLine = -1 } = (await cline.providerRef.deref()?.getState()) ?? {}

		// Create approval message
		const isOutsideWorkspace = isPathOutsideWorkspace(fullPath)
		let lineSnippet = ""
		if (maxReadFileLine === 0) {
			lineSnippet = t("tools:readFile.definitionsOnly")
		} else if (maxReadFileLine > 0) {
			lineSnippet = t("tools:readFile.maxLines", { max: maxReadFileLine })
		}

		const completeMessage = JSON.stringify({
			tool: "readFile",
			path: getReadablePath(cline.cwd, relPath),
			isOutsideWorkspace,
			content: fullPath,
			reason: lineSnippet,
		} satisfies ClineSayTool)

		// kilocode_change: Auto-approve read_file - show in UI and immediately approve
		// Use setImmediate to trigger approval AFTER ask starts waiting for response
		setImmediate(() => {
			cline.handleWebviewAskResponse("yesButtonClicked", undefined, undefined)
		})
		await cline.ask("tool", completeMessage, false)

		// Process the file
		const [totalLines, isBinary] = await Promise.all([countFileLines(fullPath), isBinaryFile(fullPath)])

		// Handle binary files
		if (isBinary) {
			const fileExtension = path.extname(relPath).toLowerCase()
			const supportedBinaryFormats = getSupportedBinaryFormats()

			// Check if it's a supported image format
			if (isSupportedImageFormat(fileExtension)) {
				try {
					const {
						maxImageFileSize = DEFAULT_MAX_IMAGE_FILE_SIZE_MB,
						maxTotalImageSize = DEFAULT_MAX_TOTAL_IMAGE_SIZE_MB,
					} = (await cline.providerRef.deref()?.getState()) ?? {}

					// Validate image for processing
					const validationResult = await validateImageForProcessing(
						fullPath,
						supportsImages,
						maxImageFileSize,
						maxTotalImageSize,
						0, // No cumulative memory for single file
					)

					if (!validationResult.isValid) {
						await cline.fileContextTracker.trackFileContext(relPath, "read_tool" as RecordSource)
						pushToolResult(
							`<file><path>${relPath}</path>\n<notice>${validationResult.notice}</notice>\n</file>`,
						)
						return
					}

					// Process the image
					const imageResult = await processImageFile(fullPath)
					await cline.fileContextTracker.trackFileContext(relPath, "read_tool" as RecordSource)

					// Return result with image data
					const result = formatResponse.toolResult(
						`<file><path>${relPath}</path>\n<notice>${imageResult.notice}</notice>\n</file>`,
						supportsImages ? [imageResult.dataUrl] : undefined,
					)

					if (typeof result === "string") {
						pushToolResult(result)
					} else {
						pushToolResult(result)
					}
					return
				} catch (error) {
					const errorMsg = error instanceof Error ? error.message : String(error)
					pushToolResult(
						`<file><path>${relPath}</path><error>Error reading image file: ${errorMsg}</error></file>`,
					)
					await handleError(
						`reading image file ${relPath}`,
						error instanceof Error ? error : new Error(errorMsg),
					)
					return
				}
			}

			// Check if it's a supported binary format that can be processed
			if (supportedBinaryFormats && supportedBinaryFormats.includes(fileExtension)) {
				// For supported binary formats (.pdf, .docx, .ipynb), continue to extractTextFromFile
				// Fall through to the normal extractTextFromFile processing below
			} else {
				// Handle unknown binary format
				const fileFormat = fileExtension.slice(1) || "bin"
				pushToolResult(
					`<file><path>${relPath}</path>\n<binary_file format="${fileFormat}">Binary file - content not displayed</binary_file>\n</file>`,
				)
				return
			}
		}

		// Handle definitions-only mode
		if (maxReadFileLine === 0) {
			try {
				const defResult = await parseSourceCodeDefinitionsForFile(fullPath, cline.rooIgnoreController)
				if (defResult) {
					// kilocode_change: Return raw definitions without XML
					pushToolResult(`[definitions only]\n${defResult}`)
				}
			} catch (error) {
				if (error instanceof Error && error.message.startsWith("Unsupported language:")) {
					console.warn(`[simple_read_file] Warning: ${error.message}`)
				} else {
					console.error(
						`[simple_read_file] Unhandled error: ${error instanceof Error ? error.message : String(error)}`,
					)
				}
			}
			return
		}

		// Handle files exceeding line threshold
		if (maxReadFileLine > 0 && totalLines > maxReadFileLine) {
			const content = addLineNumbers(await readLines(fullPath, maxReadFileLine - 1, 0))
			// kilocode_change: Return raw content without XML
			let output = `[showing ${maxReadFileLine} of ${totalLines} lines]\n${content}`

			try {
				const defResult = await parseSourceCodeDefinitionsForFile(fullPath, cline.rooIgnoreController)
				if (defResult) {
					output += `\n[definitions]\n${defResult}`
				}
				pushToolResult(output)
			} catch (error) {
				if (error instanceof Error && error.message.startsWith("Unsupported language:")) {
					console.warn(`[simple_read_file] Warning: ${error.message}`)
				} else {
					console.error(
						`[simple_read_file] Unhandled error: ${error instanceof Error ? error.message : String(error)}`,
					)
				}
			}
			return
		}

		// Handle normal file read
		const content = await extractTextFromFile(fullPath)

		// Track file read
		await cline.fileContextTracker.trackFileContext(relPath, "read_tool" as RecordSource)

		// kilocode_change: Return raw content without XML wrapping
		if (totalLines === 0) {
			pushToolResult(`(empty file: ${relPath})`)
		} else {
			pushToolResult(content)
		}
	} catch (error) {
		const errorMsg = error instanceof Error ? error.message : String(error)
		pushToolResult(`[error] Error reading file ${relPath}: ${errorMsg}`)
		await handleError(`reading file ${relPath}`, error instanceof Error ? error : new Error(errorMsg))
	}
}

/**
 * Get description for the simple read file tool
 * @param blockName The name of the tool block
 * @param blockParams The parameters passed to the tool
 * @returns A description string for the tool use
 */
export function getSimpleReadFileToolDescription(blockName: string, blockParams: any): string {
	if (blockParams.path) {
		return `[${blockName} for '${blockParams.path}']`
	} else {
		return `[${blockName} with missing path]`
	}
}
