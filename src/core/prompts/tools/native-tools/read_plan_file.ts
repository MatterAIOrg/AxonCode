import type OpenAI from "openai"

export default {
	type: "function",
	function: {
		name: "read_plan_file",
		description:
			"Read a plan file from the extension's memory. Use this to review existing plans before making updates. Files are stored in plan-memory directory, not in the workspace.",
		strict: true,
		parameters: {
			type: "object",
			properties: {
				filename: {
					type: "string",
					description: "Name of the plan file to read (e.g., 'implementation.md', 'architecture.md').",
				},
			},
			required: ["filename"],
			additionalProperties: false,
		},
	},
} satisfies OpenAI.Chat.ChatCompletionTool
