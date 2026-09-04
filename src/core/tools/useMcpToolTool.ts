import { Task } from "../task/Task"
import { ToolUse, AskApproval, HandleError, PushToolResult, RemoveClosingTag } from "../../shared/tools"
import { formatResponse } from "../prompts/responses"
import { ClineAskUseMcpServer } from "../../shared/ExtensionMessage"
import { McpExecutionStatus } from "@roo-code/types"
import { t } from "../../i18n"
import { McpToolCallResponse, McpAuthError } from "../../shared/mcp" // kilocode_change
import { summarizeSuccessfulMcpOutputWhenTooLong } from "./kilocode" // kilocode_change
import { formatArgumentRepairNote, parseToolCallArguments } from "../../utils/jsonRepair" // forked_change

interface McpToolParams {
	server_name?: string
	tool_name?: string
	arguments?: string | Record<string, unknown>
}

type ValidationResult =
	| { isValid: false }
	| {
			isValid: true
			serverName: string
			toolName: string
			parsedArguments?: Record<string, unknown>
			argumentsRepaired?: boolean
	  }

async function handlePartialRequest(
	cline: Task,
	params: McpToolParams,
	removeClosingTag: RemoveClosingTag,
): Promise<void> {
	// Always include arguments field (even if empty object)
	// Handle both string (from XML) and object (from native function calling)
	let argumentsString: string
	if (typeof params.arguments === "string") {
		argumentsString = removeClosingTag("arguments", params.arguments) || "{}"
	} else if (typeof params.arguments === "object" && params.arguments !== null) {
		argumentsString = JSON.stringify(params.arguments)
	} else {
		argumentsString = "{}"
	}

	// Generate executionId early for consistent tracking
	const executionId = cline.lastMessageTs?.toString() ?? Date.now().toString()

	const partialMessage = JSON.stringify({
		type: "use_mcp_tool",
		serverName: removeClosingTag("server_name", params.server_name),
		toolName: removeClosingTag("tool_name", params.tool_name),
		arguments: argumentsString,
		executionId,
	} satisfies ClineAskUseMcpServer)

	await cline.ask("use_mcp_server", partialMessage, true).catch(() => {})
}

async function validateParams(
	cline: Task,
	params: McpToolParams,
	pushToolResult: PushToolResult,
): Promise<ValidationResult> {
	if (!params.server_name) {
		cline.consecutiveMistakeCount++
		cline.recordToolError("use_mcp_tool")
		pushToolResult(await cline.sayAndCreateMissingParamError("use_mcp_tool", "server_name"))
		return { isValid: false }
	}

	if (!params.tool_name) {
		cline.consecutiveMistakeCount++
		cline.recordToolError("use_mcp_tool")
		pushToolResult(await cline.sayAndCreateMissingParamError("use_mcp_tool", "tool_name"))
		return { isValid: false }
	}

	let parsedArguments: Record<string, unknown> = {}
	let argumentsRepaired = false

	if (params.arguments) {
		try {
			// Handle both string (from XML) and object (from native function calling)
			if (typeof params.arguments === "string") {
				// forked_change: repair malformed JSON arguments (placeholder tags,
				// unquoted values, single quotes, truncation) instead of failing the
				// whole tool call. XML-mode arguments arrive complete, so truncated
				// input is closed here too.
				const parsed = parseToolCallArguments(params.arguments, { repairTruncated: true })
				if (!parsed) {
					throw new Error("Invalid JSON in tool arguments")
				}
				if (parsed.args && typeof parsed.args === "object" && !Array.isArray(parsed.args)) {
					parsedArguments = parsed.args as Record<string, unknown>
					argumentsRepaired = parsed.repaired
				}
			} else if (typeof params.arguments === "object") {
				// Already parsed (from native function calling)
				parsedArguments = params.arguments
			}
			console.log("[MCP Debug] validateParams - parsed arguments:", parsedArguments)
		} catch (error) {
			cline.consecutiveMistakeCount++
			cline.recordToolError("use_mcp_tool")
			await cline.say("error", t("mcp:errors.invalidJsonArgument", { toolName: params.tool_name }))

			pushToolResult(
				formatResponse.toolError(
					formatResponse.invalidMcpToolArgumentError(params.server_name, params.tool_name),
				),
			)
			return { isValid: false }
		}
	}

	return {
		isValid: true,
		serverName: params.server_name,
		toolName: params.tool_name,
		parsedArguments,
		argumentsRepaired,
	}
}

