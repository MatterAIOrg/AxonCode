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
	"axon-2-5-mini": {
		id: "axon-2-5-mini",
		name: "Axon 2.5 Mini (free)",
		description: "Auto is a model that automatically selects the best model for the task",
		input_modalities: ["text", "image"],
		context_length: 200000,
		max_output_length: 32768,
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
	"axon-code-2-pro": {
		id: "axon-code-2-pro",
		name: "Axon Code 2.1 Pro",
		description:
			"Axon Code 2.1 Pro is the next-generation of Axon Code for coding tasks, currently in experimental stage.",
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
			prompt: "0.0000012",
			completion: "0.0000048",
			image: "0",
			request: "0",
			input_cache_reads: "0",
			input_cache_writes: "0",
		},
	},
	"axon-code-2-pro-high": {
		id: "axon-code-2-pro-high",
		name: "Axon Code 2.1 Pro (High)",
		description:
			"Enabled with deep thinking, Axon Code 2.1 Pro High is the next-generation of Axon Code for coding tasks, currently in experimental stage.",
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
			prompt: "0.0000012",
			completion: "0.0000048",
			image: "0",
			request: "0",
			input_cache_reads: "0",
			input_cache_writes: "0",
		},
	},
	"axon-code-2-5-pro": {
		id: "axon-code-2-5-pro",
		name: "Axon Code 2.5 Pro",
		description:
			"Axon Code 2.5 Pro is the next-generation of Axon Code for coding tasks, currently in experimental stage.",
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
			prompt: "0.0000012",
			completion: "0.0000048",
			image: "0",
			request: "0",
			input_cache_reads: "0",
			input_cache_writes: "0",
		},
	},
	"axon-code-2-5-pro-high": {
		id: "axon-code-2-5-pro-high",
		name: "Axon Code 2.5 Pro (High)",
		description:
			"Enabled with deep thinking, Axon Code 2.5 Pro High is the next-generation of Axon Code for coding tasks, currently in experimental stage.",
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
			prompt: "0.0000012",
			completion: "0.0000048",
			image: "0",
			request: "0",
			input_cache_reads: "0",
			input_cache_writes: "0",
		},
	},
}
