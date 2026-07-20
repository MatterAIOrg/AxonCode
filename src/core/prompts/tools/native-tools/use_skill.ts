import type OpenAI from "openai"

export default {
	type: "function",
	function: {
		name: "use_skill",
		description:
			"Use a discovered skill by name or load one from an explicit skill directory or SKILL.md path. Skills contain specialized instructions for performing specific tasks or following particular patterns.",
		strict: true,
		parameters: {
			type: "object",
			properties: {
				skill_name: {
					type: "string",
					description:
						"A discovered skill name, plugin:skill name, or an absolute, workspace-relative, or home-relative path to a skill directory or SKILL.md file.",
				},
			},
			required: ["skill_name"],
			additionalProperties: false,
		},
	},
} satisfies OpenAI.Chat.ChatCompletionTool