async function validateToolExists(
	cline: Task,
	serverName: string,
	toolName: string,
	pushToolResult: PushToolResult,
): Promise<{ isValid: boolean; availableTools?: string[] }> {
	try {
		// Get the MCP hub to access server information
		const provider = cline.providerRef.deref()
		const mcpHub = provider?.getMcpHub()

		if (!mcpHub) {
			// If we can't get the MCP hub, we can't validate, so proceed with caution
			return { isValid: true }
		}

		// Get all servers to find the specific one
		const servers = mcpHub.getAllServers()
		const server = servers.find((s) => s.name === serverName)

		if (!server) {
			// Fail fast when server is unknown
			const availableServersArray = servers.map((s) => s.name)
			const availableServers =
				availableServersArray.length > 0 ? availableServersArray.join(", ") : "No servers available"

			cline.consecutiveMistakeCount++
			cline.recordToolError("use_mcp_tool")
			await cline.say("error", t("mcp:errors.serverNotFound", { serverName, availableServers }))

			pushToolResult(formatResponse.unknownMcpServerError(serverName, availableServersArray))
			return { isValid: false, availableTools: [] }
		}

		// Check if the server has tools defined
		if (!server.tools || server.tools.length === 0) {
			// No tools available on this server
			cline.consecutiveMistakeCount++
			cline.recordToolError("use_mcp_tool")
			await cline.say(
				"error",
				t("mcp:errors.toolNotFound", {
					toolName,
					serverName,
					availableTools: "No tools available",
				}),
			)

			pushToolResult(formatResponse.unknownMcpToolError(serverName, toolName, []))
			return { isValid: false, availableTools: [] }
		}

		// Check if the requested tool exists
		const tool = server.tools.find((tool) => tool.name === toolName)

		if (!tool) {
			// Tool not found - provide list of available tools
			const availableToolNames = server.tools.map((tool) => tool.name)

			cline.consecutiveMistakeCount++
			cline.recordToolError("use_mcp_tool")
			await cline.say(
				"error",
				t("mcp:errors.toolNotFound", {
					toolName,
					serverName,
					availableTools: availableToolNames.join(", "),
				}),
			)

			pushToolResult(formatResponse.unknownMcpToolError(serverName, toolName, availableToolNames))
			return { isValid: false, availableTools: availableToolNames }
		}

		// Check if the tool is disabled (enabledForPrompt is false)
		if (tool.enabledForPrompt === false) {
			// Tool is disabled - only show enabled tools
			const enabledTools = server.tools.filter((t) => t.enabledForPrompt !== false)
			const enabledToolNames = enabledTools.map((t) => t.name)

			cline.consecutiveMistakeCount++
			cline.recordToolError("use_mcp_tool")
			await cline.say(
				"error",
				t("mcp:errors.toolDisabled", {
					toolName,
					serverName,
					availableTools:
						enabledToolNames.length > 0 ? enabledToolNames.join(", ") : "No enabled tools available",
				}),
			)

			pushToolResult(formatResponse.unknownMcpToolError(serverName, toolName, enabledToolNames))
			return { isValid: false, availableTools: enabledToolNames }
		}

		// Tool exists and is enabled
		return { isValid: true, availableTools: server.tools.map((tool) => tool.name) }
	} catch (error) {
		// If there's an error during validation, log it but don't block the tool execution
		// The actual tool call might still fail with a proper error
		console.error("Error validating MCP tool existence:", error)
		return { isValid: true }
	}
}

async function sendExecutionStatus(cline: Task, status: McpExecutionStatus): Promise<void> {
	const clineProvider = await cline.providerRef.deref()
	clineProvider?.postMessageToWebview({
		type: "mcpExecutionStatus",
		text: JSON.stringify(status),
	})
}

// kilocode_change: make async, add task parameter
async function processToolContent(task: Task, toolResult: McpToolCallResponse): Promise<string> {
	if (!toolResult?.content || toolResult.content.length === 0) {
		return ""
	}

	const outputText = toolResult.content // kilocode_change: introduce const
		.map((item: any) => {
			if (item.type === "text") {
				return item.text
			}
			if (item.type === "resource") {
				const { blob: _, ...rest } = item.resource
				return JSON.stringify(rest, null, 2)
			}
			return ""
		})
		.filter(Boolean)
		.join("\n\n")

	// kilocode_change: summarize
	return toolResult.isError ? outputText : await summarizeSuccessfulMcpOutputWhenTooLong(task, outputText)
}

