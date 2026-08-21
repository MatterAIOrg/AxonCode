import type OpenAI from "openai"

export default {
	type: "function",
	function: {
		name: "search_files",
		description:
			"Search file contents recursively under a directory using a Rust-compatible regex and optional file glob. Returns a compact, paginated page with at most three matches per file. To continue, call search_files again with the returned cursor and the same path, regex, and file_pattern; pass JSON null without quotes for the first page. Scope path to the narrowest plausible directory instead of searching from the repository root. If a search returns 0 matches, tighten or simplify the regex rather than retrying with a slightly different pattern. After 2+ searches with no results, stop and reason from what you already know.",
		strict: true,
		parameters: {
			type: "object",
			properties: {
				path: {
					type: "string",
					description: "Directory to search recursively, relative to the workspace",
				},
				regex: {
					type: "string",
					description: "Rust-compatible regular expression pattern to match",
				},
				file_pattern: {
					type: ["string", "null"],
					description: "Glob limiting searched files (e.g. '*.ts'), or null for all files",
				},
				cursor: {
					type: ["string", "null"],
					description:
						"Continuation cursor copied exactly from a previous result. For the first page, pass JSON null without quotes; never invent a cursor",
				},
				max_results: {
					type: ["number", "null"],
					minimum: 1,
					maximum: 100,
					description:
						"Target results for this page; null uses 50. FFF may include up to two extra matches to finish the current file",
				},
				context_lines: {
					type: ["number", "null"],
					minimum: 0,
					maximum: 2,
					description: "Context lines before and after each match; null uses 0",
				},
			},
			required: ["path", "regex", "file_pattern", "cursor", "max_results", "context_lines"],
			additionalProperties: false,
		},
	},
} satisfies OpenAI.Chat.ChatCompletionTool
