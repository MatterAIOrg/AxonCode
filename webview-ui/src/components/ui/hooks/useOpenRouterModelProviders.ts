import { useQuery, UseQueryOptions } from "@tanstack/react-query"

import type { ModelInfo, ModelParameter } from "@roo-code/types"
import { isModelParameter } from "@roo-code/types"

//TODO: import { parseApiPrice } from "@roo/cost"

export const OPENROUTER_DEFAULT_PROVIDER_NAME = "[default]"

type OpenRouterModelProvider = ModelInfo & {
	label: string
	pricingLabel?: string
}

type KiloCodeModel = {
	id: string
	name: string
	description: string
	input_modalities: string[]
	context_length: number
	max_output_length: number
	output_modalities: string[]
	supported_sampling_parameters: string[]
	supported_features: string[]
	openrouter: {
		slug: string
	}
	datacenters: Array<{ country_code: string }>
	created: number
	owned_by: string
	pricing: {
		type?: "dynamic"
		display?: string
		prompt?: string
		completion?: string
		image?: string
		request?: string
		input_cache_reads?: string
		input_cache_writes?: string
	}
}

type KiloCodeModelVariant = Omit<
	KiloCodeModel,
	"id" | "name" | "description" | "context_length" | "owned_by" | "openrouter"
>

// Shared metadata for the OSS models served through the MatterAI gateway.
// Pricing strings are USD per token (OpenRouter format); per-model rates are
// set on each entry below.
const OSS_MODEL_BASE: KiloCodeModelVariant = {
	input_modalities: ["text", "image"],
	max_output_length: 64000,
	output_modalities: ["text"],
	supported_sampling_parameters: [
		"temperature",
		"top_p",
		"top_k",
		"repetition_penalty",
		"frequency_penalty",
		"presence_penalty",
		"seed",
		"stop",
	],
	supported_features: ["tools", "structured_outputs", "web_search"],
	datacenters: [{ country_code: "US" }],
	created: 1786032000,
	pricing: {
		image: "0",
		request: "0",
		input_cache_writes: "0",
	},
}

const KILO_CODE_MODELS: Record<string, KiloCodeModel> = {
	"meta/muse-spark-1.2-contributor": {
		...OSS_MODEL_BASE,
		id: "meta/muse-spark-1.2-contributor",
		name: "Muse Spark 1.2 Contributor",
		description: "Meta Muse Spark 1.2 Contributor is an open general purpose model for everyday coding tasks.",
		context_length: 232000,
		owned_by: "meta",
		openrouter: { slug: "meta/muse-spark-1.2-contributor" },
		// $0.10/M input, $0.002/M cache read, $0.20/M output
		pricing: {
			...OSS_MODEL_BASE.pricing,
			prompt: "0.0000001",
			completion: "0.0000002",
			input_cache_reads: "0.000000002",
		},
	},
	"deepseek/deepseek-v4-flash-0731": {
		...OSS_MODEL_BASE,
		id: "deepseek/deepseek-v4-flash-0731",
		name: "DeepSeek V4 Flash",
		description: "DeepSeek V4 Flash is a fast, low cost open model for low-effort day-to-day coding tasks.",
		context_length: 232000,
		owned_by: "deepseek",
		openrouter: { slug: "deepseek/deepseek-v4-flash-0731" },
		// $0.14/M input, $0.028/M cache read, $0.28/M output
		pricing: {
			...OSS_MODEL_BASE.pricing,
			prompt: "0.00000014",
			completion: "0.00000028",
			input_cache_reads: "0.000000028",
		},
	},
	"zai/glm-5.3-flash": {
		...OSS_MODEL_BASE,
		id: "zai/glm-5.3-flash",
		name: "GLM 5.3 Flash",
		description: "GLM 5.3 Flash is a fast, low cost open model for everyday coding tasks.",
		context_length: 232000,
		owned_by: "zai",
		openrouter: { slug: "zai/glm-5.3-flash" },
		// $0.15/M input, $0.03/M cache read, $0.50/M output
		pricing: {
			...OSS_MODEL_BASE.pricing,
			prompt: "0.00000015",
			completion: "0.0000005",
			input_cache_reads: "0.00000003",
		},
	},
	"zai/glm-5.3": {
		...OSS_MODEL_BASE,
		id: "zai/glm-5.3",
		name: "GLM 5.3",
		description: "GLM 5.3 is Z.ai's frontier open model for complex coding tasks and long running agents.",
		context_length: 232000,
		owned_by: "zai",
		openrouter: { slug: "zai/glm-5.3" },
		// $1.40/M input, $0.14/M cache read, $4.40/M output
		pricing: {
			...OSS_MODEL_BASE.pricing,
			prompt: "0.0000014",
			completion: "0.0000044",
			input_cache_reads: "0.00000014",
		},
	},
	"gpt-5.6-luna": {
		...OSS_MODEL_BASE,
		id: "gpt-5.6-luna",
		name: "GPT-5.6 Luna",
		description: "GPT-5.6 Luna is a fast, low cost open model for everyday coding tasks.",
		context_length: 232000,
		owned_by: "openai",
		openrouter: { slug: "gpt-5.6-luna" },
		// $0.20/M input, $0.02/M cache read, $1.20/M output
		pricing: {
			...OSS_MODEL_BASE.pricing,
			prompt: "0.0000002",
			completion: "0.0000012",
			input_cache_reads: "0.00000002",
		},
	},
	"gpt-5.6-sol": {
		...OSS_MODEL_BASE,
		id: "gpt-5.6-sol",
		name: "GPT-5.6 Sol",
		description: "GPT-5.6 Sol is an open reasoning model for complex coding tasks and long running agents.",
		context_length: 232000,
		owned_by: "openai",
		openrouter: { slug: "gpt-5.6-sol" },
		// $5/M input, $0.50/M cache read, $30/M output
		pricing: {
			...OSS_MODEL_BASE.pricing,
			prompt: "0.000005",
			completion: "0.00003",
			input_cache_reads: "0.0000005",
		},
	},
	"gemini-3.7-flash": {
		...OSS_MODEL_BASE,
		id: "gemini-3.7-flash",
		name: "Gemini 3.7 Flash",
		description: "Gemini 3.7 Flash is a fast, low cost open model for everyday coding tasks.",
		context_length: 232000,
		owned_by: "google",
		openrouter: { slug: "gemini-3.7-flash" },
		// $0.75/M input, $0.075/M cache read, $3.75/M output
		pricing: {
			...OSS_MODEL_BASE.pricing,
			prompt: "0.00000075",
			completion: "0.00000375",
			input_cache_reads: "0.000000075",
		},
	},
}

