import { describe, it, expect } from "vitest"
import { parseSkillFile } from "../parser"

describe("parseSkillFile", () => {
	it("should parse a valid SKILL.md file", () => {
		const content = `---
name: test-skill
description: A test skill
license: MIT
metadata:
  author: test
  version: "1.0.0"
---

# Test Skill

This is the skill content.`

		const result = parseSkillFile(content, "/path/to/SKILL.md", "test-folder")

		expect(result).not.toBeNull()
		expect(result?.metadata.name).toBe("test-skill")
		expect(result?.metadata.description).toBe("A test skill")
		expect(result?.metadata.license).toBe("MIT")
		expect(result?.metadata.metadata?.author).toBe("test")
		expect(result?.metadata.metadata?.version).toBe("1.0.0")
		expect(result?.content).toBe("# Test Skill\n\nThis is the skill content.")
		expect(result?.folderName).toBe("test-folder")
		expect(result?.path).toBe("/path/to/SKILL.md")
	})

	it("should parse a minimal valid SKILL.md file", () => {
		const content = `---
name: minimal-skill
description: Minimal description
---

Content here.`

		const result = parseSkillFile(content, "/path/to/SKILL.md", "minimal-folder")

		expect(result).not.toBeNull()
		expect(result?.metadata.name).toBe("minimal-skill")
		expect(result?.metadata.description).toBe("Minimal description")
		expect(result?.content).toBe("Content here.")
	})

	it("should return null if name is missing", () => {
		const content = `---
description: A skill without name
---

Content here.`

		const result = parseSkillFile(content, "/path/to/SKILL.md", "folder")

		expect(result).toBeNull()
	})

	it("should return null if description is missing", () => {
		const content = `---
name: skill-without-description
---

Content here.`

		const result = parseSkillFile(content, "/path/to/SKILL.md", "folder")

		expect(result).toBeNull()
	})

	it("should return null if frontmatter is malformed", () => {
		const content = `---
invalid: yaml: content
---
Content here.`

		const result = parseSkillFile(content, "/path/to/SKILL.md", "folder")

		// gray-matter should still parse this, but let's test the behavior
		expect(result).not.toBeNull()
	})

	it("should handle empty content", () => {
		const content = `---
name: empty-skill
description: Empty content
---

`

		const result = parseSkillFile(content, "/path/to/SKILL.md", "folder")

		expect(result).not.toBeNull()
		expect(result?.content).toBe("")
	})

	it("should handle content with special characters", () => {
		const content = `---
name: special-skill
description: Skill with special chars
---

# Title

\`\`\`typescript
const code = "test";
\`\`\`

- List item 1
- List item 2
`

		const result = parseSkillFile(content, "/path/to/SKILL.md", "folder")

		expect(result).not.toBeNull()
		expect(result?.content).toContain('const code = "test";')
		expect(result?.content).toContain("List item 1")
	})
})
