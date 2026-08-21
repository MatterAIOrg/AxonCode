import type { RooIgnoreController } from "../../core/ignore/RooIgnoreController"
import { searchFilesWithFff } from "../fff"
import { searchFilesWithRipgrep } from "../ripgrep"
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

	if (options.cursor?.engine === "ripgrep") {
		page = await searchFilesWithRipgrep(cwd, directoryPath, regex, filePattern, rooIgnoreController, options)
		return { text: formatSearchPage(page), matchCount: page.matches.length }
	}

	try {
		page = await searchFilesWithFff(cwd, directoryPath, regex, filePattern, rooIgnoreController, options)
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error)
		console.warn(`[search_files] FFF failed, falling back to ripgrep: ${message}`)
		page = await searchFilesWithRipgrep(cwd, directoryPath, regex, filePattern, rooIgnoreController, {
			...options,
			cursor: null,
		})
		page.warning = `FFF failed; used ripgrep fallback (${message})`
	}

	return { text: formatSearchPage(page), matchCount: page.matches.length }
}

export * from "./format"
export * from "./types"
