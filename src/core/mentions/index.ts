import fs from "fs/promises"
import * as path from "path"

import * as vscode from "vscode"
import { isBinaryFile } from "isbinaryfile"

import { mentionRegexGlobal, commandRegexGlobal, unescapeSpaces } from "../../shared/context-mentions"

import { getCommitInfo, getWorkingState } from "../../utils/git"

import { openFile } from "../../integrations/misc/open-file"
import { extractTextFromFile } from "../../integrations/misc/extract-text"
import { diagnosticsToProblemsString } from "../../integrations/diagnostics"

import { UrlContentFetcher } from "../../services/browser/UrlContentFetcher"

import { FileContextTracker } from "../context-tracking/FileContextTracker"

import { RooIgnoreController } from "../ignore/RooIgnoreController"
import { getCommand, type Command } from "../../services/command/commands"

import { t } from "../../i18n"
import { isSupportedImageFormat } from "../tools/helpers/imageHelpers" // kilocode_change

export const MAX_MENTION_EXPANSION_CHARACTERS = 500_000
export const MAX_MENTION_FILE_CHARACTERS = 200_000
export const MAX_MENTION_FILE_LINES = 10_000
export const MAX_MENTION_ITEMS = 100
const MAX_MENTION_FOLDER_ENTRIES = 2_000
const MAX_MENTION_FOLDER_FILE_CONTENTS = 50
const MENTION_TRUNCATION_MARKER = "\n[...mention content truncated...]\n"
const MENTION_BUDGET_EXHAUSTED =
	"[Additional mention content was omitted because the per-message mention context limit was reached.]"

function getUrlErrorMessage(error: unknown): string {
	const errorMessage = error instanceof Error ? error.message : String(error)

	// Check for common error patterns and return appropriate message
	if (errorMessage.includes("timeout")) {
		return t("common:errors.url_timeout")
	}
	if (errorMessage.includes("net::ERR_NAME_NOT_RESOLVED")) {
		return t("common:errors.url_not_found")
	}
	if (errorMessage.includes("net::ERR_INTERNET_DISCONNECTED")) {
		return t("common:errors.no_internet")
	}
	if (errorMessage.includes("net::ERR_ABORTED")) {
		return t("common:errors.url_request_aborted")
	}
	if (errorMessage.includes("403") || errorMessage.includes("Forbidden")) {
		return t("common:errors.url_forbidden")
	}
	if (errorMessage.includes("404") || errorMessage.includes("Not Found")) {
		return t("common:errors.url_page_not_found")
	}

	// Default error message
	return t("common:errors.url_fetch_failed", { error: errorMessage })
}

export async function openMention(cwd: string, mention?: string): Promise<void> {
	if (!mention) {
		return
	}

	if (mention.startsWith("/")) {
		// Slice off the leading slash and unescape any spaces in the path
		const relPath = unescapeSpaces(mention.slice(1))
		const absPath = path.resolve(cwd, relPath)
		if (mention.endsWith("/")) {
			vscode.commands.executeCommand("revealInExplorer", vscode.Uri.file(absPath))
		} else {
			openFile(absPath)
		}
	} else if (mention === "problems") {
		vscode.commands.executeCommand("workbench.actions.view.problems")
	} else if (mention === "terminal") {
		vscode.commands.executeCommand("workbench.action.terminal.focus")
	} else if (mention.startsWith("http")) {
		vscode.env.openExternal(vscode.Uri.parse(mention))
	}
}

