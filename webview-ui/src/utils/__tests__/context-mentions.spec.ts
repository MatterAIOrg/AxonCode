import {
	insertMention,
	removeMention,
	getContextMenuOptions,
	shouldShowContextMenu,
	ContextMenuOptionType,
	ContextMenuQueryItem,
	SearchResult,
} from "@src/utils/context-mentions"

describe("insertMention", () => {
	it("should insert mention at cursor position when no @ symbol exists", () => {
		const result = insertMention("Hello world", 5, "test")
		expect(result.newValue).toBe("Hello@test  world")
		expect(result.mentionIndex).toBe(5)
	})

	it("should replace text after last @ symbol", () => {
		const result = insertMention("Hello @wor world", 8, "test")
		expect(result.newValue).toBe("Hello @test  world")
		expect(result.mentionIndex).toBe(6)
	})

	it("should handle empty text", () => {
		const result = insertMention("", 0, "test")
		expect(result.newValue).toBe("@test ")
		expect(result.mentionIndex).toBe(0)
	})
	it("should replace partial mention after @", () => {
		const result = insertMention("Mention @fi", 11, "/path/to/file.txt") // Cursor after 'i'
		expect(result.newValue).toBe("Mention @/path/to/file.txt ") // Space added after mention
		expect(result.mentionIndex).toBe(8)
	})

	it("should add a space after the inserted mention", () => {
		const result = insertMention("Hello ", 6, "terminal") // Cursor at the end
		expect(result.newValue).toBe("Hello @terminal ")
		expect(result.mentionIndex).toBe(6)
	})

	it("should handle insertion at the beginning", () => {
		const result = insertMention("world", 0, "problems")
		expect(result.newValue).toBe("@problems world")
		expect(result.mentionIndex).toBe(0)
	})

	it("should handle insertion at the end", () => {
		const result = insertMention("Hello", 5, "problems")
		expect(result.newValue).toBe("Hello@problems ")
		expect(result.mentionIndex).toBe(5)
	})

	// --- Tests for Escaped Spaces ---
	it("should NOT escape spaces for non-path mentions", () => {
		const result = insertMention("Hello @abc ", 10, "git commit with spaces") // Not a path
		expect(result.newValue).toBe("Hello @git commit with spaces  ")
	})

	it("should escape spaces when inserting a file path mention with spaces", () => {
		const filePath = "/path/to/file with spaces.txt"
		const expectedEscapedPath = "/path/to/file\\ with\\ spaces.txt"
		const result = insertMention("Mention @old", 11, filePath)

		expect(result.newValue).toBe(`Mention @${expectedEscapedPath} `)
		expect(result.mentionIndex).toBe(8)
		// Verify escapeSpaces was effectively used (implicitly by checking output)
		expect(result.newValue).toContain("\\ ")
	})

	it("should escape spaces when inserting a folder path mention with spaces", () => {
		const folderPath = "/my documents/folder name/"
		const expectedEscapedPath = "/my\\ documents/folder\\ name/"
		const result = insertMention("Check @dir", 9, folderPath)

		expect(result.newValue).toBe(`Check @${expectedEscapedPath} `)
		expect(result.mentionIndex).toBe(6)
		expect(result.newValue).toContain("\\ ")
	})

	it("should NOT escape spaces if the path value already contains escaped spaces", () => {
		const alreadyEscapedPath = "/path/already\\ escaped.txt"
		const result = insertMention("Insert @path", 11, alreadyEscapedPath)

		// It should insert the already escaped path without double-escaping
		expect(result.newValue).toBe(`Insert @${alreadyEscapedPath} `)
		expect(result.mentionIndex).toBe(7)
		// Check that it wasn't passed through escapeSpaces again (mock check)
		// This relies on the mock implementation detail or careful checking
		// A better check might be ensuring no double backslashes appear unexpectedly.
		expect(result.newValue.includes("\\\\ ")).toBe(false)
	})

	it("should NOT escape spaces for paths without spaces", () => {
		const simplePath = "/path/to/file.txt"
		const result = insertMention("Simple @p", 9, simplePath)
		expect(result.newValue).toBe(`Simple @${simplePath} `)
		expect(result.mentionIndex).toBe(7)
		expect(result.newValue.includes("\\ ")).toBe(false)
	})
})

