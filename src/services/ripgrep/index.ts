import * as childProcess from "child_process"
import * as path from "path"
import * as readline from "readline"

import * as vscode from "vscode"

import { RooIgnoreController } from "../../core/ignore/RooIgnoreController"
import { fileExistsAtPath } from "../../utils/fs"
import {
	MAX_MATCHES_PER_FILE,
	SearchContextLine,
	SearchFilesOptions,
	SearchMatch,
	SearchPage,
	clampSearchOptions,
} from "../search-files/types"
/*
This file provides functionality to perform regex searches on files using ripgrep.
Inspired by: https://github.com/DiscreteTom/vscode-ripgrep-utils

Key components:
1. getBinPath: Locates the ripgrep binary within the VSCode installation.
2. execRipgrep: Executes the ripgrep command and returns the output.
3. regexSearchFiles: The main function that performs regex searches on files.
   - Parameters:
	 * cwd: The current working directory (for relative path calculation)
	 * directoryPath: The directory to search in
	 * regex: The regular expression to search for (Rust regex syntax)
	 * filePattern: Optional glob pattern to filter files (default: '*')
   - Returns: A formatted string containing search results with context

The search results include:
- Relative file paths
- 2 lines of context before and after each match
- Matches formatted with pipe characters for easy reading

Usage example:
const results = await regexSearchFiles('/path/to/cwd', '/path/to/search', 'TODO:', '*.ts');

rel/path/to/app.ts
│----
│function processData(data: any) {
│  // Some processing logic here
│  // TODO: Implement error handling
│  return processedData;
│}
│----

rel/path/to/helper.ts
│----
│  let result = 0;
│  for (let i = 0; i < input; i++) {
│    // TODO: Optimize this function for performance
│    result += Math.pow(i, 2);
│  }
│----
*/

const isWindows = process.platform.startsWith("win")
const binName = isWindows ? "rg.exe" : "rg"

// @vscode/ripgrep-universal (used by recent VS Code builds and Orbital) nests the
// binary in a per-platform subfolder, e.g. bin/darwin-arm64/rg. Mirror its own
// resolution: binPathFor({ os: process.platform, arch: process.arch }).
const universalBinSubdir = `${process.platform}-${process.env.npm_config_arch || process.arch}`

interface SearchFileResult {
	file: string
	searchResults: SearchResult[]
}

interface SearchResult {
	lines: SearchLineResult[]
}

interface SearchLineResult {
	line: number
	text: string
	isMatch: boolean
	column?: number
}
// Constants
const MAX_RESULTS = 300
const MAX_LINE_LENGTH = 500

/**
 * Truncates a line if it exceeds the maximum length
 * @param line The line to truncate
 * @param maxLength The maximum allowed length (defaults to MAX_LINE_LENGTH)
 * @returns The truncated line, or the original line if it's shorter than maxLength
 */
export function truncateLine(line: string, maxLength: number = MAX_LINE_LENGTH): string {
	return line.length > maxLength ? line.substring(0, maxLength) + " [truncated...]" : line
}
/**
 * Get the path to the ripgrep binary within the VSCode installation
 */
export async function getBinPath(vscodeAppRoot: string): Promise<string | undefined> {
	const checkPath = async (pkgFolder: string) => {
		const fullPath = path.join(vscodeAppRoot, pkgFolder, binName)
		return (await fileExistsAtPath(fullPath)) ? fullPath : undefined
	}

	return (
		(await checkPath("node_modules/@vscode/ripgrep/bin/")) ||
		(await checkPath("node_modules/vscode-ripgrep/bin")) ||
		(await checkPath("node_modules.asar.unpacked/vscode-ripgrep/bin/")) ||
		(await checkPath("node_modules.asar.unpacked/@vscode/ripgrep/bin/")) ||
		(await checkPath(`node_modules/@vscode/ripgrep-universal/bin/${universalBinSubdir}/`)) ||
		(await checkPath(`node_modules.asar.unpacked/@vscode/ripgrep-universal/bin/${universalBinSubdir}/`))
	)
}

