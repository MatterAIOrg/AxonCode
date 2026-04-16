import { mentionRegexGlobal, unescapeSpaces } from "@roo/context-mentions"
import { getIconForFilePath, getIconForDirectoryPath, getIconUrlByName } from "vscode-material-icons"

export interface MentionChipParts {
	primary: string
	meta: string[]
}

export const formatMentionChipParts = (rawMention: string): MentionChipParts => {
	const mention = unescapeSpaces(rawMention)

	if (/^\w+:\/\/\S+/.test(mention)) {
		try {
			const url = new URL(mention)
			const meta = url.pathname.replace(/^\/+/, "")
			return {
				primary: url.hostname || mention,
				meta: meta ? [meta] : [],
			}
		} catch {
			return { primary: mention, meta: [] }
		}
	}

	if (mention === "problems" || mention === "terminal") {
		return { primary: mention, meta: [] }
	}

	if (/^[a-f0-9]{7,40}$/i.test(mention)) {
		return { primary: mention.slice(0, 7), meta: ["commit"] }
	}

	if (!mention.startsWith("/")) {
		return { primary: mention, meta: [] }
	}

	let pathPart = mention
	let lineInfo: string | undefined

	const hashMatch = mention.match(/^(.*)#L(\d+(?:-\d+)?)/)
	if (hashMatch) {
		pathPart = hashMatch[1]
		lineInfo = `L${hashMatch[2]}`
	} else {
		const lastColonIndex = mention.lastIndexOf(":")
		if (lastColonIndex > mention.lastIndexOf("/")) {
			const maybeRange = mention.slice(lastColonIndex + 1)
			if (/^\d+(?:-\d+)?$/.test(maybeRange)) {
				pathPart = mention.slice(0, lastColonIndex)
				lineInfo = `L${maybeRange}`
			}
		}
	}

	const segments = pathPart.split("/").filter(Boolean)
	const primary = segments.pop() || "/"
	const parent = segments.length ? segments[segments.length - 1] : ""

	const metaParts = []
	if (parent) metaParts.push(parent)
	if (lineInfo) metaParts.push(lineInfo)

	return { primary, meta: metaParts }
}

export const escapeHtml = (value: string): string =>
	value.replace(/[&<>"']/g, (char) => {
		const map: Record<string, string> = {
			"&": "&amp;",
			"<": "&lt;",
			">": "&gt;",
			'"': "&quot;",
			"'": "&#39;",
		}
		return map[char] || char
	})

export const getFileIconForMention = (rawMention: string, materialIconsBaseUri: string): string => {
	const mention = unescapeSpaces(rawMention)
	// Remove line numbers (#L20-80) before extracting filename
	const pathWithoutLineNumbers = mention.replace(/#L\d+(?:-\d+)?$/, "")
	const filename = pathWithoutLineNumbers.split("/").pop() || ""

	if (filename.includes(".")) {
		const iconName = getIconForFilePath(filename)
		return getIconUrlByName(iconName, materialIconsBaseUri)
	}

	return ""
}

export const getFolderIconForMention = (rawMention: string, materialIconsBaseUri: string): string => {
	const mention = unescapeSpaces(rawMention)
	// Remove line numbers and trailing slash
	const pathWithoutLineNumbers = mention.replace(/#L\d+(?:-\d+)?$/, "").replace(/\/$/, "")
	// Get the folder name (last part of path)
	const folderName = pathWithoutLineNumbers.split("/").pop() || ""

	const iconName = getIconForDirectoryPath(folderName)
	return getIconUrlByName(iconName, materialIconsBaseUri)
}

export const isFolderMention = (rawMention: string): boolean => {
	const mention = unescapeSpaces(rawMention)
	// Remove line numbers before checking
	const pathWithoutLineNumbers = mention.replace(/#L\d+(?:-\d+)?$/, "")
	// A folder mention ends with / or doesn't have a file extension
	if (pathWithoutLineNumbers.endsWith("/")) {
		return true
	}
	// Check if it's a path without a file extension (likely a folder)
	const filename = pathWithoutLineNumbers.split("/").pop() || ""
	return !filename.includes(".") && filename.length > 0
}

export const renderMentionChip = (
	rawMention: string,
	materialIconsBaseUri: string,
	isCompactFile: boolean = false,
): string => {
	const parts = formatMentionChipParts(rawMention)
	const displayText = isCompactFile ? rawMention : parts.primary || rawMention
	const escapedPrimary = escapeHtml(displayText)
	const label = escapeHtml(`${isCompactFile ? rawMention : unescapeSpaces(rawMention)}`)
	const mentionValue = escapeHtml(`@${isCompactFile ? rawMention : unescapeSpaces(rawMention)}`)

	// Check if this is a folder mention
	const isFolder = isFolderMention(rawMention)

	let iconHtml = ""
	if (isFolder) {
		// Use material icon for folder mentions (same as ContextMenu)
		const folderIconUrl = getFolderIconForMention(rawMention, materialIconsBaseUri)
		iconHtml = `<img src="${folderIconUrl}" class="mention-chip__icon" alt="" />`
	} else {
		const fileIconUrl = getFileIconForMention(rawMention, materialIconsBaseUri)
		iconHtml = fileIconUrl ? `<img src="${fileIconUrl}" class="mention-chip__icon" alt="" />` : ""
	}

	// Extract line number from meta parts if available
	const lineInfo = parts.meta.find((m) => m.startsWith("L"))
	const lineHtml = lineInfo ? `<span class="mention-chip__line">#${escapeHtml(lineInfo)}</span>` : ""

	return `<span class="mention-chip" data-mention-value="${mentionValue}" aria-label="${label}">${iconHtml}<span class="mention-chip__primary">${escapedPrimary}</span>${lineHtml}</span>`
}

// Icon name for slash commands (using a VSCode codicon via CSS)
export const renderSlashCommandChip = (commandName: string, _materialIconsBaseUri: string): string => {
	const escapedCommand = escapeHtml(commandName)
	const label = escapeHtml(`/${commandName}`)
	const commandValue = escapeHtml(`/${commandName}`)

	// Use CommandIcon SVG as inline HTML
	const iconHtml = `<svg class="slash-command-chip__icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="14" height="14" fill="none" aria-hidden="true"><path d="M15 9V15H9V9H15Z" stroke="currentColor" stroke-width="1" stroke-linejoin="round"/><path d="M15 15H18C19.6569 15 21 16.3431 21 18C21 19.6569 19.6569 21 18 21C16.3431 21 15 19.6569 15 18V15Z" stroke="currentColor" stroke-width="1" stroke-linejoin="round"/><path d="M9 15.002H6C4.34315 15.002 3 16.3451 3 18.002C3 19.6588 4.34315 21.002 6 21.002C7.65685 21.002 9 19.6588 9 18.002V15.002Z" stroke="currentColor" stroke-width="1" stroke-linejoin="round"/><path d="M15 9L15 6C15 4.34315 16.3431 3 18 3C19.6569 3 21 4.34315 21 6C21 7.65685 19.6569 9 18 9H15Z" stroke="currentColor" stroke-width="1" stroke-linejoin="round"/><path d="M9 9V6C9 4.34315 7.65685 3 6 3C4.34315 3 3 4.34315 3 6C3 7.65685 4.34315 9 6 9H9Z" stroke="currentColor" stroke-width="1" stroke-linejoin="round"/></svg>`

	return `<span class="slash-command-chip" data-command-value="${commandValue}" aria-label="${label}">${iconHtml}<span class="slash-command-chip__primary">${escapedCommand}</span></span>`
}

export const valueToHtml = (
	value: string,
	materialIconsBaseUri: string,
	mentionMap: Map<string, string>,
	customModes: any[] = [],
	localWorkflowToggles: Record<string, boolean> = {},
	globalWorkflowToggles: Record<string, boolean> = {},
): string => {
	let processedText = escapeHtml(value || "")

	processedText = processedText
		.replace(/\n/g, '<br data-plain-break="true">')
		.replace(/@([a-zA-Z0-9_.-]+(?:\.[a-zA-Z0-9]+)?)(?=\s|$)/g, (_match, name) => {
			if (mentionMap.has(name)) {
				return renderMentionChip(name, materialIconsBaseUri, true)
			}
			return _match
		})
		.replace(mentionRegexGlobal, (_match, mention) => renderMentionChip(mention, materialIconsBaseUri, false))

	if (/^\s*\//.test(processedText)) {
		const slashIndex = processedText.indexOf("/")
		const spaceIndex = processedText.indexOf(" ", slashIndex)
		const endIndex = spaceIndex > -1 ? spaceIndex : processedText.length
		const commandText = processedText.substring(slashIndex + 1, endIndex)

		const isValidCommand = validateSlashCommand(
			commandText,
			customModes,
			localWorkflowToggles,
			globalWorkflowToggles,
		)

		if (isValidCommand) {
			const chipHtml = renderSlashCommandChip(commandText, materialIconsBaseUri)
			processedText = processedText.substring(0, slashIndex) + chipHtml + processedText.substring(endIndex)
		}
	}

	return processedText || '<br data-plain-break="true">'
}

const validateSlashCommand = (
	commandText: string,
	customModes: any[],
	localWorkflowToggles: Record<string, boolean> = {},
	globalWorkflowToggles: Record<string, boolean> = {},
): boolean => {
	const validCommands = ["newtask", "compact"]
	const modeCommands = customModes?.map((mode) => mode.slug) || []
	const workflowCommands = [
		...Object.keys(localWorkflowToggles).filter((k) => localWorkflowToggles[k]),
		...Object.keys(globalWorkflowToggles).filter((k) => globalWorkflowToggles[k]),
	].map((path) => path.split("/").pop() || "")
	return [...validCommands, ...modeCommands, ...workflowCommands].includes(commandText)
}
