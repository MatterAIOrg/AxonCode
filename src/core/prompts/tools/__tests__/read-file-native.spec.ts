import { read_file } from "../native-tools/read_file"

describe("native read_file schema", () => {
	it("exposes batched, substantial file-region reads", () => {
		const parameters = read_file.function.parameters as any
		const files = parameters.properties.files
		const item = files.items

		expect(parameters.required).toEqual(["files"])
		expect(parameters.properties.file_path).toBeUndefined()
		expect(files.minItems).toBe(1)
		expect(files.maxItems).toBe(10)
		expect(item.required).toContain("file_path")
		expect(item.properties.limit.minimum).toBe(200)
		expect(item.properties.limit.maximum).toBe(1000)
	})
})