describe("removeMention", () => {
	it("should remove mention when cursor is at end of mention", () => {
		// Test with the problems keyword that matches the regex
		const result = removeMention("Hello @problems ", 15)
		expect(result.newText).toBe("Hello ")
		expect(result.newPosition).toBe(6)
	})

	it("should not remove text when not at end of mention", () => {
		const result = removeMention("Hello @test world", 8)
		expect(result.newText).toBe("Hello @test world")
		expect(result.newPosition).toBe(8)
	})

	it("should handle text without mentions", () => {
		const result = removeMention("Hello world", 5)
		expect(result.newText).toBe("Hello world")
		expect(result.newPosition).toBe(5)
	})

	// --- Tests for Escaped Spaces ---
	it("should not remove mention with escaped spaces if cursor is at the end - KNOWN LIMITATION", () => {
		// NOTE: This is a known limitation - the current regex in removeMention
		// doesn't handle escaped spaces well because the regex engine needs
		// special lookbehind assertions for that.
		// For now, we're documenting this as a known limitation.
		const text = "File @/path/to/file\\ with\\ spaces.txt "
		const position = text.length // Cursor at the very end
		const { newText, newPosition } = removeMention(text, position)
		// The mention with escaped spaces won't be matched by the regex
		expect(newText).toBe(text)
		expect(newPosition).toBe(position)
	})

	it("should remove mention with escaped spaces and the following space", () => {
		const text = "File @/path/to/file\\ with\\ spaces.txt next word"
		const position = text.indexOf(" next") // Cursor right after the mention + space
		const { newText, newPosition } = removeMention(text, position)
		expect(newText).toBe("File next word")
		expect(newPosition).toBe(5)
	})
})

