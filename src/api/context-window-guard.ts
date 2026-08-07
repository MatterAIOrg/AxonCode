import { Anthropic } from "@anthropic-ai/sdk"
import type OpenAI from "openai"

import type { ModelInfo, ProviderSettings } from "@roo-code/types"

import { nativeTools } from "../core/prompts/tools/native-tools"
import { getModelMaxOutputTokens } from "../shared/api"
import { tiktoken } from "../utils/tiktoken"
import type { ApiHandler, ApiHandlerCreateMessageMetadata, SingleCompletionHandler } from "./index"
import type { ApiStream } from "./transform/stream"

/**
 * Leave room for provider-side serialization differences, hidden routing
 * instructions, and tokenizer variance. The local tokenizer already applies a
 * 1.5x fudge factor; this is a second, request-level safety boundary.
 */
export const CONTEXT_WINDOW_SAFETY_PERCENTAGE = 0.1
export const DEFAULT_CONTEXT_WINDOW = 128_000

const REQUEST_FIXED_OVERHEAD_TOKENS = 256
const MESSAGE_OVERHEAD_TOKENS = 12
const TOOL_DEFINITION_OVERHEAD_TOKENS = 24
const TRUNCATION_MARKER = "\n[...content truncated to fit the selected model's context window...]\n"
const HISTORY_OMISSION_MESSAGE =
	"[Earlier conversation turns were omitted by the context-window guard before this provider request.]"
const GUARDED_HANDLER = Symbol("context-window-guarded-handler")

type GuardableMessage = Anthropic.Messages.MessageParam & {
	reasoning?: string
	reasoning_content?: string
}

type ToolDefinition = OpenAI.Chat.ChatCompletionTool

export interface PreparedApiRequest {
	systemPrompt: string
	messages: Anthropic.Messages.MessageParam[]
	metadata?: ApiHandlerCreateMessageMetadata
	contextWindow: number
	inputTokenBudget: number
	estimatedInputTokens: number
	originalEstimatedInputTokens: number
	wasTruncated: boolean
}

interface MutableRequest {
	systemPrompt: string
	messages: GuardableMessage[]
	metadata?: ApiHandlerCreateMessageMetadata
	tools: ToolDefinition[]
}

type MutableApiHandler = ApiHandler &
	Partial<SingleCompletionHandler> & {
		[GUARDED_HANDLER]?: boolean
		fetchModel?: () => Promise<unknown>
		initializeClient?: () => Promise<void>
	}

/**
 * Installs the guard on the concrete handler instance instead of returning a
 * decorator object. This preserves provider-specific methods and instanceof
 * checks used by virtual/fallback providers.
 */
export function withContextWindowGuard(handler: ApiHandler, settings: ProviderSettings): ApiHandler {
	const mutableHandler = handler as MutableApiHandler
	if (mutableHandler[GUARDED_HANDLER]) {
		return handler
	}

	const originalCreateMessage = handler.createMessage.bind(handler)
	mutableHandler.createMessage = (
		systemPrompt: string,
		messages: Anthropic.Messages.MessageParam[],
		metadata?: ApiHandlerCreateMessageMetadata,
	): ApiStream => {
		const guardedStream = async function* (): ApiStream {
			const prepared = await prepareApiRequest({ handler, settings, systemPrompt, messages, metadata })

			if (prepared.wasTruncated) {
				console.warn(
					`[ContextWindowGuard] Reduced request for ${handler.getModel().id} from ` +
						`${prepared.originalEstimatedInputTokens} to ${prepared.estimatedInputTokens} estimated input tokens ` +
						`(budget ${prepared.inputTokenBudget}, context window ${prepared.contextWindow}).`,
				)
			}

			yield* originalCreateMessage(prepared.systemPrompt, prepared.messages, prepared.metadata)
		}

		return guardedStream()
	}

	if (typeof mutableHandler.completePrompt === "function") {
		const originalCompletePrompt = mutableHandler.completePrompt.bind(handler)
		mutableHandler.completePrompt = async (prompt: string): Promise<string> => {
			const prepared = await prepareApiRequest({
				handler,
				settings,
				systemPrompt: "",
				messages: [{ role: "user", content: prompt }],
				metadata: { allowedTools: [] },
			})
			const finalMessage = prepared.messages.at(-1)
			const guardedPrompt = finalMessage ? contentToPlainText(finalMessage.content) : ""
			return originalCompletePrompt(guardedPrompt)
		}
	}

	Object.defineProperty(mutableHandler, GUARDED_HANDLER, { value: true })
	return handler
}

