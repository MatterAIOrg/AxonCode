import * as vscode from "vscode"
import { promises as fs } from "fs"
import * as path from "path"

import { getReadablePath } from "../../utils/path"
import { myersDiff } from "../../services/continuedev/core/diff/myers"
import { reportAcceptedLineMetrics } from "../../services/usage-metrics/usageMetrics"
import { computeDifferenceLineNumbers, findAdjacentChangeLine } from "./fileEditReviewNavigation"

type PendingFileEdit = {
	relPath: string
	readablePath: string
	absolutePath: string
	originalContent: string
	diffAnchor: vscode.Range
	edits: Array<{
		originalContent: string
		newContent: string
		diffAnchor: vscode.Range
	}>
}

const highlightDecorationType = vscode.window.createTextEditorDecorationType({
	isWholeLine: true,
	backgroundColor: new vscode.ThemeColor("diffEditor.insertedLineBackground"),
})

const ACCEPT_COMMAND = "axon-code.fileEdit.accept"
const ACCEPT_ALL_COMMAND = "axon-code.fileEdit.acceptAll"
const REJECT_COMMAND = "axon-code.fileEdit.reject"
const REJECT_ALL_COMMAND = "axon-code.fileEdit.rejectAll"
const NEXT_COMMAND = "axon-code.fileEdit.reviewNext"
const PREV_COMMAND = "axon-code.fileEdit.reviewPrev"

export class FileEditReviewController implements vscode.Disposable {
	private readonly disposables: vscode.Disposable[] = []
	private pendingEdits = new Map<string, PendingFileEdit>()
	private reviewQueue: string[] = []
	private currentReviewIndex: number = 0
	private readonly codeLensEmitter = new vscode.EventEmitter<void>()
	private readonly codeLensProvider: FileEditReviewCodeLensProvider
	private _taskId: string | undefined
	private _getToken: (() => Promise<string | undefined>) | undefined
	private _getRepo: (() => Promise<string | undefined>) | undefined
	private _getModel: (() => string | undefined) | undefined

	private static readonly controllers = new Map<string, FileEditReviewController>()
	private static commandsRegistered = false

	private static getActiveController(): FileEditReviewController | undefined {
		for (const controller of FileEditReviewController.controllers.values()) {
			if (controller.reviewQueue.length > 0) {
				return controller
			}
		}
		const controllers = Array.from(FileEditReviewController.controllers.values())
		return controllers[controllers.length - 1]
	}

	constructor(
		private cwd: string,
		getToken?: () => Promise<string | undefined>,
		getRepo?: () => Promise<string | undefined>,
		getModel?: () => string | undefined,
	) {
		this._getToken = getToken
		this._getRepo = getRepo
		this._getModel = getModel
		// Old UI (comment thread actions) — kept for reference.
		//
		// this.commentController = vscode.comments.createCommentController("axon-code.review", "Orbital Review")
		// this.commentController.commentingRangeProvider = {
		// 	provideCommentingRanges: () => [], // Disable manual commenting
		// }

		this.codeLensProvider = new FileEditReviewCodeLensProvider(
			this.cwd,
			() => this.pendingEdits,
			this.codeLensEmitter.event,
			() => this._taskId,
		)

		this.disposables.push(
			this.codeLensEmitter,
			vscode.languages.registerCodeLensProvider({ scheme: "file" }, this.codeLensProvider),
			vscode.window.onDidChangeActiveTextEditor(() => this.refreshDecorations()),
			vscode.window.onDidChangeVisibleTextEditors(() => this.refreshDecorations()),
			vscode.workspace.onDidCloseTextDocument((doc) => this.handleDocumentClosed(doc)),
		)

		if (!FileEditReviewController.commandsRegistered) {
			vscode.commands.registerCommand(ACCEPT_COMMAND, (...args: any[]) => {
				const taskId = args[2]?.taskId
				const controller = taskId
					? FileEditReviewController.controllers.get(taskId)
					: FileEditReviewController.getActiveController()
				return controller?.handleAccept(args[0], args[1], args[2])
			})
			vscode.commands.registerCommand(ACCEPT_ALL_COMMAND, (taskId?: string) => {
				const controller = taskId
					? FileEditReviewController.controllers.get(taskId)
					: FileEditReviewController.getActiveController()
				return controller?.handleAcceptAll()
			})
			vscode.commands.registerCommand(REJECT_COMMAND, (arg?: any, index?: number, taskId?: string) => {
				const controller = taskId
					? FileEditReviewController.controllers.get(taskId)
					: FileEditReviewController.getActiveController()
				return controller?.handleReject(arg, index)
			})
			vscode.commands.registerCommand(REJECT_ALL_COMMAND, (taskId?: string) => {
				const controller = taskId
					? FileEditReviewController.controllers.get(taskId)
					: FileEditReviewController.getActiveController()
				return controller?.handleRejectAll()
			})
			vscode.commands.registerCommand(NEXT_COMMAND, (taskId?: string, navigateChanges = false) => {
				const controller = taskId
					? FileEditReviewController.controllers.get(taskId)
					: FileEditReviewController.getActiveController()
				return navigateChanges ? controller?.handleReviewNextChange() : controller?.handleReviewNext()
			})
			vscode.commands.registerCommand(PREV_COMMAND, (taskId?: string, navigateChanges = false) => {
				const controller = taskId
					? FileEditReviewController.controllers.get(taskId)
					: FileEditReviewController.getActiveController()
				return navigateChanges ? controller?.handleReviewPrevChange() : controller?.handleReviewPrev()
			})
			vscode.commands.registerCommand("axon-code.fileEdit.deletedLine", () => {}) // no-op command so VS Code doesn't strip it

			FileEditReviewController.commandsRegistered = true
		}
	}

