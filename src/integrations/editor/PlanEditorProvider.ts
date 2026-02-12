import * as vscode from "vscode"
import * as path from "path"
import * as fs from "fs/promises"
import * as crypto from "crypto"

import { getPlanMemoryDirectoryPath } from "../../utils/storage"

export const PLAN_EDITOR_URI_SCHEME = "axon-plan"

/**
 * Text document content provider for plan files
 * This allows VS Code to resolve the content of plan files using the axon-plan URI scheme
 */
class PlanTextDocumentContentProvider implements vscode.TextDocumentContentProvider {
	async provideTextDocumentContent(uri: vscode.Uri): Promise<string> {
		try {
			console.log(`[PlanTextDocumentContentProvider] Loading file: ${uri.fsPath}`)
			// The URI path contains the full file path
			const filePath = uri.fsPath

			// Read the file content
			const content = await fs.readFile(filePath, "utf-8")
			console.log(`[PlanTextDocumentContentProvider] Successfully loaded file, content length: ${content.length}`)
			return content
		} catch (error) {
			console.error(`[PlanTextDocumentContentProvider] Failed to read plan file: ${uri.fsPath}`, error)
			return `# Error\n\nFailed to read plan file: ${error instanceof Error ? error.message : String(error)}`
		}
	}
}

export class PlanEditorProvider implements vscode.CustomTextEditorProvider {
	public static register(context: vscode.ExtensionContext): vscode.Disposable {
		const provider = new PlanEditorProvider(context)

		// Register the custom text document content provider for the URI scheme
		const contentProvider = new PlanTextDocumentContentProvider()
		context.subscriptions.push(
			vscode.workspace.registerTextDocumentContentProvider(PLAN_EDITOR_URI_SCHEME, contentProvider),
		)

		// Register the custom editor
		const registration = vscode.window.registerCustomEditorProvider(PLAN_EDITOR_URI_SCHEME, provider, {
			webviewOptions: {
				retainContextWhenHidden: true,
			},
			supportsMultipleEditorsPerDocument: false,
		})

		return registration
	}

	constructor(private readonly context: vscode.ExtensionContext) {}

	async resolveCustomTextEditor(
		document: vscode.TextDocument,
		webviewPanel: vscode.WebviewPanel,
		_token: vscode.CancellationToken,
	): Promise<void> {
		console.log(`[PlanEditorProvider] Resolving custom text editor for: ${document.uri.fsPath}`)
		webviewPanel.webview.options = {
			enableScripts: true,
			localResourceRoots: [
				vscode.Uri.joinPath(this.context.extensionUri, "dist"),
				vscode.Uri.joinPath(this.context.extensionUri, "webview-ui"),
			],
		}

		const content = document.getText()
		const filename = path.basename(document.uri.fsPath)
		console.log(`[PlanEditorProvider] Content length: ${content.length}, filename: ${filename}`)

		webviewPanel.webview.html = this.getHtmlForWebview(webviewPanel.webview, content, filename)
		console.log(`[PlanEditorProvider] Webview HTML set`)

		const updateWebview = async () => {
			const content = document.getText()
			const filename = path.basename(document.uri.fsPath)
			webviewPanel.webview.html = this.getHtmlForWebview(webviewPanel.webview, content, filename)
		}

		const changeDocumentSubscription = vscode.workspace.onDidChangeTextDocument((event) => {
			if (event.document === document) {
				updateWebview()
			}
		})

		webviewPanel.onDidDispose(() => {
			changeDocumentSubscription.dispose()
		})

		// Return to indicate the editor is ready
		return Promise.resolve()
	}

