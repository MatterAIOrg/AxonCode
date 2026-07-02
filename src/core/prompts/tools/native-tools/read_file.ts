import type OpenAI from "openai"

export const read_file_single = {
	type: "function",
	function: {
		name: "read_file",
		description:
			"Read a file and return its contents with line numbers. IMPORTANT: to read around a specific line number (e.g. line 4099 from search results), you MUST pass `offset` (start ~20 lines before it); passing only `limit` reads the TOP of the file, not your target. Default and maximum limit is 1000 lines to prevent context overflow.",
		strict: true,
		parameters: {
			type: "object",
			properties: {
				file_path: {
					type: "string",
					description: "Absolute path to the file to read (e.g., /Users/username/project/src/file.ts)",
				},
				offset: {
					type: ["number", "null"],
					description:
						"Starting line number (1-indexed). REQUIRED whenever you are targeting a specific line or region — without it, reading always starts at line 1 (the top of the file). To inspect around line N, use offset ≈ N-20.",
				},
				limit: {
					type: ["number", "null"],
					description:
						"Maximum number of lines to read starting FROM `offset`. `limit` alone does NOT target a region — it only caps how many lines are returned. Default and maximum is 1000 lines.",
				},
			},
			required: ["file_path"],
			additionalProperties: false,
		},
	},
} satisfies OpenAI.Chat.ChatCompletionTool
