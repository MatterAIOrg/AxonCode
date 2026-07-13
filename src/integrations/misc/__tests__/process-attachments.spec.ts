import * as fs from "fs/promises"
import * as os from "os"
import * as path from "path"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
	showOpenDialog: vi.fn(),
	extractTextFromFile: vi.fn(),
}))

vi.mock("vscode", () => ({
	window: { showOpenDialog: mocks.showOpenDialog },
}))

vi.mock("../extract-text", async () => {
	const actual = await vi.importActual<typeof import("../extract-text")>("../extract-text")
	return { ...actual, extractTextFromFile: mocks.extractTextFromFile }
})

import { selectAttachments } from "../process-attachments"

describe("selectAttachments", () => {
	let tempDirectory: string

	beforeEach(async () => {
		tempDirectory = await fs.mkdtemp(path.join(os.tmpdir(), "attachments-"))
		mocks.showOpenDialog.mockReset()
		mocks.extractTextFromFile.mockReset()
	})

	afterEach(async () => {
		await fs.rm(tempDirectory, { recursive: true, force: true })
	})

	it("returns parsed documents and encoded images from a mixed selection", async () => {
		const documentPath = path.join(tempDirectory, "data.csv")
		const imagePath = path.join(tempDirectory, "photo.png")
		await fs.writeFile(documentPath, "name,value\nalpha,1")
		await fs.writeFile(imagePath, Buffer.from("image bytes"))
		mocks.showOpenDialog.mockResolvedValue([{ fsPath: documentPath }, { fsPath: imagePath }])
		mocks.extractTextFromFile.mockResolvedValue("     1→name,value\n     2→alpha,1\n")

		const result = await selectAttachments()

		expect(mocks.extractTextFromFile).toHaveBeenCalledWith(documentPath, 10_000)
		expect(result.documents).toEqual([
			{
				name: "data.csv",
				text: "     1→name,value\n     2→alpha,1\n",
				truncated: false,
			},
		])
		expect(result.images).toEqual([
			{
				name: "photo.png",
				dataUrl: `data:image/png;base64,${Buffer.from("image bytes").toString("base64")}`,
			},
		])
		expect(result.errors).toEqual([])
	})

	it("caps extracted document text and marks it as truncated", async () => {
		const documentPath = path.join(tempDirectory, "large.pdf")
		await fs.writeFile(documentPath, "small source")
		mocks.showOpenDialog.mockResolvedValue([{ fsPath: documentPath }])
		mocks.extractTextFromFile.mockResolvedValue("x".repeat(250_000))

		const result = await selectAttachments()

		expect(result.documents[0]?.text.length).toBeLessThanOrEqual(200_000)
		expect(result.documents[0]?.truncated).toBe(true)
	})

	it("rejects oversized and unsupported files without dropping valid attachments", async () => {
		const validPath = path.join(tempDirectory, "notes.txt")
		const oversizedPath = path.join(tempDirectory, "large.docx")
		const unsupportedPath = path.join(tempDirectory, "archive.zip")
		await fs.writeFile(validPath, "valid")
		await fs.writeFile(unsupportedPath, "zip")
		const oversizedFile = await fs.open(oversizedPath, "w")
		await oversizedFile.truncate(10 * 1024 * 1024 + 1)
		await oversizedFile.close()
		mocks.showOpenDialog.mockResolvedValue([
			{ fsPath: oversizedPath },
			{ fsPath: unsupportedPath },
			{ fsPath: validPath },
		])
		mocks.extractTextFromFile.mockResolvedValue("valid text")

		const result = await selectAttachments()

		expect(result.documents).toHaveLength(1)
		expect(result.documents[0]?.name).toBe("notes.txt")
		expect(result.errors).toEqual([
			"large.docx: File is larger than the 10 MB attachment limit",
			"archive.zip: Unsupported file type .zip",
		])
	})

	it("returns an empty result when the picker is cancelled", async () => {
		mocks.showOpenDialog.mockResolvedValue(undefined)

		await expect(selectAttachments()).resolves.toEqual({ images: [], documents: [], errors: [] })
	})
})