const parsePrice = (value?: string): number | undefined => {
	if (typeof value === "undefined") {
		return undefined
	}

	const trimmed = value.trim()
	if (trimmed.length === 0) {
		return undefined
	}

	const parsed = Number(trimmed)
	return Number.isFinite(parsed) ? parsed : undefined
}

const getSupportedParameters = (parameters: string[]): ModelParameter[] | undefined => {
	const supported = parameters.filter((parameter): parameter is ModelParameter => isModelParameter(parameter))

	return supported.length > 0 ? supported : undefined
}

const toOpenRouterModelProvider = (model: KiloCodeModel): OpenRouterModelProvider => {
	const cacheReadsPrice = parsePrice(model.pricing.input_cache_reads)
	const cacheWritesPrice = parsePrice(model.pricing.input_cache_writes)
	const supportedParameters = getSupportedParameters(model.supported_sampling_parameters)
	const supportsTemperature = supportedParameters?.includes("temperature")
	const datacenterLabel = model.datacenters
		.map(({ country_code }) => country_code)
		.filter(Boolean)
		.join(", ")

	return {
		maxTokens: model.max_output_length,
		contextWindow: model.context_length,
		maxThinkingTokens: undefined,
		supportsImages: model.input_modalities.includes("image"),
		supportsPromptCache: typeof cacheReadsPrice !== "undefined",
		supportsVerbosity: undefined,
		supportsReasoningBudget: undefined,
		requiredReasoningBudget: undefined,
		supportsReasoningEffort: undefined,
		supportedParameters,
		supportsTemperature,
		inputPrice: parsePrice(model.pricing.prompt),
		outputPrice: parsePrice(model.pricing.completion),
		cacheWritesPrice,
		cacheReadsPrice,
		description: model.description,
		reasoningEffort: undefined,
		minTokensPerCachePoint: undefined,
		maxCachePoints: undefined,
		cachableFields: undefined,
		displayName: model.name,
		pricingLabel: model.pricing.display,
		preferredIndex: undefined,
		deprecated: undefined,
		label: datacenterLabel ? `KiloCode (${datacenterLabel})` : "KiloCode",
	}
}

// kilocode_change: baseUrl, apiKey
async function getOpenRouterProvidersForModel(modelId: string, _baseUrl?: string, _apiKey?: string) {
	const models: Record<string, OpenRouterModelProvider> = {}

	const model = KILO_CODE_MODELS[modelId]
	if (!model) {
		return models
	}

	models["KiloCode"] = toOpenRouterModelProvider(model)

	return models
}

type UseOpenRouterModelProvidersOptions = Omit<
	UseQueryOptions<Record<string, OpenRouterModelProvider>>,
	"queryKey" | "queryFn"
>

// forked_change start: baseUrl, apiKey, organizationId
export const useOpenRouterModelProviders = (
	modelId?: string,
	baseUrl?: string,
	apiKey?: string,
	organizationId?: string,
	options?: UseOpenRouterModelProvidersOptions,
) =>
	useQuery<Record<string, OpenRouterModelProvider>>({
		queryKey: ["openrouter-model-providers", modelId, baseUrl, apiKey, organizationId],
		queryFn: () => (modelId ? getOpenRouterProvidersForModel(modelId, baseUrl, apiKey) : {}),
		...options,
	})
// forked_change end
