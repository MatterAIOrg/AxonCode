import { Task } from "../task/Task"
import { formatResponse } from "../prompts/responses"
import { HandleError, PushToolResult, RemoveClosingTag, ToolUse } from "../../shared/tools"

export async function readPlanFileTool(
	cline: Task,
	block: ToolUse,
	handleError: HandleError,
	pushToolResult: PushToolResult,
	removeClosingTag: RemoveClosingTag,
): Promise<void> {
	const filename = removeClosingTag("filename", block.params.filename)

	try {
		if (block.partial) {
			await cline
				.ask(
					"tool",
					JSON.stringify({
						tool: "readPlanFile",
						filename,
					}),
					block.partial,
				)
				.catch(() => {})
			return
		}

		// Validate parameters
		if (!filename) {
			cline.consecutiveMistakeCount++
			cline.recordToolError("read_plan_file")
			const errorMessage = "Filename is required for read_plan_file"
			const formattedError = formatResponse.toolError(errorMessage)
			await cline.say("error", formattedError)
			pushToolResult(formattedError)
			return
		}

		// Read from plan memory
		if (cline.planMemoryManager) {
			const content = cline.planMemoryManager.readFile(filename)

			if (content === undefined) {
				const notFoundMessage = `Plan file '${filename}' not found. Use plan_file_edit to create it first.`
				const formattedError = formatResponse.toolError(notFoundMessage)
				await cline.say("error", formattedError)
				pushToolResult(formattedError)
				return
			}

			pushToolResult(content)

			// Process any queued messages after reading plan file
			cline.processQueuedMessages()
		} else {
			const errorMessage = "Plan memory manager is not available"
			const formattedError = formatResponse.toolError(errorMessage)
			await cline.say("error", formattedError)
			pushToolResult(formattedError)
		}
	} catch (error) {
		await handleError("reading plan file", error as Error)
	}
}