	private updateContext() {
		const totalFiles = this.reviewQueue.length
		vscode.commands.executeCommand("setContext", "axon.fileEdit.pendingCount", totalFiles)

		if (totalFiles > 0) {
			// Ensure current index is valid
			if (this.currentReviewIndex >= totalFiles) {
				this.currentReviewIndex = 0
			}

			const currentFile = this.reviewQueue[this.currentReviewIndex]
			const safeIndex = this.currentReviewIndex

			vscode.commands.executeCommand("setContext", "axon.fileEdit.hasPendingEdits", true)
			vscode.commands.executeCommand("setContext", "axon.fileEdit.currentIndex", safeIndex)
		} else {
			vscode.commands.executeCommand("setContext", "axon.fileEdit.hasPendingEdits", false)
			vscode.commands.executeCommand("setContext", "axon.fileEdit.currentIndex", 0)
		}
	}

	addEdit(params: { relPath: string; absolutePath: string; originalContent: string; newContent: string }) {
		const readablePath = getReadablePath(this.cwd, params.relPath)
		const diffAnchor = computeFirstDifferenceRange(params.originalContent, params.newContent)

		// Old UI (comment thread actions) — kept for reference.
		//
		// let entry = this.pendingEdits.get(readablePath)
		// if (entry && entry.thread) {
		// 	entry.thread.dispose()
		// }
		//
		// const uri = vscode.Uri.file(params.absolutePath)
		// const thread = this.commentController.createCommentThread(uri, diffAnchor, [])
		// thread.canReply = false
		// thread.collapsibleState = vscode.CommentThreadCollapsibleState.Expanded
		// thread.label = "Orbital"
		//
		// // We don't necessarily need a comment body if the title actions are enough,
		// // but a body explains what's happening.
		// thread.comments = [
		// 	{
		// 		author: { name: "Review Changes" },
		// 		body: "",
		// 		mode: vscode.CommentMode.Preview,
		// 	},
		// ]

		const edit = {
			originalContent: params.originalContent,
			newContent: params.newContent,
			diffAnchor,
		}

		const existingEntry = this.pendingEdits.get(readablePath)
		if (existingEntry) {
			// Add to existing edits array
			existingEntry.edits.push(edit)
			// Update the main diff anchor to the first edit for consistency
			if (existingEntry.edits.length === 1) {
				existingEntry.diffAnchor = edit.diffAnchor
			}
		} else {
			// Create new entry
			const pending: PendingFileEdit = {
				relPath: params.relPath,
				readablePath,
				absolutePath: params.absolutePath,
				originalContent: params.originalContent,
				diffAnchor,
				edits: [edit],
			}
			this.pendingEdits.set(readablePath, pending)
			// Ensure unique queue items
			if (!this.reviewQueue.includes(readablePath)) {
				this.reviewQueue.push(readablePath)
			}
		}

		this.refreshDecorations()
		this.updateContext()
		this.codeLensEmitter.fire()
	}

