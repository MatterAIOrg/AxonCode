import * as fs from "fs/promises"
import * as path from "path"
import { parseSkillFile } from "./parser"
import type { Skill, SkillDiscoveryOptions } from "./types"

const SKILLS_DIR = ".agent/skills"
const SKILL_FILE = "SKILL.md"

export async function discoverSkills(options: SkillDiscoveryOptions): Promise<Skill[]> {
	const { workspacePath } = options
	const skillsDir = path.join(workspacePath, SKILLS_DIR)

	try {
		await fs.access(skillsDir)
	} catch (error) {
		console.warn(`[Skills] error accessing skills directory:`, error)
		return []
	}

	const skills: Skill[] = []

	try {
		const entries = await fs.readdir(skillsDir, { withFileTypes: true })

		// Filter for directories and symlinks that point to directories
		const skillFolders: typeof entries = []

		for (const entry of entries) {
			if (entry.isDirectory()) {
				skillFolders.push(entry)
			} else if (entry.isSymbolicLink()) {
				const fullPath = path.join(skillsDir, entry.name)
				try {
					// Use stat() to follow the symlink and check what it points to
					const stats = await fs.stat(fullPath)
					if (stats.isDirectory()) {
						skillFolders.push(entry)
					}
				} catch {
					// Skip invalid symlinks
				}
			}
		}

		for (const folder of skillFolders) {
			const skillPath = path.join(skillsDir, folder.name, SKILL_FILE)

			try {
				const content = await fs.readFile(skillPath, "utf-8")
				const skill = parseSkillFile(content, skillPath, folder.name)

				if (skill) {
					skills.push(skill)
				} else {
					console.warn(`[Skills] Failed to parse skill from ${folder.name}`)
				}
			} catch (error) {
				console.warn(`[Skills] Could not read SKILL.md from ${folder.name}:`, error)
				continue
			}
		}
	} catch (error) {
		console.warn("[Skills] Could not read skills directory:", error)
		return []
	}

	return skills
}

export async function getSkillByName(name: string, options: SkillDiscoveryOptions): Promise<Skill | null> {
	const skills = await discoverSkills(options)
	return skills.find((skill) => skill.metadata.name === name) || null
}
