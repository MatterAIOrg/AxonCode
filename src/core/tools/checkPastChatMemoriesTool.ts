import { Task } from "../task/Task"
import { ToolUse, AskApproval, HandleError, PushToolResult, RemoveClosingTag } from "../../shared/tools"
import { ClineSayTool } from "../../shared/ExtensionMessage"
import { MemoryManager } from "../../services/chat-memory"

export async function checkPastChatMemoriesTool(
	cline: Task,
	block: ToolUse,
	askApproval: AskApproval,
	handleError: HandleError,
	pushToolResult: PushToolResult,
	removeClosingTag: RemoveClosingTag,
) {
	const regex: string | undefined = block.params.regex
	const workspace: string | undefined = block.params.workspace

	const sharedMessageProps: ClineSayTool = {
		tool: "checkPastChatMemories",
		regex: removeClosingTag("regex", regex),
		workspace: removeClosingTag("workspace", workspace),
	}

	try {
		if (block.partial) {
			const partialMessage = JSON.stringify({ ...sharedMessageProps, content: "" } satisfies ClineSayTool)
			await cline.ask("tool", partialMessage, block.partial).catch(() => {})
			return
		} else {
			if (!regex) {
				cline.consecutiveMistakeCount++
				cline.recordToolError("check_past_chat_memories")
				pushToolResult(await cline.sayAndCreateMissingParamError("check_past_chat_memories", "regex"))
				return
			}

			cline.consecutiveMistakeCount = 0

			// Get global storage path from provider
			const provider = cline.providerRef.deref()
			const globalStoragePath = provider?.contextProxy.globalStorageUri.fsPath

			if (!globalStoragePath) {
				pushToolResult("Unable to access global storage path.")
				return
			}

			// Get memory manager instance
			const memoryManager = new MemoryManager(globalStoragePath)

			// Search memories
			const memories = await memoryManager.searchMemories({
				regex,
				workspace: workspace || cline.cwd,
			})

			// Format results
			let formattedResults = ""
			if (memories.length === 0) {
				formattedResults = "No matching memories found."
			} else {
				formattedResults = `Found ${memories.length} matching memories:\n\n`
				memories.forEach((memory, index) => {
					const date = new Date(memory.timestamp).toLocaleDateString()
					formattedResults += `${index + 1}. Task: ${memory.taskTitle || memory.taskId}\n`
					formattedResults += `   Date: ${date}\n`
					formattedResults += `   Mode: ${memory.mode || "N/A"}\n`
					formattedResults += `   Content:\n${memory.content}\n\n`
				})
			}

			const completeMessage = JSON.stringify({
				...sharedMessageProps,
				content: formattedResults,
			} satisfies ClineSayTool)
			const didApprove = await askApproval("tool", completeMessage)

			if (!didApprove) {
				return
			}

			pushToolResult(formattedResults)

			return
		}
	} catch (error) {
		await handleError("searching chat memories", error)
		return
	}
}