export async function prepareApiRequest({
	handler,
	settings,
	systemPrompt,
	messages,
	metadata,
}: {
	handler: ApiHandler
	settings: ProviderSettings
	systemPrompt: string
	messages: Anthropic.Messages.MessageParam[]
	metadata?: ApiHandlerCreateMessageMetadata
}): Promise<PreparedApiRequest> {
	const refreshableHandler = handler as MutableApiHandler
	// Router/local handlers often expose conservative placeholder metadata until
	// their model catalog is fetched. Refresh before budgeting so a small selected
	// context cannot inherit a larger fallback window at the guard boundary.
	if (typeof refreshableHandler.fetchModel === "function") {
		await refreshableHandler.fetchModel()
	} else if (typeof refreshableHandler.initializeClient === "function") {
		await refreshableHandler.initializeClient()
	}
	const model = handler.getModel()
	const contextWindow = resolveContextWindow(model.info, settings)
	const outputReserve = resolveOutputReserve(model.id, model.info, settings, contextWindow)
	const inputTokenBudget = Math.max(
		1,
		Math.floor(contextWindow * (1 - CONTEXT_WINDOW_SAFETY_PERCENTAGE) - outputReserve),
	)
	const tools = getEffectiveTools(metadata)

	let request: MutableRequest = {
		systemPrompt,
		messages: messages.map(cloneMessage),
		metadata,
		tools,
	}

	const originalEstimatedInputTokens = await estimateApiRequestTokens(request)
	let estimatedInputTokens = originalEstimatedInputTokens

	if (estimatedInputTokens <= inputTokenBudget) {
		return {
			systemPrompt,
			messages,
			metadata,
			contextWindow,
			inputTokenBudget,
			estimatedInputTokens,
			originalEstimatedInputTokens,
			wasTruncated: false,
		}
	}

	for (let round = 0; round < 6 && estimatedInputTokens > inputTokenBudget; round++) {
		const ratio = Math.max(0.015, Math.min(0.85, (inputTokenBudget / estimatedInputTokens) * 0.82))
		request = shrinkRequest(request, ratio, round)
		const previousEstimate = estimatedInputTokens
		estimatedInputTokens = await estimateApiRequestTokens(request)

		// If small fields and structural overhead prevent proportional shrinking,
		// remove an old, complete conversation prefix while retaining tool pairs.
		if (estimatedInputTokens >= previousEstimate && request.messages.length > 4) {
			request.messages = dropOldestConversationPrefix(request.messages)
			estimatedInputTokens = await estimateApiRequestTokens(request)
		}
	}

	while (estimatedInputTokens > inputTokenBudget && request.messages.length > 4) {
		request.messages = dropOldestConversationPrefix(request.messages)
		estimatedInputTokens = await estimateApiRequestTokens(request)
	}

	if (estimatedInputTokens > inputTokenBudget) {
		request = aggressivelyCompactRequest(request)
		estimatedInputTokens = await estimateApiRequestTokens(request)
	}

	if (estimatedInputTokens > inputTokenBudget) {
		throw new Error(
			`Context window guard stopped an unsafe provider request: ${estimatedInputTokens} estimated input tokens ` +
				`still exceed the ${inputTokenBudget}-token input budget for ${model.id} ` +
				`(${contextWindow}-token context window, ${outputReserve} tokens reserved for output). No LLM call was made.`,
		)
	}

	const guardedMetadata: ApiHandlerCreateMessageMetadata = {
		...(request.metadata ?? {}),
		allowedTools: request.tools,
		// A stored Responses API chain still contains the untrimmed remote
		// context. Force the provider to use the fitted local history whenever the
		// guard had to intervene.
		suppressPreviousResponseId: true,
	}
	delete guardedMetadata.previousResponseId

	return {
		systemPrompt: request.systemPrompt,
		messages: request.messages,
		metadata: guardedMetadata,
		contextWindow,
		inputTokenBudget,
		estimatedInputTokens,
		originalEstimatedInputTokens,
		wasTruncated: true,
	}
}

