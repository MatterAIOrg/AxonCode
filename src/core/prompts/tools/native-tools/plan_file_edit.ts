import type OpenAI from "openai"

export default {
	type: "function",
	function: {
		name: "plan_file_edit",
		description:
			"Create or update a plan file in the extension's memory. Files are stored in plan-memory directory, not in the workspace. Use this tool in plan mode to create and update plan files.",
		strict: true,
		parameters: {
			type: "object",
			properties: {
				filename: {
					type: "string",
					description:
						"Name of the plan file (e.g., 'implementation.md', 'architecture.md', 'api-design.md'). Files are stored in plan:/ namespace.",
				},
				content: {
					type: "string",
					description: "Content to write to the plan file. Should be markdown formatted.",
				},
			},
			required: ["filename", "content"],
			additionalProperties: false,
		},
	},
} satisfies OpenAI.Chat.ChatCompletionTool
