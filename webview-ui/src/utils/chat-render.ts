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

	return `<span class="mention-chip" contenteditable="false" data-mention-value="${mentionValue}" aria-label="${label}">${iconHtml}<span class="mention-chip__primary">${escapedPrimary}</span>${lineHtml}</span>`
}

// Icon name for slash commands (using a VSCode codicon via CSS)
export const renderSlashCommandChip = (commandName: string, _materialIconsBaseUri: string): string => {
	const escapedCommand = escapeHtml(commandName)
	const label = escapeHtml(`/${commandName}`)
	const commandValue = escapeHtml(`/${commandName}`)

	// Use CommandIcon SVG as inline HTML
	const iconHtml = `<svg class="slash-command-chip__icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="14" height="14" fill="none" aria-hidden="true"><path d="M15 9V15H9V9H15Z" stroke="currentColor" stroke-width="1" stroke-linejoin="round"/><path d="M15 15H18C19.6569 15 21 16.3431 21 18C21 19.6569 19.6569 21 18 21C16.3431 21 15 19.6569 15 18V15Z" stroke="currentColor" stroke-width="1" stroke-linejoin="round"/><path d="M9 15.002H6C4.34315 15.002 3 16.3451 3 18.002C3 19.6588 4.34315 21.002 6 21.002C7.65685 21.002 9 19.6588 9 18.002V15.002Z" stroke="currentColor" stroke-width="1" stroke-linejoin="round"/><path d="M15 9L15 6C15 4.34315 16.3431 3 18 3C19.6569 3 21 4.34315 21 6C21 7.65685 19.6569 9 18 9H15Z" stroke="currentColor" stroke-width="1" stroke-linejoin="round"/><path d="M9 9V6C9 4.34315 7.65685 3 6 3C4.34315 3 3 4.34315 3 6C3 7.65685 4.34315 9 6 9H9Z" stroke="currentColor" stroke-width="1" stroke-linejoin="round"/></svg>`

	return `<span class="slash-command-chip" contenteditable="false" data-command-value="${commandValue}" aria-label="${label}">${iconHtml}<span class="slash-command-chip__primary">${escapedCommand}</span></span>`
}

// Markdown list parsing. The two regexes match list-line starts on already-escaped
// text. Both require whitespace between the marker and the item text, matching
// standard markdown. Ordered lists accept either "." or ")" as the delimiter.
const UNORDERED_LIST_RE = /^(\s*)([-*+])(\s+)(.*)$/
const ORDERED_LIST_RE = /^(\s*)(\d+)([.)])(\s+)(.*)$/

type ParsedListLine = {
	indent: number
	marker: string
	ordered: boolean
	content: string
}

type ListItem = ParsedListLine & { children: ListItem[] }

type ListBlock = { kind: "plain"; text: string } | { kind: "list"; items: ListItem[] }

const parseListLine = (line: string): ParsedListLine | null => {
	const u = line.match(UNORDERED_LIST_RE)
	if (u) return { indent: u[1].length, marker: u[2], ordered: false, content: u[4] }
	const o = line.match(ORDERED_LIST_RE)
	if (o) return { indent: o[1].length, marker: o[2] + o[3], ordered: true, content: o[5] }
	return null
}

// Groups consecutive list lines into a tree of nested items. The tree splits when
// the list type changes at the root level (mixed <ul>/<ol> siblings stay
// separate) or when a line doesn't match list syntax at all, which cleanly
// handles plain prose mixed into the message.
const parseListBlocks = (lines: string[]): ListBlock[] => {
	const blocks: ListBlock[] = []
	let i = 0
	while (i < lines.length) {
		const first = parseListLine(lines[i])
		if (!first) {
			blocks.push({ kind: "plain", text: lines[i] })
			i++
			continue
		}
		const rootItems: ListItem[] = []
		const stack: ListItem[] = []
		const baseOrdered = first.ordered
		while (i < lines.length) {
			const m = parseListLine(lines[i])
			if (!m) break
			// Root-level type change => new sibling list, not a nested item.
			if (m.ordered !== baseOrdered) {
				const parent = stack[stack.length - 1]
				if (!parent || m.indent <= parent.indent) break
			}
			// Dedent: drop ancestors whose indent is >= the current item's indent.
			while (stack.length > 0 && stack[stack.length - 1].indent >= m.indent) {
				stack.pop()
			}
			const item: ListItem = { ...m, children: [] }
			const parent = stack[stack.length - 1]
			if (parent) parent.children.push(item)
			else rootItems.push(item)
			stack.push(item)
			i++
		}
		blocks.push({ kind: "list", items: rootItems })
	}
	return blocks
}

