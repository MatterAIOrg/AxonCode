import * as fs from "fs/promises"
import * as path from "path"

import type { ChatMemory, MemorySaveOptions, MemorySearchOptions } from "./types"

const MEMORY_FILE = "chat-memories.json"
const MAX_CONTENT_LENGTH = 10000
const DEFAULT_SEARCH_LIMIT = 20

export class MemoryManager {
	private memories: ChatMemory[] = []
	private filePath: string
	private loaded: boolean = false

	constructor(private globalStoragePath: string) {
		this.filePath = path.join(globalStoragePath, MEMORY_FILE)
	}

	/**
	 * Load memories from disk (lazy loading)
	 */
	private async loadMemories(): Promise<void> {
		if (this.loaded) {
			return
		}

		try {
			const data = await fs.readFile(this.filePath, "utf-8")
			this.memories = JSON.parse(data)
			this.loaded = true
		} catch (error) {
			// File doesn't exist or is corrupted, start with empty array
			this.memories = []
			this.loaded = true
		}
	}

	/**
	 * Save memories to disk
	 */
	private async saveMemories(): Promise<void> {
		try {
			await fs.mkdir(path.dirname(this.filePath), { recursive: true })
			await fs.writeFile(this.filePath, JSON.stringify(this.memories, null, 2), "utf-8")
		} catch (error) {
			console.error("Failed to save chat memories:", error)
		}
	}

	/**
	 * Save a new memory (replaces existing memory with same taskId)
	 */
	async saveMemory(options: MemorySaveOptions): Promise<void> {
		await this.loadMemories()

		const { taskId, content, taskTitle, workspace, mode, maxContentLength = MAX_CONTENT_LENGTH } = options

		// Truncate content if too long
		const truncatedContent =
			content.length > maxContentLength ? content.substring(0, maxContentLength) + "... (truncated)" : content

		const memory: ChatMemory = {
			id: `${taskId}-${Date.now()}`,
			taskId,
			taskTitle,
			content: truncatedContent,
			timestamp: Date.now(),
			workspace,
			mode,
		}

		// Remove existing memory with same taskId (replace instead of append)
		const existingIndex = this.memories.findIndex((m) => m.taskId === taskId)
		if (existingIndex !== -1) {
			this.memories[existingIndex] = memory
		} else {
			this.memories.push(memory)
		}

		await this.saveMemories()
	}

	/**
	 * Search memories by regex pattern
	 */
	async searchMemories(options: MemorySearchOptions): Promise<ChatMemory[]> {
		await this.loadMemories()

		const { regex, workspace, limit = DEFAULT_SEARCH_LIMIT } = options

		try {
			const regexPattern = new RegExp(regex, "gi")

			const filtered = this.memories.filter((memory) => {
				// Filter by workspace if specified
				if (workspace && memory.workspace !== workspace) {
					return false
				}

				// Check if content matches regex
				return regexPattern.test(memory.content)
			})

			// Sort by timestamp (most recent first) and limit results
			return filtered.sort((a, b) => b.timestamp - a.timestamp).slice(0, limit)
		} catch (error) {
			console.error("Invalid regex pattern:", error)
			return []
		}
	}

	/**
	 * Get all memories, optionally filtered by workspace
	 */
	async getAllMemories(workspace?: string): Promise<ChatMemory[]> {
		await this.loadMemories()

		if (workspace) {
			return this.memories.filter((memory) => memory.workspace === workspace)
		}

		return [...this.memories]
	}

	/**
	 * Delete a specific memory by ID
	 */
	async deleteMemory(memoryId: string): Promise<void> {
		await this.loadMemories()

		this.memories = this.memories.filter((memory) => memory.id !== memoryId)
		await this.saveMemories()
	}

	/**
	 * Delete all memories for a specific task
	 */
	async deleteMemoriesForTask(taskId: string): Promise<void> {
		await this.loadMemories()

		this.memories = this.memories.filter((memory) => memory.taskId !== taskId)
		await this.saveMemories()
	}

	/**
	 * Delete all memories for a specific workspace
	 */
	async deleteMemoriesForWorkspace(workspace: string): Promise<void> {
		await this.loadMemories()

		this.memories = this.memories.filter((memory) => memory.workspace !== workspace)
		await this.saveMemories()
	}

	/**
	 * Clear all memories (use with caution)
	 */
	async clearAllMemories(): Promise<void> {
		this.memories = []
		await this.saveMemories()
	}

	/**
	 * Get memory count
	 */
	async getMemoryCount(workspace?: string): Promise<number> {
		await this.loadMemories()

		if (workspace) {
			return this.memories.filter((memory) => memory.workspace === workspace).length
		}

		return this.memories.length
	}

	/**
	 * Clean up old memories (older than specified days)
	 */
	async cleanupOldMemories(daysOld: number = 30): Promise<number> {
		await this.loadMemories()

		const cutoffTime = Date.now() - daysOld * 24 * 60 * 60 * 1000
		const initialCount = this.memories.length

		this.memories = this.memories.filter((memory) => memory.timestamp > cutoffTime)

		const deletedCount = initialCount - this.memories.length

		if (deletedCount > 0) {
			await this.saveMemories()
		}

		return deletedCount
	}
}
