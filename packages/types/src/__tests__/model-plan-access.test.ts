import { describe, expect, it } from "vitest"
import {
	canAccessAxonModel,
	canUse400kContext,
	canUseEido3Pro,
	canUseLumenModels,
	canUsePaidPlan,
	get232kAxonFallback,
	get400kAxonVariant,
	getAxonPlanFallback,
	is400kAxonModel,
	isEido3ProModel,
	isEido32Model,
	isEido3MiniModel,
	isLumenAxonModel,
	isPaidPlanAxonModel,
	isPlanRestrictedAxonModel,
} from "../model-plan-access.js"

describe("model-plan-access", () => {
	it("checks 400k plan context", () => {
		expect(canUse400kContext("proplus")).toBe(true)
		expect(canUse400kContext("ultra")).toBe(true)
		expect(canUse400kContext("pro")).toBe(false)
		expect(canUse400kContext("free")).toBe(false)
		expect(canUse400kContext(undefined)).toBe(false)
	})

	it("checks Lumen model plan access (Pro Plus and Ultra only)", () => {
		expect(canUseLumenModels("proplus")).toBe(true)
		expect(canUseLumenModels("ultra")).toBe(true)
		expect(canUseLumenModels("pro")).toBe(false)
		expect(canUseLumenModels("free")).toBe(false)
		expect(canUseLumenModels(undefined)).toBe(false)
	})

	it("checks paid plans", () => {
		expect(canUsePaidPlan("pro")).toBe(true)
		expect(canUsePaidPlan("proplus")).toBe(true)
		expect(canUsePaidPlan("ultra")).toBe(true)
		expect(canUsePaidPlan("free")).toBe(false)
		expect(canUsePaidPlan(undefined)).toBe(false)
		expect(canUseEido3Pro("pro")).toBe(true)
	})

	it("identifies model categories", () => {
		expect(is400kAxonModel("axon-auto-400k")).toBe(true)
		expect(is400kAxonModel("axon-auto-232k")).toBe(false)

		expect(isLumenAxonModel("axon-lumen-4-code-232k")).toBe(true)
		expect(isLumenAxonModel("axon-lumen-4-code-400k")).toBe(true)
		expect(isLumenAxonModel("axon-eido-3.2-code-pro-232k")).toBe(false)

		expect(isEido3ProModel("axon-eido-3.2-code-pro-232k")).toBe(true)
		expect(isEido3ProModel("axon-eido-3.2-232k")).toBe(false)

		expect(isEido32Model("axon-eido-3.2-232k")).toBe(true)
		expect(isEido32Model("axon-eido-3.2-400k")).toBe(true)
		expect(isEido32Model("axon-eido-3.2-flash")).toBe(false)

		expect(isEido3MiniModel("axon-eido-3-code-mini-232k")).toBe(true)
		expect(isEido3MiniModel("axon-eido-3-code-mini-400k")).toBe(true)

		expect(isPaidPlanAxonModel("axon-eido-3-code-mini-232k")).toBe(true)
		expect(isPaidPlanAxonModel("axon-eido-3.2-232k")).toBe(true)
		expect(isPaidPlanAxonModel("axon-eido-3.2-code-pro-232k")).toBe(true)
		expect(isPaidPlanAxonModel("axon-auto-232k")).toBe(false)
		expect(isPaidPlanAxonModel("axon-eido-3.2-flash")).toBe(false)

		expect(isPlanRestrictedAxonModel("axon-lumen-4-code-232k")).toBe(true)
		expect(isPlanRestrictedAxonModel("axon-lumen-4-code-400k")).toBe(true)
		expect(isPlanRestrictedAxonModel("axon-eido-3-code-mini-232k")).toBe(true)
		expect(isPlanRestrictedAxonModel("axon-eido-3.2-232k")).toBe(true)
		expect(isPlanRestrictedAxonModel("axon-auto-232k")).toBe(false)
		expect(isPlanRestrictedAxonModel("axon-eido-3.2-flash")).toBe(false)
	})

	it("checks access for free vs paid plans", () => {
		// Free plan access
		expect(canAccessAxonModel("axon-auto-232k", "free")).toBe(true)
		expect(canAccessAxonModel("axon-eido-3.2-flash", "free")).toBe(true)
		expect(canAccessAxonModel("axon-eido-3-code-mini-232k", "free")).toBe(false)
		expect(canAccessAxonModel("axon-eido-3.2-232k", "free")).toBe(false)
		expect(canAccessAxonModel("axon-eido-3.2-code-pro-232k", "free")).toBe(false)
		expect(canAccessAxonModel("axon-lumen-4-code-232k", "free")).toBe(false)

		// Pro plan access
		expect(canAccessAxonModel("axon-eido-3-code-mini-232k", "pro")).toBe(true)
		expect(canAccessAxonModel("axon-eido-3.2-232k", "pro")).toBe(true)
		expect(canAccessAxonModel("axon-eido-3.2-code-pro-232k", "pro")).toBe(true)
		expect(canAccessAxonModel("axon-eido-3.2-400k", "pro")).toBe(false)
		expect(canAccessAxonModel("axon-lumen-4-code-232k", "pro")).toBe(false)

		// Pro Plus access
		expect(canAccessAxonModel("axon-eido-3.2-400k", "proplus")).toBe(true)
		expect(canAccessAxonModel("axon-lumen-4-code-232k", "proplus")).toBe(true)
		expect(canAccessAxonModel("axon-lumen-4-code-400k", "proplus")).toBe(true)
	})

	it("falls back correctly for free users", () => {
		expect(get232kAxonFallback("axon-auto-400k")).toBe("axon-auto-232k")
		expect(get232kAxonFallback("axon-eido-3.2-flash-400k")).toBe("axon-eido-3.2-flash")
		expect(get232kAxonFallback("axon-eido-3.2-400k")).toBe("axon-eido-3.2-232k")
		expect(get400kAxonVariant("axon-auto-232k")).toBe("axon-auto-400k")
		expect(get400kAxonVariant("axon-eido-3.2-flash")).toBe("axon-eido-3.2-flash-400k")
		expect(get400kAxonVariant("axon-eido-3.2-232k")).toBe("axon-eido-3.2-400k")
		expect(getAxonPlanFallback("axon-eido-3-code-mini-232k", "free")).toBe("axon-auto-232k")
		expect(getAxonPlanFallback("axon-eido-3.2-232k", "free")).toBe("axon-auto-232k")
		expect(getAxonPlanFallback("axon-eido-3.2-code-pro-232k", "free")).toBe("axon-auto-232k")
		expect(getAxonPlanFallback("axon-eido-3.2-flash-400k", "free")).toBe("axon-eido-3.2-flash")
		expect(getAxonPlanFallback("axon-lumen-4-code-232k", "pro")).toBe("axon-eido-3.2-code-pro-232k")
		expect(getAxonPlanFallback("axon-lumen-4-code-232k", "free")).toBe("axon-auto-232k")
	})
})
