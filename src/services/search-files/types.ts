// Keep the model-facing search operation one-shot. A larger first page is
// cheaper than forcing the model through cursor continuation turns.
export const DEFAULT_SEARCH_RESULTS = 100
export const MAX_SEARCH_RESULTS = 100
export const MAX_MATCHES_PER_FILE = 3
export const MAX_SEARCH_CONTEXT_LINES = 2
export const MAX_SEARCH_LINE_LENGTH = 300

export type SearchEngine = "fff" | "ripgrep"

export interface SearchCursor {
	engine: SearchEngine
	offset: number
}

export interface SearchContextLine {
	line: number
	text: string
}

export interface SearchMatch {
	file: string
	line: number
	column: number
	text: string
	isDefinition?: boolean
	contextBefore?: SearchContextLine[]
	contextAfter?: SearchContextLine[]
}

export interface SearchPage {
	engine: SearchEngine
	matches: SearchMatch[]
	nextCursor: SearchCursor | null
	warning?: string
}

export interface SearchFilesOptions {
	cursor?: SearchCursor | null
	maxResults?: number
	contextLines?: number
}

export function clampSearchOptions(options: SearchFilesOptions): Required<Omit<SearchFilesOptions, "cursor">> & {
	cursor: SearchCursor | null
} {
	return {
		cursor: options.cursor ?? null,
		// Floor fractional values so repaired arguments (e.g. "50.5") execute
		// with a sane page size instead of failing the search.
		maxResults: Math.floor(Math.min(Math.max(options.maxResults ?? DEFAULT_SEARCH_RESULTS, 1), MAX_SEARCH_RESULTS)),
		contextLines: Math.floor(Math.min(Math.max(options.contextLines ?? 0, 0), MAX_SEARCH_CONTEXT_LINES)),
	}
}

export function normalizeNullableSearchString(value: unknown): string | undefined {
	if (typeof value !== "string") {
		return undefined
	}

	const normalized = value.trim()
	return normalized === "" || normalized.toLowerCase() === "null" ? undefined : normalized
}

export function parseSearchCursor(value: unknown): SearchCursor | null {
	if (value === undefined || value === null) {
		return null
	}

	if (typeof value !== "string") {
		throw new Error("search_files cursor must be a string such as 'fff:42' or null")
	}

	const normalized = value.trim()
	if (normalized === "" || normalized.toLowerCase() === "null") {
		return null
	}

	const match = /^(fff|ripgrep):(\d+)$/.exec(normalized)
	if (!match) {
		throw new Error("search_files cursor must use the format 'fff:<offset>' or 'ripgrep:<offset>'")
	}

	const offset = Number(match[2])
	if (!Number.isSafeInteger(offset)) {
		throw new Error("search_files cursor offset is too large")
	}

	return { engine: match[1] as SearchEngine, offset }
}

export function serializeSearchCursor(cursor: SearchCursor | null): string | null {
	return cursor ? `${cursor.engine}:${cursor.offset}` : null
}
