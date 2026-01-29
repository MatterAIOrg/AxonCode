import { Task } from "../task/Task"
import { getSkillByName } from "./skills"
import { ClineSayTool } from "../../shared/ExtensionMessage"
import { formatResponse } from "../prompts/responses"
import { ToolUse, AskApproval, HandleError, PushToolResult } from "../../shared/tools"

export async function useSkillTool(
	cline: Task,
	block: ToolUse,
	askApproval: AskApproval,
	handleError: HandleError,
	pushToolResult: PushToolResult,
) {
	const skillName: string | undefined = block.params.skill_name
	const sharedMessageProps: ClineSayTool = { tool: "useSkill", content: skillName }

	try {
		if (block.partial) {
			const partialMessage = JSON.stringify({ ...sharedMessageProps, content: undefined } satisfies ClineSayTool)
			await cline.ask("tool", partialMessage, block.partial).catch(() => {})
			return
		} else {
			if (!skillName) {
				cline.consecutiveMistakeCount++
				cline.recordToolError("use_skill")
				pushToolResult(await cline.sayAndCreateMissingParamError("use_skill", "skill_name"))
				return
			}

			cline.consecutiveMistakeCount = 0

			const completeMessage = JSON.stringify({ ...sharedMessageProps, content: skillName } satisfies ClineSayTool)
			const didApprove = await askApproval("tool", completeMessage)

			if (!didApprove) {
				return
			}

			// Fetch the skill content
			const skill = await getSkillByName(skillName, { workspacePath: cline.workspacePath })

			if (!skill) {
				pushToolResult(
					formatResponse.toolError(
						`Skill "${skillName}" not found. Make sure the skill exists in .agent/skills/<skill-name>/SKILL.md`,
					),
				)
				return
			}

			// Format the response with the skill content
			const formattedResponse = `You are requested to follow the below instructions

${skill.content}`

			pushToolResult(formattedResponse)

			return
		}
	} catch (error) {
		await handleError("using skill", error)
	}
}
