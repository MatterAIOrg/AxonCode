import { getKilocodeApiModelId, KILO_CODE_MODELS, type KiloCodeModel } from "../kilocode-models"

const OSS_MODEL_IDS = [
	"meta/muse-spark-1.2-contributor",
	"deepseek/deepseek-v4-flash-0731",
	"zai/glm-5.3",
	"zai/glm-5.3-flash",
	"gpt-5.6-sol",
	"gpt-5.6-luna",
	"gemini-3.7-flash",
]

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

describe("KiloCode OSS model catalog", () => {
	it("exposes exactly the seven OSS models", () => {
		expect(Object.keys(KILO_CODE_MODELS).sort()).toEqual([...OSS_MODEL_IDS].sort())
	})

	it("no longer exposes axon models", () => {
		expect(KILO_CODE_MODELS["axon-auto-232k"]).toBeUndefined()
		expect(KILO_CODE_MODELS["axon-eido-3.2-code-pro-400k"]).toBeUndefined()
	})

	it.each([...OSS_MODEL_IDS])("sends %s to the API unchanged", (modelId) => {
		const model = KILO_CODE_MODELS[modelId]

		expect(model).toBeDefined()
		expect(model?.id).toBe(modelId)
		expect(model?.context_length).toBe(232000)
		expect(getKilocodeApiModelId(modelId)).toBe(modelId)
	})

	it("prices each OSS model at its published rate", () => {
		expect(KILO_CODE_MODELS["meta/muse-spark-1.2-contributor"]?.pricing).toMatchObject({
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

	it("shares identical base metadata across all OSS models", () => {
		const models = OSS_MODEL_IDS.map((modelId) => KILO_CODE_MODELS[modelId]!)
		const [first, ...rest] = models.map(getSharedMetadata)

		for (const metadata of rest) {
			expect(metadata).toEqual(first)
		}
	})
})