export async function estimateApiRequestTokens(request: {
	systemPrompt: string
	messages: GuardableMessage[]
	metadata?: ApiHandlerCreateMessageMetadata
	tools?: ToolDefinition[]
}): Promise<number> {
	const blocks: Anthropic.Messages.ContentBlockParam[] = [{ type: "text", text: `[system]\n${request.systemPrompt}` }]

	for (const message of request.messages) {
		blocks.push({ type: "text", text: `[${message.role}]` })
		if (typeof message.content === "string") {
			blocks.push({ type: "text", text: message.content })
		} else {
			blocks.push(...message.content)
		}
		if (message.reasoning) {
			blocks.push({ type: "text", text: message.reasoning })
		}
		if (message.reasoning_content) {
			blocks.push({ type: "text", text: message.reasoning_content })
		}
	}

	const tools = request.tools ?? getEffectiveTools(request.metadata)
	if (tools.length > 0) {
		blocks.push({ type: "text", text: `[tools]\n${safeJsonStringify(tools)}` })
	}

	if (request.metadata) {
		const { allowedTools: _allowedTools, ...promptRelevantMetadata } = request.metadata
		blocks.push({ type: "text", text: `[request metadata]\n${safeJsonStringify(promptRelevantMetadata)}` })
	}

	return (
		(await tiktoken(blocks)) +
		REQUEST_FIXED_OVERHEAD_TOKENS +
		request.messages.length * MESSAGE_OVERHEAD_TOKENS +
		tools.length * TOOL_DEFINITION_OVERHEAD_TOKENS
	)
}

function resolveContextWindow(model: ModelInfo, settings: ProviderSettings): number {
	const selectedModelId = getSelectedModelId(settings)
	const explicitContextSuffix = selectedModelId?.match(
		/^axon-(?:auto|eido-3-code-(?:mini|pro)|lumen-4-code)-(200|400)k$/i,
	)

	// Axon aliases route to shared upstream ids. Use the alias to lower a stale
	// fallback safely, but never raise a finite fetched limit when the two
	// disagree. Dynamic handlers are refreshed before this function runs.
	if (explicitContextSuffix) {
		const suffixWindow = Number(explicitContextSuffix[1]) * 1_000
		return Number.isFinite(model.contextWindow) && model.contextWindow > 0
			? Math.min(suffixWindow, Math.floor(model.contextWindow))
			: suffixWindow
	}

	return Number.isFinite(model.contextWindow) && model.contextWindow > 0
		? Math.floor(model.contextWindow)
		: DEFAULT_CONTEXT_WINDOW
}

function getSelectedModelId(settings: ProviderSettings): string | undefined {
	if (settings.thirdPartySelectedModel) {
		const separator = settings.thirdPartySelectedModel.indexOf(":")
		return separator >= 0 ? settings.thirdPartySelectedModel.slice(separator + 1) : settings.thirdPartySelectedModel
	}

	switch (settings.apiProvider) {
		case "kilocode":
		case "kilocode-openrouter":
			return settings.kilocodeModel
		case "openrouter":
			return settings.openRouterModelId
		case "openai":
			return settings.openAiModelId
		case "glama":
			return settings.glamaModelId
		case "ollama":
			return settings.ollamaModelId
		case "lmstudio":
			return settings.lmStudioModelId
		case "unbound":
			return settings.unboundModelId
		case "requesty":
			return settings.requestyModelId
		case "huggingface":
			return settings.huggingFaceModelId
		case "litellm":
			return settings.litellmModelId
		case "ovhcloud":
			return settings.ovhCloudAiEndpointsModelId
		case "io-intelligence":
			return settings.ioIntelligenceModelId
		case "vercel-ai-gateway":
			return settings.vercelAiGatewayModelId
		case "vscode-lm":
			return settings.vsCodeLmModelSelector?.id
		default:
			return settings.apiModelId
	}
}

function resolveOutputReserve(
	modelId: string,
	model: ModelInfo,
	settings: ProviderSettings,
	contextWindow: number,
): number {
	// Use the resolved/selected context window here as well. Axon's 200k and
	// 400k aliases can share an upstream id, and a fresh handler may temporarily
	// hold the 200k fallback record even though the 400k alias is selected.
	const configuredReserve = getModelMaxOutputTokens({
		modelId,
		model: { ...model, contextWindow },
		settings,
	})
	const reserve =
		typeof configuredReserve === "number" && Number.isFinite(configuredReserve) && configuredReserve >= 0
			? configuredReserve
			: Math.min(8_192, Math.floor(contextWindow * 0.2))

	// A malformed model record must not create a negative input budget. The
	// provider will never be called if even the compacted prompt cannot fit.
	return Math.min(Math.floor(reserve), Math.max(0, contextWindow - REQUEST_FIXED_OVERHEAD_TOKENS - 1))
}

function getEffectiveTools(metadata?: ApiHandlerCreateMessageMetadata): ToolDefinition[] {
	if (metadata && metadata.allowedTools !== undefined) {
		return metadata.allowedTools
	}

	return nativeTools
}

