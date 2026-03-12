import * as vscode from "vscode"
import * as path from "path"
import * as fs from "fs"
import * as childProcess from "child_process"
import * as readline from "readline"
import { byLengthAsc, Fzf } from "fzf"
import { getBinPath } from "../ripgrep"

export type FileResult = { path: string; type: "file" | "folder"; label?: string }

const DEFAULT_FILE_SCAN_LIMIT = Number.MAX_SAFE_INTEGER
const MIN_FZF_CANDIDATES = 200

function normalizeForSearch(value: string): string {
	return value.toLowerCase()
}

function getItemBasename(item: FileResult): string {
	return path.posix.basename(item.path)
}

function getSearchString(item: FileResult): string {
	const basename = getItemBasename(item)
	return `${basename} ${item.path}`
}

function hasFileExtension(value: string): boolean {
	return /\.[a-z0-9]+$/i.test(value)
}

function getRankSignals(item: FileResult, normalizedQuery: string) {
	const basename = normalizeForSearch(getItemBasename(item))
	const fullPath = normalizeForSearch(item.path)
	const queryHasExtension = hasFileExtension(normalizedQuery)

	return {
		exactBasename: basename === normalizedQuery ? 1 : 0,
		exactPathSuffix: fullPath.endsWith(normalizedQuery) ? 1 : 0,
		basenameStartsWith: basename.startsWith(normalizedQuery) ? 1 : 0,
		pathSegmentMatch: fullPath.includes(`/${normalizedQuery}`) ? 1 : 0,
		basenameIncludes: basename.includes(normalizedQuery) ? 1 : 0,
		extensionExactness: queryHasExtension && basename.endsWith(normalizedQuery) ? 1 : 0,
		isFile: item.type === "file" ? 1 : 0,
		basenameLength: basename.length,
		pathLength: fullPath.length,
	}
}

export function rankWorkspaceSearchResults(results: FileResult[], query: string): FileResult[] {
	const normalizedQuery = normalizeForSearch(query.trim())
	if (!normalizedQuery) {
		return results
	}

	return [...results].sort((left, right) => {
		const a = getRankSignals(left, normalizedQuery)
		const b = getRankSignals(right, normalizedQuery)

		return (
			b.exactBasename - a.exactBasename ||
			b.extensionExactness - a.extensionExactness ||
			b.exactPathSuffix - a.exactPathSuffix ||
			b.basenameStartsWith - a.basenameStartsWith ||
			b.pathSegmentMatch - a.pathSegmentMatch ||
			b.basenameIncludes - a.basenameIncludes ||
			b.isFile - a.isFile ||
			a.basenameLength - b.basenameLength ||
			a.pathLength - b.pathLength ||
			left.path.localeCompare(right.path)
		)
	})
}

export async function executeRipgrep({
	args,
	workspacePath,
	limit = 500,
}: {
	args: string[]
	workspacePath: string
	limit?: number
}): Promise<FileResult[]> {
	const rgPath = await getBinPath(vscode.env.appRoot)

	if (!rgPath) {
		throw new Error(`ripgrep not found: ${rgPath}`)
	}

	return new Promise((resolve, reject) => {
		const rgProcess = childProcess.spawn(rgPath, args)
		const rl = readline.createInterface({ input: rgProcess.stdout, crlfDelay: Infinity })
		const fileResults: FileResult[] = []
		const dirSet = new Set<string>() // Track unique directory paths.

		let count = 0

		rl.on("line", (line) => {
			if (count < limit) {
				try {
					const relativePath = path.relative(workspacePath, line)

					// Add the file itself.
					fileResults.push({ path: relativePath, type: "file", label: path.basename(relativePath) })

					// Extract and store all parent directory paths.
					let dirPath = path.dirname(relativePath)

					while (dirPath && dirPath !== "." && dirPath !== "/") {
						dirSet.add(dirPath)
						dirPath = path.dirname(dirPath)
					}

					count++
				} catch (error) {
					// Silently ignore errors processing individual paths.
				}
			} else {
				rl.close()
				rgProcess.kill()
			}
		})

		let errorOutput = ""

		rgProcess.stderr.on("data", (data) => {
			errorOutput += data.toString()
		})

		rl.on("close", () => {
			if (errorOutput && fileResults.length === 0) {
				reject(new Error(`ripgrep process error: ${errorOutput}`))
			} else {
				// Convert directory set to array of directory objects.
				const dirResults = Array.from(dirSet).map((dirPath) => ({
					path: dirPath,
					type: "folder" as const,
					label: path.basename(dirPath),
				}))

				// Combine files and directories and resolve.
				resolve([...fileResults, ...dirResults])
			}
		})

		rgProcess.on("error", (error) => {
			reject(new Error(`ripgrep process error: ${error.message}`))
		})
	})
}

export async function executeRipgrepForFiles(
	workspacePath: string,
	limit: number = DEFAULT_FILE_SCAN_LIMIT,
): Promise<{ path: string; type: "file" | "folder"; label?: string }[]> {
	const args = [
		"--files",
		"--follow",
		"--hidden",
		"-g",
		"!**/node_modules/**",
		"-g",
		"!**/.git/**",
		"-g",
		"!**/out/**",
		"-g",
		"!**/dist/**",
		workspacePath,
	]

	return executeRipgrep({ args, workspacePath, limit })
}

export async function searchWorkspaceFiles(
	query: string,
	workspacePath: string,
	limit: number = 20,
): Promise<{ path: string; type: "file" | "folder"; label?: string }[]> {
	try {
		// Get all files and directories (from our modified function)
		const allItems = await executeRipgrepForFiles(workspacePath)

		// If no query, just return the top items
		if (!query.trim()) {
			return allItems.slice(0, limit)
		}

		// Create search items for all files AND directories
		const searchItems = allItems.map((item) => ({
			original: item,
			searchStr: getSearchString(item),
		}))

		// Run fzf search on all items
		const fzf = new Fzf(searchItems, {
			selector: (item) => item.searchStr,
			tiebreakers: [byLengthAsc],
			limit: Math.max(limit * 10, MIN_FZF_CANDIDATES),
		})

		// Get a broad slice of matching results from fzf, then apply ranking tuned for file names/extensions.
		const rankedMatches = rankWorkspaceSearchResults(
			fzf.find(query).map((result) => result.item.original),
			query,
		).slice(0, limit)

		// Verify types of the shortest results
		const verifiedResults = await Promise.all(
			rankedMatches.map(async (result) => {
				const fullPath = path.join(workspacePath, result.path)
				// Verify if the path exists and is actually a directory
				if (fs.existsSync(fullPath)) {
					const isDirectory = fs.lstatSync(fullPath).isDirectory()
					return {
						...result,
						path: result.path.toPosix(),
						type: isDirectory ? ("folder" as const) : ("file" as const),
					}
				}
				// If path doesn't exist, keep original type
				return result
			}),
		)

		return verifiedResults
	} catch (error) {
		console.error("Error in searchWorkspaceFiles:", error)
		return []
	}
}
