import fs from "fs"
import path from "path"
import { pathToFileURL } from "url"

import type { FileFinder, GrepCursor, GrepMatch } from "@ff-labs/fff-node"

import type { RooIgnoreController } from "../../core/ignore/RooIgnoreController"
import {
	MAX_MATCHES_PER_FILE,
	SearchContextLine,
	SearchFilesOptions,
	SearchMatch,
	SearchPage,
	clampSearchOptions,
} from "../search-files/types"

type FffModule = typeof import("@ff-labs/fff-node")

interface FinderCacheEntry {
	finder: Promise<FileFinder>
	lastUsed: number
}

const FINDER_INIT_TIMEOUT_MS = 10_000
const MAX_CACHED_FINDERS = 3

const finderCache = new Map<string, FinderCacheEntry>()
let fffModulePromise: Promise<FffModule> | undefined

/**
 * Keep the ESM-only FFF SDK outside the CommonJS extension bundle. In a packaged
 * extension it is copied under dist/fff; in source/test runs normal package
 * resolution is used.
 */
async function loadFffModule(): Promise<FffModule> {
	if (!fffModulePromise) {
		const packagedEntry = path.join(
			__dirname,
			"fff",
			"node_modules",
			"@ff-labs",
			"fff-node",
			"dist",
			"src",
			"index.js",
		)
		const specifier = fs.existsSync(packagedEntry) ? pathToFileURL(packagedEntry).href : "@ff-labs/fff-node"

		// A non-literal import is intentionally preserved by esbuild so the native
		// SDK can resolve its platform library from the copied package tree.
		fffModulePromise = import(specifier) as Promise<FffModule>
	}

	return fffModulePromise
}

async function createFinder(basePath: string): Promise<FileFinder> {
	const { FileFinder } = await loadFffModule()
	const created = FileFinder.create({
		basePath,
		aiMode: false,
		disableWatch: false,
		followSymlinks: false,
	})

	if (!created.ok) {
		throw new Error(created.error)
	}

	const finder = created.value
	const ready = await finder.waitForScan(FINDER_INIT_TIMEOUT_MS)
	if (!ready.ok || !ready.value) {
		finder.destroy()
		throw new Error(ready.ok ? `FFF initial scan timed out after ${FINDER_INIT_TIMEOUT_MS}ms` : ready.error)
	}

	return finder
}

async function getFinder(basePath: string): Promise<FileFinder> {
	const normalizedBasePath = path.resolve(basePath)
	const cached = finderCache.get(normalizedBasePath)
	if (cached) {
		cached.lastUsed = Date.now()
		return cached.finder
	}

	const entry: FinderCacheEntry = {
		finder: createFinder(normalizedBasePath),
		lastUsed: Date.now(),
	}
	finderCache.set(normalizedBasePath, entry)

	try {
		const finder = await entry.finder
		await evictOldFinders(normalizedBasePath)
		return finder
	} catch (error) {
		finderCache.delete(normalizedBasePath)
		throw error
	}
}

async function evictOldFinders(currentBasePath: string) {
	if (finderCache.size <= MAX_CACHED_FINDERS) {
		return
	}

	const oldest = [...finderCache.entries()]
		.filter(([basePath]) => basePath !== currentBasePath)
		.sort(([, a], [, b]) => a.lastUsed - b.lastUsed)[0]

	if (!oldest) {
		return
	}

	finderCache.delete(oldest[0])
	try {
		const finder = await oldest[1].finder
		if (!finder.isDestroyed) {
			finder.destroy()
		}
	} catch {
		// A failed initialization has no live native instance to release.
	}
}

function isInsidePath(parent: string, child: string): boolean {
	const relative = path.relative(parent, child)
	return relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative))
}

function normalizeFilePattern(filePattern?: string): string {
	if (!filePattern || filePattern === "*") {
		return "*"
	}

	return filePattern.startsWith(".") && !filePattern.includes("*") ? `*${filePattern}` : filePattern
}

/**
 * FFF's grep API parses whitespace and slash-containing tokens as file
 * constraints. Encode those regex characters equivalently so the user's Rust
 * regex reaches the matcher unchanged while our own constraints remain active.
 */
