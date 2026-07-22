import { encodeRegexForFffQuery } from ".."

describe("FFF regex query encoding", () => {
	it("preserves regex meaning without exposing constraint tokens", () => {
		expect(encodeRegexForFffQuery("search files/src/.*")).toBe("search\\x20files\\x2Fsrc\\x2F.*")
	})

	it("protects a leading exclamation mark from FFF negation parsing", () => {
		expect(encodeRegexForFffQuery("!important")).toBe("\\x21important")
	})

	it("preserves Rust regex backslash escapes", () => {
		expect(encodeRegexForFffQuery("\\bsearch_files\\b")).toBe("\\bsearch_files\\b")
	})
})