	// Public getter for pendingEdits to allow webview access
	getPendingEdits() {
		return this.pendingEdits
	}

	// Set the task ID for metrics reporting
	setTaskId(taskId: string) {
		if (this._taskId) {
			FileEditReviewController.controllers.delete(this._taskId)
		}
		this._taskId = taskId
		FileEditReviewController.controllers.set(taskId, this)
		this.codeLensEmitter.fire() // Refresh CodeLenses to pick up new taskId
	}

	// Get the current task ID
	getTaskId(): string | undefined {
		return this._taskId
	}

	/**
	 * Export pending edits data for transfer to another task.
	 * This is used when a task is cancelled and rehydrated to preserve pending edits.
	 */
	exportPendingEdits(): Array<{
		relPath: string
		absolutePath: string
		originalContent: string
		edits: Array<{
			originalContent: string
			newContent: string
		}>
	}> {
		const exported: Array<{
			relPath: string
			absolutePath: string
			originalContent: string
			edits: Array<{
				originalContent: string
				newContent: string
			}>
		}> = []

		for (const entry of this.pendingEdits.values()) {
			exported.push({
				relPath: entry.relPath,
				absolutePath: entry.absolutePath,
				originalContent: entry.originalContent,
				edits: entry.edits.map((e) => ({
					originalContent: e.originalContent,
					newContent: e.newContent,
				})),
			})
		}

		return exported
	}

	/**
	 * Import pending edits from another task.
	 * This is used to restore pending edits after a task is rehydrated.
	 */
	importPendingEdits(
		editsData: Array<{
			relPath: string
			absolutePath: string
			originalContent: string
			edits: Array<{
				originalContent: string
				newContent: string
			}>
		}>,
	): void {
		for (const data of editsData) {
			// Re-add each edit using the addEdit method to properly set up decorations
			for (const edit of data.edits) {
				this.addEdit({
					relPath: data.relPath,
					absolutePath: data.absolutePath,
					originalContent: edit.originalContent,
					newContent: edit.newContent,
				})
			}
		}
	}

	async handleAccept(
		arg?: any,
		index?: number,
		editData?: {
			originalContent?: string
			newContent?: string
			filePath?: string
			taskId?: string
		},
	) {
		// Arg can be a CommentThread if triggered from menu, or relPath if triggered programmatically
		let entry: PendingFileEdit | undefined

		if (arg && (arg as vscode.CommentThread).uri) {
			const thread = arg as vscode.CommentThread
			const readablePath = getReadablePath(this.cwd, path.relative(this.cwd, thread.uri.fsPath))
			entry = this.pendingEdits.get(readablePath)
		} else if (typeof arg === "string") {
			const readablePath = getReadablePath(this.cwd, arg)
			entry = this.pendingEdits.get(readablePath)
		} else {
			// Fallback: active editor
			const activeEditor = vscode.window.activeTextEditor
			if (activeEditor) {
				const readablePath = getReadablePath(
					this.cwd,
					path.relative(this.cwd, activeEditor.document.uri.fsPath),
				)
				entry = this.pendingEdits.get(readablePath)
			}
		}

		if (!entry) {
			console.log("[FileEditReviewController] No entry found, returning")
			return
		}

		// Report metrics for single edit acceptance
		if (editData?.originalContent !== undefined && editData?.newContent !== undefined && editData?.filePath) {
			this.reportEditMetrics({
				originalContent: editData.originalContent,
				newContent: editData.newContent,
				filePath: editData.filePath,
				taskId: editData.taskId,
			}).catch((err) => {
				console.error("[FileEditReviewController] Failed to report edit metrics:", err)
			})
		} else {
			console.log("[FileEditReviewController] Skipping metrics - missing editData")
		}

		if (typeof index === "number" && index >= 0 && index < entry.edits.length) {
			entry.edits.splice(index, 1)
			if (entry.edits.length === 0) {
				this.clearEntry(entry)
			}
			this.refreshDecorations()
			this.codeLensEmitter.fire()
		} else {
			// Accept means we keep the changes. Just clean up all edits for this file.
			this.clearEntry(entry)
			this.refreshDecorations()

			// If we just accepted the current file, try to go to the next one
			if (this.reviewQueue.length > 0) {
				// Optional: auto-advance behavior?
				// this.handleReviewNext()
			}
		}
	}

