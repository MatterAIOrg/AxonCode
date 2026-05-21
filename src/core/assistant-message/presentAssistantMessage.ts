import cloneDeep from "clone-deep"
import { serializeError } from "serialize-error"

import type { AssistantMessageContent } from "./parseAssistantMessage"
import { TelemetryService } from "@roo-code/telemetry"
import type { ClineAsk, ToolName, ToolProgressStatus } from "@roo-code/types"

import { defaultModeSlug, getModeBySlug } from "../../shared/modes"
import type { ToolParamName, ToolResponse } from "../../shared/tools"

import { accessMcpResourceTool } from "../tools/accessMcpResourceTool"
import { attemptCompletionTool } from "../tools/attemptCompletionTool"
import { browserActionTool } from "../tools/browserActionTool"
import { executeCommandTool } from "../tools/executeCommandTool"
import { fetchInstructionsTool } from "../tools/fetchInstructionsTool"
import { fileEditTool } from "../tools/fileEditTool"
import { multiFileEditTool } from "../tools/multiFileEditTool"
import { fileWriteTool } from "../tools/fileWriteTool"
import { listCodeDefinitionNamesTool } from "../tools/listCodeDefinitionNamesTool"
import { listFilesTool } from "../tools/listFilesTool"
import { newTaskTool } from "../tools/newTaskTool"
import { getReadFileToolDescription, readFileTool } from "../tools/readFileTool"
import { searchFilesTool } from "../tools/searchFilesTool"
import { switchModeTool } from "../tools/switchModeTool"
import { useMcpToolTool } from "../tools/useMcpToolTool"
import { mcpAuthenticateTool } from "../tools/mcpAuthenticateTool"

import { generateImageTool } from "../tools/generateImageTool"
import { lspTool } from "../tools/lspTool"
import { runSlashCommandTool } from "../tools/runSlashCommandTool"
import { updateTodoListTool } from "../tools/updateTodoListTool"
import { useSkillTool } from "../tools/useSkillTool"

import Anthropic from "@anthropic-ai/sdk" // kilocode_change
import { formatResponse } from "../prompts/responses"
import { Task } from "../task/Task"
import { yieldPromise } from "../kilocode" // kilocode_change
import { codebaseSearchTool } from "../tools/codebaseSearchTool"
import { condenseTool } from "../tools/condenseTool" // kilocode_change
import { newRuleTool } from "../tools/newRuleTool" // kilocode_change
import { reportBugTool } from "../tools/reportBugTool" // kilocode_change
import { validateToolUse } from "../tools/validateToolUse"
import { webFetchTool } from "../tools/webFetchTool"
import { webSearchTool } from "../tools/webSearchTool"
import { askFollowupQuestionTool } from "../tools/askFollowupQuestionTool"

/**
 * Processes and presents assistant message content to the user interface.
 *
 * This function is the core message handling system that:
 * - Sequentially processes content blocks from the assistant's response.
 * - Displays text content to the user.
 * - Executes tool use requests with appropriate user approval.
 * - Manages the flow of conversation by determining when to proceed to the next content block.
 * - Coordinates file system checkpointing for modified files.
 * - Controls the conversation state to determine when to continue to the next request.
 *
 * The function uses a locking mechanism to prevent concurrent execution and handles
 * partial content blocks during streaming. It's designed to work with the streaming
 * API response pattern, where content arrives incrementally and needs to be processed
 * as it becomes available.
 */

