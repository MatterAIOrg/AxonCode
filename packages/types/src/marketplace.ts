import { z } from "zod"

/**
 * Schema for MCP parameter definitions
 */
export const mcpParameterSchema = z.object({
	name: z.string().min(1),
	key: z.string().min(1),
	placeholder: z.string().optional(),
	optional: z.boolean().optional().default(false),
})

export type McpParameter = z.infer<typeof mcpParameterSchema>

/**
 * Schema for MCP installation method with name
 */
export const mcpInstallationMethodSchema = z.object({
	name: z.string().min(1),
	content: z.string().min(1),
	parameters: z.array(mcpParameterSchema).optional(),
	prerequisites: z.array(z.string()).optional(),
})

export type McpInstallationMethod = z.infer<typeof mcpInstallationMethodSchema>

/**
 * Component type validation
 */
export const marketplaceItemTypeSchema = z.enum(["mode", "mcp", "skill", "plugin"] as const)

export type MarketplaceItemType = z.infer<typeof marketplaceItemTypeSchema>

/**
 * Base schema for common marketplace item fields
 */
const baseMarketplaceItemSchema = z.object({
	id: z.string().min(1),
	name: z.string().min(1, "Name is required"),
	description: z.string(),
	author: z.string().optional(),
	authorUrl: z.string().url("Author URL must be a valid URL").optional(),
	logo: z.string().optional(),
	tags: z.array(z.string()).optional(),
	prerequisites: z.array(z.string()).optional(),
})

/**
 * Type-specific schemas for YAML parsing (without type field, added programmatically)
 */
export const modeMarketplaceItemSchema = baseMarketplaceItemSchema.extend({
	content: z.string().min(1), // YAML content for modes
})

export type ModeMarketplaceItem = z.infer<typeof modeMarketplaceItemSchema>

export const mcpMarketplaceItemSchema = baseMarketplaceItemSchema.extend({
	url: z.string().url(), // Required url field
	content: z.union([z.string().min(1), z.array(mcpInstallationMethodSchema)]), // Single config or array of methods
	parameters: z.array(mcpParameterSchema).optional(),
})

export type McpMarketplaceItem = z.infer<typeof mcpMarketplaceItemSchema>

/**
 * Skill marketplace item — a SKILL.md file that gets installed into
 * `.orb/skills/<name>/SKILL.md` in the user's workspace.
 */
export const skillMarketplaceItemSchema = baseMarketplaceItemSchema.extend({
	// The full SKILL.md content (frontmatter + body). The `name` field in the
	// frontmatter is what the agent uses to invoke the skill via the
	// `use_skill` tool.
	content: z.string().optional(),
	// Optional source URL (e.g. GitHub raw URL) for traceability.
	sourceUrl: z.string().url().optional(),
})

export type SkillMarketplaceItem = z.infer<typeof skillMarketplaceItemSchema>

/**
 * A complete Claude-compatible plugin bundle. Plugins may contain skills,
 * commands, agents, hooks, and MCP server definitions.
 */
export const pluginSourceSchema = z.union([
	z.string().min(1),
	z
		.object({
			source: z.string().min(1),
			url: z.string().optional(),
			repo: z.string().optional(),
			path: z.string().optional(),
			ref: z.string().optional(),
			sha: z.string().optional(),
			commit: z.string().optional(),
			package: z.string().optional(),
			version: z.string().optional(),
		})
		.passthrough(),
])

export const pluginMarketplaceItemSchema = baseMarketplaceItemSchema.extend({
	marketplace: z.string().min(1),
	source: pluginSourceSchema,
	sourceUrl: z.string().url().optional(),
	homepage: z.string().url().optional(),
	version: z.string().optional(),
	category: z.string().optional(),
	strict: z.boolean().optional(),
	skills: z.array(z.string()).optional(),
	commands: z.union([z.string(), z.array(z.string())]).optional(),
	agents: z.union([z.string(), z.array(z.string())]).optional(),
	hooks: z.unknown().optional(),
	mcpServers: z.unknown().optional(),
})

export type PluginMarketplaceItem = z.infer<typeof pluginMarketplaceItemSchema>

/**
 * Unified marketplace item schema using discriminated union
 */
export const marketplaceItemSchema = z.discriminatedUnion("type", [
	// Mode marketplace item
	modeMarketplaceItemSchema.extend({
		type: z.literal("mode"),
	}),
	// MCP marketplace item
	mcpMarketplaceItemSchema.extend({
		type: z.literal("mcp"),
	}),
	// Skill marketplace item
	skillMarketplaceItemSchema.extend({
		type: z.literal("skill"),
	}),
	// Complete plugin bundle
	pluginMarketplaceItemSchema.extend({
		type: z.literal("plugin"),
	}),
])

export type MarketplaceItem = z.infer<typeof marketplaceItemSchema>

/**
 * Installation options for marketplace items
 */
export const installMarketplaceItemOptionsSchema = z.object({
	target: z.enum(["global", "project"]).optional().default("project"),
	parameters: z.record(z.string(), z.any()).optional(),
})

export type InstallMarketplaceItemOptions = z.infer<typeof installMarketplaceItemOptionsSchema>
