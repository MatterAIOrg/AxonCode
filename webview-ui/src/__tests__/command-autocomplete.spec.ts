import { getContextMenuOptions, ContextMenuOptionType } from "../utils/context-mentions"

describe("Command Autocomplete", () => {
	const mockQueryItems = [
		{ type: ContextMenuOptionType.File, value: "/src/app.ts" },
		{ type: ContextMenuOptionType.Folder, value: "/src" },
	]

	describe("context menu options", () => {
		it("should return the 3 main options for empty query", () => {
			const options = getContextMenuOptions("", null, mockQueryItems, [])

			// Should have 3 items: File, Folder, Image
			expect(options).toHaveLength(3)
			expect(options.map((o) => o.type)).toEqual([
				ContextMenuOptionType.Folder,
				ContextMenuOptionType.File,
				ContextMenuOptionType.Image,
			])
		})

		it("should filter by selected type when query is empty", () => {
			const options = getContextMenuOptions("", ContextMenuOptionType.File, mockQueryItems)
			expect(options).toHaveLength(1)
			expect(options[0].type).toBe(ContextMenuOptionType.File)
			expect(options[0].value).toBe("/src/app.ts")
		})

		it("should return NoResults when no matches found", () => {
			const options = getContextMenuOptions("nonexistent", null, mockQueryItems)
			expect(options).toHaveLength(1)
			expect(options[0].type).toBe(ContextMenuOptionType.NoResults)
		})

		it("should not show options for slash queries", () => {
			const options = getContextMenuOptions("/setup", null, mockQueryItems)
			expect(options).toHaveLength(1)
			expect(options[0].type).toBe(ContextMenuOptionType.NoResults)
		})
	})
})
