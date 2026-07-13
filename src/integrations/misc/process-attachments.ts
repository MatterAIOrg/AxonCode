import * as path from "path"
import * as fs from "fs/promises"
import * as vscode from "vscode"

import type { DocumentAttachment, ImageAttachment } from "../../shared/ExtensionMessage"
import { extractTextFromFile } from "./extract-text"

const MAX_SOURCE_FILE_BYTES = 10 * 1024 * 1024
const MAX_SOURCE_BYTES_TOTAL = 25 * 1024 * 1024
const MAX_EXTRACTED_CHARACTERS_PER_FILE = 200_000
const MAX_EXTRACTED_CHARACTERS_TOTAL = 500_000
const MAX_TEXT_FILE_LINES = 10_000
const MAX_ATTACHMENTS_PER_SELECTION = 20

const IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp"])
const DOCUMENT_EXTENSIONS = new Set([".csv", ".docx", ".json", ".md", ".pdf", ".text", ".txt", ".tsv", ".xlsx"])

export interface SelectedAttachments {
	images: ImageAttachment[]
	documents: DocumentAttachment[]
	errors: string[]
}

export async function selectAttachments(): Promise<SelectedAttachments> {
	const fileUris = await vscode.window.showOpenDialog({
		canSelectMany: true,
		canSelectFolders: false,
		openLabel: "Attach",
		filters: {
			"Supported files": [
				"png",
				"jpg",
				"jpeg",
				"webp",
				"csv",
				"xlsx",
				"docx",
				"txt",
				"text",
				"md",
				"pdf",
				"json",
				"tsv",
			],
			Images: ["png", "jpg", "jpeg", "webp"],
			Documents: ["csv", "xlsx", "docx", "txt", "text", "md", "pdf", "json", "tsv"],
		},
	})

	if (!fileUris?.length) {
		return { images: [], documents: [], errors: [] }
	}

	const result: SelectedAttachments = { images: [], documents: [], errors: [] }
	let totalExtractedCharacters = 0
	let totalSourceBytes = 0
	if (fileUris.length > MAX_ATTACHMENTS_PER_SELECTION) {
		result.errors.push(`Only the first ${MAX_ATTACHMENTS_PER_SELECTION} selected files were processed`)
	}

	// Process sequentially so several compressed documents cannot cause simultaneous memory spikes.
	for (const uri of fileUris.slice(0, MAX_ATTACHMENTS_PER_SELECTION)) {
		const filePath = uri.fsPath
		const name = path.basename(filePath)
		const extension = path.extname(filePath).toLowerCase()

		try {
			if (!IMAGE_EXTENSIONS.has(extension) && !DOCUMENT_EXTENSIONS.has(extension)) {
				throw new Error(`Unsupported file type ${extension || "(none)"}`)
			}

			const stat = await fs.stat(filePath)
			if (!stat.isFile()) {
				throw new Error("Only files can be attached")
			}
			if (stat.size > MAX_SOURCE_FILE_BYTES) {
				throw new Error("File is larger than the 10 MB attachment limit")
			}
			if (totalSourceBytes + stat.size > MAX_SOURCE_BYTES_TOTAL) {
				throw new Error("The 25 MB total attachment limit has been reached")
			}
			totalSourceBytes += stat.size

			if (IMAGE_EXTENSIONS.has(extension)) {
				const buffer = await fs.readFile(filePath)
				result.images.push({
					dataUrl: `data:${getImageMimeType(extension)};base64,${buffer.toString("base64")}`,
					name,
				})
				continue
			}

			const extracted = await extractTextFromFile(filePath, MAX_TEXT_FILE_LINES)
			if (!extracted.trim()) {
				throw new Error("No extractable text was found")
			}
			const remainingCharacters = MAX_EXTRACTED_CHARACTERS_TOTAL - totalExtractedCharacters
			if (remainingCharacters <= 0) {
				throw new Error("The 500,000 character attachment limit has been reached")
			}

			const characterLimit = Math.min(MAX_EXTRACTED_CHARACTERS_PER_FILE, remainingCharacters)
			const text = truncateExtractedText(extracted, characterLimit)
			result.documents.push({ name, text, truncated: text.length < extracted.length })
			totalExtractedCharacters += text.length
		} catch (error) {
			result.errors.push(`${name}: ${error instanceof Error ? error.message : String(error)}`)
		}
	}

	return result
}

function truncateExtractedText(text: string, limit: number): string {
	if (text.length <= limit) {
		return text
	}

	const marker = "\n[...attachment content truncated...]\n"
	if (limit <= marker.length) {
		return text.slice(0, limit)
	}
	const contentLimit = Math.max(0, limit - marker.length)
	const startLength = Math.floor(contentLimit * 0.2)
	const endLength = contentLimit - startLength
	return text.slice(0, startLength) + marker + text.slice(text.length - endLength)
}

function getImageMimeType(extension: string): string {
	if (extension === ".jpg" || extension === ".jpeg") {
		return "image/jpeg"
	}
	if (extension === ".png") {
		return "image/png"
	}
	return "image/webp"
}
