import { z } from "zod"

/**
 * HistoryItem
 */

export const historyItemSchema = z.object({
	id: z.string(),
	rootTaskId: z.string().optional(),
	parentTaskId: z.string().optional(),
	number: z.number(),
	ts: z.number(),
	task: z.string(),
	tokensIn: z.number(),
	tokensOut: z.number(),
	cacheWrites: z.number().optional(),
	cacheReads: z.number().optional(),
	totalCost: z.number(),
	size: z.number().optional(),
	workspace: z.string().optional(),
	isFavorited: z.boolean().optional(), // kilicode_change
	fileNotfound: z.boolean().optional(), // kilicode_change
	mode: z.string().optional(),
	title: z.string().optional(), // kilicode_change: Task title from backend
	contextWindowUsage: z
		.object({
			currentTokens: z.number(),
			maxTokens: z.number(),
		})
		.optional(),
	apiProvider: z.string().optional(), // Task-specific API provider
	apiModelId: z.string().optional(), // Task-specific model ID
})

export type HistoryItem = z.infer<typeof historyItemSchema>
