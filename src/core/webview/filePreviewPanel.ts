import * as vscode from "vscode"
import * as path from "path"
import * as os from "os"
import * as fs from "fs/promises"

const FILE_TYPE_LABELS: Record<string, string> = {
	pdf: "PDF Document",
	docx: "Word Document",
	pptx: "PowerPoint",
	xlsx: "Excel Spreadsheet",
	csv: "CSV File",
	md: "Markdown",
	txt: "Text File",
	html: "HTML File",
}

function formatBytes(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function escapeHtml(text: string): string {
	return text
		.replace(/&/g, "\x26amp;")
		.replace(/</g, "\x26lt;")
		.replace(/>/g, "\x26gt;")
		.replace(/"/g, "\x26quot;")
		.replace(/'/g, "\x26#039;")
}

function csvToHtmlTable(csv: string): string {
	const rows: string[][] = []
	for (const line of csv.split(/\r?\n/)) {
		if (!line.trim()) continue
		const cells: string[] = []
		let current = ""
		let inQuotes = false
		for (let i = 0; i < line.length; i++) {
			const ch = line[i]
			if (inQuotes) {
				if (ch === '"' && line[i + 1] === '"') {
					current += '"'
					i++
				} else if (ch === '"') {
					inQuotes = false
				} else {
					current += ch
				}
			} else if (ch === '"') {
				inQuotes = true
			} else if (ch === ",") {
				cells.push(current)
				current = ""
			} else {
				current += ch
			}
		}
		cells.push(current)
		rows.push(cells)
	}
	if (rows.length === 0) return "<p>No data</p>"
	let html =
		'<table style="border-collapse:collapse;width:100%;font-size:13px;font-family:var(--vscode-editor-font-family);">'
	html += "<thead><tr>"
	for (const cell of rows[0]) {
		html += `<th style="padding:8px 12px;border-bottom:2px solid var(--vscode-panel-border);text-align:left;font-weight:600;color:var(--vscode-foreground);white-space:nowrap;">${escapeHtml(cell)}</th>`
	}
	html += "</tr></thead><tbody>"
	for (let i = 1; i < rows.length; i++) {
		html += "<tr>"
		for (const cell of rows[i]) {
			html += `<td style="padding:6px 12px;border-bottom:1px solid var(--vscode-panel-border);color:var(--vscode-foreground);white-space:nowrap;">${escapeHtml(cell)}</td>`
		}
		html += "</tr>"
	}
	html += "</tbody></table>"
	return html
}

function pageShell(title: string, bodyContent: string, extraHead = ""): string {
	return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(title)}</title>
<style>
  html, body {
    margin: 0; padding: 0; height: 100%;
    background-color: var(--vscode-editor-background);
    color: var(--vscode-editor-foreground);
    font-family: var(--vscode-editor-font-family);
    font-size: var(--vscode-editor-font-size);
  }
  #header {
    display: flex; align-items: center; gap: 8px;
    padding: 10px 16px;
    border-bottom: 1px solid var(--vscode-panel-border);
    background-color: var(--vscode-editor-inactiveSelectionBackground);
    position: sticky; top: 0; z-index: 10;
  }
  #header .name { font-weight: 600; font-size: 13px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  #header .meta { font-size: 11px; color: var(--vscode-descriptionForeground); text-transform: uppercase; letter-spacing: 0.05em; flex-shrink: 0; }
  #content { padding: 16px; overflow: auto; }
  pre { white-space: pre-wrap; word-break: break-word; font-family: var(--vscode-editor-font-family); font-size: 13px; line-height: 1.6; }
  a { color: var(--vscode-textLink-foreground); }
  h1,h2,h3,h4,h5,h6 { color: var(--vscode-foreground); margin-top: 1.2em; margin-bottom: 0.5em; }
  code { font-family: var(--vscode-editor-font-family); background-color: var(--vscode-textCodeBlock-background); padding: 2px 4px; border-radius: 3px; font-size: 0.9em; }
  pre code { background: none; padding: 0; }
  table { border-collapse: collapse; }
  blockquote { border-left: 3px solid var(--vscode-panel-border); margin-left: 0; padding-left: 12px; color: var(--vscode-descriptionForeground); }
</style>
${extraHead}
</head>
<body>
<div id="header">
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style="flex-shrink:0;color:var(--vscode-foreground);"><path d="M9 1H4a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V5L9 1z" fill="currentColor" fill-opacity="0.25"/><path d="M9 1v4h4L9 1z" fill="currentColor" fill-opacity="0.5"/></svg>
  <span class="name">${escapeHtml(title)}</span>
</div>
<div id="content">
${bodyContent}
</div>
</body>
</html>`
}

function generatePdfHtml(
	pdfWebviewUri: string,
	pdfJsUri: string,
	pdfWorkerUri: string,
	pdfRendererUri: string,
	cspSource: string,
	fileName: string,
	typeLabel: string,
	sizeLabel: string,
): string {
	const meta = sizeLabel ? `${typeLabel} \u00b7 ${sizeLabel}` : typeLabel
	const head = `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${cspSource} data: blob:; connect-src ${cspSource}; script-src ${cspSource}; style-src ${cspSource} 'unsafe-inline'; worker-src ${cspSource} blob:;">`
	const body = `<div id="pdf-container" data-pdf-uri="${escapeHtml(pdfWebviewUri)}" data-worker-uri="${escapeHtml(pdfWorkerUri)}" style="display:flex;flex-direction:column;align-items:center;gap:8px;"></div>
<script src="${pdfJsUri}"></script>
<script src="${pdfRendererUri}"></script>`
	return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(fileName)}</title>
<style>
  html, body { margin:0; padding:0; height:100%; background-color:#404040; }
  #header { display:flex; align-items:center; gap:8px; padding:10px 16px; border-bottom:1px solid rgba(255,255,255,0.1); background-color:var(--vscode-editor-inactiveSelectionBackground); position:sticky; top:0; z-index:10; }
  #header .name { font-weight:600; font-size:13px; color:var(--vscode-foreground); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  #header .meta { font-size:11px; color:var(--vscode-descriptionForeground); text-transform:uppercase; letter-spacing:0.05em; flex-shrink:0; }
  #content { overflow:auto; }
  #pdf-container { display:flex; flex-direction:column; align-items:center; gap:8px; padding:16px; }
</style>
${head}
</head>
<body>
<div id="header">
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style="flex-shrink:0;color:var(--vscode-foreground);"><path d="M9 1H4a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V5L9 1z" fill="currentColor" fill-opacity="0.25"/><path d="M9 1v4h4L9 1z" fill="currentColor" fill-opacity="0.5"/></svg>
  <span class="name">${escapeHtml(fileName)}</span>
  <span class="meta">${escapeHtml(meta)}</span>
</div>
<div id="content">
${body}
</div>
</body>
</html>`
}

function generateMarkdownHtml(
	textContent: string,
	markedJsUri: string,
	mdRendererUri: string,
	cspSource: string,
	fileName: string,
	typeLabel: string,
	sizeLabel: string,
): string {
	const meta = sizeLabel ? `${typeLabel} \u00b7 ${sizeLabel}` : typeLabel
	const head = `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${cspSource} data:; script-src ${cspSource}; style-src ${cspSource} 'unsafe-inline';">`
	const body = `<div id="md-container" data-content="${escapeHtml(textContent)}" style="max-width:800px;margin:0 auto;"></div>
<script src="${markedJsUri}"></script>
<script src="${mdRendererUri}"></script>`
	return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(fileName)}</title>
<style>
  html, body { margin:0; padding:0; height:100%; background-color:var(--vscode-editor-background); color:var(--vscode-editor-foreground); font-family:var(--vscode-editor-font-family); font-size:var(--vscode-editor-font-size); }
  #header { display:flex; align-items:center; gap:8px; padding:10px 16px; border-bottom:1px solid var(--vscode-panel-border); background-color:var(--vscode-editor-inactiveSelectionBackground); position:sticky; top:0; z-index:10; }
  #header .name { font-weight:600; font-size:13px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  #header .meta { font-size:11px; color:var(--vscode-descriptionForeground); text-transform:uppercase; letter-spacing:0.05em; flex-shrink:0; }
  #content { padding:16px; overflow:auto; }
  h1,h2,h3,h4,h5,h6 { color:var(--vscode-foreground); margin-top:1.2em; margin-bottom:0.5em; }
  code { font-family:var(--vscode-editor-font-family); background-color:var(--vscode-textCodeBlock-background); padding:2px 4px; border-radius:3px; font-size:0.9em; }
  pre { background-color:var(--vscode-textCodeBlock-background); padding:12px; border-radius:6px; overflow:auto; }
  pre code { background:none; padding:0; }
  a { color:var(--vscode-textLink-foreground); }
  blockquote { border-left:3px solid var(--vscode-panel-border); margin-left:0; padding-left:12px; color:var(--vscode-descriptionForeground); }
  table { border-collapse:collapse; }
  th, td { padding:6px 12px; border:1px solid var(--vscode-panel-border); }
</style>
${head}
</head>
<body>
<div id="header">
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style="flex-shrink:0;color:var(--vscode-foreground);"><path d="M9 1H4a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V5L9 1z" fill="currentColor" fill-opacity="0.25"/><path d="M9 1v4h4L9 1z" fill="currentColor" fill-opacity="0.5"/></svg>
  <span class="name">${escapeHtml(fileName)}</span>
  <span class="meta">${escapeHtml(meta)}</span>
</div>
<div id="content">
${body}
</div>
</body>
</html>`
}

function generateTextHtml(textContent: string, fileName: string, typeLabel: string, sizeLabel: string): string {
	const meta = sizeLabel ? `${typeLabel} \u00b7 ${sizeLabel}` : typeLabel
	return pageShell(
		fileName,
		`<pre>${escapeHtml(textContent)}</pre>`,
		`<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline';">`,
	)
}

