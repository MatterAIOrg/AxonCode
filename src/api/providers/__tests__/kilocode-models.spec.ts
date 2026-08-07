import { getKilocodeApiModelId, KILO_CODE_MODELS, type KiloCodeModel } from "../kilocode-models"

const getSharedMetadata = ({ name: _name, context_length: _contextLength, ...metadata }: KiloCodeModel) => metadata

describe("KiloCode Axon context variants", () => {
	it.each([
		["auto", "axon-auto-200k", "axon-auto-400k"],
		["pro", "axon-eido-3-code-pro-200k", "axon-eido-3-code-pro-400k"],
		["mini", "axon-eido-3-code-mini-200k", "axon-eido-3-code-mini-400k"],
		["lumen", "axon-lumen-4-code-200k", "axon-lumen-4-code-400k"],
	])("provides 200k and 400k %s variants with identical model metadata", (_tier, model200kId, model400kId) => {
		const model200k = KILO_CODE_MODELS[model200kId]
		const model400k = KILO_CODE_MODELS[model400kId]

		expect(model200k).toBeDefined()
		expect(model400k).toBeDefined()
		expect(model200k?.context_length).toBe(200000)
		expect(model400k?.context_length).toBe(400000)
		expect(getSharedMetadata(model200k!)).toEqual(getSharedMetadata(model400k!))
	})

	it.each([
		["axon-auto-200k", "axon-auto"],
		["axon-auto-400k", "axon-auto"],
		["axon-eido-3-code-pro-200k", "axon-eido-3-code-pro"],
		["axon-eido-3-code-pro-400k", "axon-eido-3-code-pro"],
		["axon-eido-3-code-mini-200k", "axon-eido-3-code-mini"],
		["axon-eido-3-code-mini-400k", "axon-eido-3-code-mini"],
		["axon-lumen-4-code-200k", "axon-lumen-4-code"],
		["axon-lumen-4-code-400k", "axon-lumen-4-code"],
	])("sends %s to its upstream model %s", (selectedId, apiModelId) => {
		expect(getKilocodeApiModelId(selectedId)).toBe(apiModelId)
	})

	it.each(["axon-auto-200k", "axon-auto-400k"])("marks %s as dynamically priced", (modelId) => {
		const model = KILO_CODE_MODELS[modelId]

		expect(model?.pricing).toMatchObject({ type: "dynamic", display: "dynamic pricing" })
		expect(model?.pricing.prompt).toBeUndefined()
		expect(model?.pricing.completion).toBeUndefined()
	})
})
