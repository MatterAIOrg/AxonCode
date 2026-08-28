import type OpenAI from "openai"

export default {
	type: "function",
	function: {
		name: "file_edit",
		description:
			"Make exactly ONE text replacement in ONE file. DO NOT call this tool multiple times in sequence — if you have 2 or more edits, you MUST use multi_file_edit instead. `old_string` must be copied verbatim from a current read of the file and must identify exactly one location. Never invent, reconstruct, or guess file content. If a match is ambiguous or missing, no edit is applied: re-read the target region and retry with more exact surrounding context. Use `replace_all` only when the requested change intentionally applies to every occurrence, never merely to bypass an ambiguity error. old_string and new_string cannot be the same.",
		strict: true,
		parameters: {
			type: "object",
			properties: {
				file_path: {
					type: "string",
					description: "Absolute path to the file to modify (e.g., /Users/username/project/src/file.ts)",
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
					type: ["boolean", "null"],
					description:
						"Pass false (or null) unless the requested change intentionally applies to every occurrence. Never use it to bypass an ambiguity error.",
				},
			},
			required: ["file_path", "old_string", "new_string", "replace_all"],
			additionalProperties: false,
		},
	},
} satisfies OpenAI.Chat.ChatCompletionTool