async function executeToolAndProcessResult(
	cline: Task,
	serverName: string,
	toolName: string,
	parsedArguments: Record<string, unknown> | undefined,
	executionId: string,
	pushToolResult: PushToolResult,
	argumentsRepaired?: boolean,
): Promise<void> {
	await cline.say("mcp_server_request_started")

	// Send started status
	await sendExecutionStatus(cline, {
		executionId,
		status: "started",
		serverName,
		toolName,
	})

	// Debug logging
	console.log("[MCP Debug] Executing tool:", toolName, "on server:", serverName)
	console.log("[MCP Debug] Arguments:", JSON.stringify(parsedArguments, null, 2))

	try {
		console.log("[MCP Debug] About to call callTool with:", { serverName, toolName, parsedArguments })
		const toolResult = await cline.providerRef.deref()?.getMcpHub()?.callTool(serverName, toolName, parsedArguments)
		console.log("[MCP Debug] callTool result:", toolResult)

		let toolResultPretty = "(No response)"

		if (toolResult) {
			// kilocode_change: await, add api parameter
			const outputText = await processToolContent(cline, toolResult)

			if (outputText) {
				await sendExecutionStatus(cline, {
					executionId,
					status: "output",
					response: outputText,
				})

				toolResultPretty = (toolResult.isError ? "Error:\n" : "") + outputText
			}

			// Send completion status
			await sendExecutionStatus(cline, {
				executionId,
				status: toolResult.isError ? "error" : "completed",
				response: toolResultPretty,
				error: toolResult.isError ? "Error executing MCP tool" : undefined,
			})
		} else {
			// Send error status if no result
			await sendExecutionStatus(cline, {
				executionId,
				status: "error",
				error: "No response from MCP server",
			})
		}

		await cline.say("mcp_server_response", toolResultPretty)
		if (argumentsRepaired) {
			// forked_change: transparency — tell the model what actually executed
			// so it does not repeat the malformed form.
			toolResultPretty += `\n\n${formatArgumentRepairNote(JSON.stringify(parsedArguments ?? {}))}`
		}
		pushToolResult(formatResponse.toolResult(toolResultPretty))
	} catch (error) {
		// Handle authentication errors specially
		if (error instanceof McpAuthError) {
			const authMessage = `The MCP server "${error.serverName}" requires authentication.

To authenticate with this server, use the mcp_authenticate tool:
<mcp_authenticate>
<server_name>${error.serverName}</server_name>
</mcp_authenticate>

This will initiate the OAuth flow and provide you with an authorization URL to complete authentication in your browser.`

			await sendExecutionStatus(cline, {
				executionId,
				status: "error",
				error: `Authentication required for ${error.serverName}`,
			})

			await cline.say("mcp_server_response", authMessage)
			pushToolResult(formatResponse.toolError(authMessage))
			return
		}

		// Re-throw other errors to be handled by the outer try-catch
		throw error
	}
}

export async function useMcpToolTool(
	cline: Task,
	block: ToolUse,
	askApproval: AskApproval,
	handleError: HandleError,
	pushToolResult: PushToolResult,
	removeClosingTag: RemoveClosingTag,
) {
	try {
		console.log("[MCP Debug] useMcpToolTool - raw block.params:", block.params)
		const params: McpToolParams = {
			server_name: block.params.server_name,
			tool_name: block.params.tool_name,
			arguments: block.params.arguments,
		}
		console.log("[MCP Debug] useMcpToolTool - extracted params:", params)

		// Handle partial requests
		if (block.partial) {
			await handlePartialRequest(cline, params, removeClosingTag)
			return
		}

		// Validate parameters
		const validation = await validateParams(cline, params, pushToolResult)
		if (!validation.isValid) {
			return
		}

		const { serverName, toolName, parsedArguments, argumentsRepaired } = validation

		// Validate that the tool exists on the server
		const toolValidation = await validateToolExists(cline, serverName, toolName, pushToolResult)
		if (!toolValidation.isValid) {
			return
		}

		// Reset mistake count on successful validation
		cline.consecutiveMistakeCount = 0

		// Get user approval - always include arguments field (even if empty object)
		// Handle both string (from XML) and object (from native function calling)
		let argumentsString: string
		if (typeof params.arguments === "string") {
			argumentsString = params.arguments || "{}"
		} else if (typeof params.arguments === "object" && params.arguments !== null) {
			argumentsString = JSON.stringify(params.arguments)
		} else {
			argumentsString = "{}"
		}

		// Generate executionId for consistent tracking throughout the tool execution lifecycle
		const executionId = Date.now().toString()

		const completeMessage = JSON.stringify({
			type: "use_mcp_tool",
			serverName,
			toolName,
			arguments: argumentsString,
			executionId,
		} satisfies ClineAskUseMcpServer)

		const didApprove = await askApproval("use_mcp_server", completeMessage)

		if (!didApprove) {
			return
		}

		// Execute the tool and process results
		await executeToolAndProcessResult(
			cline,
			serverName!,
			toolName!,
			parsedArguments,
			executionId,
			pushToolResult,
			argumentsRepaired,
		)
	} catch (error) {
		await handleError("executing MCP tool", error)
	}
}