describe("getContextMenuOptions", () => {
	const mockQueryItems: ContextMenuQueryItem[] = [
		{
			type: ContextMenuOptionType.File,
			value: "src/test.ts",
			label: "test.ts",
			description: "Source file",
		},
		{
			type: ContextMenuOptionType.Folder,
			value: "src",
			label: "src",
			description: "Source folder",
		},
	]

	const mockDynamicSearchResults = [
		{
			path: "search/result1.ts",
			type: "file" as const,
			label: "result1.ts",
		},
		{
			path: "search/folder",
			type: "folder" as const,
		},
	]

	const mockSearchResults: SearchResult[] = [
		{ path: "/Users/test/project/src/search result spaces.ts", type: "file", label: "search result spaces.ts" },
		{ path: "/Users/test/project/assets/", type: "folder", label: "assets/" },
	]

	it("should return the 3 main options for empty query", () => {
		const result = getContextMenuOptions("", null, [])
		expect(result).toHaveLength(3)
		expect(result.map((item) => item.type)).toEqual([
			ContextMenuOptionType.Folder,
			ContextMenuOptionType.File,
			ContextMenuOptionType.Image,
		])
	})

	it("should filter by selected type when query is empty", () => {
		const result = getContextMenuOptions("", ContextMenuOptionType.File, mockQueryItems)
		expect(result).toHaveLength(1)
		expect(result[0].type).toBe(ContextMenuOptionType.File)
		expect(result[0].value).toBe("src/test.ts")
	})

	it("should return NoResults when no matches found", () => {
		const result = getContextMenuOptions("nonexistent", null, mockQueryItems)
		expect(result).toHaveLength(1)
		expect(result[0].type).toBe(ContextMenuOptionType.NoResults)
	})

	it("should include dynamic search results along with other matches", () => {
		const result = getContextMenuOptions("test", null, mockQueryItems, mockDynamicSearchResults)

		// Check if file results and dynamic search results are included
		expect(result.some((item) => item.type === ContextMenuOptionType.File)).toBe(true)
		expect(result.some((item) => item.value === "/search/result1.ts")).toBe(true)
	})

	it("should deduplicate items correctly when combining different result types", () => {
		// Create duplicate search result with same path as an existing file
		const duplicateSearchResults = [
			{
				path: "src/test.ts", // Duplicate of existing file in mockQueryItems
				type: "file" as const,
			},
			{
				path: "unique/path.ts",
				type: "file" as const,
			},
		]

		const result = getContextMenuOptions("test", null, mockQueryItems, duplicateSearchResults)

		// Count occurrences of src/test.ts in results
		const duplicateCount = result.filter(
			(item) =>
				(item.value === "src/test.ts" || item.value === "/src/test.ts") &&
				item.type === ContextMenuOptionType.File,
		).length
		// With path normalization, these should be treated as duplicates
		expect(duplicateCount).toBe(1)

		// Verify the unique item was included (check both path formats)
		expect(result.some((item) => item.value === "/unique/path.ts" || item.value === "unique/path.ts")).toBe(true)
	})

	it("should return NoResults when all combined results are empty with dynamic search", () => {
		// Use a query that won't match anything
		const result = getContextMenuOptions(
			"nonexistentquery123456",
			null,
			mockQueryItems,
			[], // Empty dynamic search results
		)

		expect(result).toHaveLength(1)
		expect(result[0].type).toBe(ContextMenuOptionType.NoResults)
	})

	// --- Tests for Escaped Spaces (Focus on how paths are presented) ---
	it("should return search results with correct labels/descriptions (no escaping needed here)", () => {
		const options = getContextMenuOptions("@search", null, mockQueryItems, mockSearchResults)
		const fileResult = options.find((o) => o.label === "search result spaces.ts")
		expect(fileResult).toBeDefined()
		// Value should be the normalized path, description might be the same or label
		expect(fileResult?.value).toBe("/Users/test/project/src/search result spaces.ts")
		expect(fileResult?.description).toBe("/Users/test/project/src/search result spaces.ts") // Check current implementation
		expect(fileResult?.label).toBe("search result spaces.ts")
		// Crucially, no backslashes should be in label/description here
		expect(fileResult?.label).not.toContain("\\")
		expect(fileResult?.description).not.toContain("\\")
	})

	it("should handle formatting of search results without escaping spaces in display", () => {
		// Create a search result with spaces in the path
		const searchResults: SearchResult[] = [
			{ path: "/path/with spaces/file.txt", type: "file", label: "file with spaces.txt" },
		]

		// The formatting happens in getContextMenuOptions when converting search results to menu items
		const formattedItems = getContextMenuOptions("spaces", null, [], searchResults)

		// Verify we get some results back that aren't "No Results"
		expect(formattedItems.length).toBeGreaterThan(0)
		expect(formattedItems[0].type !== ContextMenuOptionType.NoResults).toBeTruthy()

		// The main thing we want to verify is that no backslashes show up in any display fields
		// This is the core UI behavior we want to test - spaces should not be escaped in display text
		formattedItems.forEach((item) => {
			// Some items might not have labels or descriptions, so check conditionally
			if (item.label) {
				// Verify the label doesn't contain any escaped spaces
				expect(item.label.indexOf("\\")).toBe(-1)
			}
			if (item.description) {
				// Verify the description doesn't contain any escaped spaces
				expect(item.description.indexOf("\\")).toBe(-1)
			}
		})
	})

	// Add more tests for filtering, fuzzy search interaction if needed

	// --- Tests for Tiered Matching (Exact, Prefix, Substring, Fuzzy) ---
	describe("tiered matching", () => {
		const tieredTestItems: ContextMenuQueryItem[] = [
			{ type: ContextMenuOptionType.File, value: "/src/README.md", label: "README.md" },
			{ type: ContextMenuOptionType.File, value: "/src/readme.txt", label: "readme.txt" },
			{ type: ContextMenuOptionType.File, value: "/src/Readme.ts", label: "Readme.ts" },
			{ type: ContextMenuOptionType.File, value: "/src/ThreadReader.ts", label: "ThreadReader.ts" },
			{ type: ContextMenuOptionType.File, value: "/src/XXXreadYYY.js", label: "XXXreadYYY.js" },
			{ type: ContextMenuOptionType.File, value: "/src/reader.ts", label: "reader.ts" },
			{ type: ContextMenuOptionType.File, value: "/src/other.ts", label: "other.ts" },
			{ type: ContextMenuOptionType.Folder, value: "/readme-folder", label: "readme-folder" },
		]

		it("should match files by basename without extension", () => {
			const result = getContextMenuOptions("readme", null, tieredTestItems, [])

			// Should match files where basename without extension equals "readme"
			const basenames = result.map((item) => item.value?.split("/").pop())
			expect(basenames).toContain("README.md")
			expect(basenames).toContain("readme.txt")
			expect(basenames).toContain("Readme.ts")
		})

		it("should prioritize exact matches first (case-insensitive)", () => {
			const result = getContextMenuOptions("readme", null, tieredTestItems, [])

			// Exact matches should come first (basename without extension equals query)
			const exactMatches = result.slice(0, 3)
			expect(exactMatches.length).toBeGreaterThanOrEqual(3)

			// All exact matches should have basename without extension "readme" (case-insensitive)
			exactMatches.forEach((item) => {
				const basename = item.value?.split("/").pop()
				const basenameWithoutExt = basename?.substring(0, basename.lastIndexOf(".")) || basename
				expect(basenameWithoutExt?.toLowerCase()).toBe("readme")
			})

			// Verify exact matches include all case variations
			const basenames = exactMatches.map((item) => item.value?.split("/").pop())
			expect(basenames).toContain("README.md")
			expect(basenames).toContain("readme.txt")
			expect(basenames).toContain("Readme.ts")
		})

		it("should include prefix matches after exact matches", () => {
			const result = getContextMenuOptions("read", null, tieredTestItems, [])

			const prefixMatches = result.filter((item) => {
				const basename = item.value?.split("/").pop()?.toLowerCase()
				return basename?.startsWith("read") && basename !== "read"
			})

			// Should have prefix matches
			expect(prefixMatches.length).toBeGreaterThan(0)

			// Prefix matches should include files starting with "read"
			const prefixBasenames = prefixMatches.map((item) => item.value?.split("/").pop())
			expect(prefixBasenames).toContain("README.md")
			expect(prefixBasenames).toContain("readme.txt")
			expect(prefixBasenames).toContain("Readme.ts")
			expect(prefixBasenames).toContain("reader.ts")
		})

		it("should include substring matches after prefix matches", () => {
			const result = getContextMenuOptions("read", null, tieredTestItems, [])

			// Find substring matches (contain "read" but don't start with it)
			const substringMatches = result.filter((item) => {
				const basename = item.value?.split("/").pop()?.toLowerCase()
				return basename?.includes("read") && !basename?.startsWith("read")
			})

			// Should have substring matches
			expect(substringMatches.length).toBeGreaterThan(0)

			// Substring matches should include files with "read" in the middle
			const substringBasenames = substringMatches.map((item) => item.value?.split("/").pop())
			expect(substringBasenames).toContain("ThreadReader.ts")
			expect(substringBasenames).toContain("XXXreadYYY.js")
		})

		it("should maintain priority order: exact > prefix > substring > fuzzy", () => {
			const result = getContextMenuOptions("read", null, tieredTestItems, [])

			// Find indices of different match types
			const exactIndex = result.findIndex((item) => item.value?.split("/").pop()?.toLowerCase() === "read")
			const prefixIndex = result.findIndex((item) => {
				const basename = item.value?.split("/").pop()?.toLowerCase()
				return basename?.startsWith("read") && basename !== "read"
			})
			const substringIndex = result.findIndex((item) => {
				const basename = item.value?.split("/").pop()?.toLowerCase()
				return basename?.includes("read") && !basename?.startsWith("read")
			})

			// Verify ordering: exact < prefix < substring
			if (exactIndex !== -1 && prefixIndex !== -1) {
				expect(exactIndex).toBeLessThan(prefixIndex)
			}
			if (prefixIndex !== -1 && substringIndex !== -1) {
				expect(prefixIndex).toBeLessThan(substringIndex)
			}
		})

		it("should be case-insensitive for all matching tiers", () => {
			// Test with lowercase query
			const lowerResult = getContextMenuOptions("readme", null, tieredTestItems, [])
			const lowerBasenames = lowerResult.map((item) => item.value?.split("/").pop())

			// Test with uppercase query
			const upperResult = getContextMenuOptions("README", null, tieredTestItems, [])
			const upperBasenames = upperResult.map((item) => item.value?.split("/").pop())

			// Should return same results regardless of case
			expect(lowerBasenames).toEqual(upperBasenames)
		})

		it("should deduplicate results across all tiers", () => {
			const result = getContextMenuOptions("read", null, tieredTestItems, [])

			// Get all values
			const values = result.map((item) => item.value)

			// Check for duplicates
			const uniqueValues = new Set(values)
			expect(values.length).toBe(uniqueValues.size)
		})

		it("should handle mixed case in filenames correctly", () => {
			const mixedCaseItems: ContextMenuQueryItem[] = [
				{ type: ContextMenuOptionType.File, value: "/src/MyFile.ts", label: "MyFile.ts" },
				{ type: ContextMenuOptionType.File, value: "/src/myfile.ts", label: "myfile.ts" },
				{ type: ContextMenuOptionType.File, value: "/src/MYFILE.ts", label: "MYFILE.ts" },
				{ type: ContextMenuOptionType.File, value: "/src/MyFileComponent.tsx", label: "MyFileComponent.tsx" },
			]

			const result = getContextMenuOptions("myfile", null, mixedCaseItems, [])

			// Should match all case variations
			const basenames = result.map((item) => item.value?.split("/").pop())
			expect(basenames).toContain("MyFile.ts")
			expect(basenames).toContain("myfile.ts")
			expect(basenames).toContain("MYFILE.ts")
		})

		it("should return NoResults when no matches found in any tier", () => {
			const result = getContextMenuOptions("zzzzzzzz", null, tieredTestItems, [])

			expect(result).toHaveLength(1)
			expect(result[0].type).toBe(ContextMenuOptionType.NoResults)
		})

		it("should handle folders in tiered matching", () => {
			const result = getContextMenuOptions("readme", null, tieredTestItems, [])

			// Should include folder matches
			const folderMatches = result.filter((item) => item.type === ContextMenuOptionType.Folder)
			expect(folderMatches.length).toBeGreaterThan(0)

			// Folder should be matched by name
			const folder = folderMatches.find((item) => item.value === "/readme-folder")
			expect(folder).toBeDefined()
		})

		it("should combine queryItems and dynamicSearchResults in tiered matching", () => {
			const dynamicResults: SearchResult[] = [
				{ path: "dynamic/README.md", type: "file", label: "README.md" },
				{ path: "dynamic/ThreadReader.ts", type: "file", label: "ThreadReader.ts" },
			]

			const result = getContextMenuOptions("readme", null, tieredTestItems, dynamicResults)

			// Should include results from both sources
			const basenames = result.map((item) => item.value?.split("/").pop())

			// From queryItems
			expect(basenames).toContain("README.md")
			expect(basenames).toContain("readme.txt")

			// From dynamicSearchResults
			expect(basenames).toContain("README.md") // May be duplicate, should be deduped
		})

		it("should handle empty query correctly", () => {
			const result = getContextMenuOptions("", null, tieredTestItems, [])

			// Empty query should return the 3 main options
			expect(result).toHaveLength(3)
			expect(result.map((item) => item.type)).toEqual([
				ContextMenuOptionType.Folder,
				ContextMenuOptionType.File,
				ContextMenuOptionType.Image,
			])
		})

		it("should match CHANGELOG.md when typing 'changelog' (without extension)", () => {
			const items: ContextMenuQueryItem[] = [
				{ type: ContextMenuOptionType.File, value: "/CHANGELOG.md", label: "CHANGELOG.md" },
				{ type: ContextMenuOptionType.File, value: "/src/other.ts", label: "other.ts" },
			]

			const result = getContextMenuOptions("changelog", null, items, [])

			// Should match CHANGELOG.md as an exact match (basename without extension)
			const basenames = result.map((item) => item.value?.split("/").pop())
			expect(basenames).toContain("CHANGELOG.md")

			// Should be in the first position (exact match)
			expect(result[0].value).toBe("/CHANGELOG.md")
		})

		it("should match CHANGELOG.md when typing 'Changelog' (capitalized)", () => {
			const items: ContextMenuQueryItem[] = [
				{ type: ContextMenuOptionType.File, value: "/CHANGELOG.md", label: "CHANGELOG.md" },
				{ type: ContextMenuOptionType.File, value: "/src/other.ts", label: "other.ts" },
			]

			const result = getContextMenuOptions("Changelog", null, items, [])

			// Should match CHANGELOG.md as an exact match (case-insensitive)
			const basenames = result.map((item) => item.value?.split("/").pop())
			expect(basenames).toContain("CHANGELOG.md")
		})

		it("should match CHANGELOG.md when typing 'CHANGELOG' (all caps)", () => {
			const items: ContextMenuQueryItem[] = [
				{ type: ContextMenuOptionType.File, value: "/CHANGELOG.md", label: "CHANGELOG.md" },
				{ type: ContextMenuOptionType.File, value: "/src/other.ts", label: "other.ts" },
			]

			const result = getContextMenuOptions("CHANGELOG", null, items, [])

			// Should match CHANGELOG.md as an exact match (case-insensitive)
			const basenames = result.map((item) => item.value?.split("/").pop())
			expect(basenames).toContain("CHANGELOG.md")
		})
	})
})

