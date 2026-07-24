export function getFileEditDescription(): string {
	return `## file_edit

**Description**: Perform targeted text replacements within a single file without constructing manual diff blocks.

**When to use**:
- You know the exact text that should be replaced and its updated form.
- You want a deterministic edit without invoking Fast Apply models.
- You need to delete or rewrite a block of code but don't want to craft search/replace diff markers manually.

**Parameters**:
1. \`file_path\` — Absolute path to the file you want to modify (e.g., /Users/username/project/src/file.ts).
2. \`old_string\` — The current text you expect to replace. Provide enough context for a unique match; this can be empty to replace the entire file.
3. \`new_string\` — The text that should replace the match. Use an empty string to delete the matched content.
4. \`replace_all\` (optional, default false) — Set to true to replace every occurrence of the matched text. Leave false to replace only a single uniquely identified match.

**Guidance**:
- Read the current target region immediately before editing, then copy \`old_string\` verbatim from that result. Never invent, reconstruct, or guess file content, indentation, whitespace, or escaping.
- Include enough unchanged surrounding lines in \`old_string\` to identify exactly one location. Prefer a multi-line snippet when a short string is repeated.
- A missing or multiple-match error means no edit was applied. Re-read the intended target and build a new \`old_string\` from exact file content; do not guess a longer string.
- Set \`replace_all\` to true only when the requested change intentionally applies to every occurrence. Never use it merely to bypass a multiple-match error.
- The tool shows a diff before applying changes so you can confirm the result.`
}
