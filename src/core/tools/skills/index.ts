import * as fs from "fs/promises"
import * as os from "os"
import * as path from "path"
import { parseSkillFile } from "./parser"
import type { Skill, SkillDiscoveryOptions } from "./types"

const SKILLS_DIR = path.join(".orb", "skills")
const PLUGINS_DIR = path.join(".orb", "plugins")
const SKILL_FILE = "SKILL.md"

async function isDirectory(
	entryPath: string,
	entry: { isDirectory(): boolean; isSymbolicLink(): boolean },
): Promise<boolean> {
	if (entry.isDirectory()) return true
	if (!entry.isSymbolicLink()) return false
	try {
		return (await fs.stat(entryPath)).isDirectory()
	} catch {
		return false
	}
}

async function parseSkill(skillPath: string, folderName: string, namespace?: string): Promise<Skill | null> {
	try {
		const content = await fs.readFile(skillPath, "utf-8")
		const skill = parseSkillFile(content, skillPath, folderName)
		if (!skill) return null
		if (namespace) skill.metadata.name = `${namespace}:${skill.metadata.name}`
		return skill
	} catch {
		return null
	}
}

function resolveSkillFile(skillPath: string, workspacePath: string): string {
	const expandedPath =
		skillPath === "~"
			? os.homedir()
			: skillPath.startsWith("~/") || skillPath.startsWith(`~\\`)
				? path.join(os.homedir(), skillPath.slice(2))
				: skillPath
	const resolvedPath = path.resolve(workspacePath, expandedPath)

	return path.basename(resolvedPath) === SKILL_FILE ? resolvedPath : path.join(resolvedPath, SKILL_FILE)
}

/** Load a skill from an explicit directory or SKILL.md path. */
export async function getSkillByPath(skillPath: string, options: SkillDiscoveryOptions): Promise<Skill | null> {
	const skillFile = resolveSkillFile(skillPath.trim(), options.workspacePath)
	return parseSkill(skillFile, path.basename(path.dirname(skillFile)))
}

async function discoverPersonalSkills(workspacePath: string): Promise<Skill[]> {
	const skillsDir = path.join(workspacePath, SKILLS_DIR)
	let entries
	try {
		entries = await fs.readdir(skillsDir, { withFileTypes: true })
	} catch {
		return []
	}

	const skills: Skill[] = []
	for (const entry of entries) {
		const folder = path.join(skillsDir, entry.name)
		if (!(await isDirectory(folder, entry))) continue
		const skill = await parseSkill(path.join(folder, SKILL_FILE), entry.name)
		if (skill) skills.push(skill)
	}
	return skills
}

async function findSkillFiles(dir: string): Promise<string[]> {
	let entries
	try {
		entries = await fs.readdir(dir, { withFileTypes: true })
	} catch {
		return []
	}

	const files: string[] = []
	for (const entry of entries) {
		const entryPath = path.join(dir, entry.name)
		if (entry.isFile() && entry.name === SKILL_FILE) {
			files.push(entryPath)
		} else if (await isDirectory(entryPath, entry)) {
			files.push(...(await findSkillFiles(entryPath)))
		}
	}
	return files
}

async function discoverPluginSkills(workspacePath: string): Promise<Skill[]> {
	const pluginsDir = path.join(workspacePath, PLUGINS_DIR)
	let plugins
	try {
		plugins = await fs.readdir(pluginsDir, { withFileTypes: true })
	} catch {
		return []
	}

	const skills: Skill[] = []
	for (const plugin of plugins) {
		if (plugin.name.startsWith(".")) continue
		const pluginDir = path.join(pluginsDir, plugin.name)
		if (!(await isDirectory(pluginDir, plugin))) continue
		const skillFiles = await findSkillFiles(path.join(pluginDir, "skills"))
		try {
			await fs.access(path.join(pluginDir, SKILL_FILE))
			skillFiles.unshift(path.join(pluginDir, SKILL_FILE))
		} catch {
			// Most plugins keep skills under skills/<name>/SKILL.md.
		}

		for (const skillPath of skillFiles) {
			const relativeFolder = path.relative(pluginDir, path.dirname(skillPath)) || plugin.name
			const skill = await parseSkill(skillPath, `${plugin.name}:${relativeFolder}`, plugin.name)
			if (skill) skills.push(skill)
		}
	}
	return skills
}

export async function discoverSkills(options: SkillDiscoveryOptions): Promise<Skill[]> {
	const [personalSkills, pluginSkills] = await Promise.all([
		discoverPersonalSkills(options.workspacePath),
		discoverPluginSkills(options.workspacePath),
	])
	return [...personalSkills, ...pluginSkills]
}

export async function getSkillByName(name: string, options: SkillDiscoveryOptions): Promise<Skill | null> {
	const skills = await discoverSkills(options)
	const discoveredSkill = skills.find((skill) => skill.metadata.name === name)
	if (discoveredSkill) return discoveredSkill

	// A caller may provide a skill directory or SKILL.md path that is not part
	// of the standard .orb discovery catalog.
	return getSkillByPath(name, options)
}
