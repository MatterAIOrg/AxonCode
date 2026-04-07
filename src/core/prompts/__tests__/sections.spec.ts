import { addCustomInstructions } from "../sections/custom-instructions"
import { getCapabilitiesSection } from "../sections/capabilities"
import type { DiffStrategy, DiffResult, DiffItem } from "../../../shared/tools"

describe("addCustomInstructions", () => {
	it("adds vscode language to custom instructions", async () => {
		const result = await addCustomInstructions(
			"mode instructions",
			"global instructions",
			"/test/path",
			"test-mode",
			{ language: "fr" },
		)

		expect(result).toContain("Language Preference:")
		expect(result).toContain('You should always speak and think in the "Français" (fr) language')
	})

	it("works without vscode language", async () => {
		const result = await addCustomInstructions(
			"mode instructions",
			"global instructions",
			"/test/path",
			"test-mode",
		)

		expect(result).not.toContain("Language Preference:")
		expect(result).not.toContain("You should always speak and think in")
	})
})

describe("getCapabilitiesSection", () => {
	const cwd = "/test/path"
	const mcpHub = undefined
	const mockDiffStrategy: DiffStrategy = {
		getName: () => "MockStrategy",
		getToolDescription: () => "file_edit tool description",
		async applyDiff(_originalContent: string, _diffContents: string | DiffItem[]): Promise<DiffResult> {
			return { success: true, content: "mock result" }
		},
	}

	it("includes file_edit and file_write in capabilities", () => {
		const result = getCapabilitiesSection(cwd, false, mcpHub, mockDiffStrategy)

		expect(result).toContain("file_edit or file_write")
		expect(result).toContain("then use the file_edit or file_write tool")
	})

	it("includes file_edit and file_write even when diffStrategy is undefined", () => {
		const result = getCapabilitiesSection(cwd, false, mcpHub, undefined)

		expect(result).toContain("file_edit or file_write")
		expect(result).toContain("then use the file_edit or file_write tool")
	})
})