export async function presentAssistantMessage(cline: Task) {
	if (cline.abort) {
		throw new Error(`[Task#presentAssistantMessage] task ${cline.taskId}.${cline.instanceId} aborted`)
	}

	if (cline.presentAssistantMessageLocked) {
		cline.presentAssistantMessageHasPendingUpdates = true
		return
	}

	cline.presentAssistantMessageLocked = true
	cline.presentAssistantMessageHasPendingUpdates = false

	if (cline.currentStreamingContentIndex >= cline.assistantMessageContent.length) {
		// This may happen if the last content block was completed before
		// streaming could finish. If streaming is finished, and we're out of
		// bounds then this means we already  presented/executed the last
		// content block and are ready to continue to next request.
		if (cline.didCompleteReadingStream) {
			cline.userMessageContentReady = true
		}

		cline.presentAssistantMessageLocked = false
		return
	}

	const rawBlock = cline.assistantMessageContent[cline.currentStreamingContentIndex]
	// Shallow copy is sufficient - strings are immutable and we only need to
	// prevent the stream from mutating the reference. Deep cloning large
	// content strings would be expensive and unnecessary.
	const block: AssistantMessageContent =
		rawBlock.type === "tool_use" ? { ...rawBlock, params: { ...rawBlock.params } } : { ...rawBlock }

	switch (block.type) {
		case "text": {
			if (cline.didRejectTool) {
				break
			}

			let content = block.content

			if (content) {
				// Have to do this for partial and complete since sending
				// content in thinking tags to markdown renderer will
				// automatically be removed.
				// Remove end substrings of <thinking or </thinking (below xml
				// parsing is only for opening tags).
				// Tthis is done with the xml parsing below now, but keeping
				// here for reference.
				// content = content.replace(/<\/?t(?:h(?:i(?:n(?:k(?:i(?:n(?:g)?)?)?$/, "")
				//
				// Remove all instances of <thinking> (with optional line break
				// after) and </thinking> (with optional line break before).
				// - Needs to be separate since we dont want to remove the line
				//   break before the first tag.
				// - Needs to happen before the xml parsing below.
				content = content.replace(/<thinking>\s?/g, "")
				content = content.replace(/\s?<\/thinking>/g, "")

				// Remove partial XML tag at the very end of the content (for
				// tool use and thinking tags), Prevents scrollview from
				// jumping when tags are automatically removed.
				const lastOpenBracketIndex = content.lastIndexOf("<")

				if (lastOpenBracketIndex !== -1) {
					const possibleTag = content.slice(lastOpenBracketIndex)

					// Check if there's a '>' after the last '<' (i.e., if the
					// tag is complete) (complete thinking and tool tags will
					// have been removed by now.)
					const hasCloseBracket = possibleTag.includes(">")

					if (!hasCloseBracket) {
						// Extract the potential tag name.
						let tagContent: string

						if (possibleTag.startsWith("</")) {
							tagContent = possibleTag.slice(2).trim()
						} else {
							tagContent = possibleTag.slice(1).trim()
						}

						// Check if tagContent is likely an incomplete tag name
						// (letters and underscores only).
						const isLikelyTagName = /^[a-zA-Z_]+$/.test(tagContent)

						// Preemptively remove < or </ to keep from these
						// artifacts showing up in chat (also handles closing
						// thinking tags).
						const isOpeningOrClosing = possibleTag === "<" || possibleTag === "</"

						// If the tag is incomplete and at the end, remove it
						// from the content.
						if (isOpeningOrClosing || isLikelyTagName) {
							content = content.slice(0, lastOpenBracketIndex).trim()
						}
					}
				}
			}

			await cline.say("text", content, undefined, block.partial)
			break
		}
		case "tool_use":
			const toolDescription = (): string => {
				switch (block.name) {
					case "execute_command":
						return `[${block.name} for '${block.params.command}']`
					case "read_file":
						return getReadFileToolDescription(block.name, block.params)
					case "fetch_instructions":
						return `[${block.name} for '${block.params.task}']`
					case "file_edit":
						return `[${block.name} for '${(block.params as any).file_path || block.params.target_file}']`
					case "multi_file_edit": {
						let editCount = 0
						try {
							const editsRaw = (block.params as any).edits
							if (editsRaw) {
								const edits = JSON.parse(editsRaw)
								editCount = Array.isArray(edits) ? edits.length : 0
							}
						} catch {
							// During streaming, edits might be incomplete
						}
						return `[${block.name} for ${editCount} edits]`
					}
					case "file_write":
						return `[${block.name} for '${(block.params as any).file_path}']`
					case "list_files":
						return `[${block.name} for '${block.params.path}']`
					case "list_code_definition_names":
						return `[${block.name} for '${block.params.path}']`
					case "lsp":
						return `[${block.name} ${block.params.operation} at '${block.params.file_path}:${block.params.line}:${block.params.character}']`
					case "search_files":
						return `[${block.name} for '${block.params.regex}'${
							block.params.file_pattern ? ` in '${block.params.file_pattern}'` : ""
						}]`
					case "browser_action":
						return `[${block.name} for '${block.params.action}']`
					case "use_mcp_tool":
						return `[${block.name} for '${block.params.server_name}']`
					case "mcp_authenticate":
						return `[${block.name} for '${block.params.server_name}']`
					case "access_mcp_resource":
						return `[${block.name} for '${block.params.server_name}']`
					case "ask_followup_question":
						return `[${block.name} for '${block.params.question}']`
					case "attempt_completion":
						return `[${block.name}]`
					case "switch_mode":
						return `[${block.name} to '${block.params.mode_slug}'${block.params.reason ? ` because: ${block.params.reason}` : ""}]`
					case "codebase_search": // Add case for the new tool
						return `[${block.name} for '${block.params.query}']`
					case "update_todo_list":
						return `[${block.name}]`
					case "new_task": {
						const mode = block.params.mode ?? defaultModeSlug
						const message = block.params.message ?? "(no message)"
						const modeName = getModeBySlug(mode, customModes)?.name ?? mode
						return `[${block.name} in ${modeName} mode: '${message}']`
					}
					// forked_change start
					case "new_rule":
						return `[${block.name} for '${block.params.path}']`
					case "report_bug":
						return `[${block.name}]`
					case "condense":
						return `[${block.name}]`
					// forked_change end
					case "run_slash_command":
						return `[${block.name} for '${block.params.command}'${block.params.args ? ` with args: ${block.params.args}` : ""}]`
					case "generate_image":
						return `[${block.name} for '${block.params.path}']`
					case "check_past_chat_memories":
						return `[${block.name} for '${block.params.regex}']`
					case "use_skill":
						return `[${block.name} for '${block.params.skill_name}']`
					case "web_fetch":
						return `[${block.name} for '${block.params.url}']`
					case "web_search":
						return `[${block.name} for '${block.params.query}']`
					default:
						return `[${block.name}]`
				}
			}

			// forked_change start: Track whether a tool_result was pushed for this
			// tool_use block. We use this in the try/finally below to guarantee that
			// every non-partial tool_use with a toolUseId gets a matching tool_result
			// pushed onto userMessageContent — otherwise the assistant's tool_use blocks
			// (which were already added to apiConversationHistory) won't pair up with
			// the user's tool_result blocks on the next API call, causing the provider
			// to reject the request with a tool_use_id mismatch.
			//
			// Common ways the result can fail to be pushed:
			//   - cline.ask() throws "Current ask promise was ignored" mid-tool
			//   - a duplicate tool call short-circuits via checkAndRegisterToolCall
			//   - an unexpected error escapes the tool handler before pushToolResult
			let toolResultPushed = false
			// forked_change end

			const pushToolResult_withToolUseId_kilocode = (
				...items: (Anthropic.TextBlockParam | Anthropic.ImageBlockParam)[]
			) => {
				// Check for non-empty toolUseId - empty string should be treated as missing
				if (block.toolUseId && block.toolUseId.length > 0) {
					cline.userMessageContent.push({ type: "tool_result", tool_use_id: block.toolUseId, content: items })
				} else {
					cline.userMessageContent.push(...items)
				}
				// forked_change: mark that this tool_use already has a result so the
				// safety net in the finally block doesn't double-push.
				toolResultPushed = true
			}

			// forked_change: hoist provider state lookup out of the try below so
			// `customModes` stays in the same lexical scope as `toolDescription`
			// (which captures it via closure) and so the safety net in the finally
			// can still see it if needed. We accept a small risk of error here —
			// the call is wrapped in `?? {}` and is typically safe.
			const { mode: _mode_kilocode, customModes: _customModes_kilocode } =
				(await cline.providerRef.deref()?.getState()) ?? {}
			const mode = _mode_kilocode
			const customModes = _customModes_kilocode

			// forked_change start: Wrap the entire tool_use processing body in a
			// try/catch/finally. Any throw from cline.ask, validateToolUse, the
			// repetition check, the per-tool handlers, or any helper here is caught
			// here and converted into a tool_result, instead of bubbling out and
			// leaving the assistant tool_use unmatched.
			try {
				// forked_change end

				if (cline.didRejectTool) {
					// Ignore any tool content after user has rejected tool once.
					if (!block.partial) {
						pushToolResult_withToolUseId_kilocode({
							type: "text",
							text: `Skipping tool ${toolDescription()} due to user rejecting a previous tool.`,
						})
					} else {
						// Partial tool after user rejected a previous tool.
						pushToolResult_withToolUseId_kilocode({
							type: "text",
							text: `Tool ${toolDescription()} was interrupted and not executed due to user rejecting a previous tool.`,
						})
					}

					break
				}

				// Check for duplicate tool calls (same name + same args) when the tool call is complete
				// Only check/register when !block.partial to avoid registering partial streaming updates
				// which would cause the final complete call to be incorrectly flagged as duplicate
				if (!block.partial) {
					const toolCallSignature = cline.getToolCallSignature(block.name, block.params)
					if (cline.checkAndRegisterToolCall(toolCallSignature)) {
						cline.didAlreadyUseTool = true
						// forked_change: explicitly push a tool_result for the duplicate so the
						// assistant tool_use is paired in the API conversation history. Without
						// this push, the bare `break` below would leave the tool_use unmatched
						// and the next request would fail with a tool_use_id mismatch.
						pushToolResult_withToolUseId_kilocode({
							type: "text",
							text: `Duplicate tool call detected for ${toolDescription()}. The same tool call was already executed in this turn — its previous result still applies. Please move on or try a different approach.`,
						})
						break
					}
				}

				const pushToolResult = (content: ToolResponse) => {
					// forked_change start
					const items = new Array<Anthropic.TextBlockParam | Anthropic.ImageBlockParam>()

					// No prefix - just return raw tool output
					if (typeof content === "string") {
						items.push({ type: "text", text: content || "(tool did not return anything)" })
					} else {
						items.push(...content)
					}
					pushToolResult_withToolUseId_kilocode(...items)
					// forked_change end

					// Track that at least one tool ran during this assistant turn.
					// We still continue processing later content blocks because
					// native/OpenAI responses may legitimately batch multiple tool
					// calls into a single assistant message.
					cline.didAlreadyUseTool = true

					// If this is not a partial block (i.e., the tool has completed execution),
					// and the stream has finished reading, set userMessageContentReady
					// to allow the task loop to continue. This is critical for native tool
					// calls where the block state might not trigger the normal completion flow.
					//
					// forked_change: only do this on the LAST content block. With parallel
					// native tool calls, multiple tool_use blocks live in the same assistant
					// message; setting userMessageContentReady=true after the first tool's
					// pushToolResult races the recursion processing later blocks — pWaitFor
					// in the task loop returns and fires off the next request with only one
					// tool_result, leaving subsequent tool_uses unmatched.
					if (
						!block.partial &&
						cline.didCompleteReadingStream &&
						cline.currentStreamingContentIndex >= cline.assistantMessageContent.length - 1
					) {
						cline.userMessageContentReady = true
					}
				}

				const askApproval = async (
					type: ClineAsk,
					partialMessage?: string,
					progressStatus?: ToolProgressStatus,
					isProtected?: boolean,
				) => {
					// forked_change start: yolo mode

					const state = await cline.providerRef.deref()?.getState()
					if (state?.yoloMode) {
						return true
					}
					// kilocode_change start: auto-approve all commands for current task
					if (type === "command" && cline.autoApproveAllCommands) {
						// Mirror the non-command auto-approve path: surface the final UI row
						// (so the user can see what ran) and resolve the pending ask without
						// blocking on a real user response. Without this, the partial command
						// message is never marked complete and subsequent commands keep their
						// Run/Cancel UI visible because the previous ask never resolved.
						if (partialMessage) {
							setImmediate(() => {
								try {
									cline.handleWebviewAskResponse?.("yesButtonClicked", undefined, undefined)
								} catch {
									// best-effort; never let the auto-approval poke crash the flow
								}
							})
							await cline
								.ask(type, partialMessage, false, progressStatus, isProtected || false)
								.catch(() => {})
						}
						return true
					}
					// kilocode_change end
					// forked_change end

					// forked_change start: only `execute_command` (ask type "command") ever
					// surfaces a Run/Cancel prompt. Every other tool — file edits, MCP, web,
					// browser actions, etc. — must auto-approve. We still surface the tool's
					// final UI row (so the user can see what ran), but we never block on a
					// real user response: setImmediate posts a "yesButtonClicked" right
					// after the ask starts waiting, and we .catch() any race-condition
					// throw (e.g. "Current ask promise was ignored") so the tool flow can
					// always continue. This pattern mirrors what webFetchTool / readFileTool
					// were already doing inline; centralising it here protects every tool.
					if (type !== "command") {
						if (partialMessage) {
							setImmediate(() => {
								try {
									// Guard for tests where cline is a partial mock without this method.
									cline.handleWebviewAskResponse?.("yesButtonClicked", undefined, undefined)
								} catch {
									// best-effort; never let the auto-approval poke crash the flow
								}
							})
							await cline
								.ask(type, partialMessage, false, progressStatus, isProtected || false)
								.catch(() => {})
						}
						return true
					}
					// forked_change end

					const { response, text, images } = await cline.ask(
						type,
						partialMessage,
						false,
						progressStatus,
						isProtected || false,
					)

					if (response !== "yesButtonClicked") {
						// On reject, do nothing - just reject
						cline.didRejectTool = true

						// If the user sent a message (which caused the rejection), it might be queued
						// Process any queued messages now
						cline.processQueuedMessages()

						return false
					}

					// Handle yesButtonClicked with text.
					if (text) {
						await cline.say("user_feedback", text, images)
						pushToolResult(formatResponse.toolResult(formatResponse.toolApprovedWithFeedback(text), images))
					}

					return true
				}

				const askFinishSubTaskApproval = async () => {
					// Ask the user to approve this task has completed, and he has
					// reviewed it, and we can declare task is finished and return
					// control to the parent task to continue running the rest of
					// the sub-tasks.
					const toolMessage = JSON.stringify({ tool: "finishTask" })
					return await askApproval("tool", toolMessage)
				}

				const handleError = async (action: string, error: Error) => {
					const errorString = `Error ${action}: ${JSON.stringify(serializeError(error))}`

					await cline.say(
						"error",
						`Error ${action}:\n${error.message ?? JSON.stringify(serializeError(error), null, 2)}`,
					)

					pushToolResult(formatResponse.toolError(errorString))
				}

				// If block is partial, remove partial closing tag so its not
				// presented to user.
				const removeClosingTag = (tag: ToolParamName, text?: string): string => {
					if (!block.partial) {
						return text || ""
					}

					if (!text) {
						return ""
					}

					// This regex dynamically constructs a pattern to match the
					// closing tag:
					// - Optionally matches whitespace before the tag.
					// - Matches '<' or '</' optionally followed by any subset of
					//   characters from the tag name.
					const tagRegex = new RegExp(
						`\\s?<\/?${tag
							.split("")
							.map((char) => `(?:${char})?`)
							.join("")}$`,
						"g",
					)

					return text.replace(tagRegex, "")
				}

				if (block.name !== "browser_action") {
					await cline.browserSession.closeBrowser()
				}

				if (!block.partial) {
					cline.recordToolUsage(block.name)
					TelemetryService.instance.captureToolUsage(cline.taskId, block.name)
				}

				// Validate tool use before execution.
				// forked_change: `mode` and `customModes` are now hoisted above the
				// outer tool_use try block so toolDescription's closure can see them.
				try {
					validateToolUse(
						block.name as ToolName,
						mode ?? defaultModeSlug,
						customModes ?? [],
						{ file_edit: cline.diffEnabled },
						block.params,
					)
				} catch (error) {
					cline.consecutiveMistakeCount++
					pushToolResult(formatResponse.toolError(error.message))
					break
				}

				// Check for identical consecutive tool calls.
				if (!block.partial) {
					// Use the detector to check for repetition, passing the ToolUse
					// block directly.
					const repetitionCheck = cline.toolRepetitionDetector.check(block)

					// If execution is not allowed, notify user and break.
					if (!repetitionCheck.allowExecution && repetitionCheck.askUser) {
						// Handle repetition similar to mistake_limit_reached pattern.
						const { response, text, images } = await cline.ask(
							repetitionCheck.askUser.messageKey as ClineAsk,
							repetitionCheck.askUser.messageDetail.replace("{toolName}", block.name),
						)

						if (response === "messageResponse") {
							// Add user feedback to userContent.
							pushToolResult_withToolUseId_kilocode(
								{
									type: "text" as const,
									text: `Tool repetition limit reached. User feedback: ${text}`,
								},
								...formatResponse.imageBlocks(images),
							)

							// Add user feedback to chat.
							await cline.say("user_feedback", text, images)

							// Track tool repetition in telemetry.
							TelemetryService.instance.captureConsecutiveMistakeError(cline.taskId)
						}

						// Return tool result message about the repetition
						pushToolResult(
							formatResponse.toolError(
								`Tool call repetition limit reached for ${block.name}. Please try a different approach.`,
							),
						)
						break
					}
				}

				await checkpointSaveAndMark(cline) // kilocode_change: moved out of switch

				// forked_change start: Clean up stale partial tool ask message from
				// native tool call streaming before the complete tool handler runs.
				// During streaming, a partial ask("tool", ..., true) is created to
				// show a spinner. Some tool handlers (e.g., file_edit) use
				// say("tool", ...) for the complete version, which doesn't update
				// the partial ask — causing duplicate messages. This removes the
				// stale partial so only the complete message is shown.
				if (!block.partial && block.toolUseId) {
					await cline.removeStalePartialToolAskMessage()
				}
				// forked_change end

				// forked_change start: Check if context condensation is needed before executing tools
				// that may add significant content to the context window.
				// This prevents context window overflow when the LLM requests to read files
				// with a nearly full context.
				const toolsThatAddContent = [
					"read_file",
					"search_files",
					"list_files",
					"list_code_definition_names",
					"codebase_search",
					"lsp",
					"web_fetch",
					"web_search",
					"use_mcp_tool",
					"access_mcp_resource",
				]
				if (!block.partial && toolsThatAddContent.includes(block.name)) {
					await cline.checkAndCondenseContext()
				}
				// forked_change end

				switch (block.name) {
					case "update_todo_list": {
						// For native tool calls, the partial block is just for UI display during streaming.
						// We should only execute the actual tool logic when the block is complete (partial: false).
						if (!block.partial) {
							await updateTodoListTool(
								cline,
								block,
								askApproval,
								handleError,
								pushToolResult,
								removeClosingTag,
							)
						} else {
							// For partial blocks, just update the UI display without executing
							// The tool will be executed when the complete block arrives
							const todosRaw = block.params.todos || ""
							try {
								const { parseMarkdownChecklist } = await import("../tools/updateTodoListTool")
								const todos = parseMarkdownChecklist(todosRaw)
								const approvalMsg = JSON.stringify({
									tool: "updateTodoList",
									todos,
								})
								await cline.ask("tool", approvalMsg, true).catch(() => {})
							} catch {
								// Ignore parsing errors for partial blocks
							}
						}
						break
					}
					case "file_edit":
						await fileEditTool(cline, block, handleError, pushToolResult, removeClosingTag)
						break
					case "multi_file_edit":
						await multiFileEditTool(cline, block, handleError, pushToolResult, removeClosingTag)
						break
					case "file_write":
						await fileWriteTool(cline, block, askApproval, handleError, pushToolResult, removeClosingTag)
						break
					case "read_file":
						await readFileTool(cline, block, askApproval, handleError, pushToolResult, removeClosingTag)
						break
					case "fetch_instructions":
						await fetchInstructionsTool(cline, block, askApproval, handleError, pushToolResult)
						break
					case "list_files":
						await listFilesTool(cline, block, askApproval, handleError, pushToolResult, removeClosingTag)
						break
					case "codebase_search":
						await codebaseSearchTool(
							cline,
							block,
							askApproval,
							handleError,
							pushToolResult,
							removeClosingTag,
						)
						break
					case "list_code_definition_names":
						await listCodeDefinitionNamesTool(
							cline,
							block,
							askApproval,
							handleError,
							pushToolResult,
							removeClosingTag,
						)
						break
					case "lsp":
						await lspTool(cline, block, askApproval, handleError, pushToolResult, removeClosingTag)
						break
					case "search_files":
						await searchFilesTool(cline, block, askApproval, handleError, pushToolResult, removeClosingTag)
						break
					case "browser_action":
						await browserActionTool(
							cline,
							block,
							askApproval,
							handleError,
							pushToolResult,
							removeClosingTag,
						)
						break
					case "execute_command":
						await executeCommandTool(
							cline,
							block,
							askApproval,
							handleError,
							pushToolResult,
							removeClosingTag,
						)
						break
					case "use_mcp_tool":
						await useMcpToolTool(cline, block, askApproval, handleError, pushToolResult, removeClosingTag)
						break
					case "mcp_authenticate":
						await mcpAuthenticateTool(
							cline,
							block,
							askApproval,
							handleError,
							pushToolResult,
							removeClosingTag,
						)
						break
					case "access_mcp_resource":
						await accessMcpResourceTool(
							cline,
							block,
							askApproval,
							handleError,
							pushToolResult,
							removeClosingTag,
						)
						break
					case "ask_followup_question":
						await askFollowupQuestionTool(
							cline,
							block,
							askApproval,
							handleError,
							pushToolResult,
							removeClosingTag,
						)
						break
					case "switch_mode":
						await switchModeTool(cline, block, askApproval, handleError, pushToolResult, removeClosingTag)
						break
					case "new_task":
						await newTaskTool(cline, block, askApproval, handleError, pushToolResult, removeClosingTag)
						break
					case "attempt_completion":
						await attemptCompletionTool(
							cline,
							block,
							askApproval,
							handleError,
							pushToolResult,
							removeClosingTag,
							toolDescription,
							askFinishSubTaskApproval,
						)
						break
					// forked_change start
					case "new_rule":
						await newRuleTool(cline, block, askApproval, handleError, pushToolResult, removeClosingTag)
						break
					case "report_bug":
						await reportBugTool(cline, block, askApproval, handleError, pushToolResult, removeClosingTag)
						break
					case "condense":
						await condenseTool(cline, block, askApproval, handleError, pushToolResult, removeClosingTag)
						break
					// forked_change end
					case "run_slash_command":
						await runSlashCommandTool(
							cline,
							block,
							askApproval,
							handleError,
							pushToolResult,
							removeClosingTag,
						)
						break
					case "generate_image":
						await generateImageTool(
							cline,
							block,
							askApproval,
							handleError,
							pushToolResult,
							removeClosingTag,
						)
						break
					case "use_skill":
						await useSkillTool(cline, block, handleError, pushToolResult)
						break
					case "web_fetch":
						await webFetchTool(cline, block, askApproval, handleError, pushToolResult, removeClosingTag)
						break
					case "web_search":
						await webSearchTool(cline, block, askApproval, handleError, pushToolResult, removeClosingTag)
						break
					default:
						break
				}

				// forked_change start: close the try and add catch/finally for the tool_use
				// safety net. The catch keeps a thrown error (e.g. "Current ask promise was
				// ignored") from escaping presentAssistantMessage, and the finally guarantees
				// a matching tool_result is pushed for every non-partial tool_use with a
				// toolUseId so the assistant tool_use / user tool_result pairing stays
				// consistent in the API conversation history.
			} catch (error) {
				const errMsg = error instanceof Error ? error.message : String(error)
				console.error(`[presentAssistantMessage] Tool '${block.name}' processing threw: ${errMsg}`, error)
				try {
					await cline.say("error", `Tool '${block.name}' failed: ${errMsg}`)
				} catch {
					// best-effort; never let the error reporter itself break the loop
				}
			} finally {
				// CRITICAL: every non-partial tool_use with a toolUseId MUST have a
				// matching tool_result pushed, even on failure. The assistant message
				// already contains the tool_use block, so without a paired tool_result
				// the next API request will be rejected for an unmatched tool_use_id.
				if (!block.partial && block.toolUseId && block.toolUseId.length > 0 && !toolResultPushed) {
					try {
						cline.userMessageContent.push({
							type: "tool_result",
							tool_use_id: block.toolUseId,
							content: [
								{
									type: "text",
									text: `Tool '${block.name}' did not produce a result (an internal error or interrupted ask occurred). Please try a different approach or ask the user for clarification.`,
								},
							],
						})
						toolResultPushed = true

						// Make sure the task loop can move forward even on failure —
						// otherwise the next iteration may hang waiting for a result.
						cline.didAlreadyUseTool = true
						if (cline.didCompleteReadingStream) {
							cline.userMessageContentReady = true
						}
					} catch (e) {
						console.error("[presentAssistantMessage] Failed to push fallback tool_result:", e)
					}
				}
			}
			// forked_change end

			break
	}

	// Seeing out of bounds is fine, it means that the next too call is being
	// built up and ready to add to assistantMessageContent to present.
	// When you see the UI inactive during this, it means that a tool is
	// breaking without presenting any UI. For example the file_write tool
	// was breaking when relpath was undefined, and for invalid relpath it never
	// presented UI.
	// This needs to be placed here, if not then calling
	// cline.presentAssistantMessage below would fail (sometimes) since it's
	// locked.
	cline.presentAssistantMessageLocked = false

	// NOTE: When tool is rejected, iterator stream is interrupted and it waits
	// for `userMessageContentReady` to be true. Future calls to present will
	// skip execution since `didRejectTool` and iterate until `contentIndex` is
	// set to message length and it sets userMessageContentReady to true itself
	// (instead of preemptively doing it in iterator).
	if (!block.partial || cline.didRejectTool) {
		// Block is finished streaming and executing.
		if (cline.currentStreamingContentIndex === cline.assistantMessageContent.length - 1) {
			// It's okay that we increment if !didCompleteReadingStream, it'll
			// just return because out of bounds and as streaming continues it
			// will call `presentAssitantMessage` if a new block is ready. If
			// streaming is finished then we set `userMessageContentReady` to
			// true when out of bounds. This gracefully allows the stream to
			// continue on and all potential content blocks be presented.
			// Last block is complete and it is finished executing
			cline.userMessageContentReady = true // Will allow `pWaitFor` to continue.
		}

		// Call next block if it exists (if not then read stream will call it
		// when it's ready).
		// Need to increment regardless, so when read stream calls this function
		// again it will be streaming the next block.
		cline.currentStreamingContentIndex++

		if (cline.currentStreamingContentIndex < cline.assistantMessageContent.length) {
			// There are already more content blocks to stream, so we'll call
			// this function ourselves.
			// forked_change start: prevent excessive recursion
			await yieldPromise()
			await presentAssistantMessage(cline)
			// forked_change end
			return
		}

		// If we've already used a tool and there are no more blocks to process,
		// we need to set userMessageContentReady to true to allow the loop to continue.
		// This fixes the issue where update_todo_list (or other tools) execute but
		// the agent stops because userMessageContentReady is never set.
		// This handles the case where the stream has finished and we've processed all blocks,
		// but userMessageContentReady wasn't set because we weren't at the last block when
		// the tool executed.
		if (cline.didAlreadyUseTool && cline.didCompleteReadingStream) {
			cline.userMessageContentReady = true
		}
	}

	// Block is partial, but the read stream may have finished.
	if (cline.presentAssistantMessageHasPendingUpdates) {
		// forked_change start: prevent excessive recursion
		await yieldPromise()
		await presentAssistantMessage(cline)
		// forked_change end
	}
}

/**
 * save checkpoint and mark done in the current streaming task.
 * @param task The Task instance to checkpoint save and mark.
 * @returns
 */
async function checkpointSaveAndMark(task: Task) {
	if (task.currentStreamingDidCheckpoint) {
		return
	}
	try {
		// kilocode_change: order changed to prevent second execution while still awaiting the save
		task.currentStreamingDidCheckpoint = true
		await task.checkpointSave(true)
	} catch (error) {
		console.error(`[Task#presentAssistantMessage] Error saving checkpoint: ${error.message}`, error)
	}
}
