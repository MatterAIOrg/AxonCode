import type { ModelParameter } from "@roo-code/types"

export type KiloCodeModel = {
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
		prompt?: string
		completion?: string
		image?: string
		request?: string
		input_cache_reads?: string
		input_cache_writes?: string
	}
}

export const KILO_CODE_MODELS: Record<string, KiloCodeModel> = {
	"axon-eido-3-flash": {
		id: "axon-eido-3-flash",
		name: "Axon Eido 3 Flash (free)",
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
	"axon-eido-3-code-pro": {
		id: "axon-eido-3-code-pro",
		name: "Axon Eido 3 Pro",
		description:
			"Axon Eido 3 Pro is the frontier Axon Code model for coding tasks, long running agents and general intelligence, fine-tuned on open source models.",
		input_modalities: ["text", "image"],
		context_length: 400000,
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
	},
	"axon-eido-3-code-mini": {
		id: "axon-eido-3-code-mini",
		name: "Axon Eido 3 Mini",
		description:
			"Axon Eido 3 Mini is a general purpose super intelligent LLM coding model for high-effort day-to-day tasks",
		input_modalities: ["text", "image"],
		context_length: 400000,
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
	},
}

/**
 * Checks whether a given model ID is present in the static KiloCode model list.
 * Used to detect stale model selections after extension updates remove models.
 */
export function isValidKilocodeModel(modelId: string): boolean {
	return modelId in KILO_CODE_MODELS
}
