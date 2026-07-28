import { canUse400kContext, get200kAxonFallback, is400kAxonModel } from "@roo-code/types"

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
		expect(is400kAxonModel("axon-lumos-4-code-400k")).toBe(true)
		expect(is400kAxonModel("axon-eido-3-code-mini-200k")).toBe(false)
		expect(is400kAxonModel("axon-lumos-4-code-200k")).toBe(false)
		expect(is400kAxonModel("third-party-model-400k")).toBe(false)
	})

	it("maps a restricted model to the matching 200k variant", () => {
		expect(get200kAxonFallback("axon-eido-3-code-mini-400k")).toBe("axon-eido-3-code-mini-200k")
	})
})
