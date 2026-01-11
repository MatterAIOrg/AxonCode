import NodeCache from "node-cache"
import getFolderSize from "get-folder-size"
import axios from "axios" // kilocode_change

import type { ClineMessage, HistoryItem } from "@roo-code/types"

import { combineApiRequests } from "../../shared/combineApiRequests"
import { combineCommandSequences } from "../../shared/combineCommandSequences"
import { getApiMetrics } from "../../shared/getApiMetrics"
import { findLastIndex } from "../../shared/array"
import { getTaskDirectoryPath } from "../../utils/storage"
import { t } from "../../i18n"
import { getKiloUrlFromToken } from "@roo-code/types" // kilocode_change

const taskSizeCache = new NodeCache({ stdTTL: 30, checkperiod: 5 * 60 })

// kilocode_change: Fetch task title from backend
export interface TaskTitleResponse {
	taskId: string
	title: string
}

/**
 * Fetch task title from backend with retry logic.
 * The title is only available after the first response streaming starts.
 *
 * @param taskId - The task ID to fetch title for
 * @param kilocodeToken - The KiloCode authentication token
 * @param maxRetries - Maximum number of retry attempts (default: 3)
 * @param retryDelayMs - Delay between retries in milliseconds (default: 2000)
 * @returns Promise resolving to the task title or null if not found
 */
export async function fetchTaskTitle(
	taskId: string,
	kilocodeToken: string,
	maxRetries: number = 3,
	retryDelayMs: number = 2000,
): Promise<string | null> {
	if (!kilocodeToken) {
		return null
	}

	const url = `https://api.matterai.so/axoncode/meta/${taskId}`

	for (let attempt = 1; attempt <= maxRetries; attempt++) {
		try {
			const response = await axios.get<TaskTitleResponse>(url, {
				headers: {
					Authorization: `Bearer ${kilocodeToken}`,
				},
				timeout: 5000, // 5 second timeout
			})

			if (response.data?.title) {
				return response.data.title
			}

			// If we got a response but no title, retry
			if (attempt < maxRetries) {
				await new Promise((resolve) => setTimeout(resolve, retryDelayMs))
			}
		} catch (error) {
			// Log error but continue retrying
			if (axios.isAxiosError(error)) {
				if (error.response?.status === 404) {
					// Task not found or title not yet available
					if (attempt < maxRetries) {
						await new Promise((resolve) => setTimeout(resolve, retryDelayMs))
						continue
					}
				}
			}

			// For other errors, log and continue retrying
			if (attempt < maxRetries) {
				await new Promise((resolve) => setTimeout(resolve, retryDelayMs))
			}
		}
	}

	return null
}

export type TaskMetadataOptions = {
	taskId: string
	rootTaskId?: string
	parentTaskId?: string
	taskNumber: number
	messages: ClineMessage[]
	globalStoragePath: string
	workspace: string
	mode?: string
	contextWindowUsage?: {
		currentTokens: number
		maxTokens: number
	}
}

export async function taskMetadata({
	taskId: id,
	rootTaskId,
	parentTaskId,
	taskNumber,
	messages,
	globalStoragePath,
	workspace,
	mode,
	contextWindowUsage,
}: TaskMetadataOptions) {
	const taskDir = await getTaskDirectoryPath(globalStoragePath, id)

	// Determine message availability upfront
	const hasMessages = messages && messages.length > 0

	// Pre-calculate all values based on availability
	let timestamp: number
	let tokenUsage: ReturnType<typeof getApiMetrics>
	let taskDirSize: number
	let taskMessage: ClineMessage | undefined

	if (!hasMessages) {
		// Handle no messages case
		timestamp = Date.now()
		tokenUsage = {
			totalTokensIn: 0,
			totalTokensOut: 0,
			totalCacheWrites: 0,
			totalCacheReads: 0,
			totalCost: 0,
			contextTokens: 0,
		}
		taskDirSize = 0
	} else {
		// Handle messages case
		taskMessage = messages[0] // First message is always the task say.

		const lastRelevantMessage =
			messages[findLastIndex(messages, (m) => !(m.ask === "resume_task" || m.ask === "resume_completed_task"))] ||
			taskMessage

		timestamp = lastRelevantMessage.ts

		tokenUsage = getApiMetrics(combineApiRequests(combineCommandSequences(messages.slice(1))))

		// Get task directory size
		const cachedSize = taskSizeCache.get<number>(taskDir)

		if (cachedSize === undefined) {
			try {
				taskDirSize = await getFolderSize.loose(taskDir)
				taskSizeCache.set<number>(taskDir, taskDirSize)
			} catch (error) {
				taskDirSize = 0
			}
		} else {
			taskDirSize = cachedSize
		}
	}

	// Create historyItem once with pre-calculated values.
	const historyItem: HistoryItem = {
		id,
		rootTaskId,
		parentTaskId,
		number: taskNumber,
		ts: timestamp,
		task: hasMessages
			? taskMessage!.text?.trim() || t("common:tasks.incomplete", { taskNumber })
			: t("common:tasks.no_messages", { taskNumber }),
		tokensIn: tokenUsage.totalTokensIn,
		tokensOut: tokenUsage.totalTokensOut,
		cacheWrites: tokenUsage.totalCacheWrites,
		cacheReads: tokenUsage.totalCacheReads,
		totalCost: tokenUsage.totalCost,
		size: taskDirSize,
		workspace,
		mode,
		title: (taskMessage as any)?.title, // kilocode_change: Include title if available
		// Use provided contextWindowUsage if available, otherwise calculate from tokenUsage
		contextWindowUsage: contextWindowUsage
			? contextWindowUsage
			: tokenUsage.contextTokens > 0
				? {
						currentTokens: tokenUsage.contextTokens,
						maxTokens: 200000, // Default max tokens for KiloCode models
					}
				: undefined,
	}

	return { historyItem, tokenUsage }
}
