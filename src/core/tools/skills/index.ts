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
		// Check if skills directory exists
		await fs.access(skillsDir)
	} catch {
		// Directory doesn't exist, return empty array
		return []
	}

	const skills: Skill[] = []

	try {
		// Read all subdirectories in skills directory
		const entries = await fs.readdir(skillsDir, { withFileTypes: true })
		const skillFolders = entries.filter((entry) => entry.isDirectory())

		// Load SKILL.md from each folder
		for (const folder of skillFolders) {
			const skillPath = path.join(skillsDir, folder.name, SKILL_FILE)

			try {
				const content = await fs.readFile(skillPath, "utf-8")
				const skill = parseSkillFile(content, skillPath, folder.name)

				if (skill) {
					skills.push(skill)
				}
			} catch {
				// SKILL.md doesn't exist or can't be read, skip this folder
				continue
			}
		}
	} catch {
		// Error reading directory, return empty array
		return []
	}

	return skills
}

export async function getSkillByName(name: string, options: SkillDiscoveryOptions): Promise<Skill | null> {
	const skills = await discoverSkills(options)
	return skills.find((skill) => skill.metadata.name === name) || null
}