export async function parseMentions(
	text: string,
	cwd: string,
	urlContentFetcher: UrlContentFetcher,
	fileContextTracker?: FileContextTracker,
	rooIgnoreController?: RooIgnoreController,
	showRooIgnoredFiles: boolean = false,
	includeDiagnosticMessages: boolean = true,
	maxDiagnosticMessages: number = 50,
	maxReadFileLine?: number,
): Promise<string> {
	const mentions: Set<string> = new Set()
	const validCommands: Map<string, Command> = new Map()
	let parsedText = text
	let remainingExpansionCharacters = MAX_MENTION_EXPANSION_CHARACTERS
	let didAppendBudgetExhaustedNotice = false

	const appendMentionContext = (openingTag: string, content: string, closingTag: string) => {
		if (remainingExpansionCharacters <= 0) {
			if (!didAppendBudgetExhaustedNotice) {
				parsedText += `\n\n${MENTION_BUDGET_EXHAUSTED}`
				didAppendBudgetExhaustedNotice = true
			}
			return
		}

		const fittedContent = truncateMentionContent(content, remainingExpansionCharacters)
		parsedText += `\n\n${openingTag}\n${fittedContent}\n${closingTag}`
		remainingExpansionCharacters -= fittedContent.length
	}

	// First pass: check which command mentions exist and cache the results
	const commandMatches = Array.from(text.matchAll(commandRegexGlobal))
	const uniqueCommandNames = new Set(commandMatches.map(([, commandName]) => commandName).slice(0, MAX_MENTION_ITEMS))

	const commandExistenceChecks = await Promise.all(
		Array.from(uniqueCommandNames).map(async (commandName) => {
			try {
				const command = await getCommand(cwd, commandName)
				return { commandName, command }
			} catch (error) {
				// If there's an error checking command existence, treat it as non-existent
				return { commandName, command: undefined }
			}
		}),
	)

	// Store valid commands for later use
	for (const { commandName, command } of commandExistenceChecks) {
		if (command) {
			validCommands.set(commandName, command)
		}
	}

	// Only replace text for commands that actually exist
	for (const [match, commandName] of commandMatches) {
		if (validCommands.has(commandName)) {
			parsedText = parsedText.replace(match, `Command '${commandName}' (see below for command content)`)
		}
	}

	// Second pass: handle regular mentions
	parsedText = parsedText.replace(mentionRegexGlobal, (match, mention) => {
		if (mentions.size < MAX_MENTION_ITEMS) {
			mentions.add(mention)
		}
		if (mention.startsWith("http")) {
			return `'${mention}' (see below for site content)`
		} else if (mention.startsWith("/")) {
			const mentionPath = mention.slice(1)
			return mentionPath.endsWith("/")
				? `'${mentionPath}' (see below for folder content)`
				: `'${mentionPath}' (see below for file content)`
		} else if (mention === "problems") {
			return `Workspace Problems (see below for diagnostics)`
		} else if (mention === "git-changes") {
			return `Working directory changes (see below for details)`
		} else if (/^[a-f0-9]{7,40}$/.test(mention)) {
			return `Git commit '${mention}' (see below for commit info)`
		} else if (mention === "terminal") {
			return `Terminal Output (see below for output)`
		}
		return match
	})

	const urlMention = Array.from(mentions).find((mention) => mention.startsWith("http"))
	let launchBrowserError: Error | undefined
	if (urlMention) {
		try {
			await urlContentFetcher.launchBrowser()
		} catch (error) {
			launchBrowserError = error
			const errorMessage = error instanceof Error ? error.message : String(error)
			vscode.window.showErrorMessage(`Error fetching content for ${urlMention}: ${errorMessage}`)
		}
	}

	for (const mention of mentions) {
		if (mention.startsWith("http")) {
			let result: string
			if (launchBrowserError) {
				const errorMessage =
					launchBrowserError instanceof Error ? launchBrowserError.message : String(launchBrowserError)
				result = `Error fetching content: ${errorMessage}`
			} else {
				try {
					const markdown = await urlContentFetcher.urlToMarkdown(mention)
					result = markdown
				} catch (error) {
					console.error(`Error fetching URL ${mention}:`, error)

					// Get raw error message for AI
					const rawErrorMessage = error instanceof Error ? error.message : String(error)

					// Get localized error message for UI notification
					const localizedErrorMessage = getUrlErrorMessage(error)

					vscode.window.showErrorMessage(
						t("common:errors.url_fetch_error_with_url", { url: mention, error: localizedErrorMessage }),
					)

					// Send raw error message to AI model
					result = `Error fetching content: ${rawErrorMessage}`
				}
			}
			appendMentionContext(`<url_content url="${mention}">`, result, "</url_content>")
		} else if (mention.startsWith("/")) {
			const mentionPath = mention.slice(1)
			try {
				const content = await getFileOrFolderContent(
					mentionPath,
					cwd,
					rooIgnoreController,
					showRooIgnoredFiles,
					maxReadFileLine,
				)
				if (mention.endsWith("/")) {
					appendMentionContext(`<folder_content path="${mentionPath}">`, content, "</folder_content>")
				} else {
					appendMentionContext(`<file_content path="${mentionPath}">`, content, "</file_content>")
					if (fileContextTracker) {
						await fileContextTracker.trackFileContext(mentionPath, "file_mentioned")
					}
				}
			} catch (error) {
				if (mention.endsWith("/")) {
					appendMentionContext(
						`<folder_content path="${mentionPath}">`,
						`Error fetching content: ${error.message}`,
						"</folder_content>",
					)
				} else {
					appendMentionContext(
						`<file_content path="${mentionPath}">`,
						`Error fetching content: ${error.message}`,
						"</file_content>",
					)
				}
			}
		} else if (mention === "problems") {
			try {
				const problems = await getWorkspaceProblems(cwd, includeDiagnosticMessages, maxDiagnosticMessages)
				appendMentionContext("<workspace_diagnostics>", problems, "</workspace_diagnostics>")
			} catch (error) {
				appendMentionContext(
					"<workspace_diagnostics>",
					`Error fetching diagnostics: ${error.message}`,
					"</workspace_diagnostics>",
				)
			}
		} else if (mention === "git-changes") {
			try {
				const workingState = await getWorkingState(cwd)
				appendMentionContext("<git_working_state>", workingState, "</git_working_state>")
			} catch (error) {
				appendMentionContext(
					"<git_working_state>",
					`Error fetching working state: ${error.message}`,
					"</git_working_state>",
				)
			}
		} else if (/^[a-f0-9]{7,40}$/.test(mention)) {
			try {
				const commitInfo = await getCommitInfo(mention, cwd)
				appendMentionContext(`<git_commit hash="${mention}">`, commitInfo, "</git_commit>")
			} catch (error) {
				appendMentionContext(
					`<git_commit hash="${mention}">`,
					`Error fetching commit info: ${error.message}`,
					"</git_commit>",
				)
			}
		} else if (mention === "terminal") {
			try {
				const terminalOutput = await getLatestTerminalOutput()
				appendMentionContext("<terminal_output>", terminalOutput, "</terminal_output>")
			} catch (error) {
				appendMentionContext(
					"<terminal_output>",
					`Error fetching terminal output: ${error.message}`,
					"</terminal_output>",
				)
			}
		}
	}

	// Process valid command mentions using cached results
	for (const [commandName, command] of validCommands) {
		try {
			let commandOutput = ""
			if (command.description) {
				commandOutput += `Description: ${command.description}\n\n`
			}
			commandOutput += command.content
			appendMentionContext(`<command name="${commandName}">`, commandOutput, "</command>")
		} catch (error) {
			appendMentionContext(
				`<command name="${commandName}">`,
				`Error loading command '${commandName}': ${error.message}`,
				"</command>",
			)
		}
	}

	if (urlMention) {
		try {
			await urlContentFetcher.closeBrowser()
		} catch (error) {
			console.error(`Error closing browser: ${error.message}`)
		}
	}

	return parsedText
}

