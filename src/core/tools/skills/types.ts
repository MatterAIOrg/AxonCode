export interface SkillMetadata {
	name: string
	description: string
	license?: string
	metadata?: {
		author?: string
		version?: string
		[key: string]: any
	}
}

export interface Skill {
	metadata: SkillMetadata
	content: string
	folderName: string
	path: string
}

export interface SkillDiscoveryOptions {
	workspacePath: string
}
