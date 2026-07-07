import * as os from "os"
import * as vscode from "vscode"

import type {
	CustomModePrompts,
	Experiments,
	ModeConfig,
	PromptComponent,
	TodoItem,
	HistoryItem,
} from "@roo-code/types"

import type { SystemPromptSettings } from "./types"

import { ToolUseStyle } from "../../../packages/types/src" // kilocode_change
import { CodeIndexManager } from "../../services/code-index/manager"
import { McpHub } from "../../services/mcp/McpHub"
import { formatLanguage } from "../../shared/language"
import { Mode, defaultModeSlug, getGroupName, getModeBySlug, getModeSelection, modes } from "../../shared/modes"
import { DiffStrategy } from "../../shared/tools"
import { isEmpty } from "../../utils/object"

import { PromptVariables, loadSystemPromptFile } from "./sections/custom-system-prompt"

import { type ClineProviderState } from "../webview/ClineProvider" // kilocode_change
import { addCustomInstructions, getMcpServersSection, getSystemInfoSection } from "./sections"
import { getToolDescriptionsForMode } from "./tools"
import { discoverSkills } from "../tools/skills"
import type { ContextBreakdownParts } from "../sliding-window/contextBreakdown"

/**
 * Result of generating a system prompt: the full markdown string (`text`) and
 * the per-category text fragments (`parts`) that the UI uses to build the
 * context-window usage breakdown.
 */
export interface SystemPromptParts {
	text: string
	parts: ContextBreakdownParts
}

// Helper function to get prompt component, filtering out empty objects
export function getPromptComponent(
	customModePrompts: CustomModePrompts | undefined,
	mode: string,
): PromptComponent | undefined {
	const component = customModePrompts?.[mode]
	// Return undefined if component is empty
	if (isEmpty(component)) {
		return undefined
	}
	return component
}

/**
 * Get previous chat titles section for system prompt
 */
function getPreviousChatTitlesSection(history?: HistoryItem[]): string {
	if (!history || history.length === 0) {
		return ""
	}

	// Get titles from history, filter out empty ones, and take last 20
	const titles = history
		.filter((item) => item.title && item.title.trim() !== "")
		.map((item) => item.title)
		.slice(-20)

	if (titles.length === 0) {
		return ""
	}

	return `Previous Chat Titles: ${titles.join(", ")}`
}

/**
 * Get available skills section for system prompt
 */
async function getSkillsSection(workspacePath: string): Promise<string> {
	const skills = await discoverSkills({ workspacePath })

	if (skills.length === 0) {
		return ""
	}

	const skillList = skills
		.map((skill) => {
			return `  - ${skill.metadata.name}: ${skill.metadata.description}`
		})
		.join("\n")

	return `You are provided Skills below, these skills are to be used by you as per your descretion. The purpose of these skills is to provide you additional niche context for you tasks. You might get skills for React, Security or even third-party tools. Use the tool use_skill to get the skill context:
${skillList}

IMPORTANT: Skills are not tool calls such as read_file_with_content.
`
}

