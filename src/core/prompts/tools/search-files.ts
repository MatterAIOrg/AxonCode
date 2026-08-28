import { ToolArgs } from "./types"

export function getSearchFilesDescription(args: ToolArgs): string {
	return `## search_files
Description: Search file contents with a Rust-compatible regex. Results are compact and bounded to the first 100 matches; refine the query instead of paginating or repeating it.
Parameters:
- path: (required) The path of the directory to search in (relative to the current workspace directory ${args.cwd}). This directory will be recursively searched.
- regex: (required) The regular expression pattern to search for. Uses Rust regex syntax.
- file_pattern: (optional) Glob pattern to filter files (e.g., '*.ts' for TypeScript files). If not provided, it will search all files (*).
- max_results: (optional) Target result count from 1-100. Defaults to 100.
- context_lines: (optional) Surrounding lines from 0-2. Defaults to 0; prefer read_file for context.
Usage:
<search_files>
<path>Directory path here</path>
<regex>Your regex pattern here</regex>
<file_pattern>file pattern here (optional)</file_pattern>
<max_results>100</max_results>
<context_lines>0</context_lines>
</search_files>

Example: Requesting to search for all .ts files in the current directory
<search_files>
<path>.</path>
<regex>.*</regex>
<file_pattern>*.ts</file_pattern>
<max_results>100</max_results>
<context_lines>0</context_lines>
</search_files>`
}