	/**
	 * Report edit metrics to the MatterAI API
	 */
	private async reportEditMetrics(editData: {
		originalContent: string
		newContent: string
		filePath: string
		taskId?: string
	}): Promise<void> {
		// Calculate line changes using myers diff
		const diffLines = myersDiff(editData.originalContent, editData.newContent)
		let linesAdded = 0
		let linesDeleted = 0
		for (const diffLine of diffLines) {
			if (diffLine.type === "new") {
				linesAdded++
			} else if (diffLine.type === "old") {
				linesDeleted++
			}
		}

		await this.reportLineMetrics({
			filePath: editData.filePath,
			linesAdded,
			linesUpdated: 0,
			linesDeleted,
			taskId: editData.taskId,
		})
	}

	private async reportLineMetrics(metrics: {
		filePath: string
		linesAdded: number
		linesUpdated: number
		linesDeleted: number
		taskId?: string
	}): Promise<void> {
		if (metrics.linesAdded === 0 && metrics.linesUpdated === 0 && metrics.linesDeleted === 0) {
			console.log("[FileEditReviewController] No changes detected, skipping")
			return
		}

		const kilocodeToken = await this._getToken?.()
		if (!kilocodeToken) {
			console.log("[FileEditReviewController] No kilocodeToken available, skipping metrics reporting")
			return
		}

		const taskId = metrics.taskId || this._taskId
		if (!taskId) {
			console.log("[FileEditReviewController] No taskId available, skipping metrics reporting")
			return
		}

		const ext = path.extname(metrics.filePath).toLowerCase()
		const languageMap: Record<string, string> = {
			".ts": "ts",
			".tsx": "tsx",
			".js": "js",
			".jsx": "jsx",
			".py": "py",
			".java": "java",
			".go": "go",
			".rs": "rs",
			".cpp": "cpp",
			".c": "c",
			".cs": "cs",
			".php": "php",
			".rb": "rb",
			".swift": "swift",
			".kt": "kt",
			".dart": "dart",
			".vue": "vue",
			".svelte": "svelte",
		}
		const language = languageMap[ext] || "ts"

		// Get repo info
		const repo = (await this._getRepo?.()) || path.basename(this.cwd)

		await reportAcceptedLineMetrics(kilocodeToken, {
			taskId,
			model: this._getModel?.(),
			repo,
			language,
			linesAdded: metrics.linesAdded,
			linesModified: metrics.linesUpdated,
			linesDeleted: metrics.linesDeleted,
		})
	}

	async handleReject(arg?: any, index?: number) {
		let entry: PendingFileEdit | undefined

		if (arg && (arg as vscode.CommentThread).uri) {
			const thread = arg as vscode.CommentThread
			const readablePath = getReadablePath(this.cwd, path.relative(this.cwd, thread.uri.fsPath))
			entry = this.pendingEdits.get(readablePath)
		} else if (typeof arg === "string") {
			const readablePath = getReadablePath(this.cwd, arg)
			entry = this.pendingEdits.get(readablePath)
		} else {
			// Fallback: active editor
			const activeEditor = vscode.window.activeTextEditor
			if (activeEditor) {
				const readablePath = getReadablePath(
					this.cwd,
					path.relative(this.cwd, activeEditor.document.uri.fsPath),
				)
				entry = this.pendingEdits.get(readablePath)
			}
		}

		if (!entry) {
			return
		}

		if (typeof index === "number" && index >= 0 && index < entry.edits.length) {
			const edit = entry.edits[index]
			// Restore the original content for this particular edit
			// Since we don't have a reliable way of isolating patch applications,
			// writing the originalContent of the edit will revert to before THIS edit.
			// (Note: this effectively undoes subsequent edits too, as we revert the whole document
			// to the state before this edit, but it is necessary for correctly rejecting).
			await fs.writeFile(entry.absolutePath, edit.originalContent, "utf-8")

			entry.edits.splice(index)
			if (entry.edits.length === 0) {
				this.clearEntry(entry)
			}
			this.refreshDecorations()
			this.codeLensEmitter.fire()
		} else {
			// Reject means we restore the original content (first edit's original content)
			await fs.writeFile(entry.absolutePath, entry.originalContent, "utf-8")
			// Force reload/save not strictly needed as file watcher handles it,
			// but ensures editor updates

			this.clearEntry(entry)
			this.refreshDecorations()

			if (this.reviewQueue.length > 0) {
				// Optional: auto-advance
			}
		}
	}