const applyDiffToolDescription = `
Common tool calls and explanations

## file_edit

**Description**: Make exactly ONE targeted text replacement in ONE file.

**When to use**:
- You need to make a **single** edit to a single file.
- You know the exact text that should be replaced and its updated form.

**When NOT to use**:
- If you have **2 or more edits** to make (even to the same file), use \`multi_file_edit\` instead.
- Never call \`file_edit\` multiple times in sequence. Batch your edits with \`multi_file_edit\`.

**Parameters**:
1. \`file_path\` — Absolute path to the file you want to modify (e.g., /Users/username/project/src/file.ts).
2. \`old_string\` — The current text you expect to replace. Provide enough context for a unique match; this can be empty to replace the entire file.
3. \`new_string\` — The text that should replace the match. Use an empty string to delete the matched content.
4. \`replace_all\` (optional, default false) — Set to true to replace every occurrence of the matched text. Leave false to replace only a single uniquely identified match.

## multi_file_edit

**Description**: Make multiple text replacements across one or more files in a single tool call. This is the **preferred** tool for editing when you have 2+ changes to make.

**When to use**:
- You have **2 or more edits** to make, whether to the same file or different files.
- You want to batch edits efficiently instead of making multiple separate tool calls.

**Parameters**:
1. \`edits\` — An array of edit objects. Each edit has:
   - \`file_path\` — Absolute path to the file to modify.
   - \`old_string\` — Exact text to replace (provide enough context for a unique match).
   - \`new_string\` — Replacement text.
   - \`replace_all\` (optional) — Set to true to replace every occurrence.

**Behavior**:
- Edits within the same file are applied bottom-to-top to preserve line offsets.
- Each edit is reported individually (success/failure) so you know exactly which edits worked.
- If an edit fails, other edits in the same file are still attempted.

**Example** (editing 2 places in the same file):
\`\`\`json
{
  "edits": [
    {"file_path": "/path/to/file.ts", "old_string": "const x = 1", "new_string": "const x = 2"},
    {"file_path": "/path/to/file.ts", "old_string": "return x", "new_string": "return x + 1"}
  ]
}
\`\`\`

**Guidance for choosing between file_edit and multi_file_edit**:
- 1 edit → \`file_edit\`
- 2+ edits → \`multi_file_edit\` (always)

**Editing discipline (CRITICAL)**:
- ALWAYS copy \`old_string\` verbatim from a read_file result obtained in the same turn. NEVER reconstruct indentation or whitespace from memory — this is especially important in tab-indented files, where a reconstructed \`old_string\` will silently mismatch.
- After any successful edit, treat all earlier reads of that file as stale. Re-read the region with read_file before editing the same area of the file again.
- If one edit in a \`multi_file_edit\` batch fails with a string mismatch, STOP and re-read the file before retrying that edit. Do not guess at a corrected \`old_string\` — guessed corrections compound the mismatch.

## read_file Tool Usage

The \`read_file\` tool reads file contents with optional offset and limit. Use it to examine code before making changes or to discuss specific sections.

### Parameters

- \`file_path\` (required): Absolute path to the file (e.g., /Users/username/project/src/file.ts)
- \`offset\` (optional): Starting line number (1-indexed). Defaults to 1.
- \`limit\` (optional): Maximum number of lines to read. If not specified, reads the complete file. Default and maximum limit is 1000 lines.

### Example

**Read lines 100-150:**
\`\`\`json
{
  "file_path": "/Users/username/project/src/App.tsx",
  "offset": 100,
  "limit": 50
}
\`\`\`

Parameter rules: \`file_path\` must be an absolute path; \`offset\` and \`limit\` must be >= 1 if specified; omit \`limit\` to read from \`offset\` to the end. Call the tool multiple times to read multiple files.

CRITICAL: \`offset\` is what targets a region — \`limit\` alone reads the TOP of the file. To inspect line N (e.g. from search results), you MUST pass \`offset\` ≈ N-20 together with \`limit\`. Before sending the call, confirm \`offset\` is present whenever you are aiming at a specific line.

When you don't know line numbers: use \`search_files\` to locate the code, note the line number from the results, then \`read_file\` that region with surrounding context.

### Reading Strategy

- When investigating a bug, read whole functions or logical regions in ONE call rather than small slivers. Prefer one 150-line read over five 30-line reads — fragmented reads lose context and waste calls.
- Budget your re-reads: if you have already read a region and have not edited it since, work from what you have instead of fetching it again. Re-read only when the file has changed or you genuinely lack the detail.
- After every read, verify the output matches the parameters you sent. If you meant to read around line N but the result starts at line 1, you omitted \`offset\` — re-issue the call with \`offset\` set. NEVER re-read the top of the file expecting a different result.


# execute_command

The \`execute_command\` tool runs CLI commands on the user's system. It allows Axon Code to perform system operations, install dependencies, build projects, start servers, and execute other terminal-based tasks needed to accomplish user objectives.

## Parameters

The tool accepts these parameters:

- \`command\` (required): The CLI command to execute. Must be valid for the user's operating system.
- \`cwd\` (optional): The working directory to execute the command in. If not provided, the current working directory is used. Ensure this is always an absolute path, starting with \`/\`. If you are running the command in the root directly, skip this parameter. The command executor is defaulted to run in the root directory. You already have the Current Workspace Directory in the Environment Details section.

CRITICAL: If the command is a very long running process, prefer to let the user know so they can run it manually in their terminal. If the user specifically requests to run a long running command, you may proceed.

Command validity rules: a command is never empty, never just \`:\`, never a bare single word with no arguments, and never contains tool-call markup tokens or angle-bracket tags of any kind. Commands must be valid for the user's operating system, shell, and current working directory.

## search_files

The \`search_files\` tool allows you to search for patterns across files in a directory using regex.

### Parameters

1. **path** (string, required): Directory to search recursively, relative to workspace
2. **regex** (string, required): Rust-compatible regular expression pattern
3. **file_pattern** (string or null, required): Glob pattern to filter files OR null

### CRITICAL: file_pattern Must Be a String or null

**The \`file_pattern\` parameter MUST ALWAYS be:**
- A properly quoted string: \`"*.js"\`, \`"*.tsx"\`, \`"**/*.json"\`
- OR explicitly \`null\` if you want to search all files

**NEVER provide an unquoted value like \`*.js\` - this will cause a JSON parsing error.**

### Correct Examples
\`\`\`json
// Search for "import" in all TypeScript files
{
  "path": "src",
  "regex": "import.*from",
  "file_pattern": "*.ts"
}

// Search for "TODO" in all files (no filter)
{
  "path": "src",
  "regex": "TODO:",
  "file_pattern": null
}

\`\`\`

The regex uses Rust syntax (similar to PCRE); escape special characters like \`\.\` and \`\(\`. \`file_pattern\` uses glob syntax: \`"*.ts"\`, \`"*.{jsx,tsx}"\`, \`"**/*.json"\`. When in doubt, use \`null\` to search all files.

### Search Hygiene

- Exclude test, spec, and mock paths from discovery searches by default (\`__tests__\`, \`*.spec.*\`, \`*.test.*\`, \`__mocks__\`) unless the task itself is about tests. They pollute results and bury the implementation you are looking for.
- Scope \`path\` to the narrowest plausible directory instead of searching from the repository root.
- If a search returns hundreds of hits, tighten the regex or \`file_pattern\` and search again. Do not scan through the dump.

### Remember

**Always quote the file_pattern value or use null. Never use bare/unquoted glob patterns.**

## Verifying tool results and avoiding loops

- After EVERY tool call, verify the output actually matches the parameters you sent (correct file, correct line range, correct directory). A result that does not reflect your parameters means the call was malformed — fix the call, do not reason from the bad output.
- If two consecutive identical tool calls produce identical results, you are in a loop. Change the call or change the strategy. NEVER repeat the same call a third time.

## Plan before editing

- Investigate first, edit second. Once the root cause is confirmed, write out the full change plan — which files, the exact locations, and the edit order — BEFORE touching anything.
- Then execute the edits in one pass (batched via \`multi_file_edit\`) and verify with a single typecheck/build at the end, rather than alternating between editing and checking.

## update_todo_list

**Description:**
Replace the entire TODO list with an updated checklist reflecting the current state. Always provide the full list; the system will overwrite the previous one. This tool is designed for step-by-step task tracking, allowing you to confirm completion of each step before updating, update multiple task statuses at once (e.g., mark one as completed and start the next), and dynamically add new todos discovered during long or complex tasks.

**Checklist Format:**
- Use a single-level markdown checklist (no nesting or subtasks), in intended execution order.
- Statuses: \`[ ]\` pending, \`[x]\` completed (fully finished, no unresolved issues), \`[-]\` in progress.

**Core Principles:**
- Update multiple statuses in a single call (e.g., mark the previous task completed and the next in progress).
- Add newly discovered actionable items immediately. Retain all unfinished tasks; remove one only if it is no longer relevant or the user asks.
- Mark a task completed only when fully accomplished. If blocked, keep it in_progress and add a todo describing what must be resolved.
- Keep the todo list AHEAD of the work, not behind it: it is a steering tool, not a changelog. Lay out upcoming steps before you start them instead of only recording steps after they are finished.

IMPORTANT: Use attempt_completion tool when you have completed the task. This signals that you are done.
`

