import { Anthropic } from "@anthropic-ai/sdk"
import OpenAI from "openai" // kilocode_change

import type { ProviderSettings, ModelInfo } from "@roo-code/types"

import { ApiStream } from "./transform/stream"

import {
	GlamaHandler,
	AnthropicHandler,
	AwsBedrockHandler,
	CerebrasHandler,
	OpenRouterHandler,
	VertexHandler,
	AnthropicVertexHandler,
	OpenAiHandler,
	LmStudioHandler,
	GeminiHandler,
	OpenAiNativeHandler,
	DeepSeekHandler,
	MoonshotHandler,
	MistralHandler,
	VsCodeLmHandler,
	UnboundHandler,
	RequestyHandler,
	HumanRelayHandler,
	FakeAIHandler,
	XAIHandler,
	GroqHandler,
	HuggingFaceHandler,
	ChutesHandler,
	LiteLLMHandler,
	// forked_change start
	VirtualQuotaFallbackHandler,
	GeminiCliHandler,
	// forked_change end
	ClaudeCodeHandler,
	QwenCodeHandler,
	SambaNovaHandler,
	IOIntelligenceHandler,
	DoubaoHandler,
	ZAiHandler,
	FireworksHandler,
	SyntheticHandler, // kilocode_change
	RooHandler,
	FeatherlessHandler,
	VercelAiGatewayHandler,
	DeepInfraHandler,
	OVHcloudAIEndpointsHandler, // kilocode_change
} from "./providers"
// forked_change start
import { KilocodeOpenrouterHandler } from "./providers/kilocode-openrouter"
// forked_change end
import { NativeOllamaHandler } from "./providers/native-ollama"

export interface SingleCompletionHandler {
	completePrompt(prompt: string): Promise<string>
}

export interface ApiHandlerCreateMessageMetadata {
	mode?: string
	taskId: string
	previousResponseId?: string
	/**
	 * When true, the provider must NOT fall back to internal continuity state
	 * (e.g., lastResponseId) if previousResponseId is absent.
	 * Used to enforce "skip once" after a condense operation.
	 */
	suppressPreviousResponseId?: boolean
	/**
	 * Controls whether the response should be stored for 30 days in OpenAI's Responses API.
	 * When true (default), responses are stored and can be referenced in future requests
	 * using the previous_response_id for efficient conversation continuity.
	 * Set to false to opt out of response storage for privacy or compliance reasons.
	 * @default true
	 */
	store?: boolean
	// forked_change start
	/**
	 * Array of allowed tools for the current mode when using JSON tool style.
	 * This contains the full tool definitions (function schemas) that the model can use.
	 */
	allowedTools?: OpenAI.Chat.ChatCompletionTool[]
	/**
	 * KiloCode-specific: The project ID for the current workspace (derived from git origin remote).
	 * Used by KiloCodeOpenrouterHandler for backend tracking. Ignored by other providers.
	 * @kilocode-only
	 */
	projectId?: string
	/**
	 * KiloCode-specific: The git repository URL or root folder name for the current workspace.
	 * If a git repository, contains the git remote URL. Otherwise, contains the root folder name.
	 * Used by KiloCodeOpenrouterHandler for backend tracking. Ignored by other providers.
	 * @kilocode-only
	 */
	repo?: string
	// forked_change end
}

export interface ApiHandler {
	createMessage(
		systemPrompt: string,
		messages: Anthropic.Messages.MessageParam[],
		metadata?: ApiHandlerCreateMessageMetadata,
	): ApiStream

	getModel(): { id: string; info: ModelInfo }

	/**
	 * Counts tokens for content blocks
	 * All providers extend BaseProvider which provides a default tiktoken implementation,
	 * but they can override this to use their native token counting endpoints
	 *
	 * @param content The content to count tokens for
	 * @returns A promise resolving to the token count
	 */
	countTokens(content: Array<Anthropic.Messages.ContentBlockParam>): Promise<number>
}

