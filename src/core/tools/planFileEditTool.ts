import { Task } from "../task/Task"
import { formatResponse } from "../prompts/responses"
import { HandleError, PushToolResult, RemoveClosingTag, ToolUse } from "../../shared/tools"
import { ClineSayTool } from "../../shared/ExtensionMessage"

export async function planFileEditTool(
	cline: Task,
	block: ToolUse,
	handleError: HandleError,
	pushToolResult: PushToolResult,
	removeClosingTag: RemoveClosingTag,
): Promise<void> {
	const filename = removeClosingTag("filename", block.params.filename)
	const content = removeClosingTag("content", block.params.content)

	try {
		if (block.partial) {
			const partialMessageProps: ClineSayTool = {
				tool: "planFileEdit",
				filename,
				content,
			}

			await cline.ask("tool", JSON.stringify(partialMessageProps), block.partial).catch(() => {})
			return
		}

		// Validate parameters
		if (!filename || !content) {
			cline.consecutiveMistakeCount++
			cline.recordToolError("plan_file_edit")
			const errorMessage = "Both filename and content are required for plan_file_edit"
			const formattedError = formatResponse.toolError(errorMessage)
			await cline.say("error", formattedError)
			pushToolResult(formattedError)
			return
		}

		// Write to plan memory
		if (cline.planMemoryManager) {
			const isUpdate = cline.planMemoryManager.hasFile(filename)
			const oldContent = isUpdate ? cline.planMemoryManager.readFile(filename) : ""

			await cline.planMemoryManager.writeFile(filename, content)

			// Provide contextual feedback
			let successMessage: string
			if (isUpdate) {
				successMessage = `Plan file '${filename}' has been updated.`
				if (oldContent && oldContent !== content) {
					// Calculate and show a brief summary of changes
					const oldLines = oldContent.split("\n").length
					const newLines = content.split("\n").length
					successMessage += ` (${oldLines} lines → ${newLines} lines)`
				}
			} else {
				successMessage = `Plan file '${filename}' has been created.`
			}

			const messageProps: ClineSayTool = {
				tool: "planFileEdit",
				filename,
				content,
			}

			await cline.ask("tool", JSON.stringify(messageProps))
			pushToolResult(successMessage)

			// Process any queued messages after plan file edit completes
			cline.processQueuedMessages()
		} else {
			const errorMessage = "Plan memory manager is not available"
			const formattedError = formatResponse.toolError(errorMessage)
			await cline.say("error", formattedError)
			pushToolResult(formattedError)
		}
	} catch (error) {
		await handleError("editing plan file", error as Error)
	}
}
