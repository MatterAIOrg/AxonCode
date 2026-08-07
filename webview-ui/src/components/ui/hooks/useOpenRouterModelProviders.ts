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

type KiloCodeModelVariant = Omit<KiloCodeModel, "id" | "name" | "context_length">

const AXON_AUTO: KiloCodeModelVariant = {
	description:
		"Axon Auto starts with Eido 3 Code Flash and dynamically selects Flash, Mini, or Pro as the task evolves. Pricing is dynamic and follows the model used for each request.",
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
	openrouter: {
		slug: "matterai/axon",
	},
	datacenters: [{ country_code: "US" }],
	created: 1750426201,
	owned_by: "matterai",
	pricing: {
		type: "dynamic",
		display: "dynamic pricing",
		image: "0",
		request: "0",
		input_cache_reads: "0",
		input_cache_writes: "0",
	},
}

const AXON_EIDO_3_CODE_PRO: KiloCodeModelVariant = {
	description:
		"Axon Eido 3 Pro is the frontier model for coding tasks, long running agents and general intelligence, fine-tuned on open source models.",
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
	openrouter: {
		slug: "matterai/axon",
	},
	datacenters: [{ country_code: "US" }],
	created: 1750426201,
	owned_by: "matterai",
	pricing: {
		prompt: "0.000003",
		completion: "0.000009",
		image: "0",
		request: "0",
		input_cache_reads: "0",
		input_cache_writes: "0",
	},
}

const AXON_EIDO_3_CODE_MINI: KiloCodeModelVariant = {
	description:
		"Axon Eido 3 Mini is a general purpose super intelligent LLM coding model for high-effort day-to-day tasks",
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
	openrouter: {
		slug: "matterai/axon",
	},
	datacenters: [{ country_code: "US" }],
	created: 1750426201,
	owned_by: "matterai",
	pricing: {
		prompt: "0.0000015",
		completion: "0.0000045",
		image: "0",
		request: "0",
		input_cache_reads: "0",
		input_cache_writes: "0",
	},
}

const AXON_LUMEN_4_CODE: KiloCodeModelVariant = {
	description:
		"Axon Lumen 4 is the ultra-intelligent frontier model for complex agentic coding tasks and general intelligence.",
	input_modalities: ["text", "image"],
	max_output_length: 128000,
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
	openrouter: {
		slug: "matterai/axon",
	},
	datacenters: [{ country_code: "US" }],
	created: 1750426201,
	owned_by: "matterai",
	pricing: {
		prompt: "0.000005",
		completion: "0.000025",
		image: "0",
		request: "0",
		input_cache_reads: "0",
		input_cache_writes: "0",
	},
}

const KILO_CODE_MODELS: Record<string, KiloCodeModel> = {
	"axon-auto-200k": {
		...AXON_AUTO,
		id: "axon-auto",
		name: "Axon Auto (200K context)",
		context_length: 200000,
	},
	"axon-auto-400k": {
		...AXON_AUTO,
		id: "axon-auto",
		name: "Axon Auto (400K context)",
		context_length: 400000,
	},
	"axon-eido-3-flash": {
		id: "axon-eido-3-flash",
		name: "Axon Eido 3 Flash (200K context)",
		description: "Axon Eido is a fast and low cost general purpose model for low-effort day-to-day tasks",
		input_modalities: ["text", "image"],
		context_length: 200000,
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
		openrouter: {
			slug: "matterai/axon",
		},
		datacenters: [{ country_code: "US" }],
		created: 1750426201,
		owned_by: "matterai",
		pricing: {
			prompt: "0.0",
			completion: "0.0",
			image: "0",
			request: "0",
			input_cache_reads: "0",
			input_cache_writes: "0",
		},
	},
	"axon-eido-3-code-pro-200k": {
		...AXON_EIDO_3_CODE_PRO,
		id: "axon-eido-3-code-pro",
		name: "Axon Eido 3 Pro (200K context)",
		context_length: 200000,
	},
	"axon-eido-3-code-pro-400k": {
		...AXON_EIDO_3_CODE_PRO,
		id: "axon-eido-3-code-pro",
		name: "Axon Eido 3 Pro (400K context)",
		context_length: 400000,
	},
	"axon-eido-3-code-mini-200k": {
		...AXON_EIDO_3_CODE_MINI,
		id: "axon-eido-3-code-mini",
		name: "Axon Eido 3 Mini (200K context)",
		context_length: 200000,
	},
	"axon-eido-3-code-mini-400k": {
		...AXON_EIDO_3_CODE_MINI,
		id: "axon-eido-3-code-mini",
		name: "Axon Eido 3 Mini (400K context)",
		context_length: 400000,
	},
	"axon-lumen-4-code-200k": {
		...AXON_LUMEN_4_CODE,
		id: "axon-lumen-4-code",
		name: "Axon Lumen 4 (200K context)",
		context_length: 200000,
	},
	"axon-lumen-4-code-400k": {
		...AXON_LUMEN_4_CODE,
		id: "axon-lumen-4-code",
		name: "Axon Lumen 4 (400K context)",
		context_length: 400000,
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
