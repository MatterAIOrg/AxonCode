import {
	canAccessAxonModel,
	canUse400kContext,
	canUseEido3Pro,
	canUseLumenModels,
	get200kAxonFallback,
	getAxonPlanFallback,
	is400kAxonModel,
	isEido3ProModel,
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
		expect(is400kAxonModel("axon-auto-400k")).toBe(true)
		expect(is400kAxonModel("axon-eido-3-code-mini-400k")).toBe(true)
		expect(is400kAxonModel("axon-eido-3-code-pro-400k")).toBe(true)
		expect(is400kAxonModel("axon-lumen-4-code-400k")).toBe(true)
		expect(is400kAxonModel("axon-auto-200k")).toBe(false)
		expect(is400kAxonModel("axon-eido-3-code-mini-200k")).toBe(false)
		expect(is400kAxonModel("axon-lumen-4-code-200k")).toBe(false)
		expect(is400kAxonModel("third-party-model-400k")).toBe(false)
	})

	it("maps a restricted model to the matching 200k variant", () => {
		expect(get200kAxonFallback("axon-auto-400k")).toBe("axon-auto-200k")
		expect(get200kAxonFallback("axon-eido-3-flash-400k")).toBe("axon-eido-3-flash")
		expect(get200kAxonFallback("axon-eido-3-code-mini-400k")).toBe("axon-eido-3-code-mini-200k")
	})

	it.each(["Pro", "pro", "Pro Plus", "pro_plus", "pro-plus", "ULTRA"])("allows Eido 3 Pro on %s", (plan) => {
		expect(canUseEido3Pro(plan)).toBe(true)
	})

	it.each([undefined, "free", "Enterprise"])("rejects Eido 3 Pro on %s", (plan) => {
		expect(canUseEido3Pro(plan)).toBe(false)
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
		expect(isPlanRestrictedAxonModel("axon-auto-400k")).toBe(true)
		expect(isPlanRestrictedAxonModel("axon-auto-200k")).toBe(false)
		expect(isPlanRestrictedAxonModel("axon-lumen-4-code-200k")).toBe(true)
		expect(isPlanRestrictedAxonModel("axon-lumen-4-code-400k")).toBe(true)
		expect(isPlanRestrictedAxonModel("axon-eido-3-flash-400k")).toBe(true)
		expect(isPlanRestrictedAxonModel("axon-eido-3-code-mini-400k")).toBe(true)
		expect(isPlanRestrictedAxonModel("axon-eido-3-code-pro-400k")).toBe(true)
		expect(isPlanRestrictedAxonModel("axon-eido-3-code-pro-200k")).toBe(true)
		expect(isPlanRestrictedAxonModel("axon-eido-3-flash")).toBe(false)
		expect(isPlanRestrictedAxonModel("axon-eido-3-code-mini-200k")).toBe(false)
	})

	it("identifies Eido 3 Pro models", () => {
		expect(isEido3ProModel("axon-eido-3-code-pro-200k")).toBe(true)
		expect(isEido3ProModel("axon-eido-3-code-pro-400k")).toBe(true)
		expect(isEido3ProModel("axon-eido-3-code-mini-400k")).toBe(false)
		expect(isEido3ProModel("axon-lumen-4-code-400k")).toBe(false)
	})

	it("checks model access by plan", () => {
		// Auto 200k: all plans; Auto 400k: Pro Plus+ plans only
		expect(canAccessAxonModel("axon-auto-200k", "free")).toBe(true)
		expect(canAccessAxonModel("axon-auto-400k", "proplus")).toBe(true)
		expect(canAccessAxonModel("axon-auto-400k", "pro")).toBe(false)
		// Eido 3 Flash 400k: Pro Plus+ plans only
		expect(canAccessAxonModel("axon-eido-3-flash-400k", "proplus")).toBe(true)
		expect(canAccessAxonModel("axon-eido-3-flash-400k", "pro")).toBe(false)
		expect(canAccessAxonModel("axon-eido-3-flash", "free")).toBe(true)
		// Eido 3 Pro 200k: Pro+ plans
		expect(canAccessAxonModel("axon-eido-3-code-pro-200k", "pro")).toBe(true)
		expect(canAccessAxonModel("axon-eido-3-code-pro-200k", "proplus")).toBe(true)
		expect(canAccessAxonModel("axon-eido-3-code-pro-200k", "free")).toBe(false)
		// Eido 3 Pro 400k: Pro Plus+ plans only
		expect(canAccessAxonModel("axon-eido-3-code-pro-400k", "proplus")).toBe(true)
		expect(canAccessAxonModel("axon-eido-3-code-pro-400k", "pro")).toBe(false)
		expect(canAccessAxonModel("axon-eido-3-code-pro-400k", "free")).toBe(false)
		// Eido 3 Mini 200k: all plans
		expect(canAccessAxonModel("axon-eido-3-code-mini-200k", "free")).toBe(true)
		// Eido 3 Mini 400k: Pro Plus+ plans only
		expect(canAccessAxonModel("axon-eido-3-code-mini-400k", "proplus")).toBe(true)
		expect(canAccessAxonModel("axon-eido-3-code-mini-400k", "pro")).toBe(false)
		// Lumen: Pro Plus+ plans only
		expect(canAccessAxonModel("axon-lumen-4-code-200k", "proplus")).toBe(true)
		expect(canAccessAxonModel("axon-lumen-4-code-200k", "pro")).toBe(false)
		// Non-Axon models: always accessible
		expect(canAccessAxonModel("some-other-model", "free")).toBe(true)
	})

	it("falls back from restricted models to the closest accessible variant", () => {
		expect(getAxonPlanFallback("axon-auto-400k", "free")).toBe("axon-auto-200k")
		// Lumen on Pro plan -> Eido 3 Pro 200k
		expect(getAxonPlanFallback("axon-lumen-4-code-200k", "pro")).toBe("axon-eido-3-code-pro-200k")
		expect(getAxonPlanFallback("axon-lumen-4-code-400k", "pro")).toBe("axon-eido-3-code-pro-200k")
		// Lumen on free plan -> Axon Auto 200k
		expect(getAxonPlanFallback("axon-lumen-4-code-200k", "free")).toBe("axon-auto-200k")
		// Eido 3 Pro 400k on Pro plan -> Eido 3 Pro 200k
		expect(getAxonPlanFallback("axon-eido-3-code-pro-400k", "pro")).toBe("axon-eido-3-code-pro-200k")
		// Eido 3 Pro 400k on free plan -> Axon Auto 200k
		expect(getAxonPlanFallback("axon-eido-3-code-pro-400k", "free")).toBe("axon-auto-200k")
		// Eido 3 Pro 200k on free plan -> Axon Auto 200k
		expect(getAxonPlanFallback("axon-eido-3-code-pro-200k", "free")).toBe("axon-auto-200k")
		// Eido 3 Flash 400k on free plan -> Eido 3 Flash 200k
		expect(getAxonPlanFallback("axon-eido-3-flash-400k", "free")).toBe("axon-eido-3-flash")
		// Eido 3 Mini 400k -> Eido 3 Mini 200k
		expect(getAxonPlanFallback("axon-eido-3-code-mini-400k", "free")).toBe("axon-eido-3-code-mini-200k")
	})
})
