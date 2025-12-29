import * as path from "path"
import * as fs from "fs/promises"

import { getPlanMemoryDirectoryPath } from "../../utils/storage"

/**
 * PlanMemoryManager - Manages in-memory file storage for plan mode
 * Files are stored in extension's plan-memory directory, not in workspace
 */
export class PlanMemoryManager {
	private taskId: string
	private globalStoragePath: string
	private planMemoryDir: string | null = null
	private files: Map<string, string> = new Map()

	constructor(taskId: string, globalStoragePath: string) {
		this.taskId = taskId
		this.globalStoragePath = globalStoragePath
	}

	/**
	 * Initialize the plan memory directory
	 */
	async initialize(): Promise<void> {
		this.planMemoryDir = await getPlanMemoryDirectoryPath(this.globalStoragePath, this.taskId)
		// Load existing files from disk
		await this.loadExistingFiles()
	}

	/**
	 * Load existing files from disk into memory
	 */
	private async loadExistingFiles(): Promise<void> {
		if (!this.planMemoryDir) return

		try {
			const entries = await fs.readdir(this.planMemoryDir, { withFileTypes: true })
			for (const entry of entries) {
				if (entry.isFile()) {
					const filePath = path.join(this.planMemoryDir, entry.name)
					const content = await fs.readFile(filePath, "utf-8")
					if (!this.files.has(entry.name)) {
						this.files.set(entry.name, content)
					}
				}
			}
		} catch (error) {
			// Directory might not exist yet, that's fine
			console.log("No existing plan files to load")
		}
	}

	/**
	 * Create or update a plan file
	 */
	async writeFile(filename: string, content: string): Promise<void> {
		const safeFilename = path.basename(filename)
		// Store in memory
		this.files.set(safeFilename, content)

		// Persist to disk
		if (this.planMemoryDir) {
			const filePath = path.join(this.planMemoryDir, safeFilename)
			await fs.writeFile(filePath, content, "utf-8")
		}
	}

	/**
	 * Read a plan file
	 */
	readFile(filename: string): string | undefined {
		const safeFilename = path.basename(filename)
		return this.files.get(safeFilename)
	}

	/**
	 * Check if a file exists
	 */
	hasFile(filename: string): boolean {
		const safeFilename = path.basename(filename)
		return this.files.has(safeFilename)
	}

	/**
	 * Get all plan files
	 */
	getAllFiles(): Map<string, string> {
		return new Map(this.files)
	}

	/**
	 * Delete a plan file
	 */
	async deleteFile(filename: string): Promise<void> {
		const safeFilename = path.basename(filename)
		this.files.delete(safeFilename)

		if (this.planMemoryDir) {
			const filePath = path.join(this.planMemoryDir, safeFilename)
			try {
				await fs.unlink(filePath)
			} catch (error) {
				console.warn(`Failed to delete plan file ${safeFilename}:`, error)
			}
		}
	}

	/**
	 * Clear all plan files
	 */
	async clearAll(): Promise<void> {
		this.files.clear()

		if (this.planMemoryDir) {
			try {
				const entries = await fs.readdir(this.planMemoryDir)
				for (const entry of entries) {
					const filePath = path.join(this.planMemoryDir, entry)
					await fs.unlink(filePath)
				}
			} catch (error) {
				console.warn("Failed to clear plan files:", error)
			}
		}
	}

	/**
	 * Get the main plan file (plan.md or implementation.md)
	 */
	getMainPlanFile(): { filename: string; content: string } | null {
		// Look for common plan file names
		const planFiles = ["plan.md", "implementation.md", "todo.md"]
		for (const filename of planFiles) {
			if (this.files.has(filename)) {
				return { filename, content: this.files.get(filename)! }
			}
		}
		return null
	}
}