	async handleAcceptAll(): Promise<{ linesAdded: number; linesUpdated: number; linesDeleted: number } | undefined> {
		if (this.pendingEdits.size === 0) return undefined

		// Calculate line counters before clearing
		let linesAdded = 0
		let linesUpdated = 0
		let linesDeleted = 0
		const firstEditedFile = this.pendingEdits.values().next().value?.absolutePath

		for (const edit of this.pendingEdits.values()) {
			for (const editEntry of edit.edits) {
				const beforeContent = editEntry.originalContent || ""
				const afterContent = editEntry.newContent || ""

				// Use proper diff algorithm to calculate changes
				const diffLines = myersDiff(beforeContent, afterContent)

				for (const diffLine of diffLines) {
					if (diffLine.type === "new") {
						linesAdded++
					} else if (diffLine.type === "old") {
						linesDeleted++
					}
				}
			}
		}

		this.pendingEdits.clear()
		this.reviewQueue = []
		this.currentReviewIndex = 0
		this.refreshDecorations()
		this.updateContext()
		this.codeLensEmitter.fire()

		if (firstEditedFile) {
			await this.reportLineMetrics({
				filePath: firstEditedFile,
				linesAdded,
				linesUpdated,
				linesDeleted,
			})
		}

		return { linesAdded, linesUpdated, linesDeleted }
	}

	async handleRejectAll() {
		if (this.pendingEdits.size === 0) return

		// Reject all edits by restoring original content for each file
		for (const entry of this.pendingEdits.values()) {
			await fs.writeFile(entry.absolutePath, entry.originalContent, "utf-8")
		}

		this.pendingEdits.clear()
		this.reviewQueue = []
		this.currentReviewIndex = 0
		this.refreshDecorations()
		this.updateContext()
		this.codeLensEmitter.fire()
	}

	async handleReviewNext() {
		if (this.reviewQueue.length === 0) {
			vscode.window.showInformationMessage("No more pending file reviews.")
			return
		}

		this.currentReviewIndex = (this.currentReviewIndex + 1) % this.reviewQueue.length
		const readablePath = this.reviewQueue[this.currentReviewIndex]
		const nextEntry = this.pendingEdits.get(readablePath)

		if (!nextEntry) {
			return
		}

		this.updateContext()

		const document = await vscode.workspace.openTextDocument(nextEntry.absolutePath)
		const editor = await vscode.window.showTextDocument(document, { preview: false })
		editor.revealRange(nextEntry.diffAnchor, vscode.TextEditorRevealType.InCenter)
	}

	async handleReviewPrev() {
		if (this.reviewQueue.length === 0) {
			vscode.window.showInformationMessage("No more pending file reviews.")
			return
		}

		this.currentReviewIndex = (this.currentReviewIndex - 1 + this.reviewQueue.length) % this.reviewQueue.length
		const readablePath = this.reviewQueue[this.currentReviewIndex]
		const prevEntry = this.pendingEdits.get(readablePath)

		if (!prevEntry) {
			return
		}

		this.updateContext()

		const document = await vscode.workspace.openTextDocument(prevEntry.absolutePath)
		const editor = await vscode.window.showTextDocument(document, { preview: false })
		editor.revealRange(prevEntry.diffAnchor, vscode.TextEditorRevealType.InCenter)
	}

	async handleReviewNextChange() {
		await this.handleReviewChange(1)
	}

	async handleReviewPrevChange() {
		await this.handleReviewChange(-1)
	}