function generateCsvHtml(tableHtml: string, fileName: string, typeLabel: string, sizeLabel: string): string {
	const meta = sizeLabel ? `${typeLabel} \u00b7 ${sizeLabel}` : typeLabel
	return pageShell(
		fileName,
		tableHtml,
		`<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline';">`,
	)
}

export async function openFilePreviewPanel(
	context: vscode.ExtensionContext,
	fileType: string,
	fileName: string,
	fileData: string,
	content?: string,
	mimeType?: string,
	bytes?: number,
): Promise<void> {
	const ft = fileType.toLowerCase()
	const typeLabel = FILE_TYPE_LABELS[ft] || fileType.toUpperCase()
	const sizeLabel = bytes ? formatBytes(bytes) : ""
	const title = fileName

	const panel = vscode.window.createWebviewPanel("filePreview", title, vscode.ViewColumn.Beside, {
		enableScripts: true,
		retainContextWhenHidden: false,
		localResourceRoots: [
			context.extensionUri,
			vscode.Uri.file(os.tmpdir()),
			vscode.Uri.joinPath(context.extensionUri, "assets", "vendor"),
		],
	})

	panel.iconPath = {
		light: vscode.Uri.joinPath(context.extensionUri, "assets", "icons", "matterai-ic.png"),
		dark: vscode.Uri.joinPath(context.extensionUri, "assets", "icons", "matterai-ic.png"),
	}

	const cspSource = panel.webview.cspSource

	// Decode base64 to text for text-based types
	let textContent = ""
	if (content) {
		textContent = content
	} else if (fileData && ["md", "txt", "csv", "html", "pptx", "docx", "xlsx"].includes(ft)) {
		try {
			textContent = Buffer.from(fileData, "base64").toString("utf-8")
		} catch {
			textContent = ""
		}
	}

	let html = ""

	switch (ft) {
		case "pdf": {
			// Write to temp file, load via PDF.js using a webview URI.
			// PDF.js renders to <canvas> so no browser plugin is needed,
			// which avoids the sandbox "plugin loading" restriction.
			const tempPath = path.join(os.tmpdir(), `mattercode-preview-${Date.now()}.pdf`)
			await fs.writeFile(tempPath, Buffer.from(fileData, "base64"))
			const pdfUri = panel.webview.asWebviewUri(vscode.Uri.file(tempPath))
			const pdfJsUri = panel.webview
				.asWebviewUri(vscode.Uri.joinPath(context.extensionUri, "assets", "vendor", "pdfjs", "pdf.min.js"))
				.toString()
			const pdfWorkerUri = panel.webview
				.asWebviewUri(
					vscode.Uri.joinPath(context.extensionUri, "assets", "vendor", "pdfjs", "pdf.worker.min.js"),
				)
				.toString()
			const pdfRendererUri = panel.webview
				.asWebviewUri(
					vscode.Uri.joinPath(
						context.extensionUri,
						"assets",
						"vendor",
						"pdfjs",
						"scripts",
						"pdf-renderer.js",
					),
				)
				.toString()
			html = generatePdfHtml(
				pdfUri.toString(),
				pdfJsUri,
				pdfWorkerUri,
				pdfRendererUri,
				cspSource,
				fileName,
				typeLabel,
				sizeLabel,
			)
			break
		}
		case "html": {
			// Set the decoded HTML directly as the webview content.
			html = textContent || "<p>Empty HTML document</p>"
			break
		}
		case "md": {
			const markedJsUri = panel.webview
				.asWebviewUri(vscode.Uri.joinPath(context.extensionUri, "assets", "vendor", "pdfjs", "marked.min.js"))
				.toString()
			const mdRendererUri = panel.webview
				.asWebviewUri(
					vscode.Uri.joinPath(context.extensionUri, "assets", "vendor", "pdfjs", "scripts", "md-renderer.js"),
				)
				.toString()
			html = generateMarkdownHtml(
				textContent,
				markedJsUri,
				mdRendererUri,
				cspSource,
				fileName,
				typeLabel,
				sizeLabel,
			)
			break
		}
		case "txt": {
			html = generateTextHtml(textContent, fileName, typeLabel, sizeLabel)
			break
		}
		case "csv": {
			html = generateCsvHtml(csvToHtmlTable(textContent), fileName, typeLabel, sizeLabel)
			break
		}
		case "pptx":
		case "docx":
		case "xlsx": {
			const markedJsUri = panel.webview
				.asWebviewUri(vscode.Uri.joinPath(context.extensionUri, "assets", "vendor", "pdfjs", "marked.min.js"))
				.toString()
			const mdRendererUri = panel.webview
				.asWebviewUri(
					vscode.Uri.joinPath(context.extensionUri, "assets", "vendor", "pdfjs", "scripts", "md-renderer.js"),
				)
				.toString()
			html = generateMarkdownHtml(
				textContent,
				markedJsUri,
				mdRendererUri,
				cspSource,
				fileName,
				typeLabel,
				sizeLabel,
			)
			break
		}
	}

	panel.webview.html = html
}
