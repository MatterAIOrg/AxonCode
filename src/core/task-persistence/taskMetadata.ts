import NodeCache from "node-cache"
import getFolderSize from "get-folder-size"
import axios from "axios" // kilocode_change

import type { ClineMessage, HistoryItem } from "@roo-code/types"
import type { ProviderSettings } from "@roo-code/types"

import { combineApiRequests } from "../../shared/combineApiRequests"
import { combineCommandSequences } from "../../shared/combineCommandSequences"
import { getApiMetrics } from "../../shared/getApiMetrics"
import { findLastIndex } from "../../shared/array"
import { getTaskDirectoryPath } from "../../utils/storage"
import { t } from "../../i18n"
import { getKiloUrlFromToken } from "@roo-code/types" // kilocode_change

const taskSizeCache = new NodeCache({ stdTTL: 30, checkperiod: 5 * 60 })

// kilocode_change: Fetch task title from backend

/**
 * Safely extract a clean title string from potentially malformed input.
 * Handles cases where the title might be stored as:
 * - A plain string: "My Title"
 * - A JSON object string: '{"title":"My Title"}'
 * - An object: { title: "My Title" }
 */
function sanitizeTitle(raw: unknown): string | undefined {
	if (raw == null) return undefined

	if (typeof raw === "string") {
		const trimmed = raw.trim()
		if (!trimmed) return undefined

		// Try parsing as JSON if it looks like an object
		if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
			try {
				const parsed = JSON.parse(trimmed)
				const extracted = sanitizeTitle(parsed)
				if (extracted) return extracted
			} catch {
				// Not valid JSON, fall through
			}
		}

		return trimmed
	}

	if (typeof raw === "object") {
		// Check for .title property (string or nested object/string)
		const maybe = (raw as Record<string, unknown>)["title"]
		if (maybe != null) {
			// Recurse to handle nested cases like { title: { title: "..." } }
			const extracted = sanitizeTitle(maybe)
			if (extracted) return extracted
		}
	}

	return undefined
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
			const response = await axios.get(url, {
				headers: {
					Authorization: `Bearer ${kilocodeToken}`,
				},
				timeout: 5000, // 5 second timeout
			})

			const data = response.data

			if (typeof data === "string") {
				// Server responded with a string — try parsing as JSON if it looks like one
				const trimmed = data.trim()
				if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
					try {
						const parsed = JSON.parse(trimmed)
						if (parsed?.title) {
							return parsed.title
						}
					} catch {
						// Not valid JSON, fall through to use as plain string
					}
				}
				if (trimmed) {
					return trimmed
				}
			} else if (typeof data === "object" && data !== null) {
				// Server responded with an object — extract title regardless of other fields
				if (data.title) {
					return data.title
				}
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

/**
 * Extract model ID from ProviderSettings based on the provider.
 * Different providers use different field names for model ID.
 *
 * @param settings - The ProviderSettings object
 * @returns The model ID string or undefined if not found
 */
export function getModelIdFromConfig(settings: ProviderSettings): string | undefined {
	const provider = settings.apiProvider

	if (!provider) {
		return undefined
	}

	// Map provider to its model ID field
	const modelFieldMap: Record<string, keyof ProviderSettings> = {
		anthropic: "apiModelId",
		"claude-code": "apiModelId",
		bedrock: "apiModelId",
		vertex: "apiModelId",
		gemini: "apiModelId",
		"gemini-cli": "apiModelId",
		mistral: "apiModelId",
		deepseek: "apiModelId",
		doubao: "apiModelId",
		moonshot: "apiModelId",
		xai: "apiModelId",
		groq: "apiModelId",
		chutes: "apiModelId",
		cerebras: "apiModelId",
		sambanova: "apiModelId",
		zai: "apiModelId",
		fireworks: "apiModelId",
		synthetic: "apiModelId",
		featherless: "apiModelId",
		"qwen-code": "apiModelId",
		roo: "apiModelId",
		"virtual-quota-fallback": "apiModelId",
		openrouter: "openRouterModelId",
		"kilocode-openrouter": "openRouterModelId",
		glama: "glamaModelId",
		openai: "openAiModelId",
		"openai-native": "openAiModelId",
		ollama: "ollamaModelId",
		lmstudio: "lmStudioModelId",
		unbound: "unboundModelId",
		requesty: "requestyModelId",
		litellm: "litellmModelId",
		huggingface: "huggingFaceModelId",
		"io-intelligence": "ioIntelligenceModelId",
		"vercel-ai-gateway": "vercelAiGatewayModelId",
		deepinfra: "deepInfraModelId",
		kilocode: "kilocodeModel",
		ovhcloud: "ovhCloudAiEndpointsModelId",
	}

	const field = modelFieldMap[provider]
	if (!field) {
		return undefined
	}

	const modelId = settings[field]
	return typeof modelId === "string" ? modelId : undefined
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
	apiConfiguration?: ProviderSettings
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
	apiConfiguration,
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
		title: sanitizeTitle((taskMessage as any)?.title) ?? undefined, // kilocode_change: Include title if available
		// Use provided contextWindowUsage if available, otherwise calculate from tokenUsage
		contextWindowUsage: contextWindowUsage
			? contextWindowUsage
			: tokenUsage.contextTokens > 0
				? {
						currentTokens: tokenUsage.contextTokens,
						maxTokens: 400000,
					}
				: undefined,
		// Capture model information for task isolation
		apiProvider: apiConfiguration?.apiProvider,
		apiModelId: apiConfiguration ? getModelIdFromConfig(apiConfiguration) : undefined,
	}

	return { historyItem, tokenUsage }
}
