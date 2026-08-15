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
		"Axon Auto starts with Eido 3.2 Flash and dynamically selects Flash, 3.2, or Pro as the task evolves. Pricing is dynamic and follows the model used for each request.",
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

const AXON_EIDO_3_2_CODE_PRO: KiloCodeModelVariant = {
	description:
		"Axon Eido 3.2 Pro is the frontier Orbital model for coding tasks, long running agents and general intelligence, fine-tuned on open source models.",
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

const AXON_EIDO_3_2: KiloCodeModelVariant = {
	description:
		"Axon Eido 3.2 is a general purpose super intelligent LLM coding model for high-effort day-to-day tasks",
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
		prompt: "0.000002",
		completion: "0.000006",
		image: "0",
		request: "0",
		input_cache_reads: "0.0000005",
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

const AXON_EIDO_3_2_FLASH: KiloCodeModelVariant = {
	description: "Axon Eido 3.2 Flash is a fast and low cost general purpose model for low-effort day-to-day tasks",
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
		prompt: "0.0",
		completion: "0.0",
		image: "0",
		request: "0",
		input_cache_reads: "0",
		input_cache_writes: "0",
	},
}

export const KILO_CODE_MODELS: Record<string, KiloCodeModel> = {
	"axon-auto-232k": {
		...AXON_AUTO,
		id: "axon-auto",
		name: "Axon Auto (232K context)",
		context_length: 232000,
	},
	"axon-auto-400k": {
		...AXON_AUTO,
		id: "axon-auto",
		name: "Axon Auto (400K context)",
		context_length: 400000,
	},
	"axon-eido-3.2-flash": {
		...AXON_EIDO_3_2_FLASH,
		id: "axon-eido-3.2-flash",
		name: "Axon Eido 3.2 Flash (232K context)",
		context_length: 232000,
	},
	"axon-eido-3.2-flash-400k": {
		...AXON_EIDO_3_2_FLASH,
		id: "axon-eido-3.2-flash",
		name: "Axon Eido 3.2 Flash (400K context)",
		context_length: 400000,
	},
	"axon-eido-3.2-232k": {
		...AXON_EIDO_3_2,
		id: "axon-eido-3.2",
		name: "Axon Eido 3.2 (232K context)",
		context_length: 232000,
	},
	"axon-eido-3.2-400k": {
		...AXON_EIDO_3_2,
		id: "axon-eido-3.2",
		name: "Axon Eido 3.2 (400K context)",
		context_length: 400000,
	},
	"axon-eido-3.2-code-pro-232k": {
		...AXON_EIDO_3_2_CODE_PRO,
		id: "axon-eido-3.2-code-pro",
		name: "Axon Eido 3.2 Pro (232K context)",
		context_length: 232000,
	},
	"axon-eido-3.2-code-pro-400k": {
		...AXON_EIDO_3_2_CODE_PRO,
		id: "axon-eido-3.2-code-pro",
		name: "Axon Eido 3.2 Pro (400K context)",
		context_length: 400000,
	},
	"axon-lumen-4-code-232k": {
		...AXON_LUMEN_4_CODE,
		id: "axon-lumen-4-code",
		name: "Axon Lumen 4 (232K context)",
		context_length: 232000,
	},
	"axon-lumen-4-code-400k": {
		...AXON_LUMEN_4_CODE,
		id: "axon-lumen-4-code",
		name: "Axon Lumen 4 (400K context)",
		context_length: 400000,
	},
}

/**
 * Checks whether a given model ID is present in the static KiloCode model list.
 * Used to detect stale model selections after extension updates remove models.
 */
export function isValidKilocodeModel(modelId: string): boolean {
	return modelId in KILO_CODE_MODELS
}

/**
 * Resolves an extension model option to the model ID understood by the API.
 * Context-window variants are local catalog choices and share an upstream model.
 */
export function getKilocodeApiModelId(modelId: string): string {
	return KILO_CODE_MODELS[modelId]?.id ?? modelId
}
