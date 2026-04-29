import axios from "axios"
import { Task } from "../task/Task"
import { ToolUse, AskApproval, HandleError, PushToolResult, RemoveClosingTag } from "../../shared/tools"
import { ClineSayTool } from "../../shared/ExtensionMessage"
import { formatResponse } from "../prompts/responses"

interface WebFetchResponse {
	excerpts: string[]
}

export async function webFetchTool(
	cline: Task,
	block: ToolUse,
	askApproval: AskApproval,
	handleError: HandleError,
	pushToolResult: PushToolResult,
	removeClosingTag: RemoveClosingTag,
) {
	const toolName = "web_fetch"

	let url: string | undefined = block.params.url

	const sharedMessageProps: ClineSayTool = {
		tool: "webFetch",
		content: url,
	}

	if (block.partial) {
		await cline.ask("tool", JSON.stringify(sharedMessageProps), block.partial).catch(() => {})
		return
	}

	url = removeClosingTag("url", url)

	if (!url) {
		cline.consecutiveMistakeCount++
		pushToolResult(await cline.sayAndCreateMissingParamError(toolName, "url"))
		return
	}

	// Validate URL format
	try {
		new URL(url)
	} catch (e) {
		pushToolResult(formatResponse.toolError(`Invalid URL format: ${url}`))
		return
	}

	cline.consecutiveMistakeCount = 0

	// Send message to UI and auto-approve (no approval needed for web tools)
	const completeMessage = JSON.stringify({ ...sharedMessageProps, content: url } satisfies ClineSayTool)

	// Auto-approve - show in UI and immediately approve.
	// forked_change: guard handleWebviewAskResponse (mocks in tests may not
	// implement it) and swallow any race-condition error from cline.ask (e.g.
	// "Current ask promise was ignored") so it never aborts the tool flow —
	// this is purely UI surfacing, the tool result is still pushed below.
	setImmediate(() => {
		try {
			cline.handleWebviewAskResponse?.("yesButtonClicked", undefined, undefined)
		} catch {
			// best-effort
		}
	})
	await cline.ask("tool", completeMessage, false).catch(() => {})

	// Get kilocodeToken from provider state
	const provider = await cline.providerRef.deref()
	const providerState = await provider?.getState()
	const kilocodeToken = providerState?.apiConfiguration?.kilocodeToken

	if (!kilocodeToken) {
		pushToolResult(
			formatResponse.toolError("Kilocode token is required for web fetch. Please configure your token."),
		)
		return
	}

	try {
		const apiUrl = `https://api.matterai.so/axoncode/webFetch?token=${kilocodeToken}`

		const response = await axios.post<WebFetchResponse>(
			apiUrl,
			{ url },
			{
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${kilocodeToken}`,
				},
				timeout: 30000,
			},
		)

		const excerpts = response.data.excerpts

		if (!excerpts || excerpts.length === 0) {
			pushToolResult(`No content could be extracted from URL: "${url}"`)
			return
		}

		// Format excerpts for LLM
		const formattedContent = excerpts.join("\n\n")

		pushToolResult(`Content from ${url}:\n\n${formattedContent}`)
	} catch (error: any) {
		if (error.response?.status === 401) {
			pushToolResult(formatResponse.toolError("Authentication failed. Please check your Kilocode token."))
		} else if (error.response?.status === 429) {
			pushToolResult(formatResponse.toolError("Rate limit exceeded. Please try again later."))
		} else {
			await handleError(toolName, error)
		}
	}
}
