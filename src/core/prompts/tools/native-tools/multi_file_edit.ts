import type OpenAI from "openai"

export default {
	type: "function",
	function: {
		name: "multi_file_edit",
		description:
			"Make multiple text replacements across one or more files in a single call. Use this tool whenever you have 2 or more edits to make, even if they are all in the same file. Every `old_string` must be copied verbatim from a current read of its file and uniquely identify the intended location; never invent, reconstruct, or guess file content. If an edit is ambiguous or missing, re-read that target before retrying with exact surrounding context. Use `replace_all` only when the requested change intentionally applies to every occurrence, never to bypass ambiguity. Edits within the same file are applied bottom-to-top and return per-edit results.",
		strict: true,
		parameters: {
			type: "object",
			properties: {
				edits: {
					type: "array",
					description:
						"Array of edit operations. Each edit must have file_path, old_string, new_string. Optionally include replace_all (boolean).",
					items: {
						type: "object",
						properties: {
							file_path: {
								type: "string",
								description:
									"Absolute path to the file to modify (e.g., /Users/username/project/src/file.ts)",
							},
							old_string: {
								type: "string",
								description:
									"Exact text to replace. MUST be copied verbatim from the latest read of this file, including its actual whitespace and escaping. Include enough unchanged surrounding context to match exactly once; never guess or reconstruct it from memory. Use an empty string only when intentionally replacing the entire file.",
							},
							new_string: {
								type: "string",
								description:
									"Replacement text. This will be inserted in place of the matched section. Can be an empty string to delete the match.",
							},
							replace_all: {
								type: "boolean",
								description:
									"Set to true only after verifying that the requested change should apply to every occurrence of old_string. Never set it merely to bypass a multiple-match error. Defaults to false.",
							},
						},
						required: ["file_path", "old_string", "new_string"],
						additionalProperties: false,
					},
				},
			},
			required: ["edits"],
			additionalProperties: false,
		},
	},
} satisfies OpenAI.Chat.ChatCompletionTool
