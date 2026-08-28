import type OpenAI from "openai"

export default {
	type: "function",
	function: {
		name: "generate_file",
		description:
			"Generate a downloadable file (PDF, DOCX, PPTX, XLSX, CSV) from structured content. Use this tool when the user asks for a document, report, presentation, spreadsheet, or any other file artifact that should be produced as a real file rather than inline text. The file is generated server-side and written to the workspace, then auto-opened in the appropriate viewer.",
		strict: true,
		parameters: {
			type: "object",
			properties: {
				file_type: {
					type: "string",
					enum: ["pdf", "docx", "pptx", "xlsx", "csv"],
					description:
						"The type of file to generate. Use 'pdf' for documents/reports, 'docx' for Word documents, 'pptx' for slide decks, 'xlsx' for spreadsheets, 'csv' for raw tabular data, 'md' for markdown, 'txt' for plain text, and 'html' for standalone web pages.",
				},
				title: {
					type: "string",
					description:
						"Human-readable title for the file. Used as the document title, slide deck title, spreadsheet name, and as the basis for the output filename.",
				},
				content: {
					type: "string",
					description:
						"The full content to render into the file. For pdf/docx/md/txt/html use markdown (headings, bullets, tables, code blocks). For pptx use the slide-deck dialect with @layout, @accent, @section, @chart/@endchart, @cards, @category, @subtitle, @notes directives. For xlsx/csv use CSV text where the first row is the header row.",
				},
				path: {
					type: ["string", "null"],
					description:
						"Optional filesystem path (relative to the workspace) where the generated file should be saved. If omitted, the file is saved to the workspace root using a sanitized version of the title plus the appropriate extension.",
				},
			},
			required: ["file_type", "title", "content", "path"],
			additionalProperties: false,
		},
	},
} satisfies OpenAI.Chat.ChatCompletionTool
