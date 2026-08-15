import { getKilocodeApiModelId, KILO_CODE_MODELS, type KiloCodeModel } from "../kilocode-models"

const getSharedMetadata = ({ name: _name, context_length: _contextLength, ...metadata }: KiloCodeModel) => metadata

describe("KiloCode Axon context variants", () => {
	it.each([
		["auto", "axon-auto-232k", "axon-auto-400k", 232000],
		["flash", "axon-eido-3.2-flash", "axon-eido-3.2-flash-400k", 232000],
		["eido-3.2", "axon-eido-3.2-232k", "axon-eido-3.2-400k", 232000],
		["pro", "axon-eido-3.2-code-pro-232k", "axon-eido-3.2-code-pro-400k", 232000],
		["lumen", "axon-lumen-4-code-232k", "axon-lumen-4-code-400k", 232000],
	])(
		"provides lower-context and 400k %s variants with identical model metadata",
		(_tier, modelLowerId, model400kId, lowerContextLength) => {
			const modelLower = KILO_CODE_MODELS[modelLowerId]
			const model400k = KILO_CODE_MODELS[model400kId]

			expect(modelLower).toBeDefined()
			expect(model400k).toBeDefined()
			expect(modelLower?.context_length).toBe(lowerContextLength)
			expect(model400k?.context_length).toBe(400000)
			expect(getSharedMetadata(modelLower!)).toEqual(getSharedMetadata(model400k!))
		},
	)

	it.each([
		["axon-auto-232k", "axon-auto"],
		["axon-auto-400k", "axon-auto"],
		["axon-eido-3.2-flash", "axon-eido-3.2-flash"],
		["axon-eido-3.2-flash-400k", "axon-eido-3.2-flash"],
		["axon-eido-3.2-232k", "axon-eido-3.2"],
		["axon-eido-3.2-400k", "axon-eido-3.2"],
		["axon-eido-3.2-code-pro-232k", "axon-eido-3.2-code-pro"],
		["axon-eido-3.2-code-pro-400k", "axon-eido-3.2-code-pro"],
		["axon-lumen-4-code-232k", "axon-lumen-4-code"],
		["axon-lumen-4-code-400k", "axon-lumen-4-code"],
	])("sends %s to its upstream model %s", (selectedId, apiModelId) => {
		expect(getKilocodeApiModelId(selectedId)).toBe(apiModelId)
	})

	it.each(["axon-auto-232k", "axon-auto-400k"])("marks %s as dynamically priced", (modelId) => {
		const model = KILO_CODE_MODELS[modelId]

		expect(model?.pricing).toMatchObject({ type: "dynamic", display: "dynamic pricing" })
		expect(model?.pricing.prompt).toBeUndefined()
		expect(model?.pricing.completion).toBeUndefined()
	})
})
