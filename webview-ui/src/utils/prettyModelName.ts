// Hardcoded credits information for Axon models
const AXON_MODEL_CREDITS: Record<string, string> = {
	"axon-auto": "(0.25x)",
	"axon-code-2-pro": "(1.5x)",
}

export const AXON_MODEL_TOOLTIPS: Record<string, [string, string]> = {
	"axon-auto-200k": ["Dynamic coding model", "selects Flash, Mini, or Pro for the task"],
	"axon-auto-400k": ["Dynamic coding model", "selects Flash, Mini, or Pro for the task"],
	"axon-eido-3-flash": ["Fast general-purpose model", "for low-effort day-to-day tasks"],
	"axon-eido-3-flash-400k": ["Fast general-purpose model", "for low-effort day-to-day tasks"],
	"axon-code-2-5-mini": ["Free model for very lightweight task", "low thinking"],
	"axon-code-2-pro": ["Medium cost frontier model for", "small to medium tasks, medium thinking"],
	"axon-code-2-pro-high": ["Medium cost frontier model for", "small to medium tasks, extended thinking"],
	"axon-code-2-5-pro": ["High intelligence frontier model", "for complex task, medium thinking"],
	"axon-code-2-5-pro-high": ["High intelligence frontier model", "for complex task, extended thinking"],
	"axon-eido-3-code-mini-200k": ["High intelligence frontier model", "for high-effort day-to-day tasks"],
	"axon-eido-3-code-mini-400k": ["High intelligence frontier model", "for high-effort day-to-day tasks"],
	"axon-eido-3-code-pro-200k": ["Frontier model", "for coding tasks and long-running agents"],
	"axon-eido-3-code-pro-400k": ["Frontier model", "for coding tasks and long-running agents"],
	"axon-lumen-4-code-200k": ["Ultra-intelligence frontier model", "for complex agentic coding tasks"],
	"axon-lumen-4-code-400k": ["Ultra-intelligence frontier model", "for complex agentic coding tasks"],
}

/**
 * Formats a model ID into a human-readable display name.
 * Handles various model ID formats:
 * - Simple names: "gpt-4" -> "Gpt 4"
 * - Two-part paths: "openai/gpt-4" -> "Openai / Gpt 4"
 * - Three-part paths: "@cf/moonshotai/kimi-k2.5" -> "Kimi K2.5 (Moonshotai)"
 * - With tags: "llama3.2:latest" -> "Llama3.2 (Latest)"
 */
export const prettyModelName = (modelId: string): string => {
	if (!modelId) {
		return ""
	}

	// Remove provider prefix if present (e.g., "matterai3p:", "ollama:", "opencode:")
	const withoutProviderPrefix = modelId.replace(/^(matterai3p|ollama|opencode):/, "")

	const [mainId, tag] = withoutProviderPrefix.split(":")

	// Handle paths with "/" separator
	if (mainId?.includes("/")) {
		const segments = mainId.split("/").filter(Boolean)

		// Handle three-part paths like "@cf/moonshotai/kimi-k2.5"
		// Pattern: [prefix]/[vendor]/[model] or [vendor]/[model]
		if (segments.length >= 3) {
			// Take the last segment as model name
			const modelName = segments[segments.length - 1]!
			// Take the second-to-last as vendor (skip prefixes like "@cf")
			const vendor = segments[segments.length - 2]!

			// Format model name: replace hyphens/underscores with spaces, title case
			// Preserve dots in version numbers (e.g., "kimi-k2.5" -> "Kimi K2.5")
			const formattedModelName = modelName.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())

			// Format vendor: title case
			const formattedVendor = vendor.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())

			const formattedTag = tag ? ` (${tag.charAt(0).toUpperCase() + tag.slice(1)})` : ""
			return `${formattedModelName} (${formattedVendor})${formattedTag}`
		}

		// Handle two-part paths like "openai/gpt-4"
		if (segments.length === 2) {
			const projectName = segments[0]!
			const modelName = segments[1]!

			const formattedProject = projectName.charAt(0).toUpperCase() + projectName.slice(1)
			const formattedName = modelName
				.split("-")
				.filter(Boolean)
				.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
				.join(" ")

			const formattedTag = tag ? ` (${tag.charAt(0).toUpperCase() + tag.slice(1)})` : ""
			return `${formattedProject} / ${formattedName}${formattedTag}`
		}
	}

	// Handle simple names without "/"
	const formattedName = (mainId || "")
		.split("-")
		.filter(Boolean)
		.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
		.join(" ")

	const formattedTag = tag ? ` (${tag.charAt(0).toUpperCase() + tag.slice(1)})` : ""
	return formattedName + formattedTag
}

export const removeAxonPrefix = (text: string): string => {
	if (!text) return ""
	return text
		.replace(/^axon[\s-/_]*/i, "")
		.replace(/\bAxon\b\s*/gi, "")
		.trim()
}

/**
 * Removes context window suffixes like "(200k context)", "(400k context)", "200k context", etc.
 */
export const removeContextSuffix = (text: string): string => {
	if (!text) return ""
	return text.replace(/\s*\(?(?:200k|400k)(?:\s*context)?\)?/gi, "").trim()
}

/**
 * Formats model label for displaying as selected model in ChatTextArea.
 * Removes "Axon" prefix. Hides 200k context, but appends 400k context if is400k is true.
 */
export const formatSelectedModelLabel = (text: string, is400k?: boolean): string => {
	if (!text) return ""
	let result = removeContextSuffix(removeAxonPrefix(text))
	if (is400k) {
		result += " (400k context)"
	}
	return result
}

// Function to get credits for Axon models
export const getModelCredits = (modelId: string): string | null => {
	return AXON_MODEL_CREDITS[modelId]
}
