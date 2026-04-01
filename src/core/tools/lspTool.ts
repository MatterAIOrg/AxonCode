import * as vscode from "vscode"
import path from "path"
import { Task } from "../task/Task"
import { ToolUse, AskApproval, HandleError, PushToolResult, RemoveClosingTag } from "../../shared/tools"
import { fileExistsAtPath } from "../../utils/fs"
import { ClineSayTool } from "../../shared/ExtensionMessage"
import { getReadablePath } from "../../utils/path"

export async function lspTool(
	cline: Task,
	block: ToolUse,
	askApproval: AskApproval,
	_handleError: HandleError,
	pushToolResult: PushToolResult,
	removeClosingTag: RemoveClosingTag,
) {
	const operation: string = block.params.operation ?? ""
	const filePath: string = block.params.file_path ?? ""
	const line: number = parseInt(block.params.line ?? "1", 10)
	const character: number = parseInt(block.params.character ?? "1", 10)

	const sharedMessageProps: ClineSayTool = {
		tool: "lsp",
		operation: removeClosingTag("operation", operation),
		path: getReadablePath(cline.cwd, removeClosingTag("file_path", filePath)),
		line,
		character,
	}

	try {
		// Validate inputs
		if (!operation) {
			pushToolResult("Error: operation parameter is required")
			return
		}

		if (!filePath) {
			pushToolResult("Error: file_path parameter is required")
			return
		}

		// Convert to 0-based indexing for VSCode
		const zeroBasedLine = Math.max(0, line - 1)
		const zeroBasedChar = Math.max(0, character - 1)

		// Check if file exists
		const absolutePath = path.isAbsolute(filePath) ? filePath : path.resolve(cline.cwd, filePath)
		if (!(await fileExistsAtPath(absolutePath))) {
			pushToolResult(`Error: File not found at ${absolutePath}`)
			return
		}

		const uri = vscode.Uri.file(absolutePath)
		const position = new vscode.Position(zeroBasedLine, zeroBasedChar)

		let result: string

		switch (operation) {
			case "go_to_definition": {
				const definitions = await vscode.commands.executeCommand<vscode.LocationLink[]>(
					"vscode.executeDefinitionProvider",
					uri,
					position,
				)
				if (!definitions || definitions.length === 0) {
					result = "No definition found for the symbol at the specified position."
				} else {
					result = formatLocations(definitions, "Definition")
				}
				break
			}

			case "find_references": {
				const references = await vscode.commands.executeCommand<vscode.Location[]>(
					"vscode.executeReferenceProvider",
					uri,
					position,
				)
				if (!references || references.length === 0) {
					result = "No references found for the symbol at the specified position."
				} else {
					result = formatLocations(references, "Reference")
				}
				break
			}

			case "hover": {
				const hovers = await vscode.commands.executeCommand<vscode.Hover[]>(
					"vscode.executeHoverProvider",
					uri,
					position,
				)
				if (!hovers || hovers.length === 0) {
					result = "No hover information available for the symbol at the specified position."
				} else {
					result = formatHovers(hovers)
				}
				break
			}

			case "document_symbol": {
				const symbols = await vscode.commands.executeCommand<vscode.DocumentSymbol[]>(
					"vscode.executeDocumentSymbolProvider",
					uri,
				)
				if (!symbols || symbols.length === 0) {
					result = "No symbols found in the document."
				} else {
					result = formatDocumentSymbols(symbols, absolutePath)
				}
				break
			}

			case "workspace_symbol": {
				// For workspace symbol, we need a query - use the word at position
				const document = await vscode.workspace.openTextDocument(uri)
				const wordRange = document.getWordRangeAtPosition(position)
				const query = wordRange ? document.getText(wordRange) : ""

				if (!query) {
					result = "No symbol name found at the specified position to search for."
					break
				}

				const symbols = await vscode.commands.executeCommand<vscode.SymbolInformation[]>(
					"vscode.executeWorkspaceSymbolProvider",
					query,
				)
				if (!symbols || symbols.length === 0) {
					result = `No workspace symbols found matching "${query}".`
				} else {
					result = formatWorkspaceSymbols(symbols, query)
				}
				break
			}

			default:
				result = `Error: Unknown operation "${operation}". Supported operations: go_to_definition, find_references, hover, document_symbol, workspace_symbol`
		}

		const completeMessage = JSON.stringify({ ...sharedMessageProps, content: result } satisfies ClineSayTool)
		const didApprove = await askApproval("tool", completeMessage)

		if (!didApprove) {
			return
		}

		pushToolResult(result)
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error)
		pushToolResult(`Error executing LSP operation: ${errorMessage}`)
	}
}

function formatLocations(locations: (vscode.Location | vscode.LocationLink)[], type: string): string {
	const formatted = locations.map((loc, index) => {
		let uri: vscode.Uri
		let range: vscode.Range

		if ("targetUri" in loc) {
			// LocationLink
			uri = loc.targetUri
			range = loc.targetRange
		} else {
			// Location
			uri = loc.uri
			range = loc.range
		}

		const startLine = range.start.line + 1 // Convert to 1-based
		const startChar = range.start.character + 1
		const endLine = range.end.line + 1
		const endChar = range.end.character + 1

		return `${index + 1}. ${type}: ${uri.fsPath}\n   Range: Line ${startLine}, Char ${startChar} - Line ${endLine}, Char ${endChar}`
	})

	return formatted.join("\n\n")
}

function formatHovers(hovers: vscode.Hover[]): string {
	return hovers
		.map((hover, index) => {
			const contents = hover.contents
				.map((content) => {
					if (typeof content === "string") {
						return content
					} else if ("value" in content) {
						return content.value
					}
					return ""
				})
				.join("\n")

			return `${index + 1}. Hover Information:\n${contents}`
		})
		.join("\n\n")
}

function formatDocumentSymbols(symbols: vscode.DocumentSymbol[], filePath: string, indent = 0): string {
	const lines: string[] = []

	for (const symbol of symbols) {
		const kind = vscode.SymbolKind[symbol.kind]
		const startLine = symbol.range.start.line + 1
		const name = "  ".repeat(indent) + `${symbol.name} (${kind}) - Line ${startLine}`
		lines.push(name)

		if (symbol.children && symbol.children.length > 0) {
			lines.push(formatDocumentSymbols(symbol.children, filePath, indent + 1))
		}
	}

	return lines.join("\n")
}

function formatWorkspaceSymbols(symbols: vscode.SymbolInformation[], query: string): string {
	const formatted = symbols.map((symbol, index) => {
		const kind = vscode.SymbolKind[symbol.kind]
		const location = symbol.location
		const startLine = location.range.start.line + 1
		const container = symbol.containerName ? ` in ${symbol.containerName}` : ""

		return `${index + 1}. ${symbol.name} (${kind})${container}\n   File: ${location.uri.fsPath}\n   Line: ${startLine}`
	})

	return `Workspace symbols matching "${query}":\n\n${formatted.join("\n\n")}`
}