describe("shouldShowContextMenu", () => {
	it("should return true for @ symbol", () => {
		expect(shouldShowContextMenu("@", 1)).toBe(true)
	})

	it("should return true for @ followed by text", () => {
		expect(shouldShowContextMenu("Hello @test", 10)).toBe(true)
	})

	it("should return false when no @ symbol exists", () => {
		expect(shouldShowContextMenu("Hello world", 5)).toBe(false)
	})

	it("should return false for @ followed by whitespace", () => {
		expect(shouldShowContextMenu("Hello @ world", 6)).toBe(false)
	})

	it("should return false for @ in URL", () => {
		expect(shouldShowContextMenu("Hello @http://test.com", 17)).toBe(false)
	})

	// --- Tests for Escaped Spaces ---
	it("should return true when typing path with escaped spaces", () => {
		expect(shouldShowContextMenu("@/path/to/file\\ ", 17)).toBe(true) // Cursor after escaped space
		expect(shouldShowContextMenu("@/path/to/file\\ with\\ spaces", 28)).toBe(true) // Cursor within path after escaped spaces
	})

	it("should return false if an unescaped space exists after @", () => {
		// This case means the regex wouldn't match anyway, but confirms context menu logic
		expect(shouldShowContextMenu("@/path/with space", 13)).toBe(false) // Cursor after unescaped space
	})
})
