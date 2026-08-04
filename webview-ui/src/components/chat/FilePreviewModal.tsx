import React, { useMemo } from "react"
import { VSCodeButton } from "@vscode/webview-ui-toolkit/react"
import { Markdown } from "./Markdown"
import { vscode } from "@src/utils/vscode"

export const FILE_TYPE_LABELS: Record<string, string> = {
	pdf: "PDF Document",
	docx: "Word Document",
	pptx: "PowerPoint",
	xlsx: "Excel Spreadsheet",
	csv: "CSV File",
	md: "Markdown",
	txt: "Text File",
	html: "HTML File",
}

export function formatBytes(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function decodeBase64(base64: string): string {
	try {
		const binary = atob(base64)
		const bytes = new Uint8Array(binary.length)
		for (let i = 0; i < binary.length; i++) {
			bytes[i] = binary.charCodeAt(i)
		}
		return new TextDecoder("utf-8").decode(bytes)
	} catch {
		return ""
	}
}

function parseCsv(text: string): string[][] {
	const rows: string[][] = []
	for (const line of text.split(/\r?\n/)) {
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
	return rows
}

const TEXT_TYPES = ["md", "txt", "csv", "html"]

interface FilePreviewModalProps {
	fileType: string
	fileName: string
	fileData?: string
	content?: string
	mimeType?: string
	bytes?: number
	onClose: () => void
}

export const FilePreviewModal: React.FC<FilePreviewModalProps> = ({
	fileType,
	fileName,
	fileData,
	content,
	mimeType,
	bytes,
	onClose,
}) => {
	const ft = fileType.toLowerCase()
	const typeLabel = FILE_TYPE_LABELS[ft] || fileType.toUpperCase()
	const sizeLabel = bytes ? formatBytes(bytes) : ""

	const textContent = useMemo(() => {
		if (content) return content
		if (fileData && TEXT_TYPES.includes(ft)) {
			return decodeBase64(fileData)
		}
		return ""
	}, [content, fileData, ft])

	// Build a data URL directly from the base64 payload — no atob/Blob/objectURL
	// needed. This works reliably inside the VS Code webview iframe/embed.
	const previewUrl = useMemo(() => {
		if (!fileData) return ""
		const mime = mimeType || (ft === "pdf" ? "application/pdf" : ft === "html" ? "text/html" : "")
		if (!mime) return ""
		return `data:${mime};base64,${fileData}`
	}, [fileData, mimeType, ft])

	const csvRows = useMemo(() => {
		if (ft !== "csv" || !textContent) return null
		return parseCsv(textContent)
	}, [ft, textContent])

	const handleSave = () => {
		if (fileData) {
			vscode.postMessage({
				type: "saveFile",
				values: {
					fileData,
					defaultFileName: fileName,
					mimeType,
				},
			})
		}
	}

	return (
		<div
			onClick={onClose}
			style={{
				position: "fixed",
				top: 0,
				left: 0,
				right: 0,
				bottom: 0,
				backgroundColor: "rgba(0, 0, 0, 0.6)",
				display: "flex",
				alignItems: "center",
				justifyContent: "center",
				zIndex: 1000,
			}}>
			<div
				onClick={(e) => e.stopPropagation()}
				style={{
					width: "90%",
					maxWidth: "900px",
					height: "85%",
					backgroundColor: "var(--vscode-editor-background)",
					border: "1px solid var(--vscode-panel-border)",
					borderRadius: "8px",
					display: "flex",
					flexDirection: "column",
					overflow: "hidden",
				}}>
				{/* Header */}
				<div
					style={{
						display: "flex",
						alignItems: "center",
						justifyContent: "space-between",
						padding: "10px 16px",
						borderBottom: "1px solid var(--vscode-panel-border)",
						backgroundColor: "var(--vscode-editor-inactiveSelectionBackground)",
					}}>
					<div style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: 0 }}>
						<span className="codicon codicon-file" style={{ fontSize: 16, flexShrink: 0 }} />
						<span
							style={{
								fontWeight: 600,
								fontSize: "13px",
								whiteSpace: "nowrap",
								overflow: "hidden",
								textOverflow: "ellipsis",
							}}>
							{fileName}
						</span>
						<span
							style={{
								fontSize: "11px",
								color: "var(--vscode-descriptionForeground)",
								textTransform: "uppercase",
								letterSpacing: "0.05em",
								flexShrink: 0,
							}}>
							{typeLabel}
							{sizeLabel && ` \u00b7 ${sizeLabel}`}
						</span>
					</div>
					<div style={{ display: "flex", gap: "8px", flexShrink: 0 }}>
						<VSCodeButton onClick={handleSave} appearance="secondary">
							Save
						</VSCodeButton>
						<VSCodeButton onClick={onClose} appearance="icon">
							<span className="codicon codicon-close" />
						</VSCodeButton>
					</div>
				</div>

				{/* Content */}
				<div style={{ flex: 1, overflow: "auto", padding: "16px" }}>
					{ft === "pdf" && previewUrl && (
						<embed
							src={previewUrl}
							type="application/pdf"
							style={{ width: "100%", height: "100%", border: "none" }}
						/>
					)}
					{ft === "html" && previewUrl && (
						<iframe
							src={previewUrl}
							title={fileName}
							style={{ width: "100%", height: "100%", border: "none" }}
							sandbox="allow-same-origin"
						/>
					)}
					{ft === "md" && textContent && (
						<div style={{ maxWidth: "800px", margin: "0 auto" }}>
							<Markdown markdown={textContent} partial={false} />
						</div>
					)}
					{ft === "txt" && textContent && (
						<pre
							style={{
								whiteSpace: "pre-wrap",
								wordBreak: "break-word",
								fontSize: "13px",
								fontFamily: "var(--vscode-editor-font-family)",
								color: "var(--vscode-editor-foreground)",
								margin: 0,
							}}>
							{textContent}
						</pre>
					)}
					{ft === "csv" && csvRows && (
						<table style={{ borderCollapse: "collapse", width: "100%", fontSize: "12px" }}>
							<thead>
								<tr>
									{csvRows[0]?.map((cell, i) => (
										<th
											key={i}
											style={{
												padding: "6px 10px",
												borderBottom: "1px solid var(--vscode-panel-border)",
												textAlign: "left",
												fontWeight: 600,
												color: "var(--vscode-foreground)",
												whiteSpace: "nowrap",
											}}>
											{cell}
										</th>
									))}
								</tr>
							</thead>
							<tbody>
								{csvRows.slice(1).map((row, ri) => (
									<tr key={ri}>
										{row.map((cell, ci) => (
											<td
												key={ci}
												style={{
													padding: "4px 10px",
													borderBottom: "1px solid var(--vscode-panel-border)",
													color: "var(--vscode-foreground)",
													whiteSpace: "nowrap",
												}}>
												{cell}
											</td>
										))}
									</tr>
								))}
							</tbody>
						</table>
					)}
					{(ft === "pptx" || ft === "docx" || ft === "xlsx") && textContent && (
						<div style={{ maxWidth: "800px", margin: "0 auto" }}>
							<Markdown markdown={textContent} partial={false} />
						</div>
					)}
					{!previewUrl && !textContent && (
						<div
							style={{
								display: "flex",
								alignItems: "center",
								justifyContent: "center",
								height: "100%",
								color: "var(--vscode-descriptionForeground)",
								fontSize: "13px",
							}}>
							No preview available. Click Save to download the file.
						</div>
					)}
				</div>
			</div>
		</div>
	)
}
