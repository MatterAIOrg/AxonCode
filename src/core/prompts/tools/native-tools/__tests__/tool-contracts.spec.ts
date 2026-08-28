import { describe, expect, it } from "vitest"

import executeCommand from "../execute_command"
import { nativeTools } from ".."
import fileEdit from "../file_edit"
import multiFileEdit from "../multi_file_edit"
import searchFiles from "../search_files"

function parameters(tool: any) {
	return tool.function.parameters
}

describe("native tool contracts", () => {
	it("keeps search one-shot and free of model-facing cursors", () => {
		const schema = parameters(searchFiles)
		expect(schema.properties.cursor).toBeUndefined()
		expect(schema.required).not.toContain("cursor")
		expect(schema.required).toEqual(["path", "regex", "file_pattern", "max_results", "context_lines"])
	})

	it("makes edit replacement intent explicit for strict schemas", () => {
		expect(parameters(fileEdit).required).toContain("replace_all")
		expect(parameters(fileEdit).properties.replace_all.type).toEqual(["boolean", "null"])
		expect(parameters(multiFileEdit).items).toBeUndefined()
		expect(parameters(multiFileEdit).properties.edits.items.required).toContain("replace_all")
	})

	it("requires command safety metadata", () => {
		expect(parameters(executeCommand).required).toEqual(["command", "cwd", "message", "isDangerous"])
	})

	it("keeps strict schemas valid for optional arguments", () => {
		const visit = (schema: any, location: string) => {
			if (!schema || typeof schema !== "object") return

			if (schema.properties) {
				const required = new Set(schema.required ?? [])
				for (const property of Object.keys(schema.properties)) {
					expect(required.has(property), `${location}.${property} must be required`).toBe(true)
					visit(schema.properties[property], `${location}.${property}`)
				}
			}

			if (schema.items) visit(schema.items, `${location}[]`)
		}

		for (const tool of nativeTools) {
			if (tool.function.strict) visit(tool.function.parameters, tool.function.name)
		}
	})
})