const renderListItem = (item: ListItem): string => {
	// Nested children render as a separate <ul>/<ol> inside the <li>; no extra
	// "\n" here because nested lists are separated structurally, not by a <br>.
	const childrenHtml = item.children.length > 0 ? renderListItems(item.children) : ""
	return `<li data-list-marker="${escapeHtml(item.marker)}">${item.content}${childrenHtml}</li>`
}

const renderListItems = (items: ListItem[]): string => {
	if (items.length === 0) return ""
	const ordered = items[0].ordered
	const tag = ordered ? "ol" : "ul"
	const lis = items.map(renderListItem).join("")
	return `<${tag} class="chat-list">${lis}</${tag}>`
}

const renderListBlocks = (blocks: ListBlock[]): string =>
	blocks.map((b) => (b.kind === "plain" ? b.text : renderListItems(b.items))).join("\n")

// True when any line of `value` looks like a markdown list item. The chat input
// uses this to decide whether to sync the DOM into list form on the next layout
// effect, so the user sees pretty bullets/numbers while typing instead of only on
// paste.
export const containsListSyntax = (value: string): boolean => {
	if (!value) return false
	return value.split("\n").some((line) => parseListLine(line) !== null)
}

export const valueToHtml = (
	value: string,
	materialIconsBaseUri: string,
	mentionMap: Map<string, string>,
	customModes: any[] = [],
	localWorkflowToggles: Record<string, boolean> = {},
	globalWorkflowToggles: Record<string, boolean> = {},
): string => {
	const raw = value || ""
	const escaped = escapeHtml(raw)

	// Mentions must be expanded per line. The compact-mention boundary (?=\s|$)
	// relies on end-of-line matching after splitting, and mention chips need to
	// land inside <li> elements rather than be spliced into the HTML tag soup by
	// a whole-string regex pass that would also break on list markup.
	const lines = escaped.split("\n").map((line) =>
		line
			.replace(/@([a-zA-Z0-9_.-]+(?:\.[a-zA-Z0-9]+)?)(?=\s|$)/g, (_match, name) => {
				if (mentionMap.has(name)) {
					return renderMentionChip(name, materialIconsBaseUri, true)
				}
				return _match
			})
			.replace(mentionRegexGlobal, (_match, mention) => renderMentionChip(mention, materialIconsBaseUri, false)),
	)

	// Group consecutive list lines into <ul>/<ol> trees. Non-matching lines stay
	// as plain text and are joined back with "\n" so they round-trip through
	// <br data-plain-break="true"> exactly as before.
	const blocks = parseListBlocks(lines)
	let processedText = renderListBlocks(blocks)

	// Top-level block separators become <br>. No "\n" remains inside list trees
	// (nesting is represented by nested <ul>/<ol>, not text newlines).
	processedText = processedText.replace(/\n/g, '<br data-plain-break="true">')

	// Slash command chip at the very start of the input. Extract the command
	// name from the raw input (not the HTML) so a command followed by a newline
	// + list doesn't pull list markup into the chip name.
	if (/^\s*\//.test(raw)) {
		const rawSlashIndex = raw.indexOf("/")
		// String.search has no start-position overload, so scan the substring
		// starting at the slash and translate back to absolute offsets.
		const afterSlash = raw.substring(rawSlashIndex)
		const relativeSpace = afterSlash.search(/\s/)
		const rawSpaceIndex = relativeSpace === -1 ? -1 : rawSlashIndex + relativeSpace
		const rawEndIndex = rawSpaceIndex > -1 ? rawSpaceIndex : raw.length
		const commandText = raw.substring(rawSlashIndex + 1, rawEndIndex)

		const isValidCommand = validateSlashCommand(
			commandText,
			customModes,
			localWorkflowToggles,
			globalWorkflowToggles,
		)

		if (isValidCommand) {
			const slashIndex = processedText.indexOf("/")
			const commandEndInProcessed = slashIndex + 1 + commandText.length
			const chipHtml = renderSlashCommandChip(commandText, materialIconsBaseUri)
			processedText =
				processedText.substring(0, slashIndex) + chipHtml + processedText.substring(commandEndInProcessed)
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
