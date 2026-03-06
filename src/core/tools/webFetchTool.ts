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
	console.log(`[webFetchTool] Called with block:`, JSON.stringify(block, null, 2))

	let url: string | undefined = block.params.url
	console.log(`[webFetchTool] Extracted URL: ${url}`)

	const sharedMessageProps: ClineSayTool = {
		tool: "webFetch",
		content: url,
	}

	if (block.partial) {
		console.log(`[webFetchTool] Block is partial, streaming...`)
		await cline.ask("tool", JSON.stringify(sharedMessageProps), block.partial).catch(() => {})
		return
	}

	console.log(`[webFetchTool] Block is complete, processing...`)
	url = removeClosingTag("url", url)
	console.log(`[webFetchTool] URL after removeClosingTag: ${url}`)

	if (!url) {
		console.log(`[webFetchTool] URL is missing, returning error`)
		cline.consecutiveMistakeCount++
		pushToolResult(await cline.sayAndCreateMissingParamError(toolName, "url"))
		return
	}

	// Validate URL format
	try {
		new URL(url)
		console.log(`[webFetchTool] URL validation passed`)
	} catch (e) {
		console.log(`[webFetchTool] URL validation failed:`, e)
		pushToolResult(formatResponse.toolError(`Invalid URL format: ${url}`))
		return
	}

	cline.consecutiveMistakeCount = 0

	// Send message to UI and auto-approve (no approval needed for web tools)
	const completeMessage = JSON.stringify({ ...sharedMessageProps, content: url } satisfies ClineSayTool)

	// Auto-approve - show in UI and immediately approve
	setImmediate(() => {
		cline.handleWebviewAskResponse("yesButtonClicked", undefined, undefined)
	})
	await cline.ask("tool", completeMessage, false)

	// Get kilocodeToken from provider state
	const provider = await cline.providerRef.deref()
	const providerState = await provider?.getState()
	const kilocodeToken = providerState?.apiConfiguration?.kilocodeToken

	console.log(`[webFetchTool] kilocodeToken present: ${!!kilocodeToken}`)

	if (!kilocodeToken) {
		pushToolResult(
			formatResponse.toolError("Kilocode token is required for web fetch. Please configure your token."),
		)
		return
	}

	try {
		const apiUrl = `https://api.matterai.so/axoncode/webFetch?token=${kilocodeToken}`
		console.log(`[webFetchTool] Calling API: ${apiUrl}`)

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

		console.log(`[webFetchTool] API response status: ${response.status}`)
		const excerpts = response.data.excerpts
		console.log(`[webFetchTool] Excerpts count: ${excerpts?.length ?? 0}`)

		if (!excerpts || excerpts.length === 0) {
			pushToolResult(`No content could be extracted from URL: "${url}"`)
			return
		}

		// Format excerpts for LLM
		const formattedContent = excerpts.join("\n\n")

		console.log(`[webFetchTool] Pushing formatted content`)
		pushToolResult(`Content from ${url}:\n\n${formattedContent}`)
	} catch (error: any) {
		console.error(`[webFetchTool] Error:`, error)
		if (error.response?.status === 401) {
			pushToolResult(formatResponse.toolError("Authentication failed. Please check your Kilocode token."))
		} else if (error.response?.status === 429) {
			pushToolResult(formatResponse.toolError("Rate limit exceeded. Please try again later."))
		} else {
			await handleError(toolName, error)
		}
	}
}
