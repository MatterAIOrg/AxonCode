import { Fzf } from "fzf"

import type { ModeConfig } from "@roo-code/types"
import type { Command } from "@roo/ExtensionMessage"

import { mentionRegex } from "@roo/context-mentions"

import { escapeSpaces } from "./path-mentions"

/**
 * Gets the description for a mode, prioritizing description > whenToUse > roleDefinition
 * and taking only the first line
 */
// function getModeDescription(mode: ModeConfig): string {
// 	return (mode.description || mode.whenToUse || mode.roleDefinition).split("\n")[0]
// }

export interface SearchResult {
	path: string
	type: "file" | "folder"
	label?: string
}

function getBasename(filepath: string): string {
	return filepath.split("/").pop() || filepath
}

function normalizeForSearch(value: string): string {
	return value.toLowerCase()
}

function normalizePathValue(value: string): string {
	return value.startsWith("/") ? value : `/${value}`
}

function hasFileExtension(value: string): boolean {
	return /\.[a-z0-9]+$/i.test(value)
}

function rankContextMenuItems(items: ContextMenuQueryItem[], query: string): ContextMenuQueryItem[] {
	const normalizedQuery = normalizeForSearch(query.trim().replace(/^@/, ""))
	if (!normalizedQuery) {
		return items
	}

	const getSignals = (item: ContextMenuQueryItem) => {
		const value = item.value || ""
		const basename = normalizeForSearch(getBasename(value))
		const fullPath = normalizeForSearch(value)
		const queryHasExtension = hasFileExtension(normalizedQuery)

		return {
			exactBasename: basename === normalizedQuery ? 1 : 0,
			extensionExactness: queryHasExtension && basename.endsWith(normalizedQuery) ? 1 : 0,
			exactPathSuffix: fullPath.endsWith(normalizedQuery) ? 1 : 0,
			basenameStartsWith: basename.startsWith(normalizedQuery) ? 1 : 0,
			basenameIncludes: basename.includes(normalizedQuery) ? 1 : 0,
			isFile: item.type === ContextMenuOptionType.File ? 1 : 0,
			basenameLength: basename.length,
			pathLength: fullPath.length,
		}
	}

	return [...items].sort((left, right) => {
		const a = getSignals(left)
		const b = getSignals(right)

		return (
			b.exactBasename - a.exactBasename ||
			b.extensionExactness - a.extensionExactness ||
			b.exactPathSuffix - a.exactPathSuffix ||
			b.basenameStartsWith - a.basenameStartsWith ||
			b.basenameIncludes - a.basenameIncludes ||
			b.isFile - a.isFile ||
			a.basenameLength - b.basenameLength ||
			a.pathLength - b.pathLength ||
			(left.value || "").localeCompare(right.value || "")
		)
	})
}

export function insertMention(
	text: string,
	position: number,
	value: string,
	isSlashCommand: boolean = false,
): { newValue: string; mentionIndex: number } {
	// Handle slash command selection (only when explicitly selecting a slash command)
	if (isSlashCommand) {
		return {
			newValue: value,
			mentionIndex: 0,
		}
	}

	const beforeCursor = text.slice(0, position)
	const afterCursor = text.slice(position)

	// Find the position of the last '@' symbol before the cursor
	const lastAtIndex = beforeCursor.lastIndexOf("@")

	// Process the value - escape spaces if it's a file path
	let processedValue = value
	if (value && value.startsWith("/")) {
		// Only escape if the path contains spaces that aren't already escaped
		if (value.includes(" ") && !value.includes("\\ ")) {
			processedValue = escapeSpaces(value)
		}
	}

	let newValue: string
	let mentionIndex: number

	if (lastAtIndex !== -1) {
		// If there's an '@' symbol, replace everything after it with the new mention
		const beforeMention = text.slice(0, lastAtIndex)
		// Only replace if afterCursor is all alphanumerical
		// This is required to handle languages that don't use space as a word separator (chinese, japanese, korean, etc)
		const afterCursorContent = /^[a-zA-Z0-9\s]*$/.test(afterCursor)
			? afterCursor.replace(/^[^\s]*/, "")
			: afterCursor
		newValue = beforeMention + "@" + processedValue + " " + afterCursorContent
		mentionIndex = lastAtIndex
	} else {
		// If there's no '@' symbol, insert the mention at the cursor position
		newValue = beforeCursor + "@" + processedValue + " " + afterCursor
		mentionIndex = position
	}

	return { newValue, mentionIndex }
}

export function removeMention(text: string, position: number): { newText: string; newPosition: number } {
	const beforeCursor = text.slice(0, position)
	const afterCursor = text.slice(position)

	// Check if we're at the end of a mention
	const matchEnd = beforeCursor.match(new RegExp(mentionRegex.source + "$"))

	if (matchEnd) {
		// If we're at the end of a mention, remove it
		// Remove the mention and the first space that follows it
		const mentionLength = matchEnd[0].length
		// Remove the mention and one space after it if it exists
		const newText = text.slice(0, position - mentionLength) + afterCursor.replace(/^\s/, "")
		const newPosition = position - mentionLength
		return { newText, newPosition }
	}

	// If we're not at the end of a mention, just return the original text and position
	return { newText: text, newPosition: position }
}

