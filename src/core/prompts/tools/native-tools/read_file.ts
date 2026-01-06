import type OpenAI from "openai"

export const read_file_multi = {
	type: "function",
	function: {
		name: "read_file",
		description:
			"Read one or more files and return their contents with line numbers. Use offset and limit to read specific portions of files efficiently. By default reads from the beginning with a reasonable limit.",
		strict: true,
		parameters: {
			type: "object",
			properties: {
				files: {
					type: "array",
					description: "List of files to read; request related files together when allowed",
					items: {
						type: "object",
						properties: {
							file_path: {
								type: "string",
								description:
									"Absolute path to the file to read (e.g., /Users/username/project/src/file.ts)",
							},
							offset: {
								type: ["number", "null"],
								description: "Starting line number (1-indexed). Defaults to 1 if not specified.",
							},
							limit: {
								type: ["number", "null"],
								description:
									"Maximum number of lines to read from offset. If not specified, reads the complete file from offset. Use smaller values for targeted reads.",
							},
						},
						required: ["file_path"],
						additionalProperties: false,
					},
					minItems: 1,
				},
			},
			required: ["files"],
			additionalProperties: false,
		},
	},
} satisfies OpenAI.Chat.ChatCompletionTool

export const read_file_single = {
	type: "function",
	function: {
		name: "read_file",
		description:
			"Read a file and return its contents with line numbers. Use offset and limit to read specific portions efficiently.",
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
					description: "Starting line number (1-indexed). Defaults to 1 if not specified.",
				},
				limit: {
					type: ["number", "null"],
					description:
						"Maximum number of lines to read from offset. If not specified, reads the complete file from offset.",
				},
			},
			required: ["file_path"],
			additionalProperties: false,
		},
	},
} satisfies OpenAI.Chat.ChatCompletionTool
