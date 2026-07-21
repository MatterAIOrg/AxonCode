import { getKilocodeApiModelId, KILO_CODE_MODELS, type KiloCodeModel } from "../kilocode-models"

const getSharedMetadata = ({ name: _name, context_length: _contextLength, ...metadata }: KiloCodeModel) => metadata

describe("KiloCode Axon Eido 3 context variants", () => {
	it.each([
		["pro", "axon-eido-3-code-pro-200k", "axon-eido-3-code-pro-400k"],
		["mini", "axon-eido-3-code-mini-200k", "axon-eido-3-code-mini-400k"],
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
		["axon-eido-3-code-pro-200k", "axon-eido-3-code-pro"],
		["axon-eido-3-code-pro-400k", "axon-eido-3-code-pro"],
		["axon-eido-3-code-mini-200k", "axon-eido-3-code-mini"],
		["axon-eido-3-code-mini-400k", "axon-eido-3-code-mini"],
	])("sends %s to its upstream model %s", (selectedId, apiModelId) => {
		expect(getKilocodeApiModelId(selectedId)).toBe(apiModelId)
	})
})
