import { Command } from "./commands"

interface BuiltInCommandDefinition {
	name: string
	description: string
	argumentHint?: string
	content: string
}

const BUILT_IN_COMMANDS: Record<string, BuiltInCommandDefinition> = {
	commit: {
		name: "commit",
		description: "Check pending changes and generate detailed commit messages",
		content: `<task>
Please check all the pending changes in the git repository and generate detailed commit messages. If needed, you can split into multiple commits also.

Instructions:
1. First, check all pending changes using git status and git diff
2. Group related changes together logically (e.g., a feature implementation, a bug fix, refactoring, etc.)
3. For each logical group, generate a detailed, conventional commit message following the format:
   type(scope): short description
   
   Detailed explanation of what changed and why
4. Create separate commits for each logical group using git add and git commit
5. For GitHub repositories only, attribute the commit author as: matterai-app[bot]

To detect if the repository is hosted on GitHub, check the remote URL using:
  git remote get-url origin
  
If the remote URL contains "github.com", use the author flag:
  git commit --author="matterai-app[bot] <matterai-app[bot]@users.noreply.github.com>"
</task>`,
	},
	migrate: {
		name: "migrate",
		description: "Import MCP servers from Cursor / Claude Code / Claude Desktop",
		argumentHint: "",
		content: `<task>
The user has explicitly asked to run the /migrate command, which imports MCP server configurations from other clients (Cursor, Claude Code, Claude Desktop) into Orbital's global MCP settings.

Your job is to inform the user that the migration UI is available in the MCP settings panel, and tell them how to invoke it. The actual file I/O happens in the extension host; you do not need to read or write any files yourself.

1. Tell the user: "Open the **MCP** tab in the Orbital sidebar and click **Migrate from Cursor / Claude** (cloud-download icon). A picker will appear listing every server Orbital found on your machine. Select the ones you want, then click **Apply**."
2. Mention the sources the picker covers:
   - **Cursor** — \`~/.cursor/mcp.json\` (global) and \`<workspace>/.cursor/mcp.json\` (project)
   - **Claude Code** — \`~/.claude/settings.json\` (user) and \`~/.claude.json\` (user + per-project)
   - **Claude Desktop** — platform-specific \`claude_desktop_config.json\`
3. Note that servers whose name already exists in the destination are skipped (no overwrite).
4. Alternative: \`mcp migrate --all\` in the CLI TUI imports every non-conflicting server without showing a picker.
5. Do not attempt to read or modify any MCP config files directly. Do not run shell commands to copy configs. End your response after step 4.
</task>`,
	},
	init: {
		name: "init",
		description: "Analyze the codebase and create a concise AGENTS.md to reduce cold-start",
		content: `<task>
Analyze this codebase and write a concise AGENTS.md that reduces cold-start for future coding sessions. Create or update the file at exactly this path, relative to the workspace root:

  .orb/AGENTS.md

Investigate first — read the directory layout, key config files, and a few representative source files — then write. Keep it under ~150 lines so it stays cheap to include in every future prompt. Cover, briefly:
1. What the project does (1-2 lines) and its main tech stack.
2. Project structure — the key directories/files and what each is responsible for.
3. Architecture — how the main pieces fit together (entry points, data/control flow).
4. Business-logic / domain mapping — where the core domain concepts live in the code.
5. Notable code patterns and conventions to follow (imports, naming, error handling, tests).
6. The common build, run, lint and test commands.

Start the file with a "# AGENTS.md" heading and a one-line note that it guides agents working in this repo. Favor durable facts over volatile detail. If an AGENTS.md already exists at .orb/AGENTS.md (or a legacy AGENTS.md in the project root), refine it rather than rewriting from scratch. Also fold in any existing AI-assistant rules you find (CLAUDE.md, .cursor/rules/ or .cursorrules, .github/copilot-instructions.md).
</task>`,
	},
	"create-skill": {
		name: "create-skill",
		description: "Create or update a repo-local skill from a plain-language description",
		argumentHint: "<describe the skill you want>",
		content: `<task>
Create or update a reusable skill for this repository from the user's text after /create-skill. Treat that text as the skill request, including any examples, constraints, or desired triggers they supplied. If it is missing or too ambiguous to implement safely, use ask_followup_question to ask one focused question before writing files.

All generated skill files must live under this repository path:

  .orb/skills/<skill-name>/

Do not create the skill in .orbcode, .claude, .agents, a home-directory skills folder, or anywhere else. Supporting scripts, references, and assets must also stay inside the same .orb/skills/<skill-name>/ directory. During this command, do not modify any file outside that skill directory.

Workflow:
1. Read .orb/AGENTS.md when present, inspect the relevant repository files, and check existing skills in .orb/skills so the new skill reflects this codebase and does not accidentally overwrite a different skill.
2. Derive a short, descriptive skill name using lowercase letters, digits, and hyphens only. Keep it under 64 characters and use that exact value for both the folder name and the frontmatter name.
3. Decide whether the skill needs only SKILL.md or also reusable scripts, references, or assets. Create only files that directly help execute the requested workflow repeatedly.
4. Write .orb/skills/<skill-name>/SKILL.md with YAML frontmatter containing exactly name and description. Make the description say both what the skill does and when it should be used. Write the body as concise imperative instructions for another coding agent; keep essential guidance in SKILL.md and place lengthy detail in directly linked reference files.
5. Preserve useful existing content when updating a skill. Do not create extra README, changelog, installation, or quick-reference files inside the skill.
6. Test any scripts you add. Then read the generated files back and verify the folder name, frontmatter name, description, paths, and instructions are consistent.
7. Finish by reporting the created or updated skill name, its .orb/skills path, and a short summary of what it teaches the agent.
</task>`,
	},
	link: {
		name: "link",
		description: "Link other repos so changes here are checked against them",
		argumentHint: "",
		content: `<task>
The user wants to manage Linked Repositories for this project. Linked repos are other codebases on disk that are coupled to this one; once linked, Orbital injects them (and their AGENTS.md) into the environment so changes here can be checked for impact on — or propagated to — them.

Links are stored in a file shared by both the Orbital extension and the OrbCode CLI:

  .orb/links.json   (relative to the workspace root)

Schema:
{
  "links": [
    { "input": "<exactly what the user pasted>" }
  ]
}

Each "input" is a folder path — absolute, a "~/path", or relative to the workspace root. Store it verbatim — the host resolves and validates the path when building context, so you do not need to resolve it yourself.

Steps:
1. Read .orb/links.json if it exists and show the user the repos currently linked (their "input" values). If the file is missing, treat the list as empty.
2. Use the ask_followup_question tool to ask what they want to do: add a repo (have them enter its folder path), remove one of the existing links, or finish.
3. Apply the change by writing .orb/links.json with the updated "links" array (create the .orb directory if needed). Never add duplicates; preserve entries you are not changing.
4. Repeat from step 2 until the user is done, then confirm the final list and tell them the linked repos are included automatically in the next task's context.

Do not read or modify files inside the linked repositories during this command — you are only editing .orb/links.json.
</task>`,
	},
}

/**
 * Get all built-in commands as Command objects
 */
export async function getBuiltInCommands(): Promise<Command[]> {
	return Object.values(BUILT_IN_COMMANDS).map((cmd) => ({
		name: cmd.name,
		content: cmd.content,
		source: "built-in" as const,
		filePath: `<built-in:${cmd.name}>`,
		description: cmd.description,
		argumentHint: cmd.argumentHint,
	}))
}

/**
 * Get a specific built-in command by name
 */
export async function getBuiltInCommand(name: string): Promise<Command | undefined> {
	const cmd = BUILT_IN_COMMANDS[name]
	if (!cmd) return undefined

	return {
		name: cmd.name,
		content: cmd.content,
		source: "built-in" as const,
		filePath: `<built-in:${name}>`,
		description: cmd.description,
		argumentHint: cmd.argumentHint,
	}
}

/**
 * Get names of all built-in commands
 */
export async function getBuiltInCommandNames(): Promise<string[]> {
	return Object.keys(BUILT_IN_COMMANDS)
}
