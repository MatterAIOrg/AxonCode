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

	let query: string | undefined = block.params.query

	const sharedMessageProps: ClineSayTool = {
		tool: "webSearch",
		query: query,
	}

	if (block.partial) {
		await cline.ask("tool", JSON.stringify(sharedMessageProps), block.partial).catch(() => {})
		return
	}

	query = removeClosingTag("query", query)

	if (!query) {
		cline.consecutiveMistakeCount++
		pushToolResult(await cline.sayAndCreateMissingParamError(toolName, "query"))
		return
	}

	cline.consecutiveMistakeCount = 0

	// Send message to UI and auto-approve (no approval needed for web tools)
	const completeMessage = JSON.stringify({ ...sharedMessageProps, query } satisfies ClineSayTool)

	// Auto-approve - show in UI and immediately approve.
	// forked_change: guard handleWebviewAskResponse (mocks in tests may not
	// implement it) and swallow any race-condition error from cline.ask (e.g.
	// "Current ask promise was ignored") so it never aborts the tool flow.
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
			formatResponse.toolError("Kilocode token is required for web search. Please configure your token."),
		)
		return
	}

	try {
		const url = `https://api.matterai.so/axoncode/websearch?token=${kilocodeToken}`

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

		const results = response.data.results

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

		pushToolResult(`Search results for "${query}":\n\n${formattedResults}`)
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
