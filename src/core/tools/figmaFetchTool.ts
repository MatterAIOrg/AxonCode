import axios from "axios"
import { Task } from "../task/Task"
import { ToolUse, AskApproval, HandleError, PushToolResult, RemoveClosingTag } from "../../shared/tools"
import { ClineSayTool } from "../../shared/ExtensionMessage"
import { formatResponse } from "../prompts/responses"

interface FigmaDesignData {
	fileKey: string
	nodeId: string | null
	name: string
	lastModified: string
	thumbnailUrl: string
	nodes: Record<string, { document: unknown; components: Record<string, unknown> }>
	components: Record<string, unknown>
	styles: Record<string, unknown>
	images: Record<string, string | null>
}

interface FigmaFetchResponse {
	success: boolean
	data?: FigmaDesignData
	error?: string
}

export async function figmaFetchTool(
	cline: Task,
	block: ToolUse,
	askApproval: AskApproval,
	handleError: HandleError,
	pushToolResult: PushToolResult,
	removeClosingTag: RemoveClosingTag,
) {
	const toolName = "figma_fetch"

	let url: string | undefined = block.params.url

	const sharedMessageProps: ClineSayTool = {
		tool: "figmaFetch",
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
			formatResponse.toolError("MatterAI token is required for Figma fetch. Please configure your token."),
		)
		return
	}

	try {
		const apiUrl = `https://api.matterai.so/axoncode/figma?token=${kilocodeToken}`

		const response = await axios.post<FigmaFetchResponse>(
			apiUrl,
			{ url, render_images: true, image_format: "png" },
			{
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${kilocodeToken}`,
				},
				timeout: 60000,
			},
		)

		const data = response.data

		if (!data.success || !data.data) {
			pushToolResult(formatResponse.toolError(data.error ?? "Could not fetch the Figma design."))
			return
		}

		const d = data.data
		const imageUrls = Object.entries(d.images ?? {})
			.map(([id, u]) => `node ${id}: ${u}`)
			.join("\n")

		const formattedContent =
			`Figma file: ${d.name} (key: ${d.fileKey})\n` +
			`Last modified: ${d.lastModified}\n` +
			`Thumbnail: ${d.thumbnailUrl}\n` +
			`Nodes:\n` +
			JSON.stringify(d.nodes, null, 2) +
			(imageUrls ? `\n\nRendered images:\n${imageUrls}` : "")

		pushToolResult(`Figma design data for ${url}:\n\n${formattedContent}`)
	} catch (error: any) {
		if (error.response?.status === 401) {
			pushToolResult(formatResponse.toolError("Authentication failed. Please check your MatterAI token."))
		} else if (error.response?.status === 429) {
			pushToolResult(formatResponse.toolError("Rate limit exceeded. Please try again later."))
		} else if (error.response?.status === 400) {
			const errMsg = error.response?.data?.error ?? "Bad request"
			pushToolResult(formatResponse.toolError(errMsg))
		} else {
			await handleError(toolName, error)
		}
	}
}