	private async handleReviewChange(direction: 1 | -1) {
		if (this.reviewQueue.length === 0) {
			vscode.window.showInformationMessage("No more pending file reviews.")
			return
		}

		const activeEditor = vscode.window.activeTextEditor
		const activeReadablePath = activeEditor
			? getReadablePath(this.cwd, path.relative(this.cwd, activeEditor.document.uri.fsPath))
			: undefined
		const activeEntry = activeReadablePath ? this.pendingEdits.get(activeReadablePath) : undefined
		const readablePath = activeEntry ? activeReadablePath : this.reviewQueue[this.currentReviewIndex]
		const entry = readablePath ? this.pendingEdits.get(readablePath) : undefined

		if (!entry || entry.edits.length === 0) {
			return
		}

		if (activeEntry && activeReadablePath) {
			const activeFileIndex = this.reviewQueue.indexOf(activeReadablePath)
			if (activeFileIndex !== -1) {
				this.currentReviewIndex = activeFileIndex
				this.updateContext()
			}
		}

		const editor = activeEntry
			? activeEditor
			: await vscode.window.showTextDocument(await vscode.workspace.openTextDocument(entry.absolutePath), {
					preview: false,
				})
		if (!editor) {
			return
		}

		const changeLines = new Set<number>()
		for (const edit of entry.edits) {
			for (const line of computeDifferenceLineNumbers(edit.originalContent, edit.newContent)) {
				changeLines.add(line)
			}
		}
		const lines = Array.from(changeLines).sort((a, b) => a - b)
		const targetLine = findAdjacentChangeLine(lines, editor.selection.active.line, direction)
		if (targetLine === undefined) {
			return
		}

		const anchor = new vscode.Range(targetLine, 0, targetLine, Number.MAX_SAFE_INTEGER)
		editor.selection = new vscode.Selection(anchor.start, anchor.start)
		editor.revealRange(anchor, vscode.TextEditorRevealType.InCenter)
	}

	private clearEntry(entry: PendingFileEdit) {
		this.pendingEdits.delete(entry.readablePath)

		const idx = this.reviewQueue.indexOf(entry.readablePath)
		if (idx > -1) {
			this.reviewQueue.splice(idx, 1)
			if (this.currentReviewIndex >= this.reviewQueue.length && this.reviewQueue.length > 0) {
				this.currentReviewIndex = 0
			}
		}

		this.updateContext()
		this.codeLensEmitter.fire()
	}

	private getNextEntry(): PendingFileEdit | undefined {
		for (const readablePath of this.reviewQueue) {
			const entry = this.pendingEdits.get(readablePath)
			if (entry) {
				return entry
			}
		}
		return undefined
	}

	private handleDocumentClosed(doc: vscode.TextDocument) {
		const readablePath = getReadablePath(this.cwd, path.relative(this.cwd, doc.uri.fsPath))
		if (this.pendingEdits.has(readablePath)) {
			// Keep decorations + codelens in sync when files close/reopen.
			this.refreshDecorations()
			this.codeLensEmitter.fire()
		}
	}

	private refreshDecorations() {
		for (const editor of vscode.window.visibleTextEditors) {
			const readableEditorPath = getReadablePath(this.cwd, path.relative(this.cwd, editor.document.uri.fsPath))
			const entry = this.pendingEdits.get(readableEditorPath)

			const addedLineDecorations: vscode.DecorationOptions[] = []

			if (entry && entry.edits.length > 0) {
				for (const edit of entry.edits) {
					const diffResult = myersDiff(edit.originalContent, edit.newContent)
					let lineNum = 0
					for (const diffLine of diffResult) {
						if (diffLine.type === "old") {
							// Skipped here — deleted lines are shown via CodeLens view zones
						} else {
							if (diffLine.type === "new") {
								addedLineDecorations.push({
									range: new vscode.Range(lineNum, 0, lineNum, 0),
								})
							}
							lineNum++
						}
					}
				}
			}

			editor.setDecorations(highlightDecorationType, addedLineDecorations)
		}
	}

	dispose() {
		for (const disposable of this.disposables) {
			disposable.dispose()
		}

		// Old UI (comment thread actions) — kept for reference.
		// for (const entry of this.pendingEdits.values()) {
		// 	entry.thread?.dispose()
		// }

		if (this._taskId) {
			FileEditReviewController.controllers.delete(this._taskId)
		}

		this.pendingEdits.clear()
		this.reviewQueue = []
		this.currentReviewIndex = 0
		this.updateContext()
		vscode.window.visibleTextEditors.forEach((editor) => {
			editor.setDecorations(highlightDecorationType, [])
		})
	}
}

