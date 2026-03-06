import axios from "axios"
import { Task } from "../task/Task"
import { ToolUse, AskApproval, HandleError, PushToolResult, RemoveClosingTag } from "../../shared/tools"
import { ClineSayTool } from "../../shared/ExtensionMessage"
import { formatResponse } from "../prompts/responses"

interface WebSearchResult {
	url: string
	title: string
	publish_date?: string
	excerpts: string[]
}

interface WebSearchResponse {
	results: WebSearchResult[]
}

export async function webSearchTool(
	cline: Task,
	block: ToolUse,
	askApproval: AskApproval,
	handleError: HandleError,
	pushToolResult: PushToolResult,
	removeClosingTag: RemoveClosingTag,
) {
	const toolName = "web_search"
	console.log(`[webSearchTool] Called with block:`, JSON.stringify(block, null, 2))

	let query: string | undefined = block.params.query
	console.log(`[webSearchTool] Extracted query: ${query}`)

	const sharedMessageProps: ClineSayTool = {
		tool: "webSearch",
		query: query,
	}

	if (block.partial) {
		console.log(`[webSearchTool] Block is partial, streaming...`)
		await cline.ask("tool", JSON.stringify(sharedMessageProps), block.partial).catch(() => {})
		return
	}

	console.log(`[webSearchTool] Block is complete, processing...`)
	query = removeClosingTag("query", query)
	console.log(`[webSearchTool] Query after removeClosingTag: ${query}`)

	if (!query) {
		console.log(`[webSearchTool] Query is missing, returning error`)
		cline.consecutiveMistakeCount++
		pushToolResult(await cline.sayAndCreateMissingParamError(toolName, "query"))
		return
	}

	cline.consecutiveMistakeCount = 0

	// Send message to UI and auto-approve (no approval needed for web tools)
	const completeMessage = JSON.stringify({ ...sharedMessageProps, query } satisfies ClineSayTool)

	// Auto-approve - show in UI and immediately approve
	setImmediate(() => {
		cline.handleWebviewAskResponse("yesButtonClicked", undefined, undefined)
	})
	await cline.ask("tool", completeMessage, false)

	// Get kilocodeToken from provider state
	const provider = await cline.providerRef.deref()
	const providerState = await provider?.getState()
	const kilocodeToken = providerState?.apiConfiguration?.kilocodeToken

	console.log(`[webSearchTool] kilocodeToken present: ${!!kilocodeToken}`)

	if (!kilocodeToken) {
		pushToolResult(
			formatResponse.toolError("Kilocode token is required for web search. Please configure your token."),
		)
		return
	}

	try {
		const url = `https://api.matterai.so/axoncode/websearch?token=${kilocodeToken}`
		console.log(`[webSearchTool] Calling API: ${url}`)

		const response = await axios.post<WebSearchResponse>(
			url,
			{ query },
			{
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${kilocodeToken}`,
				},
				timeout: 30000,
			},
		)

		console.log(`[webSearchTool] API response status: ${response.status}`)
		const results = response.data.results
		console.log(`[webSearchTool] Results count: ${results?.length ?? 0}`)

		if (!results || results.length === 0) {
			pushToolResult(`No results found for query: "${query}"`)
			return
		}

		// Format results for LLM
		const formattedResults = results
			.map((result, index) => {
				let entry = `[${index + 1}] ${result.title}\nURL: ${result.url}`
				if (result.publish_date) {
					entry += `\nPublished: ${result.publish_date}`
				}
				if (result.excerpts && result.excerpts.length > 0) {
					entry += `\n\n${result.excerpts.join("\n\n")}`
				}
				return entry
			})
			.join("\n\n---\n\n")

		console.log(`[webSearchTool] Pushing formatted results`)
		pushToolResult(`Search results for "${query}":\n\n${formattedResults}`)
	} catch (error: any) {
		console.error(`[webSearchTool] Error:`, error)
		if (error.response?.status === 401) {
			pushToolResult(formatResponse.toolError("Authentication failed. Please check your Kilocode token."))
		} else if (error.response?.status === 429) {
			pushToolResult(formatResponse.toolError("Rate limit exceeded. Please try again later."))
		} else {
			await handleError(toolName, error)
		}
	}
}
