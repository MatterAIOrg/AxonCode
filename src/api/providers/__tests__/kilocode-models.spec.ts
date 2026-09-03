import {
	getKilocodeApiModelId,
	isValidKilocodeModel,
	KILO_CODE_MODELS,
	registerDynamicKilocodeModels,
	type KiloCodeModel,
} from "../kilocode-models"

// Raw catalog entries as served by the MatterAI backend /v1/web/models
// endpoint (non-axon models only). The static catalog ships empty; models
// arrive at runtime via registerDynamicKilocodeModels.
const RAW_OSS_MODELS: Array<Record<string, any>> = [
	{
		id: "meta/muse-spark-1.3-contributor",
		name: "Muse Spark 1.3 Contributor",
		description: "Meta Muse Spark 1.3 Contributor is an open general purpose model for everyday coding tasks.",
		context_length: 232000,
		owned_by: "meta",
		pricing: { prompt: "0.0000001", completion: "0.0000002", input_cache_reads: "0.000000002" },
	},
	{
		id: "deepseek/deepseek-v4-flash-0731",
		name: "DeepSeek V4 Flash",
		description: "DeepSeek V4 Flash is a fast, low cost open model for low-effort day-to-day coding tasks.",
		context_length: 232000,
		owned_by: "deepseek",
		pricing: { prompt: "0.00000014", completion: "0.00000028", input_cache_reads: "0.000000028" },
	},
	{
		id: "zai/glm-5.3",
		name: "GLM 5.3",
		description: "GLM 5.3 is Z.ai's frontier open model for complex coding tasks and long running agents.",
		context_length: 232000,
		owned_by: "zai",
		pricing: { prompt: "0.0000014", completion: "0.0000044", input_cache_reads: "0.00000014" },
	},
	{
		id: "zai/glm-5.3-flash",
		name: "GLM 5.3 Flash",
		description: "GLM 5.3 Flash is a fast, low cost open model for everyday coding tasks.",
		context_length: 232000,
		owned_by: "zai",
		pricing: { prompt: "0.00000015", completion: "0.0000005", input_cache_reads: "0.00000003" },
	},
	{
		id: "gpt-5.6-sol",
		name: "GPT-5.6 Sol",
		description: "GPT-5.6 Sol is an open reasoning model for complex coding tasks and long running agents.",
		context_length: 232000,
		owned_by: "openai",
		pricing: { prompt: "0.000005", completion: "0.00003", input_cache_reads: "0.0000005" },
	},
	{
		id: "gpt-5.6-luna",
		name: "GPT-5.6 Luna",
		description: "GPT-5.6 Luna is a fast, low cost open model for everyday coding tasks.",
		context_length: 232000,
		owned_by: "openai",
		pricing: { prompt: "0.0000002", completion: "0.0000012", input_cache_reads: "0.00000002" },
	},
	{
		id: "gemini-3.7-flash",
		name: "Gemini 3.7 Flash",
		description: "Gemini 3.7 Flash is a fast, low cost open model for everyday coding tasks.",
		context_length: 232000,
		owned_by: "google",
		pricing: { prompt: "0.00000075", completion: "0.00000375", input_cache_reads: "0.000000075" },
	},
]

const OSS_MODEL_IDS = RAW_OSS_MODELS.map((raw) => raw.id as string)

const getSharedMetadata = ({
	id: _id,
	name: _name,
	description: _description,
	context_length: _contextLength,
	owned_by: _ownedBy,
	openrouter: _openrouter,
	pricing: _pricing,
	...metadata
}: KiloCodeModel) => metadata

