export function getFileWriteDescription(): string {
	return `## file_write

**Description**: Create or overwrite a file with new content. Use this tool to write new files or completely rewrite existing files. The tool will create missing directories automatically. For partial edits to existing files, prefer using file_edit instead.

**When to use**:
- Creating new files from scratch (e.g., new components, configuration files, documentation).
- Completely rewriting an existing file when the changes are extensive.
- Writing files that don't exist yet, where you need to provide the full content.
- When you want to ensure a clean slate by replacing the entire file content.

**Parameters**:
1. \`file_path\` — Absolute path to the file to write (e.g., /Users/username/project/src/file.ts).
2. \`content\` — Full content to write to the file. For new files, this is the complete file content. For existing files, this will replace the entire file content.
3. \`line_count\` — Total number of lines in the content, counting blank lines. Used to verify content completeness.

**Guidance**:
- Always provide the complete file content, never use comments like "// rest of code here" or "// existing code".
- The tool will show a diff before applying changes so you can confirm the result.
- For partial edits to existing files, use the 'file_edit' tool instead.
- The tool automatically creates parent directories if they don't exist.`
}
