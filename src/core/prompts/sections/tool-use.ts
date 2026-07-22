import { ToolUseStyle } from "../../../../packages/types/src" // kilocode_change

export function getSharedToolUseSection(
	toolUseStyle?: ToolUseStyle, // kilocode_change
): string {
	const executionGuidance =
		toolUseStyle === "json"
			? "You MUST use the provided tools while executing a task. When several tool calls are independent (especially file reads and searches), include them in the same message so they can run together. Keep dependent calls sequential so each can use the previous result."
			: "You must use exactly one tool per message and use tools step-by-step, with each tool use informed by the previous result."

	return `====

TOOL USE

You have access to a set of tools that are executed upon the user's approval. ${executionGuidance}${
		toolUseStyle === "json" // kilocode_change
			? ""
			: `

# Tool Use Formatting

Tool uses are formatted using XML-style tags. The tool name itself becomes the XML tag name. Each parameter is enclosed within its own set of tags. Here's the structure:

<actual_tool_name>
<parameter1_name>value1</parameter1_name>
<parameter2_name>value2</parameter2_name>
...
</actual_tool_name>

Always use the actual tool name as the XML tag name for proper parsing and execution.`
	}`
}