describe("KiloCode dynamic model catalog", () => {
	// KILO_CODE_MODELS is module-level mutable state shared across tests in
	// this file; seed the backend catalog before each test.
	beforeEach(() => {
		registerDynamicKilocodeModels(RAW_OSS_MODELS)
	})

	it("registers exactly the backend catalog models", () => {
		expect(Object.keys(KILO_CODE_MODELS).sort()).toEqual([...OSS_MODEL_IDS].sort())
	})

	it("skips axon models and entries without an id", () => {
		registerDynamicKilocodeModels([{ id: "axon-eido-3.2-code-flash", name: "Axon" }, { name: "no id" }])

		expect(KILO_CODE_MODELS["axon-eido-3.2-code-flash"]).toBeUndefined()
		expect(Object.keys(KILO_CODE_MODELS).sort()).toEqual([...OSS_MODEL_IDS].sort())
	})

	it.each([...OSS_MODEL_IDS])("sends %s to the API unchanged", (modelId) => {
		const model = KILO_CODE_MODELS[modelId]

		expect(model).toBeDefined()
		expect(model?.id).toBe(modelId)
		expect(model?.context_length).toBe(232000)
		expect(model?.openrouter.slug).toBe(modelId)
		expect(getKilocodeApiModelId(modelId)).toBe(modelId)
	})

	it("passes unknown ids through unchanged", () => {
		expect(getKilocodeApiModelId("acme/unknown")).toBe("acme/unknown")
	})

	it("prices each model at its published rate", () => {
		expect(KILO_CODE_MODELS["meta/muse-spark-1.3-contributor"]?.pricing).toMatchObject({
			prompt: "0.0000001",
			completion: "0.0000002",
			input_cache_reads: "0.000000002",
		})
		expect(KILO_CODE_MODELS["deepseek/deepseek-v4-flash-0731"]?.pricing).toMatchObject({
			prompt: "0.00000014",
			completion: "0.00000028",
			input_cache_reads: "0.000000028",
		})
		expect(KILO_CODE_MODELS["zai/glm-5.3"]?.pricing).toMatchObject({
			prompt: "0.0000014",
			completion: "0.0000044",
			input_cache_reads: "0.00000014",
		})
		expect(KILO_CODE_MODELS["zai/glm-5.3-flash"]?.pricing).toMatchObject({
			prompt: "0.00000015",
			completion: "0.0000005",
			input_cache_reads: "0.00000003",
		})
		expect(KILO_CODE_MODELS["gpt-5.6-sol"]?.pricing).toMatchObject({
			prompt: "0.000005",
			completion: "0.00003",
			input_cache_reads: "0.0000005",
		})
		expect(KILO_CODE_MODELS["gpt-5.6-luna"]?.pricing).toMatchObject({
			prompt: "0.0000002",
			completion: "0.0000012",
			input_cache_reads: "0.00000002",
		})
		expect(KILO_CODE_MODELS["gemini-3.7-flash"]?.pricing).toMatchObject({
			prompt: "0.00000075",
			completion: "0.00000375",
			input_cache_reads: "0.000000075",
		})
	})

	it("keeps image, request, and cache-write pricing at zero", () => {
		for (const model of Object.values(KILO_CODE_MODELS)) {
			expect(model.pricing.image).toBe("0")
			expect(model.pricing.request).toBe("0")
			expect(model.pricing.input_cache_writes).toBe("0")
		}
	})

	it("shares identical base metadata across all models", () => {
		const models = OSS_MODEL_IDS.map((modelId) => KILO_CODE_MODELS[modelId]!)
		const [first, ...rest] = models.map(getSharedMetadata)

		for (const metadata of rest) {
			expect(metadata).toEqual(first)
		}
	})

	it("falls back to sane defaults for sparse entries", () => {
		registerDynamicKilocodeModels([{ id: "acme/prototype" }])

		expect(KILO_CODE_MODELS["acme/prototype"]).toMatchObject({
			name: "acme/prototype",
			description: "acme/prototype via MatterAI",
			context_length: 232000,
			max_output_length: 64000,
			owned_by: "acme",
			input_modalities: ["text", "image"],
			output_modalities: ["text"],
		})
		expect(KILO_CODE_MODELS["acme/prototype"].pricing).toMatchObject({
			prompt: "0",
			completion: "0",
			input_cache_reads: "0",
			input_cache_writes: "0",
		})
	})

	it("coerces numeric pricing to strings", () => {
		registerDynamicKilocodeModels([
			{
				id: "acme/numeric",
				pricing: { prompt: 0.0000001, completion: 0.0000002, input_cache_reads: 0.000000002 },
			},
		])

		// String() renders sub-1e-6 numbers in scientific notation; parsePrice
		// consumes these via parseFloat, so the coercion stays lossless.
		expect(KILO_CODE_MODELS["acme/numeric"].pricing).toMatchObject({
			prompt: "1e-7",
			completion: "2e-7",
			input_cache_reads: "2e-9",
		})
	})

	it("validates registered models and rejects stale non-auto axon selections", () => {
		expect(isValidKilocodeModel("zai/glm-5.3")).toBe(true)
		expect(isValidKilocodeModel("axon-eido-3.2-code-flash")).toBe(false)
		expect(isValidKilocodeModel("unknown/model")).toBe(false)
	})

	it("always accepts axon-auto router ids", () => {
		expect(isValidKilocodeModel("axon-auto")).toBe(true)
		expect(isValidKilocodeModel("axon-auto-400k")).toBe(true)
	})
})

describe("isValidKilocodeModel with an empty catalog", () => {
	it("accepts any model before the first backend fetch", () => {
		for (const key of Object.keys(KILO_CODE_MODELS)) {
			delete KILO_CODE_MODELS[key]
		}

		expect(Object.keys(KILO_CODE_MODELS).length).toBe(0)
		expect(isValidKilocodeModel("axon-eido-3.2-code-flash")).toBe(true)
		expect(isValidKilocodeModel("anything")).toBe(true)
	})
})
