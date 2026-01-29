import matter from "gray-matter"
import type { Skill, SkillMetadata } from "./types"

export function parseSkillFile(content: string, path: string, folderName: string): Skill | null {
	try {
		const parsed = matter(content)
		const frontmatter = parsed.data as Partial<SkillMetadata>

		// Validate required fields
		if (!frontmatter.name || typeof frontmatter.name !== "string") {
			return null
		}

		if (!frontmatter.description || typeof frontmatter.description !== "string") {
			return null
		}

		const metadata: SkillMetadata = {
			name: frontmatter.name,
			description: frontmatter.description,
			license: frontmatter.license,
			metadata: frontmatter.metadata,
		}

		return {
			metadata,
			content: parsed.content.trim(),
			folderName,
			path,
		}
	} catch (error) {
		// If frontmatter parsing fails, return null
		return null
	}
}
