import {
	canUse400kContext,
	canUseLumenModels,
	get200kAxonFallback,
	getAxonPlanFallback,
	is400kAxonModel,
	isLumenAxonModel,
	isPlanRestrictedAxonModel,
} from "@roo-code/types"

describe("400k Axon model plan access", () => {
	it.each(["Pro Plus", "pro_plus", "pro-plus", "ULTRA"])("allows %s", (plan) => {
		expect(canUse400kContext(plan)).toBe(true)
	})

	it.each([undefined, "free", "Pro", "Enterprise"])("rejects %s", (plan) => {
		expect(canUse400kContext(plan)).toBe(false)
	})

	it("identifies Axon 400k variants", () => {
		expect(is400kAxonModel("axon-eido-3-code-mini-400k")).toBe(true)
		expect(is400kAxonModel("axon-eido-3-code-pro-400k")).toBe(true)
		expect(is400kAxonModel("axon-lumen-4-code-400k")).toBe(true)
		expect(is400kAxonModel("axon-eido-3-code-mini-200k")).toBe(false)
		expect(is400kAxonModel("axon-lumen-4-code-200k")).toBe(false)
		expect(is400kAxonModel("third-party-model-400k")).toBe(false)
	})

	it("maps a restricted model to the matching 200k variant", () => {
		expect(get200kAxonFallback("axon-eido-3-code-mini-400k")).toBe("axon-eido-3-code-mini-200k")
	})

	it.each(["Pro Plus", "pro_plus", "pro-plus", "ULTRA"])("allows Lumen models on %s", (plan) => {
		expect(canUseLumenModels(plan)).toBe(true)
	})

	it.each([undefined, "free", "Pro", "Enterprise"])("rejects Lumen models on %s", (plan) => {
		expect(canUseLumenModels(plan)).toBe(false)
	})

	it("identifies Lumen Axon models", () => {
		expect(isLumenAxonModel("axon-lumen-4-code-200k")).toBe(true)
		expect(isLumenAxonModel("axon-lumen-4-code-400k")).toBe(true)
		expect(isLumenAxonModel("axon-eido-3-code-pro-200k")).toBe(false)
		expect(isLumenAxonModel("axon-eido-3-flash")).toBe(false)
	})

	it("identifies plan-restricted Axon models", () => {
		expect(isPlanRestrictedAxonModel("axon-lumen-4-code-200k")).toBe(true)
		expect(isPlanRestrictedAxonModel("axon-lumen-4-code-400k")).toBe(true)
		expect(isPlanRestrictedAxonModel("axon-eido-3-code-pro-400k")).toBe(true)
		expect(isPlanRestrictedAxonModel("axon-eido-3-code-pro-200k")).toBe(false)
		expect(isPlanRestrictedAxonModel("axon-eido-3-flash")).toBe(false)
	})

	it("falls back from Lumen models to Eido Pro 200k", () => {
		expect(getAxonPlanFallback("axon-lumen-4-code-200k")).toBe("axon-eido-3-code-pro-200k")
		expect(getAxonPlanFallback("axon-lumen-4-code-400k")).toBe("axon-eido-3-code-pro-200k")
		expect(getAxonPlanFallback("axon-eido-3-code-mini-400k")).toBe("axon-eido-3-code-mini-200k")
	})
})
