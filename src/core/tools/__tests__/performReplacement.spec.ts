import { describe, expect, it } from "vitest"

import { performReplacement } from "../fileEditTool"

// npx vitest src/core/tools/__tests__/performReplacement.spec.ts

describe("performReplacement — escape safety", () => {
	it("applies an exact match verbatim (real newlines preserved)", () => {
		const content = "line one\nline two\nline three\n"
		const res = performReplacement(content, "line one\nline two", "LINE ONE\nLINE TWO", false)
		expect(res.replacements).toBe(1)
		expect(res.content).toBe("LINE ONE\nLINE TWO\nline three\n")
		expect(res.content.includes("\\n")).toBe(false)
	})

	it("matches a file that genuinely contains a literal backslash-n via exact match", () => {
		// File literally contains the two chars `\` `n` inside a string literal.
		const content = 'const s = "a\\nb"\n'
		// old_string also contains the literal `\` `n` — exact match must succeed.
		const res = performReplacement(content, 'const s = "a\\nb"', 'const s = "x\\ny"', false)
		expect(res.replacements).toBe(1)
		expect(res.content).toBe('const s = "x\\ny"\n')
	})

	it("FAILS LOUDLY when old_string only matches after escape normalization (literal \\n vs real newline)", () => {
		// File has REAL newlines...
		const content = "const x = 1\nconst y = 2\n"
		// ...but old_string carries a LITERAL backslash-n. The only way to match
		// is via escape normalization, which would risk corruption — must throw.
		const literalBackslashN = "const x = 1\\nconst y = 2"
		expect(() => performReplacement(content, literalBackslashN, "REPLACED", false)).toThrow(
			/normalizing escape sequences/i,
		)
	})

	it("still reports a clear 'not found' error when nothing matches at all", () => {
		const content = "alpha\nbeta\n"
		expect(() => performReplacement(content, "this text is absent", "x", false)).toThrow(/not found/i)
	})

	it("does not corrupt: escape-mismatched edits never silently write literal \\n", () => {
		const content = "  );\n\n  // marker\n"
		// Simulate the original bug's corrupt block: literal-\n old_string + literal-\n new_string.
		const corruptOld = "  );\\n\\n  // marker"
		const corruptNew = "  );\\n\\n  // INSERTED\\n  // marker"
		// Must throw rather than write literal backslash-n into the file.
		expect(() => performReplacement(content, corruptOld, corruptNew, false)).toThrow(
			/normalizing escape sequences/i,
		)
	})
})
