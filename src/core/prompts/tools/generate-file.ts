import { ToolArgs } from "./types"

export function getGenerateFileDescription(_args: ToolArgs): string {
	return `## generate_file

**Description**: Generate a downloadable file (PDF, DOCX, PPTX, XLSX, CSV, MD, TXT, or HTML) from structured content. The file is produced server-side, written to the workspace, and auto-opened in the appropriate viewer. Use this tool whenever the user asks for a document, report, presentation, spreadsheet, or any other file artifact that should be produced as a real file rather than inline text.

**Parameters**:
1. \`file_type\` — (required) The type of file to generate. One of: \`pdf\`, \`docx\`, \`pptx\`, \`xlsx\`, \`csv\`, \`md\`, \`txt\`, \`html\`.
2. \`title\` — (required) Human-readable title for the file. Used as the document title, slide deck title, spreadsheet name, and as the basis for the output filename.
3. \`content\` — (required) The full content to render into the file.
   - For \`pdf\` / \`docx\` / \`md\` / \`txt\` / \`html\`: use standard markdown (headings, bullets, numbered lists, code blocks, tables).
   - For \`pptx\`: use the slide-deck dialect with directives: \`@layout auto|editorial|split|metrics|chart|strategy|statement\`, \`@accent #RRGGBB\`, \`@subtitle\`, \`@section\`, \`@cards\` / \`@grid\`, \`@category\` / \`@header\`, \`@chart bar|line|pie|doughnut|area "Title"\` ... \`@endchart\` (CSV body), \`@notes\`.
   - For \`xlsx\` / \`csv\`: use CSV text where the first row is the header row.
4. \`path\` — (optional) Filesystem path (relative to the workspace) where the generated file should be saved. If omitted, the file is saved to the workspace root using a sanitized version of the title plus the appropriate extension.

**Usage**:
<generate_file>
<file_type>pdf</file_type>
<title>Q3 Strategy Report</title>
<content># Q3 Strategy Report

## Executive Summary
- Revenue grew 18% quarter-over-quarter.
- New markets in APAC exceeded plan by 12%.

## Key Metrics
| Metric | Target | Actual |
|--------|--------|--------|
| Revenue | $4.2M | $4.96M |
| New Logos | 30 | 37 |
</content>
</generate_file>

**Guidance**:
- Always pick the most appropriate \`file_type\` for the user's request — do not default to \`md\` when a PDF or DOCX is requested.
- For \`pptx\`, start each slide with a \`@layout\` directive and use \`@section\` to split slides.
- For \`xlsx\` / \`csv\`, the first row of \`content\` must be the column headers.
- Keep \`content\` focused and well-structured; the backend enforces a 400,000-character limit.
- The tool writes the file to the workspace and auto-opens it for binary types (pdf, docx, pptx, xlsx, html). For text types (md, txt, csv) the file is written but not auto-opened to avoid stealing focus.`
}
