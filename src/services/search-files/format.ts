import path from "path"

import { MAX_SEARCH_LINE_LENGTH, SearchContextLine, SearchMatch, SearchPage, serializeSearchCursor } from "./types"

export function truncateSearchLine(line: string, maxLength = MAX_SEARCH_LINE_LENGTH): string {
	const normalized = line.replace(/[\r\n]+$/g, "")
	return normalized.length > maxLength ? `${normalized.slice(0, maxLength)} [truncated]` : normalized
}

function addContextLine(lines: Map<number, string>, contextLine: SearchContextLine) {
	if (!lines.has(contextLine.line)) {
		lines.set(contextLine.line, `  ${contextLine.line} | ${truncateSearchLine(contextLine.text)}`)
	}
}

export function formatSearchPage(page: SearchPage): string {
	const cursor = serializeSearchCursor(page.nextCursor)
	const header = [`Engine: ${page.engine}`, `Matches: ${page.matches.length}`, `Next cursor: ${cursor ?? "none"}`]

	if (page.warning) {
		header.push(`Warning: ${page.warning}`)
	}

	if (page.matches.length === 0) {
		return header.join("\n")
	}

	const byFile = new Map<string, SearchMatch[]>()
	for (const match of page.matches) {
		const normalizedPath = match.file.split(path.sep).join("/")
		const existing = byFile.get(normalizedPath)
		if (existing) {
			existing.push(match)
		} else {
			byFile.set(normalizedPath, [match])
		}
	}

	const body: string[] = []
	for (const [file, matches] of byFile) {
		body.push(`# ${file}`)
		const lines = new Map<number, string>()

		for (const match of matches) {
			for (const contextLine of match.contextBefore ?? []) {
				addContextLine(lines, contextLine)
			}

			const definitionMarker = match.isDefinition ? " def" : ""
			lines.set(
				match.line,
				`> ${match.line}:${match.column}${definitionMarker} | ${truncateSearchLine(match.text)}`,
			)

			for (const contextLine of match.contextAfter ?? []) {
				addContextLine(lines, contextLine)
			}
		}

		body.push(...[...lines.entries()].sort(([a], [b]) => a - b).map(([, value]) => value), "")
	}

	return `${header.join("\n")}\n\n${body.join("\n").trimEnd()}`
}
