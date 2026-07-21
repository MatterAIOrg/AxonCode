import { computeDifferenceLineNumbers, findAdjacentChangeLine } from "../fileEditReviewNavigation"

describe("file edit review navigation", () => {
	it("finds separate hunks within a single edit", () => {
		const originalContent = ["one", "two", "three", "four"].join("\n")
		const newContent = ["one", "first addition", "two", "three", "second addition", "four"].join("\n")

		expect(computeDifferenceLineNumbers(originalContent, newContent)).toEqual([1, 4])
	})

	it("groups adjacent changed lines into one destination", () => {
		const originalContent = ["one", "two", "three", "four"].join("\n")
		const newContent = ["one", "replacement two", "replacement three", "four"].join("\n")

		expect(computeDifferenceLineNumbers(originalContent, newContent)).toEqual([1])
	})

	it("moves in either direction and wraps", () => {
		const lines = [1, 4]

		expect({
			next: findAdjacentChangeLine(lines, 1, 1),
			nextWrapped: findAdjacentChangeLine(lines, 4, 1),
			previous: findAdjacentChangeLine(lines, 4, -1),
			previousWrapped: findAdjacentChangeLine(lines, 1, -1),
		}).toEqual({
			next: 4,
			nextWrapped: 1,
			previous: 1,
			previousWrapped: 4,
		})
	})
})
