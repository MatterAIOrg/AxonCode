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

	return `You are provided Skills below, these skills are to be used by you as per your descretion. The purpose of these skills is to provide you additional niche context for you tasks. You might get skills for React, Security or even third-party tools. Use the tool use_skill with a listed name or an explicit skill directory/SKILL.md path to get the skill context:
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
- If you have **2 or more independent edits** that are all confirmed and ready right now, use \`multi_file_edit\` instead.
- Do not hold an edit back to accumulate a larger batch. If one edit is ready, make it now and gather the next edits afterwards.

**Parameters**:
1. \`file_path\` — Absolute path to the file you want to modify (e.g., /Users/username/project/src/file.ts).
2. \`old_string\` — The current text you expect to replace. Provide enough context for a unique match; this can be empty to replace the entire file.
3. \`new_string\` — The text that should replace the match. Use an empty string to delete the matched content.
4. \`replace_all\` (optional, default false) — Set to true to replace every occurrence of the matched text. Leave false to replace only a single uniquely identified match.

## multi_file_edit

**Description**: Make multiple text replacements across one or more files in a single tool call. Use it when several edits are already confirmed and ready in the same step.

**When to use**:
- You have **2 or more edits** that are all confirmed and ready now, whether to the same file or different files.
- Keep each batch small and cohesive: the edits that belong to the current step of the task, not the whole task.

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
- 2+ edits ready now → \`multi_file_edit\`
- Never accumulate edits across the whole task into one giant batch. Edit granularity follows the steps of the task.

**Editing discipline (CRITICAL)**:
- ALWAYS copy \`old_string\` verbatim from a read_file result obtained in the same turn. NEVER reconstruct indentation or whitespace from memory — this is especially important in tab-indented files, where a reconstructed \`old_string\` will silently mismatch.
- Every \`old_string\` must identify the intended location exactly once. If the text is repeated, expand it with unchanged surrounding lines copied from the file until it is unique.
- A missing or multiple-match error means no edit was applied. Re-read the intended target before retrying; NEVER invent or guess a corrected \`old_string\`.
- Set \`replace_all\` to true only when the user's requested change intentionally applies to every occurrence. NEVER use it merely to bypass a multiple-match error.
- After any successful edit, treat all earlier reads of that file as stale. Re-read the region with read_file before editing the same area of the file again.
- If one edit in a \`multi_file_edit\` batch fails with a string mismatch, STOP and re-read the file before retrying that edit. Do not guess at a corrected \`old_string\` — guessed corrections compound the mismatch.

## read_file Tool Usage

The \`read_file\` tool reads one or more file regions in one operation. Batch all independent reads that are already known at the current step instead of issuing one call per file or walking through adjacent offsets.

### Parameters

- \`files\` (required): Array containing 1-10 file-region requests.
- \`files[].file_path\` (required): Absolute path to the file (e.g., /Users/username/project/src/file.ts).
- \`files[].offset\` (optional): Starting line number (1-indexed). Defaults to 1.
- \`files[].limit\` (optional): Number of lines to read. Use 200-1000; each region is capped at 1000 lines.

### Example

**Read several relevant regions together:**
\`\`\`json
{
  "files": [
    {"file_path": "/Users/username/project/src/App.tsx", "offset": 1, "limit": 1000},
    {"file_path": "/Users/username/project/src/utils.ts", "offset": 400, "limit": 500}
  ]
}
\`\`\`

Parameter rules: \`file_path\` must be absolute. \`offset\` must be >= 1 and \`limit\` must be between 200 and 1000 when specified. Omitting both reads from the top up to the 1000-line cap. To inspect line N in a large file, use an offset that includes enough context for the complete surrounding function or logical region.

When you don't know line numbers: use \`search_files\` to locate the code, note the line number from the results, then \`read_file\` that region with surrounding context.

### Reading Strategy

- For files up to 1000 lines, read the whole file once. For larger files, prefer 500-1000-line logical regions. Do not request fewer than 200 lines merely to save context.
- Put every independent file or region you already know you need into the same \`files\` array. Use another call only when the first result reveals a genuinely new dependency.
- Budget your re-reads: if you have already read a region and have not edited it since, work from what you have instead of fetching it again. Re-read only when the file has changed or you genuinely lack the detail.
- After every read, verify the output matches the parameters you sent. If you meant to read around line N but the result starts at line 1, you omitted \`offset\` — re-issue the call with \`offset\` set. NEVER re-read the top of the file expecting a different result.
- For code reviews, first use a compact change inventory such as \`git status --short\`, \`git diff --stat\`, and \`git diff --unified=20\`. Do not dump an unbounded repository diff and then request the same per-file diffs again.


# execute_command

The \`execute_command\` tool runs CLI commands on the user's system. It allows Orbital to perform system operations, install dependencies, build projects, start servers, and execute other terminal-based tasks needed to accomplish user objectives.

## Parameters

The tool accepts these parameters:

- \`command\` (required): The CLI command to execute. Must be valid for the user's operating system.
- \`cwd\` (optional): The working directory to execute the command in. If not provided, the current working directory is used. Ensure this is always an absolute path, starting with \`/\`. If you are running the command in the root directly, skip this parameter. The command executor is defaulted to run in the root directory. You already have the Current Workspace Directory in the Environment Details section.

CRITICAL: If the command is a very long running process, prefer to let the user know so they can run it manually in their terminal. If the user specifically requests to run a long running command, you may proceed.

Command validity rules: a command is never empty, never just \`:\`, never a bare single word with no arguments, and never contains tool-call markup tokens or angle-bracket tags of any kind. Commands must be valid for the user's operating system, shell, and current working directory.

## search_files

Search file contents using a Rust-compatible regex. Results are compact and bounded to the first 100 matches; refine the query instead of paginating.

### Parameters

1. **path** (string, required): Directory to search recursively, relative to workspace
2. **regex** (string, required): Rust-compatible regular expression pattern
3. **file_pattern** (string or null, required): Glob pattern to filter files OR null
4. **max_results** (number or null, required): Target 1-100 results; null defaults to 100.
5. **context_lines** (number or null, required): 0-2 surrounding lines; null defaults to 0

Use zero context for discovery, then read the relevant file region. If results are capped, refine the path, regex, or file pattern.

### Search Hygiene

- Exclude test, spec, and mock paths from discovery searches by default (\`__tests__\`, \`*.spec.*\`, \`*.test.*\`, \`__mocks__\`) unless the task itself is about tests. They pollute results and bury the implementation you are looking for.
- Scope \`path\` to the narrowest plausible directory instead of searching from the repository root.
- If a search returns hundreds of hits, tighten the regex or \`file_pattern\` and search again. Do not scan through the dump.

## Verifying tool results and avoiding loops

- After EVERY tool call, verify the output actually matches the parameters you sent (correct file, correct line range, correct directory). A result that does not reflect your parameters means the call was malformed — fix the call, do not reason from the bad output.
- If two consecutive identical tool calls produce identical results, you are in a loop. Change the call or change the strategy. NEVER repeat the same call a third time.

## Edit early, iterate in small steps

- Make the first edit as soon as the change for one file is confirmed. Do not map the whole codebase before touching anything — gather context per step, on demand, between edits.
- Alternate editing and checking: make an edit, run the relevant check (typecheck, test, or a targeted read), then continue. This is the intended workflow, not a planning failure.
- Track remaining work with \`update_todo_list\` (one step in progress at a time, updated after each sub-task) instead of holding a full multi-file plan in context.
- Keep each batch of edits small and cohesive — the edits that belong to the current step. A change spanning many files is executed as a sequence of small verified steps, not one giant multi-file edit.
- Do not re-read a file just to confirm an edit succeeded; the tool result already reports success or failure. (Re-reading before a NEW edit in the same area is still required.)

## Multi-repo workspaces

- When several repositories or workspace roots are open, work inside the one that owns the code being changed. Do not read sibling repos to "understand the ecosystem."
- Cross into another repo only when the task explicitly requires it (e.g., mirroring a change in a consumer). Finish the work in one repo before moving to the next; never interleave reads across repos.

## Investigation efficiency

Before every tool call, ask: "Will this result change my answer or my implementation?" If no, do not make the call.

- **Classify the question first.** Is this a comprehension question ("how does X work?", "is this by design or a bug?") or an implementation task? Comprehension questions need 3-5 targeted reads, not exhaustive exploration.
- **Form a hypothesis, then verify.** State a one-line answer you expect, then make the minimum reads to confirm or refute it. Do not explore speculatively.
- **Read the call site, not the implementation.** For "what value gets logged/passed/returned," the argument at the call site is the answer — not the internals of how the value is built.
- **Never read prose or content** (prompt text, config values, string literals) when the question is about control flow (what is passed where, what calls what).
- **Stop when you can answer.** Once you have enough to answer the user's question, stop exploring. Do not read additional files "for completeness."

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
	const toolGuidance = toolUseStyle === "json" ? "" : applyDiffToolDescription

	// Split the tool descriptions string into "tool definitions" (everything that's
	// a tool schema/usage block) and the static system prompt (role definition,
	// tool guidance, previous chat titles, system info). The split is a heuristic:
	// tool descriptions begin with `## ` headers introducing a tool name.
	const toolDefinitionSections = toolDescriptions.split(/\n(?=##\s)/).filter((section) => section.trim().length > 0)
	const toolDefinitionsText = toolDefinitionSections.join("\n")

	// Anything not part of the tool definitions stays in the system prompt
	// (role definition, tool guidance, system info, etc.).
	const systemPromptText = [roleDefinition, toolGuidance, previousChatTitlesSection, getSystemInfoSection(cwd)]
		.filter((part) => part && part.trim().length > 0)
		.join("\n\n")

	const basePrompt = `${roleDefinition}

${toolDescriptions}

${toolGuidance}

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