async function generatePromptParts(
	context: vscode.ExtensionContext,
	cwd: string,
	supportsComputerUse: boolean,
	mode: Mode,
	mcpHub?: McpHub,
	diffStrategy?: DiffStrategy,
	browserViewportSize?: string,
	promptComponent?: PromptComponent,
	customModeConfigs?: ModeConfig[],
	_globalCustomInstructions?: string,
	diffEnabled?: boolean,
	experiments?: Record<string, boolean>,
	enableMcpServerCreation?: boolean,
	_language?: string,
	_rooIgnoreInstructions?: string,
	partialReadsEnabled?: boolean,
	settings?: SystemPromptSettings,
	_todoList?: TodoItem[],
	modelId?: string,
	toolUseStyle?: ToolUseStyle, // kilocode_change
	clineProviderState?: ClineProviderState, // kilocode_change
	taskHistory?: HistoryItem[], // kilocode_change: Chat memories
): Promise<SystemPromptParts> {
	if (!context) {
		throw new Error("Extension context is required for generating system prompt")
	}

	// If diff is disabled, don't pass the diffStrategy
	const effectiveDiffStrategy = diffStrategy

	// Get the full mode config to ensure we have the role definition (used for groups, etc.)
	const modeConfig = getModeBySlug(mode, customModeConfigs) || modes.find((m) => m.slug === mode) || modes[0]
	const { roleDefinition, baseInstructions } = getModeSelection(mode, promptComponent, customModeConfigs)

	// Check if MCP functionality should be included
	const hasMcpGroup = modeConfig.groups.some((groupEntry) => getGroupName(groupEntry) === "mcp")
	const hasMcpServers = mcpHub && mcpHub.getServers().length > 0
	const shouldIncludeMcp = hasMcpGroup && hasMcpServers

	const [mcpServersSection, skillsSection] = await Promise.all([
		// getModesSection(context, toolUseStyle /*kilocode_change*/),
		shouldIncludeMcp
			? getMcpServersSection(mcpHub, effectiveDiffStrategy, enableMcpServerCreation)
			: Promise.resolve(""),
		getSkillsSection(cwd),
	])

	const codeIndexManager = CodeIndexManager.getInstance(context, cwd)

	const previousChatTitlesSection = getPreviousChatTitlesSection(taskHistory)

	const toolDescriptions =
		toolUseStyle !== "json" // kilocode_change
			? await getToolDescriptionsForMode(
					mode,
					cwd,
					supportsComputerUse,
					codeIndexManager,
					effectiveDiffStrategy,
					browserViewportSize,
					shouldIncludeMcp ? mcpHub : undefined,
					customModeConfigs,
					experiments,
					partialReadsEnabled,
					settings,
					enableMcpServerCreation,
					modelId,
					clineProviderState, // kilocode_change
				)
			: ""

	// Split the tool descriptions string into "tool definitions" (everything that's
	// a tool schema/usage block) and the static system prompt (role definition,
	// apply diff, previous chat titles, system info). The split is a heuristic:
	// tool descriptions begin with `## ` headers introducing a tool name.
	const toolDefinitionSections = toolDescriptions.split(/\n(?=##\s)/).filter((section) => section.trim().length > 0)
	const toolDefinitionsText = toolDefinitionSections.join("\n")

	// Anything not part of the tool definitions stays in the system prompt
	// (role definition, applyDiffToolDescription, system info, etc.).
	const systemPromptText = [
		roleDefinition,
		applyDiffToolDescription,
		previousChatTitlesSection,
		getSystemInfoSection(cwd),
	]
		.filter((part) => part && part.trim().length > 0)
		.join("\n\n")

	const basePrompt = `${roleDefinition}

${toolDescriptions}

${applyDiffToolDescription}

${mcpServersSection}

${skillsSection}

${previousChatTitlesSection}

${getSystemInfoSection(cwd)}
`

	return {
		text: basePrompt,
		parts: {
			systemPrompt: systemPromptText,
			toolDefinitions: toolDefinitionsText,
			rules: "",
			skills: skillsSection,
			mcp: mcpServersSection,
			subagentDefinitions: "",
		},
	}
}

export const SYSTEM_PROMPT = async (
	context: vscode.ExtensionContext,
	cwd: string,
	supportsComputerUse: boolean,
	mcpHub?: McpHub,
	diffStrategy?: DiffStrategy,
	browserViewportSize?: string,
	inputMode: Mode = defaultModeSlug, // kilocode_change: name changed to inputMode
	customModePrompts?: CustomModePrompts,
	customModes?: ModeConfig[],
	globalCustomInstructions?: string,
	diffEnabled?: boolean,
	experiments?: Experiments, // kilocode_change: type
	enableMcpServerCreation?: boolean,
	language?: string,
	rooIgnoreInstructions?: string,
	partialReadsEnabled?: boolean,
	settings?: SystemPromptSettings,
	todoList?: TodoItem[],
	modelId?: string,
	toolUseStyle?: ToolUseStyle, // kilocode_change
	clineProviderState?: ClineProviderState, // kilocode_change
	taskHistory?: HistoryItem[], // kilocode_change: Chat memories
): Promise<string> => {
	if (!context) {
		throw new Error("Extension context is required for generating system prompt")
	}

	const mode =
		getModeBySlug(inputMode, customModes)?.slug || modes.find((m) => m.slug === inputMode)?.slug || defaultModeSlug // kilocode_change: don't try to use non-existent modes

	// Try to load custom system prompt from file
	const variablesForPrompt: PromptVariables = {
		workspace: cwd,
		mode: mode,
		language: language ?? formatLanguage(vscode.env.language),
		shell: vscode.env.shell,
		operatingSystem: os.type(),
	}
	const fileCustomSystemPrompt = await loadSystemPromptFile(cwd, mode, variablesForPrompt)

	// Check if it's a custom mode
	const promptComponent = getPromptComponent(customModePrompts, mode)

	// Get full mode config from custom modes or fall back to built-in modes
	const currentMode = getModeBySlug(mode, customModes) || modes.find((m) => m.slug === mode) || modes[0]

	// If a file-based custom system prompt exists, use it
	if (fileCustomSystemPrompt) {
		const { roleDefinition, baseInstructions: baseInstructionsForFile } = getModeSelection(
			mode,
			promptComponent,
			customModes,
		)

		const customInstructions = await addCustomInstructions(
			baseInstructionsForFile,
			globalCustomInstructions || "",
			cwd,
			mode,
			{
				language: language ?? formatLanguage(vscode.env.language),
				rooIgnoreInstructions,
				settings,
			},
		)

		// For file-based prompts, don't include the tool sections
		return `${roleDefinition}

${fileCustomSystemPrompt}

${customInstructions}`
	}

	// If diff is disabled, don't pass the diffStrategy
	const effectiveDiffStrategy = diffEnabled ? diffStrategy : undefined

	return generatePromptParts(
		context,
		cwd,
		supportsComputerUse,
		currentMode.slug,
		mcpHub,
		effectiveDiffStrategy,
		browserViewportSize,
		promptComponent,
		customModes,
		globalCustomInstructions,
		diffEnabled,
		experiments,
		enableMcpServerCreation,
		language,
		rooIgnoreInstructions,
		partialReadsEnabled,
		settings,
		todoList,
		modelId,
		toolUseStyle, // kilocode_change
		clineProviderState, // kilocode_change
		taskHistory, // kilocode_change: Chat memories
	).then((result) => result.text)
}

/**
 * Build the system prompt and return both the rendered text and the
 * per-category text fragments used to build a context-window breakdown.
 *
 * The returned `parts` is intentionally raw text — token counts are computed
 * at the call site using `countStringTokens` so the UI can refresh on demand.
 */
export const getSystemPromptParts = async (
	context: vscode.ExtensionContext,
	cwd: string,
	supportsComputerUse: boolean,
	mcpHub?: McpHub,
	diffStrategy?: DiffStrategy,
	browserViewportSize?: string,
	inputMode: Mode = defaultModeSlug,
	customModePrompts?: CustomModePrompts,
	customModes?: ModeConfig[],
	globalCustomInstructions?: string,
	diffEnabled?: boolean,
	experiments?: Experiments,
	enableMcpServerCreation?: boolean,
	language?: string,
	rooIgnoreInstructions?: string,
	partialReadsEnabled?: boolean,
	settings?: SystemPromptSettings,
	todoList?: TodoItem[],
	modelId?: string,
	toolUseStyle?: ToolUseStyle,
	clineProviderState?: ClineProviderState,
	taskHistory?: HistoryItem[],
): Promise<SystemPromptParts> => {
	if (!context) {
		throw new Error("Extension context is required for generating system prompt")
	}

	const mode =
		getModeBySlug(inputMode, customModes)?.slug || modes.find((m) => m.slug === inputMode)?.slug || defaultModeSlug

	const variablesForPrompt: PromptVariables = {
		workspace: cwd,
		mode,
		language: language ?? formatLanguage(vscode.env.language),
		shell: vscode.env.shell,
		operatingSystem: os.type(),
	}
	const fileCustomSystemPrompt = await loadSystemPromptFile(cwd, mode, variablesForPrompt)
	const promptComponent = getPromptComponent(customModePrompts, mode)
	const currentMode = getModeBySlug(mode, customModes) || modes.find((m) => m.slug === mode) || modes[0]

	if (fileCustomSystemPrompt) {
		const { roleDefinition, baseInstructions: baseInstructionsForFile } = getModeSelection(
			mode,
			promptComponent,
			customModes,
		)

		const customInstructions = await addCustomInstructions(
			baseInstructionsForFile,
			globalCustomInstructions || "",
			cwd,
			mode,
			{
				language: language ?? formatLanguage(vscode.env.language),
				rooIgnoreInstructions,
				settings,
			},
		)

		const text = `${roleDefinition}

${fileCustomSystemPrompt}

${customInstructions}`

		// File-based custom prompts don't expose the section breakdown — bucket
		// the entire prompt under "System prompt" so the user still sees the
		// full token usage even without a per-section split.
		return {
			text,
			parts: {
				systemPrompt: text,
				toolDefinitions: "",
				rules: "",
				skills: "",
				mcp: "",
				subagentDefinitions: "",
			},
		}
	}

	const effectiveDiffStrategy = diffEnabled ? diffStrategy : undefined

	return generatePromptParts(
		context,
		cwd,
		supportsComputerUse,
		currentMode.slug,
		mcpHub,
		effectiveDiffStrategy,
		browserViewportSize,
		promptComponent,
		customModes,
		globalCustomInstructions,
		diffEnabled,
		experiments,
		enableMcpServerCreation,
		language,
		rooIgnoreInstructions,
		partialReadsEnabled,
		settings,
		todoList,
		modelId,
		toolUseStyle,
		clineProviderState,
		taskHistory,
	)
}
