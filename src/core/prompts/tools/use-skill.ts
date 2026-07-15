import { discoverSkills } from "../../tools/skills"
import type { ToolArgs } from "./types"

export async function getUseSkillDescription(args: ToolArgs): Promise<string> {
	const skills = await discoverSkills({ workspacePath: args.cwd })

	if (skills.length === 0) {
		return `## use_skill
Description: Use a specific skill to guide the task execution. This tool allows you to apply predefined skills stored in the workspace's .orb/skills directory.
Parameters:
- skill_name: (required) The name of the skill to use.

No skills are currently available in this workspace. To add skills, create SKILL.md files in .orb/skills/<skill-name>/ directories.`
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
Description: Use a specific skill to guide the task execution. This tool allows you to apply predefined skills stored in the workspace's .orb/skills directory. Each skill contains specialized instructions for performing specific tasks or following particular patterns.
Parameters:
- skill_name: (required) The name of the skill to use. Available skills:
${skillList}

${example}`
}