function cloneMessage(message: GuardableMessage): GuardableMessage {
	return {
		...message,
		content: Array.isArray(message.content) ? message.content.map(cloneContentBlock) : message.content,
	}
}

function cloneContentBlock(block: Anthropic.Messages.ContentBlockParam): Anthropic.Messages.ContentBlockParam {
	if (block.type === "tool_result" && Array.isArray(block.content)) {
		return {
			...block,
			content: block.content.map(cloneContentBlock) as Array<
				Anthropic.TextBlockParam | Anthropic.ImageBlockParam
			>,
		}
	}
	return { ...block }
}

function shrinkRequest(request: MutableRequest, ratio: number, round: number): MutableRequest {
	const lastIndex = request.messages.length - 1
	const messages = request.messages.map((message, index) => {
		const distanceFromNewest = lastIndex - index
		const ageMultiplier = distanceFromNewest > 6 ? 0.35 : distanceFromNewest > 3 ? 0.6 : 1
		return shrinkMessage(message, Math.max(0.01, ratio * ageMultiplier), round)
	})

	const systemRatio = round < 2 ? Math.max(0.65, ratio) : Math.max(0.08, ratio)
	const tools = request.tools.map((tool) => shrinkToolDefinition(tool, ratio, round))

	return {
		systemPrompt: truncateText(
			request.systemPrompt,
			scaledLength(request.systemPrompt, systemRatio, round < 3 ? 4_096 : 512),
		),
		messages,
		metadata: request.metadata,
		tools,
	}
}

function shrinkMessage(message: GuardableMessage, ratio: number, round: number): GuardableMessage {
	const content =
		typeof message.content === "string"
			? truncateText(message.content, scaledLength(message.content, ratio, round < 3 ? 192 : 48))
			: message.content.map((block) => shrinkContentBlock(block, ratio, round))

	return {
		...message,
		content,
		...(message.reasoning
			? { reasoning: truncateText(message.reasoning, scaledLength(message.reasoning, ratio, 96)) }
			: {}),
		...(message.reasoning_content
			? {
					reasoning_content: truncateText(
						message.reasoning_content,
						scaledLength(message.reasoning_content, ratio, 96),
					),
				}
			: {}),
	}
}

function shrinkContentBlock(
	block: Anthropic.Messages.ContentBlockParam,
	ratio: number,
	round: number,
): Anthropic.Messages.ContentBlockParam {
	switch (block.type) {
		case "text":
			return { ...block, text: truncateText(block.text, scaledLength(block.text, ratio, round < 3 ? 128 : 32)) }
		case "tool_result":
			return {
				...block,
				content:
					typeof block.content === "string"
						? truncateText(block.content, scaledLength(block.content, ratio, round < 3 ? 128 : 32))
						: (block.content?.map((item) => shrinkContentBlock(item, ratio, round)) as
								| Array<Anthropic.TextBlockParam | Anthropic.ImageBlockParam>
								| undefined),
			}
		case "tool_use": {
			const serializedInput = safeJsonStringify(block.input)
			const inputLimit = scaledLength(serializedInput, ratio, round < 3 ? 256 : 64)
			return serializedInput.length > inputLimit
				? {
						...block,
						input: {
							_context_window_guard: truncateText(serializedInput, inputLimit),
						},
					}
				: { ...block }
		}
		case "thinking": {
			const limit = scaledLength(block.thinking, ratio, 96)
			return block.thinking.length > limit
				? { type: "text", text: truncateText(block.thinking, limit) }
				: { ...block }
		}
		case "redacted_thinking":
			return round >= 1
				? { type: "text", text: "[Redacted reasoning omitted by context-window guard.]" }
				: { ...block }
		case "document":
			return round >= 1 ? { type: "text", text: "[Document omitted by context-window guard.]" } : { ...block }
		case "image":
			// Image token cost is not proportional to base64 length. Keep valid image
			// blocks during normal shrinking and omit only in the aggressive pass.
			return { ...block }
		default:
			if (round < 3) {
				return { ...block }
			}
			return {
				type: "text",
				text: truncateText(safeJsonStringify(block), Math.max(64, Math.floor(512 * ratio))),
			}
	}
}

function shrinkToolDefinition(tool: ToolDefinition, ratio: number, round: number): ToolDefinition {
	if (tool.type !== "function") {
		return tool
	}

	const description = tool.function.description
	const compactParameters =
		round >= 4 ? { type: "object", properties: {} } : shrinkSchemaDescriptions(tool.function.parameters, ratio)

	return {
		...tool,
		function: {
			...tool.function,
			...(description
				? { description: truncateText(description, scaledLength(description, Math.max(ratio, 0.15), 64)) }
				: {}),
			parameters: compactParameters as typeof tool.function.parameters,
		},
	}
}

