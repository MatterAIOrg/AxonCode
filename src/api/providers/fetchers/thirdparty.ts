import axios from "axios"
import { ModelInfo, openAiModelInfoSaneDefaults } from "@roo-code/types"

export interface ThirdPartyProviderConfig {
	baseUrl: string
	apiKey?: string
	modelsEndpoint?: string // Optional custom endpoint for fetching models
	alwaysEnabled?: boolean // If true, provider is always enabled without settings
}

// Provider configurations
const PROVIDER_CONFIGS: Record<string, ThirdPartyProviderConfig> = {
	matterai3p: {
		baseUrl: "https://api2.matterai.so/v1",
		modelsEndpoint: "https://api.matterai.so/v1/models/matterai3p",
		alwaysEnabled: true, // Always enabled, no settings required
	},
	ollama: {
		baseUrl: "http://localhost:11434/v1",
	},
	opencode: {
		baseUrl: "https://opencode.ai/zen/go/v1",
		modelsEndpoint: "https://api.matterai.so/v1/models/opencode",
	},
	fireworks: {
		baseUrl: "https://api.fireworks.ai/inference/v1",
	},
}

export async function getThirdPartyModels(provider: string, apiKey?: string): Promise<Record<string, ModelInfo>> {
	const config = PROVIDER_CONFIGS[provider]
	if (!config) {
		throw new Error(`Unsupported third-party provider: ${provider}`)
	}

	const models: Record<string, ModelInfo> = {}

	// Fireworks has a hardcoded model
	if (provider === "fireworks") {
		models["fireworks:accounts/fireworks/routers/kimi-k2p5-turbo"] = {
			...openAiModelInfoSaneDefaults,
			description: "Kimi K2.5 Turbo (Fireworks Fire Pass)",
			contextWindow: 128000,
			supportsImages: true,
			supportsPromptCache: false,
			supportsComputerUse: false,
			maxTokens: 8192,
		}
		return models
	}

	try {
		// Use custom models endpoint if provided, otherwise use the standard /models endpoint
		const modelsUrl = config.modelsEndpoint || `${config.baseUrl}/models`

		if (!URL.canParse(modelsUrl)) {
			return models
		}

		// Prepare headers
		const headers: Record<string, string> = {
			"Content-Type": "application/json",
		}

		// Use provided API key or fall back to config
		const effectiveApiKey = apiKey || config.apiKey
		if (effectiveApiKey) {
			headers["Authorization"] = `Bearer ${effectiveApiKey}`
		}

		// Fetch models from the endpoint
		const response = await axios.get(modelsUrl, { headers, timeout: 10000 })

		if (response.data && response.data.data && Array.isArray(response.data.data)) {
			for (const model of response.data.data) {
				if (model.id) {
					// Create a standardized model info
					models[`${provider}:${model.id}`] = {
						...openAiModelInfoSaneDefaults,
						description: model.description || `${model.id} (${provider})`,
						contextWindow: openAiModelInfoSaneDefaults.contextWindow,
						supportsImages: false, // Default, could be enhanced based on model capabilities
						supportsPromptCache: false,
						supportsComputerUse: false,
						maxTokens: openAiModelInfoSaneDefaults.maxTokens,
					}
				}
			}
		}
	} catch (error: any) {
		if (error.code === "ECONNREFUSED") {
			console.warn(`Failed connecting to ${provider} at ${config.baseUrl}`)
		} else if (error.response?.status === 401) {
			console.warn(`Authentication failed for ${provider}. Please check your API key.`)
		} else if (error.response?.status === 404) {
			console.warn(`${provider} endpoint not found at ${config.baseUrl}/models`)
		} else {
			console.error(
				`Error fetching ${provider} models: ${JSON.stringify(error, Object.getOwnPropertyNames(error), 2)}`,
			)
		}
		throw error
	}

	return models
}

// Helper function to get the base URL for a provider
export function getThirdPartyProviderBaseUrl(provider: string): string {
	return PROVIDER_CONFIGS[provider]?.baseUrl || ""
}

// Helper function to check if a provider requires an API key
export function thirdPartyProviderRequiresApiKey(provider: string): boolean {
	return provider === "opencode" || provider === "fireworks" // Ollama typically doesn't require auth for local instances
}

// Helper function to check if a provider is always enabled (no settings required)
export function isThirdPartyProviderAlwaysEnabled(provider: string): boolean {
	return PROVIDER_CONFIGS[provider]?.alwaysEnabled === true
}

// Get list of always-enabled providers
export function getAlwaysEnabledProviders(): string[] {
	return Object.entries(PROVIDER_CONFIGS)
		.filter(([, config]) => config.alwaysEnabled)
		.map(([provider]) => provider)
}
