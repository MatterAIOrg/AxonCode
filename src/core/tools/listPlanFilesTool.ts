import { Task } from "../task/Task"
import { formatResponse } from "../prompts/responses"
import { HandleError, PushToolResult, ToolUse } from "../../shared/tools"

export async function listPlanFilesTool(
	cline: Task,
	block: ToolUse,
	handleError: HandleError,
	pushToolResult: PushToolResult,
): Promise<void> {
	try {
		if (block.partial) {
			await cline
				.ask(
					"tool",
					JSON.stringify({
						tool: "listPlanFiles",
					}),
					block.partial,
				)
				.catch(() => {})
			return
		}

		// List from plan memory
		if (cline.planMemoryManager) {
			const files = cline.planMemoryManager.getAllFiles()

			if (files.size === 0) {
				pushToolResult("No plan files exist yet. Use plan_file_edit to create your first plan file.")
				return
			}

			const fileList = Array.from(files.entries())
				.map(([filename, content]) => {
					const lineCount = content.split("\n").length
					return `- ${filename} (${lineCount} lines)`
				})
				.join("\n")

			pushToolResult(`Plan files:\n${fileList}`)

			// Process any queued messages after listing plan files
			cline.processQueuedMessages()
		} else {
			const errorMessage = "Plan memory manager is not available"
			const formattedError = formatResponse.toolError(errorMessage)
			await cline.say("error", formattedError)
			pushToolResult(formattedError)
		}
	} catch (error) {
		await handleError("listing plan files", error as Error)
	}
}