export function encodeRegexForFffQuery(regex: string): string {
	let encoded = regex
		.replace(/\\\//g, "\\x2F")
		.replace(/\//g, "\\x2F")
		.replace(/\r/g, "\\x0D")
		.replace(/\n/g, "\\x0A")
		.replace(/\t/g, "\\x09")
		.replace(/\f/g, "\\x0C")
		.replace(/\v/g, "\\x0B")
		.replace(/ /g, "\\x20")

	if (encoded.startsWith("!")) {
		encoded = `\\x21${encoded.slice(1)}`
	}

	return encoded
}

function buildFffQuery(cwd: string, directoryPath: string, regex: string, filePattern?: string) {
	const constraints: string[] = []
	const normalizedDirectory = path.resolve(directoryPath)
	const searchInsideWorkspace = isInsidePath(cwd, normalizedDirectory)
	const basePath = searchInsideWorkspace ? path.resolve(cwd) : normalizedDirectory

	if (searchInsideWorkspace) {
		const relativeDirectory = path.relative(basePath, normalizedDirectory).split(path.sep).join("/")
		if (relativeDirectory) {
			if (/\s/.test(relativeDirectory)) {
				throw new Error("FFF cannot safely encode a whitespace-containing search path")
			}
			constraints.push(`${relativeDirectory}/**`)
		}
	}

	const normalizedFilePattern = normalizeFilePattern(filePattern)
	if (normalizedFilePattern !== "*") {
		if (/\s/.test(normalizedFilePattern)) {
			throw new Error("FFF cannot safely encode a whitespace-containing file pattern")
		}
		constraints.push(normalizedFilePattern)
	}

	constraints.push(encodeRegexForFffQuery(regex))
	return { basePath, query: constraints.join(" ") }
}

function toContextLines(lines: string[] | undefined, firstLine: number): SearchContextLine[] | undefined {
	if (!lines?.length) {
		return undefined
	}

	return lines.map((text, index) => ({ line: firstLine + index, text }))
}

function toSearchMatch(cwd: string, basePath: string, match: GrepMatch): SearchMatch {
	const absoluteFilePath = path.join(basePath, match.relativePath)
	const contextBefore = match.contextBefore ?? []

	return {
		file: path.relative(cwd, absoluteFilePath),
		line: match.lineNumber,
		column: match.col + 1,
		text: match.lineContent,
		isDefinition: match.isDefinition,
		contextBefore: toContextLines(contextBefore, match.lineNumber - contextBefore.length),
		contextAfter: toContextLines(match.contextAfter, match.lineNumber + 1),
	}
}

function cursorFromOffset(offset: number): GrepCursor {
	return { __brand: "GrepCursor", _offset: offset }
}

export async function searchFilesWithFff(
	cwd: string,
	directoryPath: string,
	regex: string,
	filePattern: string | undefined,
	rooIgnoreController: RooIgnoreController | undefined,
	options: SearchFilesOptions = {},
): Promise<SearchPage> {
	const normalizedOptions = clampSearchOptions(options)
	if (normalizedOptions.cursor?.engine === "ripgrep") {
		throw new Error("A ripgrep cursor cannot be continued by FFF")
	}

	const { basePath, query } = buildFffQuery(cwd, directoryPath, regex, filePattern)
	const finder = await getFinder(basePath)
	let cursor = normalizedOptions.cursor ? cursorFromOffset(normalizedOptions.cursor.offset) : null
	let nextCursor: GrepCursor | null = null
	const matches: SearchMatch[] = []

	// Filtering .orbitalignore after the native query must not let blocked files
	// consume the visible page. Continue through FFF pages until the page is full.
	for (let page = 0; page < 100 && matches.length < normalizedOptions.maxResults; page++) {
		const result = finder.grep(query, {
			mode: "regex",
			cursor,
			pageSize: normalizedOptions.maxResults - matches.length,
			maxMatchesPerFile: MAX_MATCHES_PER_FILE,
			beforeContext: normalizedOptions.contextLines,
			afterContext: normalizedOptions.contextLines,
			classifyDefinitions: true,
			smartCase: false,
		})

		if (!result.ok) {
			throw new Error(result.error)
		}
		if (result.value.regexFallbackError) {
			throw new Error(result.value.regexFallbackError)
		}

		for (const match of result.value.items) {
			const absoluteFilePath = path.join(basePath, match.relativePath)
			if (!isInsidePath(directoryPath, absoluteFilePath)) {
				continue
			}
			if (rooIgnoreController && !rooIgnoreController.validateAccess(absoluteFilePath)) {
				continue
			}
			matches.push(toSearchMatch(cwd, basePath, match))
		}

		nextCursor = result.value.nextCursor
		if (!nextCursor || matches.length >= normalizedOptions.maxResults) {
			break
		}
		cursor = nextCursor
	}

	return {
		engine: "fff",
		matches,
		nextCursor: nextCursor ? { engine: "fff", offset: nextCursor._offset } : null,
	}
}

export async function disposeFffSearch(): Promise<void> {
	const entries = [...finderCache.values()]
	finderCache.clear()

	await Promise.allSettled(
		entries.map(async ({ finder: finderPromise }) => {
			const finder = await finderPromise
			if (!finder.isDestroyed) {
				finder.destroy()
			}
		}),
	)

	if (fffModulePromise) {
		try {
			const fff = await fffModulePromise
			fff.closeLibrary()
		} catch {
			// Loading failed, so there is no native library to close.
		}
	}
	fffModulePromise = undefined
}
