import { mentionRegexGlobal, unescapeSpaces } from "@roo/context-mentions"
import { getIconForFilePath, getIconUrlByName } from "vscode-material-icons"

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
	const filename = mention.split("/").pop() || ""

	if (filename.includes(".")) {
		const iconName = getIconForFilePath(filename)
		return getIconUrlByName(iconName, materialIconsBaseUri)
	}

	return ""
}

export const renderMentionChip = (
	rawMention: string,
	materialIconsBaseUri: string,
	isCompactFile: boolean = false,
): string => {
	const displayText = isCompactFile ? rawMention : formatMentionChipParts(rawMention).primary || rawMention
	const escapedPrimary = escapeHtml(displayText)
	const label = escapeHtml(`${isCompactFile ? rawMention : unescapeSpaces(rawMention)}`)
	const mentionValue = escapeHtml(`@${isCompactFile ? rawMention : unescapeSpaces(rawMention)}`)

	const fileIconUrl = getFileIconForMention(rawMention, materialIconsBaseUri)
	const iconHtml = fileIconUrl ? `<img src="${fileIconUrl}" class="mention-chip__icon" alt="" />` : ""

	return `<span class="mention-chip" data-mention-value="${mentionValue}" aria-label="${label}">${iconHtml}<span class="mention-chip__primary">${escapedPrimary}</span></span>`
}

export const valueToHtml = (
	value: string,
	materialIconsBaseUri: string,
	mentionMap: Map<string, string>,
	customModes: any[] = [],
): string => {
	let processedText = escapeHtml(value || "")

	processedText = processedText
		.replace(/\n/g, '<br data-plain-break="true">')
		.replace(/@([a-zA-Z0-9_.-]+\.[a-zA-Z0-9]+)(?=\s|$)/g, (_match, filename) => {
			if (mentionMap.has(filename)) {
				return renderMentionChip(filename, materialIconsBaseUri, true)
			}
			return _match
		})
		.replace(mentionRegexGlobal, (_match, mention) => renderMentionChip(mention, materialIconsBaseUri, false))

	if (/^\s*\//.test(processedText)) {
		const slashIndex = processedText.indexOf("/")
		const spaceIndex = processedText.indexOf(" ", slashIndex)
		const endIndex = spaceIndex > -1 ? spaceIndex : processedText.length
		const commandText = processedText.substring(slashIndex + 1, endIndex)

		const isValidCommand = validateSlashCommand(commandText, customModes)

		if (isValidCommand) {
			const fullCommand = processedText.substring(slashIndex, endIndex)
			const highlighted = `<mark class="slash-command-match-textarea-highlight">${fullCommand}</mark>`
			processedText = processedText.substring(0, slashIndex) + highlighted + processedText.substring(endIndex)
		}
	}

	return processedText || '<br data-plain-break="true">'
}

const validateSlashCommand = (commandText: string, customModes: any[]): boolean => {
	const validCommands = ["newtask", "loadtask", "mode", "settings", "help"]
	const modeCommands = customModes?.map((mode) => mode.slug) || []
	return [...validCommands, ...modeCommands].includes(commandText)
}
