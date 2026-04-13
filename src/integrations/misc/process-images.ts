import * as vscode from "vscode"
import fs from "fs/promises"
import * as path from "path"

export interface ImageAttachment {
	dataUrl: string
	name: string
}

export async function selectImages(): Promise<ImageAttachment[]> {
	const options: vscode.OpenDialogOptions = {
		canSelectMany: true,
		openLabel: "Select",
		filters: {
			Images: ["png", "jpg", "jpeg", "webp"], // supported by anthropic and openrouter
		},
	}

	const fileUris = await vscode.window.showOpenDialog(options)

	if (!fileUris || fileUris.length === 0) {
		return []
	}

	return await Promise.all(
		fileUris.map(async (uri) => {
			const imagePath = uri.fsPath
			const buffer = await fs.readFile(imagePath)
			const base64 = buffer.toString("base64")
			const mimeType = getMimeType(imagePath)
			const dataUrl = `data:${mimeType};base64,${base64}`
			const name = path.basename(imagePath)
			return { dataUrl, name }
		}),
	)
}

function getMimeType(filePath: string): string {
	const ext = path.extname(filePath).toLowerCase()
	switch (ext) {
		case ".png":
			return "image/png"
		case ".jpeg":
		case ".jpg":
			return "image/jpeg"
		case ".webp":
			return "image/webp"
		default:
			throw new Error(`Unsupported file type: ${ext}`)
	}
}