function shrinkSchemaDescriptions(value: unknown, ratio: number, key?: string): unknown {
	if (typeof value === "string") {
		return key === "description" || key === "title"
			? truncateText(value, scaledLength(value, Math.max(ratio, 0.15), 48))
			: value
	}
	if (Array.isArray(value)) {
		return value.map((item) => shrinkSchemaDescriptions(item, ratio))
	}
	if (value && typeof value === "object") {
		return Object.fromEntries(
			Object.entries(value).map(([childKey, childValue]) => [
				childKey,
				shrinkSchemaDescriptions(childValue, ratio, childKey),
			]),
		)
	}
	return value
}

function dropOldestConversationPrefix(messages: GuardableMessage[]): GuardableMessage[] {
	if (messages.length <= 4) {
		return messages
	}

	const target = Math.max(1, Math.floor(messages.length / 2))
	let boundary = target
	while (boundary < messages.length - 1 && messages[boundary].role !== "assistant") {
		boundary++
	}

	if (boundary >= messages.length - 1) {
		const lastMessage = messages.at(-1)
		if (!lastMessage) {
			return [{ role: "user", content: HISTORY_OMISSION_MESSAGE }]
		}
		if (lastMessage.role === "assistant") {
			return [{ role: "user", content: HISTORY_OMISSION_MESSAGE }, lastMessage]
		}
		return [
			{
				role: "user",
				content: `${HISTORY_OMISSION_MESSAGE}\n\n${contentToPlainText(lastMessage.content)}`,
			},
		]
	}

	return [{ role: "user", content: HISTORY_OMISSION_MESSAGE }, ...messages.slice(boundary)]
}

function aggressivelyCompactRequest(request: MutableRequest): MutableRequest {
	let messages = request.messages
	if (messages.length > 3) {
		messages = dropOldestConversationPrefix(messages)
	}

	messages = messages
		.map((message) => shrinkMessage(message, 0.005, 10))
		.map((message) => ({
			...message,
			content: Array.isArray(message.content) ? message.content.map(omitNonTextPayloads) : message.content,
		}))

	return {
		systemPrompt: truncateText(request.systemPrompt, 1_024),
		messages,
		metadata: request.metadata,
		// An empty, explicitly supplied list disables native tool definitions in
		// providers that use addNativeToolCallsToParams.
		tools: [],
	}
}

function omitNonTextPayloads(block: Anthropic.Messages.ContentBlockParam): Anthropic.Messages.ContentBlockParam {
	if (block.type === "image") {
		return { type: "text", text: "[Image omitted by context-window guard.]" }
	}
	if (block.type === "document") {
		return { type: "text", text: "[Document omitted by context-window guard.]" }
	}
	if (block.type === "tool_result" && Array.isArray(block.content)) {
		return {
			...block,
			content: block.content.map((item) =>
				item.type === "image"
					? { type: "text", text: "[Tool-result image omitted by context-window guard.]" }
					: item,
			),
		}
	}
	return block
}

function scaledLength(text: string, ratio: number, minimum: number): number {
	return Math.min(text.length, Math.max(minimum, Math.floor(text.length * ratio)))
}

export function truncateText(text: string, maxCharacters: number): string {
	if (text.length <= maxCharacters) {
		return text
	}
	if (maxCharacters <= TRUNCATION_MARKER.length) {
		return TRUNCATION_MARKER.slice(0, Math.max(0, maxCharacters))
	}

	const available = maxCharacters - TRUNCATION_MARKER.length
	const headLength = Math.floor(available * 0.35)
	const tailLength = available - headLength
	return `${text.slice(0, headLength)}${TRUNCATION_MARKER}${text.slice(text.length - tailLength)}`
}

function contentToPlainText(content: Anthropic.Messages.MessageParam["content"]): string {
	if (typeof content === "string") {
		return content
	}

	return content
		.map((block) => {
			if (block.type === "text") return block.text
			if (block.type === "tool_result") {
				if (typeof block.content === "string") return block.content
				return block.content?.map((item) => (item.type === "text" ? item.text : "[image]")).join("\n") ?? ""
			}
			return `[${block.type}]`
		})
		.join("\n")
}

function safeJsonStringify(value: unknown): string {
	try {
		return JSON.stringify(value)
	} catch {
		return String(value)
	}
}
