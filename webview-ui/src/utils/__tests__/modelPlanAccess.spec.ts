import {
	canAccessAxonModel,
	canUse400kContext,
	canUseEido3Pro,
	canUsePaidPlan,
	canUseLumenModels,
	get232kAxonFallback,
	get400kAxonVariant,
	getAxonPlanFallback,
	is400kAxonModel,
	isEido3ProModel,
	isEido32Model,
	isEido3MiniModel,
	isPaidPlanAxonModel,
	isLumenAxonModel,
	isPlanRestrictedAxonModel,
} from "@roo-code/types"

describe("Axon model plan access", () => {
	it.each(["Pro Plus", "pro_plus", "pro-plus", "ULTRA"])("allows 400k context on %s", (plan) => {
		expect(canUse400kContext(plan)).toBe(true)
	})

	it.each([undefined, "free", "Pro", "Enterprise"])("rejects 400k context on %s", (plan) => {
		expect(canUse400kContext(plan)).toBe(false)
	})

	it("identifies Axon 400k variants", () => {
		expect(is400kAxonModel("axon-auto-400k")).toBe(true)
		expect(is400kAxonModel("axon-eido-3-code-mini-400k")).toBe(true)
		expect(is400kAxonModel("axon-eido-3-code-pro-400k")).toBe(true)
		expect(is400kAxonModel("axon-eido-3.2-flash-400k")).toBe(true)
		expect(is400kAxonModel("axon-eido-3.2-400k")).toBe(true)
		expect(is400kAxonModel("axon-eido-3.2-code-pro-400k")).toBe(true)
		expect(is400kAxonModel("axon-lumen-4-code-400k")).toBe(true)
		expect(is400kAxonModel("axon-auto-232k")).toBe(false)
		expect(is400kAxonModel("axon-eido-3-code-mini-232k")).toBe(false)
		expect(is400kAxonModel("axon-eido-3.2-232k")).toBe(false)
		expect(is400kAxonModel("axon-lumen-4-code-232k")).toBe(false)
		expect(is400kAxonModel("third-party-model-400k")).toBe(false)
	})

	it("maps a restricted model to the matching 232k variant", () => {
		expect(get232kAxonFallback("axon-auto-400k")).toBe("axon-auto-232k")
		expect(get232kAxonFallback("axon-eido-3-flash-400k")).toBe("axon-eido-3-flash")
		expect(get232kAxonFallback("axon-eido-3.2-flash-400k")).toBe("axon-eido-3.2-flash")
		expect(get232kAxonFallback("axon-eido-3.2-400k")).toBe("axon-eido-3.2-232k")
		expect(get232kAxonFallback("axon-eido-3.2-code-pro-400k")).toBe("axon-eido-3.2-code-pro-232k")
	})

	it("maps a 232k model to the matching 400k variant", () => {
		expect(get400kAxonVariant("axon-auto-232k")).toBe("axon-auto-400k")
		expect(get400kAxonVariant("axon-eido-3-flash")).toBe("axon-eido-3-flash-400k")
		expect(get400kAxonVariant("axon-eido-3.2-flash")).toBe("axon-eido-3.2-flash-400k")
		expect(get400kAxonVariant("axon-eido-3.2-232k")).toBe("axon-eido-3.2-400k")
		expect(get400kAxonVariant("axon-eido-3.2-code-pro-232k")).toBe("axon-eido-3.2-code-pro-400k")
	})

	it.each(["Pro", "pro", "Pro Plus", "pro_plus", "pro-plus", "ULTRA"])("allows paid plans on %s", (plan) => {
		expect(canUsePaidPlan(plan)).toBe(true)
		expect(canUseEido3Pro(plan)).toBe(true)
	})

	it.each([undefined, "free", "Enterprise"])("rejects paid plans on %s", (plan) => {
		expect(canUsePaidPlan(plan)).toBe(false)
		expect(canUseEido3Pro(plan)).toBe(false)
	})

	it.each(["Pro Plus", "pro_plus", "pro-plus", "ULTRA"])("allows Lumen models on %s", (plan) => {
		expect(canUseLumenModels(plan)).toBe(true)
	})

	it.each([undefined, "free", "Pro", "Enterprise"])("rejects Lumen models on %s", (plan) => {
		expect(canUseLumenModels(plan)).toBe(false)
	})

	it("identifies Lumen Axon models", () => {
		expect(isLumenAxonModel("axon-lumen-4-code-232k")).toBe(true)
		expect(isLumenAxonModel("axon-lumen-4-code-400k")).toBe(true)
		expect(isLumenAxonModel("axon-eido-3.2-code-pro-232k")).toBe(false)
		expect(isLumenAxonModel("axon-eido-3.2-flash")).toBe(false)
	})

	it("identifies Eido 3 Pro models", () => {
		expect(isEido3ProModel("axon-eido-3-code-pro-232k")).toBe(true)
		expect(isEido3ProModel("axon-eido-3-code-pro-400k")).toBe(true)
		expect(isEido3ProModel("axon-eido-3.2-code-pro-232k")).toBe(true)
		expect(isEido3ProModel("axon-eido-3.2-code-pro-400k")).toBe(true)
		expect(isEido3ProModel("axon-eido-3.2-232k")).toBe(false)
		expect(isEido3ProModel("axon-eido-3-code-mini-400k")).toBe(false)
		expect(isEido3ProModel("axon-lumen-4-code-400k")).toBe(false)
	})

	it("identifies Eido 3.2 normal models", () => {
		expect(isEido32Model("axon-eido-3.2-232k")).toBe(true)
		expect(isEido32Model("axon-eido-3.2-400k")).toBe(true)
		expect(isEido32Model("axon-eido-3.2-flash")).toBe(false)
		expect(isEido32Model("axon-eido-3.2-flash-400k")).toBe(false)
		expect(isEido32Model("axon-eido-3.2-code-pro-232k")).toBe(false)
	})

	it("identifies Eido 3 Mini models", () => {
		expect(isEido3MiniModel("axon-eido-3-code-mini-232k")).toBe(true)
		expect(isEido3MiniModel("axon-eido-3-code-mini-400k")).toBe(true)
		expect(isEido3MiniModel("axon-eido-3.2-232k")).toBe(false)
	})

	it("identifies paid plan Axon models", () => {
		expect(isPaidPlanAxonModel("axon-eido-3.2-code-pro-232k")).toBe(true)
		expect(isPaidPlanAxonModel("axon-eido-3.2-code-pro-400k")).toBe(true)
		expect(isPaidPlanAxonModel("axon-eido-3.2-232k")).toBe(true)
		expect(isPaidPlanAxonModel("axon-eido-3.2-400k")).toBe(true)
		expect(isPaidPlanAxonModel("axon-eido-3-code-mini-232k")).toBe(true)
		expect(isPaidPlanAxonModel("axon-eido-3-code-mini-400k")).toBe(true)
		expect(isPaidPlanAxonModel("axon-auto-232k")).toBe(false)
		expect(isPaidPlanAxonModel("axon-eido-3.2-flash")).toBe(false)
	})

	it("identifies plan-restricted Axon models", () => {
		expect(isPlanRestrictedAxonModel("axon-auto-400k")).toBe(true)
		expect(isPlanRestrictedAxonModel("axon-auto-232k")).toBe(false)
		expect(isPlanRestrictedAxonModel("axon-lumen-4-code-232k")).toBe(true)
		expect(isPlanRestrictedAxonModel("axon-lumen-4-code-400k")).toBe(true)
		expect(isPlanRestrictedAxonModel("axon-eido-3.2-flash-400k")).toBe(true)
		expect(isPlanRestrictedAxonModel("axon-eido-3.2-400k")).toBe(true)
		expect(isPlanRestrictedAxonModel("axon-eido-3-code-mini-400k")).toBe(true)
		expect(isPlanRestrictedAxonModel("axon-eido-3.2-code-pro-400k")).toBe(true)
		expect(isPlanRestrictedAxonModel("axon-eido-3.2-code-pro-232k")).toBe(true)
		expect(isPlanRestrictedAxonModel("axon-eido-3.2-232k")).toBe(true)
		expect(isPlanRestrictedAxonModel("axon-eido-3-code-mini-232k")).toBe(true)
		expect(isPlanRestrictedAxonModel("axon-eido-3.2-flash")).toBe(false)
	})

	it("checks model access by plan", () => {
		// Auto 232k: all plans; Auto 400k: Pro Plus+ plans only
		expect(canAccessAxonModel("axon-auto-232k", "free")).toBe(true)
		expect(canAccessAxonModel("axon-auto-400k", "proplus")).toBe(true)
		expect(canAccessAxonModel("axon-auto-400k", "pro")).toBe(false)
		// Eido 3.2 Flash 232k: all plans; Flash 400k: Pro Plus+ plans only
		expect(canAccessAxonModel("axon-eido-3.2-flash", "free")).toBe(true)
		expect(canAccessAxonModel("axon-eido-3.2-flash-400k", "proplus")).toBe(true)
		expect(canAccessAxonModel("axon-eido-3.2-flash-400k", "pro")).toBe(false)
		// Eido 3.2 232k: Pro+ plans; 400k: Pro Plus+ plans only
		expect(canAccessAxonModel("axon-eido-3.2-232k", "free")).toBe(false)
		expect(canAccessAxonModel("axon-eido-3.2-232k", "pro")).toBe(true)
		expect(canAccessAxonModel("axon-eido-3.2-232k", "proplus")).toBe(true)
		expect(canAccessAxonModel("axon-eido-3.2-400k", "proplus")).toBe(true)
		expect(canAccessAxonModel("axon-eido-3.2-400k", "pro")).toBe(false)
		expect(canAccessAxonModel("axon-eido-3.2-400k", "free")).toBe(false)
		// Eido 3.2 Pro 232k: Pro+ plans
		expect(canAccessAxonModel("axon-eido-3.2-code-pro-232k", "pro")).toBe(true)
		expect(canAccessAxonModel("axon-eido-3.2-code-pro-232k", "proplus")).toBe(true)
		expect(canAccessAxonModel("axon-eido-3.2-code-pro-232k", "free")).toBe(false)
		// Eido 3.2 Pro 400k: Pro Plus+ plans only
		expect(canAccessAxonModel("axon-eido-3.2-code-pro-400k", "proplus")).toBe(true)
		expect(canAccessAxonModel("axon-eido-3.2-code-pro-400k", "pro")).toBe(false)
		expect(canAccessAxonModel("axon-eido-3.2-code-pro-400k", "free")).toBe(false)
		// Eido 3 Mini 232k: Pro+ plans
		expect(canAccessAxonModel("axon-eido-3-code-mini-232k", "free")).toBe(false)
		expect(canAccessAxonModel("axon-eido-3-code-mini-232k", "pro")).toBe(true)
		expect(canAccessAxonModel("axon-eido-3-code-mini-232k", "proplus")).toBe(true)
		// Eido 3 Mini 400k: Pro Plus+ plans only
		expect(canAccessAxonModel("axon-eido-3-code-mini-400k", "proplus")).toBe(true)
		expect(canAccessAxonModel("axon-eido-3-code-mini-400k", "pro")).toBe(false)
		expect(canAccessAxonModel("axon-eido-3-code-mini-400k", "free")).toBe(false)
		// Lumen: Pro Plus+ plans only
		expect(canAccessAxonModel("axon-lumen-4-code-232k", "proplus")).toBe(true)
		expect(canAccessAxonModel("axon-lumen-4-code-232k", "pro")).toBe(false)
		// Non-Axon models: always accessible
		expect(canAccessAxonModel("some-other-model", "free")).toBe(true)
	})

	it("falls back from restricted models to the closest accessible variant", () => {
		expect(getAxonPlanFallback("axon-auto-400k", "free")).toBe("axon-auto-232k")
		// Lumen on Pro plan -> Eido 3.2 Pro 232k
		expect(getAxonPlanFallback("axon-lumen-4-code-232k", "pro")).toBe("axon-eido-3.2-code-pro-232k")
		expect(getAxonPlanFallback("axon-lumen-4-code-400k", "pro")).toBe("axon-eido-3.2-code-pro-232k")
		// Lumen on free plan -> Axon Auto 232k
		expect(getAxonPlanFallback("axon-lumen-4-code-232k", "free")).toBe("axon-auto-232k")
		// Eido 3.2 Pro 400k on Pro plan -> Eido 3.2 Pro 232k
		expect(getAxonPlanFallback("axon-eido-3.2-code-pro-400k", "pro")).toBe("axon-eido-3.2-code-pro-232k")
		// Eido 3.2 Pro 400k on free plan -> Axon Auto 232k
		expect(getAxonPlanFallback("axon-eido-3.2-code-pro-400k", "free")).toBe("axon-auto-232k")
		// Eido 3.2 Pro 232k on free plan -> Axon Auto 232k
		expect(getAxonPlanFallback("axon-eido-3.2-code-pro-232k", "free")).toBe("axon-auto-232k")
		// Eido 3.2 Flash 400k on free plan -> Eido 3.2 Flash 232k
		expect(getAxonPlanFallback("axon-eido-3.2-flash-400k", "free")).toBe("axon-eido-3.2-flash")
		// Eido 3.2 400k on free plan -> Axon Auto 232k
		expect(getAxonPlanFallback("axon-eido-3.2-400k", "free")).toBe("axon-auto-232k")
		// Eido 3.2 400k on Pro plan -> Eido 3.2 232k
		expect(getAxonPlanFallback("axon-eido-3.2-400k", "pro")).toBe("axon-eido-3.2-232k")
		// Eido 3.2 232k on free plan -> Axon Auto 232k
		expect(getAxonPlanFallback("axon-eido-3.2-232k", "free")).toBe("axon-auto-232k")
		// Eido 3 Mini 400k on free plan -> Axon Auto 232k
		expect(getAxonPlanFallback("axon-eido-3-code-mini-400k", "free")).toBe("axon-auto-232k")
		// Eido 3 Mini 400k on Pro plan -> Eido 3 Mini 232k
		expect(getAxonPlanFallback("axon-eido-3-code-mini-400k", "pro")).toBe("axon-eido-3-code-mini-232k")
		// Eido 3 Mini 232k on free plan -> Axon Auto 232k
		expect(getAxonPlanFallback("axon-eido-3-code-mini-232k", "free")).toBe("axon-auto-232k")
	})
})
