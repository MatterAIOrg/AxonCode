// npx vitest src/core/sliding-window/__tests__/contextBreakdown.spec.ts
import { describe, expect, it } from "vitest"

import { buildContextBreakdown, emptyContextBreakdown, rebuildContextBreakdown } from "../contextBreakdown"

describe("contextBreakdown", () => {
	describe("buildContextBreakdown", () => {
		it("returns zeros for an empty category set", () => {
			const result = buildContextBreakdown({ categoryText: {}, currentTokens: 0 })
			expect(result).toEqual(emptyContextBreakdown())
		})

		it("treats undefined category text as empty strings", () => {
			const result = buildContextBreakdown({
				categoryText: { rules: undefined, skills: undefined },
				currentTokens: 0,
			})
			expect(result.rules).toBe(0)
			expect(result.skills).toBe(0)
			expect(result.conversation).toBe(0)
		})

		it("computes the conversation slice as the residual clamped to 0", () => {
			const result = buildContextBreakdown({
				categoryText: {
					systemPrompt: "x".repeat(100),
				},
				currentTokens: 200,
			})

			expect(result.systemPrompt).toBeGreaterThan(0)
			expect(result.conversation).toBe(200 - result.systemPrompt)
			expect(result.systemPrompt + result.conversation).toBe(200)
		})

		it("clamps the conversation slice to 0 when currentTokens is smaller than the static total", () => {
			const result = buildContextBreakdown({
				categoryText: {
					systemPrompt: "x".repeat(4000),
					toolDefinitions: "y".repeat(4000),
				},
				currentTokens: 10,
			})
			expect(result.conversation).toBe(0)
		})

		it("subtracts cacheReads from the total before computing the conversation slice", () => {
			const result = buildContextBreakdown({
				categoryText: { systemPrompt: "x".repeat(100) },
				currentTokens: 500,
				cacheReads: 150,
			})
			expect(result.cacheReads).toBe(150)
			expect(result.conversation).toBe(500 - result.systemPrompt - 150)
		})

		it("defaults cacheReads to 0 when not provided", () => {
			const result = buildContextBreakdown({
				categoryText: { systemPrompt: "x".repeat(100) },
				currentTokens: 500,
			})
			expect(result.cacheReads).toBe(0)
			expect(result.conversation).toBe(500 - result.systemPrompt)
		})
	})

	describe("rebuildContextBreakdown", () => {
		it("keeps the conversation slice consistent with the new static total", () => {
			const previous = emptyContextBreakdown()
			const next = rebuildContextBreakdown(
				previous,
				{ systemPrompt: "hello world", toolDefinitions: "execute_command, read_file" },
				500,
			)
			expect(next.systemPrompt).toBeGreaterThan(0)
			expect(next.toolDefinitions).toBeGreaterThan(0)
			expect(next.conversation).toBeGreaterThan(0)
		})
	})

	describe("emptyContextBreakdown", () => {
		it("returns a fresh zero-filled breakdown each call", () => {
			const a = emptyContextBreakdown()
			const b = emptyContextBreakdown()
			expect(a).toEqual(b)
			a.systemPrompt = 99
			expect(b.systemPrompt).toBe(0)
		})
	})
})
