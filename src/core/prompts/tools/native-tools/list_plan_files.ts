import type OpenAI from "openai"

export default {
	type: "function",
	function: {
		name: "list_plan_files",
		description:
			"List all plan files currently stored in the extension's memory. Use this to see what plan files exist before reading or updating them.",
		strict: true,
		parameters: {
			type: "object",
			properties: {},
			additionalProperties: false,
		},
	},
} satisfies OpenAI.Chat.ChatCompletionTool