	private getHtmlForWebview(webview: vscode.Webview, content: string, filename: string): string {
		const nonce = this.getNonce()

		// Get the current VS Code theme
		const isDark = vscode.window.activeColorTheme.kind === vscode.ColorThemeKind.Dark

		// Define theme colors based on VS Code theme
		const themeColors = isDark
			? {
					background: "#1e1e1e",
					foreground: "#cccccc",
					editorBackground: "#1e1e1e",
					editorForeground: "#d4d4d4",
					border: "#3c3c3c",
					heading: "#ffffff",
					codeBackground: "#2d2d2d",
					link: "#3794ff",
					quote: "#6a9955",
					listItem: "#cccccc",
					tableBorder: "#3c3c3c",
					tableHeader: "#ffffff",
					tableRow: "#cccccc",
				}
			: {
					background: "#ffffff",
					foreground: "#333333",
					editorBackground: "#ffffff",
					editorForeground: "#333333",
					border: "#e0e0e0",
					heading: "#000000",
					codeBackground: "#f5f5f5",
					link: "#0066cc",
					quote: "#6a9955",
					listItem: "#333333",
					tableBorder: "#e0e0e0",
					tableHeader: "#000000",
					tableRow: "#333333",
				}

		return `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';">
	<title>${this.escapeHtml(filename)}</title>
	<style>
		* {
			box-sizing: border-box;
			margin: 0;
			padding: 0;
		}

		body {
			font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
			font-size: 14px;
			line-height: 1.6;
			color: ${themeColors.foreground};
			background-color: ${themeColors.background};
			padding: 20px;
			max-width: 100%;
			overflow-x: hidden;
		}

		.container {
			max-width: 1200px;
			margin: 0 auto;
		}

		h1, h2, h3, h4, h5, h6 {
			color: ${themeColors.heading};
			margin-top: 1.5em;
			margin-bottom: 0.5em;
			font-weight: 600;
			line-height: 1.3;
		}

		h1 { font-size: 2em; border-bottom: 1px solid ${themeColors.border}; padding-bottom: 0.3em; }
		h2 { font-size: 1.5em; border-bottom: 1px solid ${themeColors.border}; padding-bottom: 0.3em; }
		h3 { font-size: 1.25em; }
		h4 { font-size: 1em; }
		h5 { font-size: 0.875em; }
		h6 { font-size: 0.85em; color: ${themeColors.foreground}; }

		p {
			margin-bottom: 1em;
		}

		a {
			color: ${themeColors.link};
			text-decoration: none;
		}

		a:hover {
			text-decoration: underline;
		}

		code {
			font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
			font-size: 0.9em;
			background-color: ${themeColors.codeBackground};
			padding: 0.2em 0.4em;
			border-radius: 3px;
		}

		pre {
			background-color: ${themeColors.codeBackground};
			border: 1px solid ${themeColors.border};
			border-radius: 4px;
			padding: 1em;
			overflow-x: auto;
			margin-bottom: 1em;
		}

		pre code {
			background-color: transparent;
			padding: 0;
			border-radius: 0;
		}

		blockquote {
			border-left: 4px solid ${themeColors.quote};
			padding-left: 1em;
			margin: 1em 0;
			color: ${themeColors.quote};
		}

		ul, ol {
			margin-bottom: 1em;
			padding-left: 2em;
		}

		li {
			margin-bottom: 0.5em;
			color: ${themeColors.listItem};
		}

		ul li::marker {
			color: ${themeColors.foreground};
		}

		table {
			border-collapse: collapse;
			width: 100%;
			margin-bottom: 1em;
		}

		th, td {
			border: 1px solid ${themeColors.tableBorder};
			padding: 0.5em 1em;
			text-align: left;
		}

		th {
			background-color: ${themeColors.codeBackground};
			font-weight: 600;
			color: ${themeColors.tableHeader};
		}

		tr:nth-child(even) {
			background-color: ${themeColors.codeBackground};
		}

		hr {
			border: none;
			border-top: 1px solid ${themeColors.border};
			margin: 2em 0;
		}

		.task-list-item {
			list-style-type: none;
			margin-left: -2em;
		}

		.task-list-item input {
			margin-right: 0.5em;
		}

		/* Checkbox styling */
		input[type="checkbox"] {
			cursor: pointer;
		}

		/* Code block language indicator */
		pre[data-language]::before {
			content: attr(data-language);
			display: block;
			font-size: 0.75em;
			color: ${themeColors.foreground};
			opacity: 0.7;
			margin-bottom: 0.5em;
			font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
		}

		/* Inline code in headings */
		h1 code, h2 code, h3 code, h4 code, h5 code, h6 code {
			font-size: inherit;
		}

		/* Strong and em */
		strong {
			font-weight: 600;
		}

		em {
			font-style: italic;
		}

		/* Strikethrough */
		del {
			text-decoration: line-through;
			opacity: 0.7;
		}

		/* Images */
		img {
			max-width: 100%;
			height: auto;
		}

		/* Details/Summary */
		details {
			margin-bottom: 1em;
			padding: 0.5em;
			background-color: ${themeColors.codeBackground};
			border-radius: 4px;
		}

		summary {
			cursor: pointer;
			font-weight: 600;
		}

		summary:hover {
			opacity: 0.8;
		}
	</style>
</head>
<body>
	<div class="container">
		${this.renderMarkdown(content)}
	</div>
	<script nonce="${nonce}">
		// Listen for theme changes from VS Code
		window.addEventListener('message', event => {
			const message = event.data;
			if (message.type === 'themeChanged') {
				// Reload the page to apply new theme
				location.reload();
			}
		});

		// Notify extension that webview is ready
		const vscode = acquireVsCodeApi();
		vscode.postMessage({ type: 'ready' });
	</script>
</body>
</html>`
	}

