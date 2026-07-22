import { getSharedToolUseSection } from "../tool-use"

describe("getSharedToolUseSection", () => {
	it("allows independent native JSON calls to be batched", () => {
		const section = getSharedToolUseSection("json")

		expect(section).toContain("include them in the same message")
		expect(section).not.toContain("exactly one tool per message")
	})

	it("keeps XML tool calls sequential", () => {
		const section = getSharedToolUseSection("xml")

		expect(section).toContain("exactly one tool per message")
		expect(section).toContain("Tool uses are formatted using XML-style tags")
	})
})
