import { describe, expect, it } from "vitest"
import { prettyModelName, removeAxonPrefix, formatSelectedModelLabel } from "../prettyModelName"

describe("prettyModelName", () => {
	it("should format simple model names", () => {
		expect(prettyModelName("axon-eido-3-flash")).toBe("Axon Eido 3 Flash")
		expect(prettyModelName("axon-code-2-pro")).toBe("Axon Code 2 Pro")
	})

	it("should return empty string for empty input", () => {
		expect(prettyModelName("")).toBe("")
	})
})

describe("removeAxonPrefix", () => {
	it("should remove Axon prefix from display labels", () => {
		expect(removeAxonPrefix("Axon Eido 3 Flash (200K context)")).toBe("Eido 3 Flash (200K context)")
		expect(removeAxonPrefix("Axon Code 2 Pro")).toBe("Code 2 Pro")
		expect(removeAxonPrefix("Axon Eido 3 Mini")).toBe("Eido 3 Mini")
	})

	it("should remove axon prefix from hyphenated or lowercased model ids", () => {
		expect(removeAxonPrefix("axon-eido-3-flash")).toBe("eido-3-flash")
		expect(removeAxonPrefix("AXON Eido 3")).toBe("Eido 3")
	})

	it("should preserve non-Axon model labels", () => {
		expect(removeAxonPrefix("Claude 3.5 Sonnet")).toBe("Claude 3.5 Sonnet")
		expect(removeAxonPrefix("Kimi K2.5 (Moonshotai)")).toBe("Kimi K2.5 (Moonshotai)")
	})

	it("should return empty string for empty input", () => {
		expect(removeAxonPrefix("")).toBe("")
	})
})

describe("formatSelectedModelLabel", () => {
	it("should remove Axon prefix and hide 200k context specifiers", () => {
		expect(formatSelectedModelLabel("Axon Eido 3 Flash (200K context)")).toBe("Eido 3 Flash")
		expect(formatSelectedModelLabel("Axon Eido 3 Mini (200k context)")).toBe("Eido 3 Mini")
		expect(formatSelectedModelLabel("Axon Eido 3 Code Mini 200k")).toBe("Eido 3 Code Mini")
	})

	it("should remove Axon prefix but keep 400k context specifiers", () => {
		expect(formatSelectedModelLabel("Axon Eido 3 Pro (400K context)", true)).toBe("Eido 3 Pro (400k context)")
		expect(formatSelectedModelLabel("Axon Lumen 4 (400k context)", true)).toBe("Lumen 4 (400k context)")
	})

	it("should handle model labels without context specifiers", () => {
		expect(formatSelectedModelLabel("Axon Code 2 Pro")).toBe("Code 2 Pro")
		expect(formatSelectedModelLabel("Claude 3.5 Sonnet")).toBe("Claude 3.5 Sonnet")
	})

	it("should return empty string for empty input", () => {
		expect(formatSelectedModelLabel("")).toBe("")
	})
})