	private renderMarkdown(markdown: string): string {
		if (!markdown) {
			return "<p>No content</p>"
		}

		// Escape HTML to prevent XSS
		let html = this.escapeHtml(markdown)

		// Simple markdown parsing
		// Note: This is a basic implementation. For production, consider using a proper markdown library

		// Code blocks (```language code ```)
		html = html.replace(/```(\w+)?\n([\s\S]*?)```/g, (match, lang, code) => {
			const language = lang || "text"
			return `<pre data-language="${language}"><code>${code}</code></pre>`
		})

		// Inline code (`code`)
		html = html.replace(/`([^`]+)`/g, "<code>$1</code>")

		// Headers
		html = html.replace(/^###### (.+)$/gm, "<h6>$1</h6>")
		html = html.replace(/^##### (.+)$/gm, "<h5>$1</h5>")
		html = html.replace(/^#### (.+)$/gm, "<h4>$1</h4>")
		html = html.replace(/^### (.+)$/gm, "<h3>$1</h3>")
		html = html.replace(/^## (.+)$/gm, "<h2>$1</h2>")
		html = html.replace(/^# (.+)$/gm, "<h1>$1</h1>")

		// Bold and Italic
		html = html.replace(/\*\*\*(.+?)\*\*\*/g, "<strong><em>$1</em></strong>")
		html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
		html = html.replace(/\*(.+?)\*/g, "<em>$1</em>")
		html = html.replace(/___(.+?)___/g, "<strong><em>$1</em></strong>")
		html = html.replace(/__(.+?)__/g, "<strong>$1</strong>")
		html = html.replace(/_(.+?)_/g, "<em>$1</em>")

		// Strikethrough
		html = html.replace(/~~(.+?)~~/g, "<del>$1</del>")

		// Blockquotes
		html = html.replace(/^> (.+)$/gm, "<blockquote>$1</blockquote>")

		// Horizontal rules
		html = html.replace(/^---$/gm, "<hr>")
		html = html.replace(/^\*\*\*$/gm, "<hr>")

		// Unordered lists
		html = this.parseLists(html)

		// Task lists
		html = html.replace(
			/^- \[x\] (.+)$/gm,
			'<li class="task-list-item"><input type="checkbox" checked disabled> $1</li>',
		)
		html = html.replace(/^- \[ \] (.+)$/gm, '<li class="task-list-item"><input type="checkbox" disabled> $1</li>')

		// Links
		html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>')

		// Images
		html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1">')

		// Line breaks
		html = html.replace(/\n\n/g, "</p><p>")
		html = html.replace(/\n/g, "<br>")

		// Wrap in paragraphs
		html = "<p>" + html + "</p>"

		// Clean up empty paragraphs
		html = html.replace(/<p><\/p>/g, "")
		html = html.replace(/<p>(<h[1-6]>)/g, "$1")
		html = html.replace(/(<\/h[1-6]>)<\/p>/g, "$1")
		html = html.replace(/<p>(<pre>)/g, "$1")
		html = html.replace(/(<\/pre>)<\/p>/g, "$1")
		html = html.replace(/<p>(<blockquote>)/g, "$1")
		html = html.replace(/(<\/blockquote>)<\/p>/g, "$1")
		html = html.replace(/<p>(<hr>)<\/p>/g, "$1")
		html = html.replace(/<p>(<ul>)/g, "$1")
		html = html.replace(/(<\/ul>)<\/p>/g, "$1")
		html = html.replace(/<p>(<ol>)/g, "$1")
		html = html.replace(/(<\/ol>)<\/p>/g, "$1")

		return html
	}

	private parseLists(html: string): string {
		const lines = html.split("\n")
		let result = []
		let inUl = false
		let inOl = false
		let ulItems: string[] = []
		let olItems: string[] = []

		for (let i = 0; i < lines.length; i++) {
			const line = lines[i]

			// Check for unordered list item
			const ulMatch = line.match(/^[\*\-] (.+)$/)
			if (ulMatch) {
				if (!inUl) {
					if (inOl) {
						result.push(`<ol>${olItems.join("")}</ol>`)
						olItems = []
						inOl = false
					}
					inUl = true
				}
				ulItems.push(`<li>${ulMatch[1]}</li>`)
				continue
			}

			// Check for ordered list item
			const olMatch = line.match(/^\d+\. (.+)$/)
			if (olMatch) {
				if (!inOl) {
					if (inUl) {
						result.push(`<ul>${ulItems.join("")}</ul>`)
						ulItems = []
						inUl = false
					}
					inOl = true
				}
				olItems.push(`<li>${olMatch[1]}</li>`)
				continue
			}

			// Close any open lists
			if (inUl) {
				result.push(`<ul>${ulItems.join("")}</ul>`)
				ulItems = []
				inUl = false
			}
			if (inOl) {
				result.push(`<ol>${olItems.join("")}</ol>`)
				olItems = []
				inOl = false
			}

			result.push(line)
		}

		// Close any remaining lists
		if (inUl) {
			result.push(`<ul>${ulItems.join("")}</ul>`)
		}
		if (inOl) {
			result.push(`<ol>${olItems.join("")}</ol>`)
		}

		return result.join("\n")
	}

	private escapeHtml(text: string): string {
		const map: Record<string, string> = {
			"&": "&amp;",
			"<": "&lt;",
			">": "&gt;",
			'"': "&quot;",
			"'": "&#039;",
		}
		return text.replace(/[&<>"']/g, (m) => map[m])
	}

	private getNonce(): string {
		return crypto.randomBytes(16).toString("hex")
	}
}

/**
 * Opens a plan file in the custom editor
 */
export async function openPlanFileInEditor(filename: string, context: vscode.ExtensionContext): Promise<void> {
	try {
		console.log(`[openPlanFileInEditor] Opening plan file: ${filename}`)
		const globalStoragePath = context.globalStorageUri.fsPath
		const basePath = await getPlanMemoryDirectoryPath(globalStoragePath, "default")

		// First try to find the file in the default location
		let filePath = path.join(basePath, filename)
		console.log(`[openPlanFileInEditor] Trying default path: ${filePath}`)

		// Check if file exists
		try {
			await fs.access(filePath)
			console.log(`[openPlanFileInEditor] File found at default path`)
		} catch {
			// If not found, search in all task directories
			const planMemoryBase = path.join(globalStoragePath, "plan-memory")
			console.log(`[openPlanFileInEditor] File not found, searching in: ${planMemoryBase}`)
			try {
				const taskDirs = await fs.readdir(planMemoryBase, { withFileTypes: true })
				let found = false

				for (const taskDir of taskDirs) {
					if (taskDir.isDirectory()) {
						const taskPath = path.join(planMemoryBase, taskDir.name)
						const testPath = path.join(taskPath, filename)
						try {
							await fs.access(testPath)
							filePath = testPath
							found = true
							console.log(`[openPlanFileInEditor] File found at: ${filePath}`)
							break
						} catch {
							// File not in this directory
						}
					}
				}

				if (!found) {
					vscode.window.showErrorMessage(`Plan file not found: ${filename}`)
					return
				}
			} catch {
				vscode.window.showErrorMessage(`Plan file not found: ${filename}`)
				return
			}
		}

		// Create URI with custom scheme
		const uri = vscode.Uri.parse(`${PLAN_EDITOR_URI_SCHEME}:${filePath}`)
		console.log(`[openPlanFileInEditor] Created URI: ${uri.toString()}`)

		// Open the document
		await vscode.commands.executeCommand("vscode.openWith", uri, PLAN_EDITOR_URI_SCHEME)
		console.log(`[openPlanFileInEditor] Command executed successfully`)
	} catch (error) {
		console.error(`[openPlanFileInEditor] Failed to open plan file:`, error)
		vscode.window.showErrorMessage(
			`Failed to open plan file: ${error instanceof Error ? error.message : String(error)}`,
		)
	}
}