async function execRipgrep(bin: string, args: string[]): Promise<string> {
	return new Promise((resolve, reject) => {
		const rgProcess = childProcess.spawn(bin, args)
		// cross-platform alternative to head, which is ripgrep author's recommendation for limiting output.
		const rl = readline.createInterface({
			input: rgProcess.stdout,
			crlfDelay: Infinity, // treat \r\n as a single line break even if it's split across chunks. This ensures consistent behavior across different operating systems.
		})

		let output = ""
		let lineCount = 0
		const maxLines = MAX_RESULTS * 5 // limiting ripgrep output with max lines since there's no other way to limit results. it's okay that we're outputting as json, since we're parsing it line by line and ignore anything that's not part of a match. This assumes each result is at most 5 lines.

		rl.on("line", (line) => {
			if (lineCount < maxLines) {
				output += line + "\n"
				lineCount++
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
			if (errorOutput) {
				reject(new Error(`ripgrep process error: ${errorOutput}`))
			} else {
				resolve(output)
			}
		})
		rgProcess.on("error", (error) => {
			reject(new Error(`ripgrep process error: ${error.message}`))
		})
	})
}

export async function regexSearchFiles(
	cwd: string,
	directoryPath: string,
	regex: string,
	filePattern?: string,
	rooIgnoreController?: RooIgnoreController,
): Promise<string> {
	const vscodeAppRoot = vscode.env.appRoot
	const rgPath = await getBinPath(vscodeAppRoot)

	if (!rgPath) {
		throw new Error("Could not find ripgrep binary")
	}

	// Normalize file pattern to proper glob format
	// Convert .ext to *.ext, but preserve existing globs like *.ts or **/*.ts
	const normalizedFilePattern = filePattern
		? filePattern.startsWith(".") && !filePattern.includes("*")
			? `*${filePattern}`
			: filePattern
		: "*"

	const args = [
		"--json",
		"-e",
		regex,
		"--glob",
		normalizedFilePattern,
		"--context",
		"1",
		"--no-messages",
		directoryPath,
	]

	let output: string
	try {
		output = await execRipgrep(rgPath, args)
	} catch (error) {
		console.error("Error executing ripgrep:", error)
		return "No results found"
	}

	const results: SearchFileResult[] = []
	let currentFile: SearchFileResult | null = null

	output.split("\n").forEach((line) => {
		if (line) {
			try {
				const parsed = JSON.parse(line)
				if (parsed.type === "begin") {
					currentFile = {
						file: parsed.data.path.text.toString(),
						searchResults: [],
					}
				} else if (parsed.type === "end") {
					// Reset the current result when a new file is encountered
					results.push(currentFile as SearchFileResult)
					currentFile = null
				} else if ((parsed.type === "match" || parsed.type === "context") && currentFile) {
					const line = {
						line: parsed.data.line_number,
						text: truncateLine(parsed.data.lines.text),
						isMatch: parsed.type === "match",
						...(parsed.type === "match" && { column: parsed.data.absolute_offset }),
					}

					const lastResult = currentFile.searchResults[currentFile.searchResults.length - 1]
					if (lastResult?.lines.length > 0) {
						const lastLine = lastResult.lines[lastResult.lines.length - 1]

						// If this line is contiguous with the last result, add to it
						if (parsed.data.line_number <= lastLine.line + 1) {
							lastResult.lines.push(line)
						} else {
							// Otherwise create a new result
							currentFile.searchResults.push({
								lines: [line],
							})
						}
					} else {
						// First line in file
						currentFile.searchResults.push({
							lines: [line],
						})
					}
				}
			} catch (error) {
				console.error("Error parsing ripgrep output:", error)
			}
		}
	})

	// console.log(results)

	// Filter results using RooIgnoreController if provided
	const filteredResults = rooIgnoreController
		? results.filter((result) => rooIgnoreController.validateAccess(result.file))
		: results

	return formatResults(filteredResults, cwd)
}

function formatResults(fileResults: SearchFileResult[], cwd: string): string {
	const groupedResults: { [key: string]: SearchResult[] } = {}

	let totalResults = fileResults.reduce((sum, file) => sum + file.searchResults.length, 0)
	let output = ""
	if (totalResults >= MAX_RESULTS) {
		output += `Showing first ${MAX_RESULTS} of ${MAX_RESULTS}+ results. Use a more specific search if necessary.\n\n`
	} else if (totalResults === 0) {
		output += `Found ${totalResults.toLocaleString()} results.\n\nNOTE: If you need to search again, try different search terms or file patterns. Repeating the same search will yield the same results.`
	} else {
		output += `Found ${totalResults === 1 ? "1 result" : `${totalResults.toLocaleString()} results`}.\n\n`
	}

	// Group results by file name
	fileResults.slice(0, MAX_RESULTS).forEach((file) => {
		const relativeFilePath = path.relative(cwd, file.file)
		if (!groupedResults[relativeFilePath]) {
			groupedResults[relativeFilePath] = []

			groupedResults[relativeFilePath].push(...file.searchResults)
		}
	})

	for (const [filePath, fileResults] of Object.entries(groupedResults)) {
		output += `# ${filePath.toPosix()}\n`

		fileResults.forEach((result) => {
			// Only show results with at least one line
			if (result.lines.length > 0) {
				// Show all lines in the result
				result.lines.forEach((line) => {
					const lineNumber = String(line.line).padStart(3, " ")
					output += `${lineNumber} | ${line.text.trimEnd()}\n`
				})
				output += "----\n"
			}
		})

		output += "\n"
	}

	return output.trim()
}

function jsonPathText(pathData: { text?: string } | undefined): string | undefined {
	return pathData?.text
}

/**
 * Compact, match-counted ripgrep fallback used when FFF is unavailable. Unlike
 * the legacy formatter above, this parses JSON as it streams, applies
 * .orbitalignore before consuming the page budget, and stops at the requested
 * number of accepted matches.
 */
export async function searchFilesWithRipgrep(
	cwd: string,
	directoryPath: string,
	regex: string,
	filePattern?: string,
	rooIgnoreController?: RooIgnoreController,
	options: SearchFilesOptions = {},
): Promise<SearchPage> {
	const normalizedOptions = clampSearchOptions(options)
	const offset = normalizedOptions.cursor?.engine === "ripgrep" ? normalizedOptions.cursor.offset : 0
	const vscodeAppRoot = vscode.env.appRoot
	const rgPath = await getBinPath(vscodeAppRoot)

	if (!rgPath) {
		throw new Error("Could not find ripgrep binary")
	}

	const normalizedFilePattern = filePattern
		? filePattern.startsWith(".") && !filePattern.includes("*")
			? `*${filePattern}`
			: filePattern
		: "*"
	const args = [
		"--json",
		"-e",
		regex,
		"--glob",
		normalizedFilePattern,
		"--context",
		String(normalizedOptions.contextLines),
		"--no-messages",
		directoryPath,
	]

	return new Promise<SearchPage>((resolve, reject) => {
		const rgProcess = childProcess.spawn(rgPath, args, { windowsHide: true })
		const rl = readline.createInterface({ input: rgProcess.stdout, crlfDelay: Infinity })
		const matches: SearchMatch[] = []
		let currentFile: string | undefined
		let currentFileAllowed = true
		let matchesSeenInCurrentFile = 0
		let recentContext: SearchContextLine[] = []
		let lastAcceptedMatch: SearchMatch | undefined
		let acceptedSeen = 0
		let limitReached = false
		let intentionallyKilled = false
		let settled = false
		let stderr = ""

		const killAtLimit = () => {
			if (!intentionallyKilled) {
				intentionallyKilled = true
				rl.close()
				rgProcess.kill()
			}
		}

		rgProcess.stderr.on("data", (data) => {
			stderr += data.toString()
		})

		rl.on("line", (rawLine) => {
			if (!rawLine || intentionallyKilled) {
				return
			}

			let parsed: any
			try {
				parsed = JSON.parse(rawLine)
			} catch {
				return
			}

			if (parsed.type === "begin") {
				currentFile = jsonPathText(parsed.data?.path)
				currentFileAllowed = currentFile
					? !rooIgnoreController || rooIgnoreController.validateAccess(currentFile)
					: false
				recentContext = []
				matchesSeenInCurrentFile = 0
				lastAcceptedMatch = undefined
				return
			}

			if (parsed.type === "end") {
				if (limitReached) {
					killAtLimit()
				}
				currentFile = undefined
				recentContext = []
				matchesSeenInCurrentFile = 0
				lastAcceptedMatch = undefined
				return
			}

			if (!currentFile || !currentFileAllowed || (parsed.type !== "match" && parsed.type !== "context")) {
				return
			}

			const lineNumber = Number(parsed.data?.line_number)
			const text = String(parsed.data?.lines?.text ?? "").replace(/[\r\n]+$/g, "")
			if (!Number.isFinite(lineNumber)) {
				return
			}

			if (parsed.type === "context") {
				const contextLine = { line: lineNumber, text }
				if (lastAcceptedMatch && lineNumber > lastAcceptedMatch.line) {
					lastAcceptedMatch.contextAfter ??= []
					if (lastAcceptedMatch.contextAfter.length < normalizedOptions.contextLines) {
						lastAcceptedMatch.contextAfter.push(contextLine)
					}
				}
				recentContext.push(contextLine)
				if (recentContext.length > normalizedOptions.contextLines) {
					recentContext.shift()
				}
				if (
					limitReached &&
					(!lastAcceptedMatch ||
						(lastAcceptedMatch.contextAfter?.length ?? 0) >= normalizedOptions.contextLines)
				) {
					killAtLimit()
				}
				return
			}

			acceptedSeen++
			matchesSeenInCurrentFile++
			if (acceptedSeen <= offset) {
				return
			}
			if (matchesSeenInCurrentFile > MAX_MATCHES_PER_FILE) {
				return
			}
			if (matches.length >= normalizedOptions.maxResults) {
				killAtLimit()
				return
			}

			const column = Number(parsed.data?.submatches?.[0]?.start ?? 0) + 1
			const match: SearchMatch = {
				file: path.relative(cwd, currentFile),
				line: lineNumber,
				column,
				text,
				contextBefore: recentContext.filter((line) => line.line < lineNumber),
			}
			matches.push(match)
			lastAcceptedMatch = match

			if (matches.length >= normalizedOptions.maxResults) {
				limitReached = true
				if (normalizedOptions.contextLines === 0) {
					killAtLimit()
				}
			}
		})

		rgProcess.on("error", (error) => {
			if (!settled) {
				settled = true
				reject(new Error(`ripgrep process error: ${error.message}`))
			}
		})

		rgProcess.on("close", (code) => {
			if (settled) {
				return
			}
			settled = true
			if (!intentionallyKilled && code !== 0 && code !== 1) {
				reject(new Error(`ripgrep process error: ${stderr.trim() || `exit code ${code}`}`))
				return
			}

			resolve({
				engine: "ripgrep",
				matches,
				nextCursor: limitReached ? { engine: "ripgrep", offset: acceptedSeen } : null,
			})
		})
	})
}
