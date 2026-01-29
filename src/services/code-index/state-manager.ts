import * as vscode from "vscode"

export type IndexingState = "Standby" | "Indexing" | "Indexed" | "Error"

const STATE_STORAGE_KEY = "codeIndexState"

export class CodeIndexStateManager {
	private _systemStatus: IndexingState = "Standby"
	private _statusMessage: string = ""
	private _processedItems: number = 0
	private _totalItems: number = 0
	private _currentItemUnit: string = "blocks"
	private _progressEmitter = new vscode.EventEmitter<ReturnType<typeof this.getCurrentStatus>>()
	private _context: vscode.ExtensionContext | undefined

	// --- Public API ---

	public readonly onProgressUpdate = this._progressEmitter.event

	public get state(): IndexingState {
		return this._systemStatus
	}

	/**
	 * Sets the extension context for state persistence
	 */
	public setContext(context: vscode.ExtensionContext): void {
		this._context = context
	}

	public getCurrentStatus() {
		return {
			systemStatus: this._systemStatus,
			message: this._statusMessage,
			processedItems: this._processedItems,
			totalItems: this._totalItems,
			currentItemUnit: this._currentItemUnit,
		}
	}

	// --- State Management ---

	public setSystemState(newState: IndexingState, message?: string): void {
		const stateChanged =
			newState !== this._systemStatus || (message !== undefined && message !== this._statusMessage)

		if (stateChanged) {
			this._systemStatus = newState
			if (message !== undefined) {
				this._statusMessage = message
			}

			// Reset progress counters if moving to a non-indexing state or starting fresh
			if (newState !== "Indexing") {
				this._processedItems = 0
				this._totalItems = 0
				this._currentItemUnit = "blocks" // Reset to default unit
				// Optionally clear the message or set a default for non-indexing states
				if (newState === "Standby" && message === undefined) this._statusMessage = "Ready."
				if (newState === "Indexed" && message === undefined) this._statusMessage = "Index up-to-date."
				if (newState === "Error" && message === undefined) this._statusMessage = "An error occurred."
			}

			this._progressEmitter.fire(this.getCurrentStatus())
			this._persistState()
		}
	}

	/**
	 * Loads the persisted state from extension context
	 */
	public async loadPersistedState(): Promise<void> {
		if (!this._context) {
			return
		}

		try {
			const persistedState = this._context.globalState.get<IndexingState>(STATE_STORAGE_KEY)
			if (persistedState && (persistedState === "Indexed" || persistedState === "Standby")) {
				// Only restore "Indexed" or "Standby" states - never restore "Indexing" or "Error" on restart
				this._systemStatus = persistedState
				if (persistedState === "Indexed") {
					this._statusMessage = "Index up-to-date."
				} else {
					this._statusMessage = "Ready."
				}
				console.log(`[CodeIndexStateManager] Restored state: ${persistedState}`)
			}
		} catch (error) {
			console.error("[CodeIndexStateManager] Failed to load persisted state:", error)
		}
	}

	/**
	 * Persists the current state to extension context
	 */
	private _persistState(): void {
		if (!this._context) {
			return
		}

		try {
			// Only persist "Indexed" state - other states should reset on restart
			if (this._systemStatus === "Indexed") {
				this._context.globalState.update(STATE_STORAGE_KEY, this._systemStatus)
			} else {
				// Clear persisted state if not Indexed
				this._context.globalState.update(STATE_STORAGE_KEY, undefined)
			}
		} catch (error) {
			console.error("[CodeIndexStateManager] Failed to persist state:", error)
		}
	}

	public reportBlockIndexingProgress(processedItems: number, totalItems: number): void {
		const progressChanged = processedItems !== this._processedItems || totalItems !== this._totalItems

		// Update if progress changes OR if the system wasn't already in 'Indexing' state
		if (progressChanged || this._systemStatus !== "Indexing") {
			this._processedItems = processedItems
			this._totalItems = totalItems
			this._currentItemUnit = "blocks"

			const message = `Indexed ${this._processedItems} / ${this._totalItems} ${this._currentItemUnit} found`
			const oldStatus = this._systemStatus
			const oldMessage = this._statusMessage

			this._systemStatus = "Indexing" // Ensure state is Indexing
			this._statusMessage = message

			// Only fire update if status, message or progress actually changed
			if (oldStatus !== this._systemStatus || oldMessage !== this._statusMessage || progressChanged) {
				this._progressEmitter.fire(this.getCurrentStatus())
			}
		}
	}

	public reportFileQueueProgress(processedFiles: number, totalFiles: number, currentFileBasename?: string): void {
		const progressChanged = processedFiles !== this._processedItems || totalFiles !== this._totalItems

		if (progressChanged || this._systemStatus !== "Indexing") {
			this._processedItems = processedFiles
			this._totalItems = totalFiles
			this._currentItemUnit = "files"
			this._systemStatus = "Indexing"

			let message: string
			if (totalFiles > 0 && processedFiles < totalFiles) {
				message = `Processing ${processedFiles} / ${totalFiles} ${this._currentItemUnit}. Current: ${
					currentFileBasename || "..."
				}`
			} else if (totalFiles > 0 && processedFiles === totalFiles) {
				message = `Finished processing ${totalFiles} ${this._currentItemUnit} from queue.`
			} else {
				message = `File queue processed.`
			}

			const oldStatus = this._systemStatus
			const oldMessage = this._statusMessage

			this._statusMessage = message

			if (oldStatus !== this._systemStatus || oldMessage !== this._statusMessage || progressChanged) {
				this._progressEmitter.fire(this.getCurrentStatus())
			}
		}
	}

	public dispose(): void {
		this._progressEmitter.dispose()
	}
}
