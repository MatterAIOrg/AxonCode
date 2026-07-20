import { discoverSkills } from "../../tools/skills"
import type { ToolArgs } from "./types"

export async function getUseSkillDescription(args: ToolArgs): Promise<string> {
	const skills = await discoverSkills({ workspacePath: args.cwd })

	if (skills.length === 0) {
		return `## use_skill
Description: Use a specific skill to guide the task execution. Load a discovered skill by name or load a skill from an explicit directory or SKILL.md path.
Parameters:
- skill_name: (required) A discovered skill name, plugin:skill name, or absolute, workspace-relative, or home-relative path to a skill directory or SKILL.md file.

No skills were discovered in this workspace. You can still use a skill by passing its path.`
	}

	const skillList = skills
		.map((skill) => {
			return `  - ${skill.metadata.name}: ${skill.metadata.description}`
		})
		.join("\n")

	const example = skills[0]
		? `Example: Using the "${skills[0].metadata.name}" skill

<use_skill>
<skill_name>${skills[0].metadata.name}</skill_name>
</use_skill>`
		: ""

	return `## use_skill
Description: Use a specific skill to guide the task execution. Load a discovered skill by name or load a skill from an explicit directory or SKILL.md path. Each skill contains specialized instructions for performing specific tasks or following particular patterns.
Parameters:
- skill_name: (required) A skill name from the list below, a plugin:skill name, or an absolute, workspace-relative, or home-relative path to a skill directory or SKILL.md file. Available skills:
${skillList}

${example}`
}
