import type OpenAI from "openai"

export default {
	type: "function",
	function: {
		name: "edit_file",
		description:
			"Use this tool to make an edit to a file. A less intelligent apply model will read your request, so be clear about the change while minimizing unchanged code. Specify each edit sequentially and replace omitted sections with // ... existing code ... placeholders. Provide enough surrounding context to avoid ambiguity, always use the placeholder when skipping existing content, show before-and-after context when deleting, and gather all edits for the file in a single request. Before calling file_edit, always use read_file to fetch and confirm the exact old_string matches the current file content. If it doesn't, adjust and retry. Do not proceed with file_edit until verified.",
		strict: true,
		parameters: {
			type: "object",
			properties: {
				file_path: {
					type: "string",
					description: "Absolute path to the file to modify (e.g., /Users/username/project/src/file.ts)",
				},
				instructions: {
					type: "string",
					description: "Single first-person sentence summarizing the edit to guide the apply model",
				},
				code_edit: {
					type: "string",
					description:
						"Only the edited lines using // ... existing code ... wherever unchanged content is omitted",
				},
			},
			required: ["file_path", "instructions", "code_edit"],
			additionalProperties: false,
		},
	},
} satisfies OpenAI.Chat.ChatCompletionTool
