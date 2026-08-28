import type { RooIgnoreController } from "../../core/ignore/RooIgnoreController"
import { searchFilesWithRipgrep } from "../ripgrep"
import { searchFilesWithFff } from "../fff"
import { formatSearchPage } from "./format"
import { SearchFilesOptions, SearchPage } from "./types"

export interface SearchFilesResult {
	text: string
	matchCount: number
}

export async function searchFiles(
	cwd: string,
	directoryPath: string,
	regex: string,
	filePattern?: string,
	rooIgnoreController?: RooIgnoreController,
	options: SearchFilesOptions = {},
): Promise<SearchFilesResult> {
	let page: SearchPage

	if (options.cursor?.engine === "fff") {
		page = await searchFilesWithFff(cwd, directoryPath, regex, filePattern, rooIgnoreController, options)
		return { text: formatSearchPage(page), matchCount: page.matches.length }
	}

	try {
		// Ripgrep is the fast, deterministic default used by coding agents. FFF
		// remains available as a fallback for installations where the bundled
		// ripgrep binary is unavailable or cannot execute the requested pattern.
		page = await searchFilesWithRipgrep(cwd, directoryPath, regex, filePattern, rooIgnoreController, options)
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error)
		console.warn(`[search_files] ripgrep failed, falling back to FFF: ${message}`)
		page = await searchFilesWithFff(cwd, directoryPath, regex, filePattern, rooIgnoreController, {
			...options,
			cursor: null,
		})
		page.warning = `ripgrep failed; used FFF fallback (${message})`
	}

	return { text: formatSearchPage(page), matchCount: page.matches.length }
}

export * from "./format"
export * from "./types"