function computeFirstDifferenceRange(originalContent: string, newContent: string): vscode.Range {
	const line = computeDifferenceLineNumbers(originalContent, newContent)[0] ?? 0
	return new vscode.Range(line, 0, line, Number.MAX_SAFE_INTEGER)
}

class FileEditReviewCodeLensProvider implements vscode.CodeLensProvider {
	public readonly onDidChangeCodeLenses?: vscode.Event<void>

	constructor(
		private readonly cwd: string,
		private readonly getPendingEdits: () => Map<string, PendingFileEdit>,
		onDidChangeCodeLenses: vscode.Event<void>,
		private readonly getTaskId: () => string | undefined,
	) {
		this.onDidChangeCodeLenses = onDidChangeCodeLenses
	}

	provideCodeLenses(document: vscode.TextDocument): vscode.CodeLens[] {
		const readablePath = getReadablePath(this.cwd, path.relative(this.cwd, document.uri.fsPath))
		const entry = this.getPendingEdits().get(readablePath)
		if (!entry || entry.edits.length === 0) return []

		const lenses: vscode.CodeLens[] = []

		for (let i = 0; i < entry.edits.length; i++) {
			const edit = entry.edits[i]

			// --- Deleted-line CodeLens view zones ---
			// Walk the diff: for each hunk of removed lines, emit one CodeLens per
			// removed line anchored at the first following new/same line. The
			// codelensWidget in axon-ide renders 'axon-code.fileEdit.deletedLine'
			// commands as full-width styled spans inside the CodeLens view zone,
			// giving the correct "no line number, red phantom line" look.
			const diffResult = myersDiff(edit.originalContent, edit.newContent)
			let newFileLineNum = 0
			let pendingRemovals: string[] = []

			const flushRemovals = (atLine: number) => {
				for (const removedLine of pendingRemovals) {
					const anchor = new vscode.Range(atLine, 0, atLine, 0)
					const displayText = removedLine === "" ? " " : removedLine
					lenses.push(
						new vscode.CodeLens(anchor, {
							// Prefix with $$DELETED_LINE$$ so the renderer can reliably detect it
							// even if the command ID metadata is stripped or changed during IPC.
							title: `$$DELETED_LINE$$${displayText}`,
							command: "axon-code.fileEdit.deletedLine",
							arguments: [displayText],
						}),
					)
				}
				pendingRemovals = []
			}

			for (const diffLine of diffResult) {
				if (diffLine.type === "old") {
					pendingRemovals.push(diffLine.line)
				} else {
					if (pendingRemovals.length > 0) {
						flushRemovals(newFileLineNum)
					}
					newFileLineNum++
				}
			}
			// Trailing removals (deletion at end of file)
			if (pendingRemovals.length > 0 && newFileLineNum > 0) {
				flushRemovals(newFileLineNum - 1)
			}

			// --- Accept / Reject / Next buttons ---
			const btnLine = Math.max(0, edit.diffAnchor.start.line)
			const btnAnchor = new vscode.Range(btnLine, 0, btnLine, 0)
			const taskId = this.getTaskId()
			lenses.push(
				new vscode.CodeLens(btnAnchor, {
					title: "Accept",
					command: ACCEPT_COMMAND,
					arguments: [
						entry.relPath,
						i,
						{
							originalContent: edit.originalContent,
							newContent: edit.newContent,
							filePath: entry.absolutePath,
							taskId,
						},
					],
				}),
				new vscode.CodeLens(btnAnchor, {
					title: "Reject",
					command: REJECT_COMMAND,
					arguments: [entry.relPath, i, taskId],
				}),
				new vscode.CodeLens(btnAnchor, {
					title: "Next",
					command: NEXT_COMMAND,
					arguments: [taskId],
				}),
			)
		}

		// Add "Accept all" at the first edit's location
		if (entry.edits.length > 0) {
			const firstLine = Math.max(0, entry.edits[0].diffAnchor.start.line)
			const anchor = new vscode.Range(firstLine, 0, firstLine, 0)
			const taskId = this.getTaskId()
			lenses.push(
				new vscode.CodeLens(anchor, {
					title: "Accept all",
					command: ACCEPT_ALL_COMMAND,
					arguments: [taskId],
				}),
			)
		}

		return lenses
	}
}