export enum ContextMenuOptionType {
	File = "file",
	Folder = "folder",
	Image = "image",
	NoResults = "noResults",
}

export interface ContextMenuQueryItem {
	type: ContextMenuOptionType
	value?: string
	label?: string
	description?: string
	icon?: string
	slashCommand?: string
	secondaryText?: string
	argumentHint?: string
}

export function getContextMenuOptions(
	query: string,
	selectedType: ContextMenuOptionType | null = null,
	queryItems: ContextMenuQueryItem[],
	dynamicSearchResults: SearchResult[] = [],
	_modes?: ModeConfig[],
	_commands?: Command[],
): ContextMenuQueryItem[] {
	const normalizedQuery = query.trim().replace(/^@/, "")

	if (query === "") {
		if (selectedType === ContextMenuOptionType.File) {
			const files = queryItems
				.filter((item) => item.type === ContextMenuOptionType.File)
				.map((item) => ({
					type: item.type,
					value: item.value,
				}))
			return files.length > 0 ? files : [{ type: ContextMenuOptionType.NoResults }]
		}

		if (selectedType === ContextMenuOptionType.Folder) {
			const folders = queryItems
				.filter((item) => item.type === ContextMenuOptionType.Folder)
				.map((item) => ({ type: ContextMenuOptionType.Folder, value: item.value }))
			return folders.length > 0 ? folders : [{ type: ContextMenuOptionType.NoResults }]
		}

		return [
			{ type: ContextMenuOptionType.Folder },
			{ type: ContextMenuOptionType.File },
			{ type: ContextMenuOptionType.Image },
		]
	}

	// Convert search results to queryItems format first
	const searchResultItems = dynamicSearchResults.map((result) => {
		const formattedPath = result.path.startsWith("/") ? result.path : `/${result.path}`
		const displayPath = formattedPath
		const displayName = result.label || getBasename(result.path)

		return {
			type: result.type === "folder" ? ContextMenuOptionType.Folder : ContextMenuOptionType.File,
			value: formattedPath,
			label: displayName,
			description: displayPath,
		}
	})

	// Combine all items to search through
	const allSearchItems = [...queryItems, ...searchResultItems]

	// Helper to get normalized key for deduplication
	const getItemKey = (item: ContextMenuQueryItem): string => {
		if (item.type === ContextMenuOptionType.File || item.type === ContextMenuOptionType.Folder) {
			return normalizePathValue(item.value!)
		}
		return `${item.type}-${item.value}`
	}

	// Helper to get basename from path for filename matching
	const getItemBasename = (item: ContextMenuQueryItem): string => {
		if (!item.value) return ""
		return item.value.split("/").pop() || item.value
	}

	// Prepare items for fuzzy search - prioritize filename in search string
	const searchableItems = allSearchItems
		.filter((item) => item.type === ContextMenuOptionType.File || item.type === ContextMenuOptionType.Folder)
		.map((item) => {
			const basename = getItemBasename(item)
			// Search string: basename first (highest priority), then full path
			const searchStr = `${basename} ${item.value}`
			return {
				original: item,
				searchStr,
			}
		})

	// Initialize fzf instance for fuzzy search
	// Use case-insensitive matching and prioritize filename matches
	const fzf = new Fzf(searchableItems, {
		selector: (item) => item.searchStr,
		casing: "case-insensitive",
	})

	// Get fuzzy matching items
	const fuzzyMatches = normalizedQuery ? fzf.find(normalizedQuery).map((result) => result.item.original) : []

	// Deduplicate results
	const seen = new Set<string>()
	const deduped = fuzzyMatches.filter((item) => {
		const key = getItemKey(item)
		if (seen.has(key)) return false
		seen.add(key)
		return true
	})

	const ranked = rankContextMenuItems(deduped, normalizedQuery)

	return ranked.length > 0 ? ranked : [{ type: ContextMenuOptionType.NoResults }]
}

export function shouldShowContextMenu(text: string, position: number): boolean {
	const beforeCursor = text.slice(0, position)

	// Check if we're in a slash command context (at the beginning and no space yet)
	if (text.startsWith("/") && !text.includes(" ") && position <= text.length) {
		return true
	}

	// Check for @ mention context
	const atIndex = beforeCursor.lastIndexOf("@")

	if (atIndex === -1) {
		return false
	}

	const textAfterAt = beforeCursor.slice(atIndex + 1)

	// Check if there's any unescaped whitespace after the '@'
	// We need to check for whitespace that isn't preceded by a backslash
	// Using a negative lookbehind to ensure the space isn't escaped
	const hasUnescapedSpace = /(?<!\\)\s/.test(textAfterAt)
	if (hasUnescapedSpace) return false

	// Don't show the menu if it's clearly a URL
	if (textAfterAt.toLowerCase().startsWith("http")) {
		return false
	}

	// Show menu in all other cases
	return true
}
