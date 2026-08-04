import path from "path"
import axios from "axios"

import { Task } from "../task/Task"
import { ClineSayTool } from "../../shared/ExtensionMessage"
import { formatResponse } from "../prompts/responses"
import { ToolUse, AskApproval, HandleError, PushToolResult, RemoveClosingTag } from "../../shared/tools"
import { getReadablePath } from "../../utils/path"
import { isPathOutsideWorkspace } from "../../utils/pathUtils"
import { getKiloUrlFromToken } from "@roo-code/types"

const SUPPORTED_FILE_TYPES = ["pdf", "docx", "pptx", "xlsx"] as const
type SupportedFileType = (typeof SUPPORTED_FILE_TYPES)[number]

const EXTENSION_BY_TYPE: Record<SupportedFileType, string> = {
	pdf: "pdf",
	docx: "docx",
	pptx: "pptx",
	xlsx: "xlsx",
}

const MIME_BY_TYPE: Record<SupportedFileType, string> = {
	pdf: "application/pdf",
	docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
	pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
	xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
}

interface GenerateFileResponse {
	filename: string
	mimeType: string
	data: string // base64-encoded binary
}

function sanitizeFilename(title: string): string {
	const trimmed = title
		.trim()
		.replace(/[\\/:*?"<>|]+/g, "_")
		.replace(/\s+/g, "_")
	return trimmed.length > 0 ? trimmed.slice(0, 120) : "generated_file"
}

function ensureExtension(filename: string, fileType: SupportedFileType): string {
	const expectedExt = EXTENSION_BY_TYPE[fileType]
	if (filename.toLowerCase().endsWith(`.${expectedExt}`)) {
		return filename
	}
	return `${filename}.${expectedExt}`
}

export async function generateFileTool(
	cline: Task,
	block: ToolUse,
	askApproval: AskApproval,
	handleError: HandleError,
	pushToolResult: PushToolResult,
	removeClosingTag: RemoveClosingTag,
) {
	const fileTypeRaw: string | undefined = block.params.file_type
	const title: string | undefined = block.params.title
	const content: string | undefined = block.params.content
	const relPath: string | undefined = block.params.path

	if (block.partial) {
		return
	}

	if (!fileTypeRaw || !SUPPORTED_FILE_TYPES.includes(fileTypeRaw as SupportedFileType)) {
		cline.consecutiveMistakeCount++
		cline.recordToolError("generate_file")
		pushToolResult(
			await cline.sayAndCreateMissingParamError(
				"generate_file",
				`file_type (one of: ${SUPPORTED_FILE_TYPES.join(", ")})`,
			),
		)
		return
	}

	if (!title) {
		cline.consecutiveMistakeCount++
		cline.recordToolError("generate_file")
		pushToolResult(await cline.sayAndCreateMissingParamError("generate_file", "title"))
		return
	}

	if (!content) {
		cline.consecutiveMistakeCount++
		cline.recordToolError("generate_file")
		pushToolResult(await cline.sayAndCreateMissingParamError("generate_file", "content"))
		return
	}

	const fileType = fileTypeRaw as SupportedFileType

	// Derive a display filename from the title (or use the model-supplied path).
	// We do NOT write to disk here — the file is held in memory and only
	// persisted when the user clicks View File or Save File in the chat row.
	const requestedPath = relPath ? removeClosingTag("path", relPath) : sanitizeFilename(title)
	const filename = ensureExtension(requestedPath, fileType)
	const isOutsideWorkspace = isPathOutsideWorkspace(path.resolve(cline.cwd, filename))

	// Validate access permissions (rooignore).
	const accessAllowed = cline.rooIgnoreController?.validateAccess(filename)
	if (!accessAllowed) {
		await cline.say("rooignore_error", filename)
		pushToolResult(formatResponse.toolError(formatResponse.rooIgnoreError(filename)))
		return
	}

	// Check if the file is write-protected.
	const isWriteProtected = cline.rooProtectedController?.isWriteProtected(filename) || false

	try {
		cline.consecutiveMistakeCount = 0

		// Resolve the auth token from provider state.
		const provider = cline.providerRef.deref()
		const state = await provider?.getState()
		const token = state?.apiConfiguration?.kilocodeToken

		if (!token) {
			await cline.say("error", "File generation requires a MatterAI account. Please sign in to generate files.")
			pushToolResult(
				formatResponse.toolError(
					"File generation requires a MatterAI account. Please sign in to generate files.",
				),
			)
			return
		}

		const url = getKiloUrlFromToken("https://api.matterai.so/axoncode/generateFile", token)

		const response = await axios.post<GenerateFileResponse>(
			url,
			{ type: fileType, title, content },
			{
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${token}`,
				},
				timeout: 120_000,
				maxBodyLength: 64 * 1024 * 1024,
				maxContentLength: 64 * 1024 * 1024,
				validateStatus: (status) => status >= 200 && status < 300,
			},
		)

		const payload = response.data
		if (!payload?.data || typeof payload.data !== "string") {
			throw new Error("Backend returned an empty file payload.")
		}

		const buffer = Buffer.from(payload.data, "base64")
		if (buffer.length === 0) {
			throw new Error("Backend returned an empty file.")
		}

		// Record successful tool usage.
		cline.recordToolUsage("generate_file")

		// Send the "did generate" message with the base64 data inlined so the
		// webview can pass it back to the extension when the user clicks
		// View File or Save File. The file is NOT written to disk here —
		// it stays in memory until the user explicitly saves or views it.
		const didGenerateProps: ClineSayTool = {
			tool: "generateFile",
			path: getReadablePath(cline.cwd, filename),
			content: content,
			fileType,
			isOutsideWorkspace,
			isProtected: isWriteProtected,
			mimeType: payload.mimeType || MIME_BY_TYPE[fileType],
			bytes: buffer.length,
			fileData: payload.data,
		}
		await cline.say("tool", JSON.stringify(didGenerateProps))

		pushToolResult(
			formatResponse.toolResult(
				`Generated ${fileType.toUpperCase()} file (${buffer.length} bytes). The file is available in the chat row — click View File to open it or Save File to download it.`,
			),
		)
		return
	} catch (error) {
		await handleError("generating file", error)
		return
	}
}