export function buildApiHandler(configuration: ProviderSettings): ApiHandler {
	const { apiProvider, ...options } = configuration

	// Handle third-party provider model selection
	// If a third-party model is selected, route through OpenAI handler with custom base URL
	if (options.thirdPartySelectedModel) {
		const [provider, ...modelParts] = options.thirdPartySelectedModel.split(":")
		const modelId = modelParts.join(":")

		const providerBaseUrls: Record<string, string> = {
			matterai3p: "https://api2.matterai.so/v1",
			ollama: "http://localhost:11434/v1",
			opencode: "https://opencode.ai/zen/go/v1",
			fireworks: "https://api.fireworks.ai/inference/v1",
		}

		const baseUrl = providerBaseUrls[provider]
		if (baseUrl && modelId) {
			// Get API key based on provider
			let apiKey: string | undefined
			if (provider === "opencode") {
				apiKey = options.thirdPartyProviders?.opencode?.apiKey
			} else if (provider === "fireworks") {
				apiKey = options.thirdPartyProviders?.fireworks?.apiKey
			} else if (provider === "matterai3p") {
				// Use kilocodeToken for matterai3p authentication
				apiKey = options.kilocodeToken
			}

			// Create OpenAI handler with third-party provider settings
			return new OpenAiHandler({
				...options,
				openAiBaseUrl: baseUrl,
				openAiModelId: modelId,
				...(apiKey ? { openAiApiKey: apiKey } : {}),
			})
		}
	}

	switch (apiProvider) {
		// forked_change start
		case "kilocode":
			return new KilocodeOpenrouterHandler(options)
		case "kilocode-openrouter": // temp typing fix
			return new KilocodeOpenrouterHandler(options)
		case "gemini-cli":
			return new GeminiCliHandler(options)
		case "virtual-quota-fallback":
			return new VirtualQuotaFallbackHandler(options)
		// forked_change end
		case "anthropic":
			return new AnthropicHandler(options)
		case "claude-code":
			return new ClaudeCodeHandler(options)
		case "glama":
			return new GlamaHandler(options)
		case "openrouter":
			return new OpenRouterHandler(options)
		case "bedrock":
			return new AwsBedrockHandler(options)
		case "vertex":
			return options.apiModelId?.startsWith("claude")
				? new AnthropicVertexHandler(options)
				: new VertexHandler(options)
		case "openai":
			return new OpenAiHandler(options)
		case "ollama":
			return new NativeOllamaHandler(options)
		case "lmstudio":
			return new LmStudioHandler(options)
		case "gemini":
			return new GeminiHandler(options)
		case "openai-native":
			return new OpenAiNativeHandler(options)
		case "deepseek":
			return new DeepSeekHandler(options)
		case "doubao":
			return new DoubaoHandler(options)
		case "qwen-code":
			return new QwenCodeHandler(options)
		case "moonshot":
			return new MoonshotHandler(options)
		case "vscode-lm":
			return new VsCodeLmHandler(options)
		case "mistral":
			return new MistralHandler(options)
		case "unbound":
			return new UnboundHandler(options)
		case "requesty":
			return new RequestyHandler(options)
		case "human-relay":
			return new HumanRelayHandler()
		case "fake-ai":
			return new FakeAIHandler(options)
		case "xai":
			return new XAIHandler(options)
		case "groq":
			return new GroqHandler(options)
		case "deepinfra":
			return new DeepInfraHandler(options)
		case "huggingface":
			return new HuggingFaceHandler(options)
		case "chutes":
			return new ChutesHandler(options)
		case "litellm":
			return new LiteLLMHandler(options)
		case "cerebras":
			return new CerebrasHandler(options)
		case "sambanova":
			return new SambaNovaHandler(options)
		case "zai":
			return new ZAiHandler(options)
		case "fireworks":
			return new FireworksHandler(options)
		// forked_change start
		case "synthetic":
			return new SyntheticHandler(options)
		// forked_change end
		case "io-intelligence":
			return new IOIntelligenceHandler(options)
		case "roo":
			// Never throw exceptions from provider constructors
			// The provider-proxy server will handle authentication and return appropriate error codes
			return new RooHandler(options)
		case "featherless":
			return new FeatherlessHandler(options)
		case "vercel-ai-gateway":
			return new VercelAiGatewayHandler(options)
		// forked_change start
		case "ovhcloud":
			return new OVHcloudAIEndpointsHandler(options)
		// forked_change end
		default:
			apiProvider satisfies "gemini-cli" | undefined
			return new AnthropicHandler(options)
	}
}