async function getFileOrFolderContent(
	mentionPath: string,
	cwd: string,
	rooIgnoreController?: any,
	showRooIgnoredFiles: boolean = false,
	maxReadFileLine?: number,
): Promise<string> {
	// Parse line numbers from the mention path (e.g., "file.ts#L20-80")
	const lineMatch = mentionPath.match(/^(.*?)(?:#L(\d+)(?:-(\d+))?)?$/)
	let filePath = mentionPath
	let startLine: number | undefined
	let endLine: number | undefined

	if (lineMatch) {
		filePath = lineMatch[1]
		if (lineMatch[2]) {
			startLine = parseInt(lineMatch[2], 10)
			endLine = lineMatch[3] ? parseInt(lineMatch[3], 10) : startLine
		}
	}

	const unescapedPath = unescapeSpaces(filePath)
	const absPath = path.resolve(cwd, unescapedPath)

	try {
		const stats = await fs.stat(absPath)

		if (stats.isFile()) {
			if (rooIgnoreController && !rooIgnoreController.validateAccess(absPath)) {
				return `(File ${mentionPath} is ignored by .orbitalignore)`
			}
			// forked_change start
			if (isSupportedImageFormat(path.extname(absPath))) {
				return `(Image of size ${stats.size} bytes, the read_file tool may be able to read it)`
			}
			// forked_change end
			try {
				const content = await extractTextFromFile(absPath, getMentionReadLineLimit(maxReadFileLine))

				// Extract specific lines if line numbers are specified
				if (startLine !== undefined && endLine !== undefined) {
					const lines = content.split("\n")
					// Convert to 0-based index
					const startIndex = Math.max(0, startLine - 1)
					const endIndex = Math.min(lines.length, endLine)
					const extractedLines = lines.slice(startIndex, endIndex)
					return truncateMentionContent(extractedLines.join("\n"), MAX_MENTION_FILE_CHARACTERS)
				}

				return truncateMentionContent(content, MAX_MENTION_FILE_CHARACTERS)
			} catch (error) {
				return `(Failed to read contents of ${filePath}): ${error.message}`
			}
		} else if (stats.isDirectory()) {
			const allEntries = await fs.readdir(absPath, { withFileTypes: true })
			const entries = allEntries.slice(0, MAX_MENTION_FOLDER_ENTRIES)
			let folderContent = ""
			const fileContentPromises: Promise<string | undefined>[] = []
			const LOCK_SYMBOL = "🔒"
			let includedFileContents = 0

			for (let index = 0; index < entries.length; index++) {
				const entry = entries[index]
				const isLast = index === entries.length - 1
				const linePrefix = isLast ? "└── " : "├── "
				const entryPath = path.join(absPath, entry.name)

				let isIgnored = false
				if (rooIgnoreController) {
					isIgnored = !rooIgnoreController.validateAccess(entryPath)
				}

				if (isIgnored && !showRooIgnoredFiles) {
					continue
				}

				const displayName = isIgnored ? `${LOCK_SYMBOL} ${entry.name}` : entry.name

				if (entry.isFile()) {
					folderContent += `${linePrefix}${displayName}\n`
					if (!isIgnored && includedFileContents < MAX_MENTION_FOLDER_FILE_CONTENTS) {
						includedFileContents++
						const filePath = path.join(mentionPath, entry.name)
						const absoluteFilePath = path.resolve(absPath, entry.name)
						fileContentPromises.push(
							(async () => {
								try {
									const isBinary = await isBinaryFile(absoluteFilePath).catch(() => false)
									if (isBinary) {
										return undefined
									}
									const content = await extractTextFromFile(
										absoluteFilePath,
										getMentionReadLineLimit(maxReadFileLine),
									)
									return `<file_content path="${filePath.toPosix()}">\n${truncateMentionContent(
										content,
										MAX_MENTION_FILE_CHARACTERS,
									)}\n</file_content>`
								} catch (error) {
									return undefined
								}
							})(),
						)
					}
				} else if (entry.isDirectory()) {
					folderContent += `${linePrefix}${displayName}/\n`
				} else {
					folderContent += `${linePrefix}${displayName}\n`
				}
			}
			if (allEntries.length > entries.length) {
				folderContent += `[...${allEntries.length - entries.length} additional folder entries omitted...]\n`
			}
			if (includedFileContents >= MAX_MENTION_FOLDER_FILE_CONTENTS) {
				folderContent += `[Additional file contents omitted after ${MAX_MENTION_FOLDER_FILE_CONTENTS} files.]\n`
			}
			const fileContents = (await Promise.all(fileContentPromises)).filter((content) => content)
			return truncateMentionContent(
				`${folderContent}\n${fileContents.join("\n\n")}`.trim(),
				MAX_MENTION_EXPANSION_CHARACTERS,
			)
		} else {
			return `(Failed to read contents of ${filePath})`
		}
	} catch (error) {
		throw new Error(`Failed to access path "${filePath}": ${error.message}`)
	}
}

function getMentionReadLineLimit(maxReadFileLine?: number): number {
	if (typeof maxReadFileLine === "number" && Number.isInteger(maxReadFileLine) && maxReadFileLine > 0) {
		return Math.min(maxReadFileLine, MAX_MENTION_FILE_LINES)
	}

	// File mentions are prompt expansion, so an "unlimited" read setting must
	// still have a context-safe ingestion ceiling. The read_file tool remains the
	// paginated path for content beyond this point.
	return MAX_MENTION_FILE_LINES
}

export function truncateMentionContent(content: string, maxCharacters: number): string {
	if (content.length <= maxCharacters) {
		return content
	}
	if (maxCharacters <= MENTION_TRUNCATION_MARKER.length) {
		return MENTION_TRUNCATION_MARKER.slice(0, Math.max(0, maxCharacters))
	}

	const available = maxCharacters - MENTION_TRUNCATION_MARKER.length
	const headLength = Math.floor(available * 0.35)
	const tailLength = available - headLength
	return `${content.slice(0, headLength)}${MENTION_TRUNCATION_MARKER}${content.slice(content.length - tailLength)}`
}

async function getWorkspaceProblems(
	cwd: string,
	includeDiagnosticMessages: boolean = true,
	maxDiagnosticMessages: number = 50,
): Promise<string> {
	const diagnostics = vscode.languages.getDiagnostics()
	const result = await diagnosticsToProblemsString(
		diagnostics,
		[vscode.DiagnosticSeverity.Error, vscode.DiagnosticSeverity.Warning],
		cwd,
		includeDiagnosticMessages,
		maxDiagnosticMessages,
	)
	if (!result) {
		return "No errors or warnings detected."
	}
	return result
}

/**
 * Gets the contents of the active terminal
 * @returns The terminal contents as a string
 */
export async function getLatestTerminalOutput(): Promise<string> {
	// Store original clipboard content to restore later
	const originalClipboard = await vscode.env.clipboard.readText()

	try {
		// Select terminal content
		await vscode.commands.executeCommand("workbench.action.terminal.selectAll")

		// Copy selection to clipboard
		await vscode.commands.executeCommand("workbench.action.terminal.copySelection")

		// Clear the selection
		await vscode.commands.executeCommand("workbench.action.terminal.clearSelection")

		// Get terminal contents from clipboard
		let terminalContents = (await vscode.env.clipboard.readText()).trim()

		// Check if there's actually a terminal open
		if (terminalContents === originalClipboard) {
			return ""
		}

		// Clean up command separation
		const lines = terminalContents.split("\n")
		const lastLine = lines.pop()?.trim()

		if (lastLine) {
			let i = lines.length - 1

			while (i >= 0 && !lines[i].trim().startsWith(lastLine)) {
				i--
			}

			terminalContents = lines.slice(Math.max(i, 0)).join("\n")
		}

		return terminalContents
	} finally {
		// Restore original clipboard content
		await vscode.env.clipboard.writeText(originalClipboard)
	}
}

// Export processUserContentMentions from its own file
export { processUserContentMentions } from "./processUserContentMentions"
