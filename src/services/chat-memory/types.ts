export interface ChatMemory {
	id: string
	taskId: string
	taskTitle?: string
	content: string
	timestamp: number
	workspace: string
	mode?: string
}

export interface MemorySearchOptions {
	regex: string
	workspace?: string
	limit?: number
}

export interface MemorySaveOptions {
	taskId: string
	content: string
	taskTitle?: string
	workspace: string
	mode?: string
	maxContentLength?: number
}
