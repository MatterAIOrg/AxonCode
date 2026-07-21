import React, { memo } from "react"
import { getIconForFilePath, getIconUrlByName } from "vscode-material-icons"

import type { DocumentAttachment } from "@roo/ExtensionMessage"

interface DocumentAttachmentsProps {
	documents: DocumentAttachment[]
	setDocuments?: React.Dispatch<React.SetStateAction<DocumentAttachment[]>>
	materialIconsBaseUri?: string
	// When true, render only the chips (no wrapper) so they can live inside a
	// shared flex container alongside image thumbnails. kilocode_change
	inline?: boolean
}

export function formatMessageWithDocuments(message: string, documents: DocumentAttachment[]): string {
	const trimmedMessage = message.trim()
	if (documents.length === 0) {
		return trimmedMessage
	}

	const attachmentText = documents
		.map((document) => {
			const safeName = document.name.replace(/[\r\n]/g, " ")
			return `--- BEGIN ATTACHED FILE: ${safeName} ---\n${document.text}\n--- END ATTACHED FILE: ${safeName} ---`
		})
		.join("\n\n")

	return [trimmedMessage, "Attached files (parsed as text):", attachmentText].filter(Boolean).join("\n\n")
}

const truncateFilename = (name: string, maxLength: number = 10): string => {
	if (name.length <= maxLength) return name
	const lastDotIndex = name.lastIndexOf(".")
	if (lastDotIndex <= 0) {
		return name.slice(0, Math.max(0, maxLength - 3)) + "..."
	}
	const extension = name.slice(lastDotIndex)
	const baseName = name.slice(0, lastDotIndex)
	const truncatedBase = baseName.slice(0, Math.max(0, maxLength - extension.length - 3)) + "..."
	return truncatedBase + extension
}

function DocumentAttachments({
	documents,
	setDocuments,
	materialIconsBaseUri,
	inline = false,
}: DocumentAttachmentsProps) {
	if (documents.length === 0) {
		return null
	}

	const chips = documents.map((document, index) => {
		// kilocode_change: use the extension-specific material icon when available,
		// matching the image thumbnail pill style so images and documents render
		// at the same size inside a shared flex container.
		let icon: React.ReactNode = null
		if (materialIconsBaseUri) {
			const iconName = getIconForFilePath(document.name)
			const iconUrl = getIconUrlByName(iconName, materialIconsBaseUri)
			if (iconUrl) {
				icon = (
					<img
						src={iconUrl}
						alt=""
						style={{
							width: 24,
							height: 24,
							borderRadius: "50%",
							flexShrink: 0,
							objectFit: "contain",
							padding: 2,
						}}
					/>
				)
			}
		}
		if (!icon) {
			// Fallback: a circular badge with the file extension initial
			const ext = document.name.split(".").pop()?.slice(0, 3).toUpperCase() || "DOC"
			icon = (
				<div
					style={{
						width: 24,
						height: 24,
						borderRadius: "50%",
						flexShrink: 0,
						display: "flex",
						alignItems: "center",
						justifyContent: "center",
						fontSize: 8,
						fontWeight: 600,
						color: "var(--vscode-badge-foreground)",
						backgroundColor: "var(--vscode-editor-background)",
					}}>
					{ext}
				</div>
			)
		}

		return (
			<div key={`${document.name}-${index}`} style={{ position: "relative" }}>
				<div
					title={document.truncated ? `${document.name} (content truncated)` : document.name}
					style={{
						display: "flex",
						alignItems: "center",
						backgroundColor: "var(--vscode-badge-background)",
						borderRadius: 16,
						padding: "2px 10px 2px 2px",
						gap: 6,
						transition: "background-color 0.15s",
					}}
					onMouseEnter={(e) => {
						e.currentTarget.style.backgroundColor = "var(--vscode-list-hoverBackground)"
					}}
					onMouseLeave={(e) => {
						e.currentTarget.style.backgroundColor = "var(--vscode-badge-background)"
					}}>
					{icon}
					<span
						style={{
							fontSize: 11,
							color: "var(--vscode-badge-foreground)",
							whiteSpace: "nowrap",
							overflow: "hidden",
							textOverflow: "ellipsis",
							maxWidth: 100,
							fontFamily: "var(--vscode-font-family)",
						}}>
						{truncateFilename(document.name)}
					</span>
				</div>
				{setDocuments && (
					<div
						onClick={() => setDocuments((current) => current.filter((_, itemIndex) => itemIndex !== index))}
						style={{
							position: "absolute",
							top: -5,
							right: -5,
							width: 18,
							height: 18,
							borderRadius: "50%",
							backgroundColor: "var(--vscode-badge-background)",
							display: "flex",
							justifyContent: "center",
							alignItems: "center",
							cursor: "pointer",
							zIndex: 10,
						}}>
						<span
							className="codicon codicon-close"
							style={{
								color: "var(--vscode-foreground)",
								fontSize: 12,
								fontWeight: "bold",
							}}
						/>
					</div>
				)}
			</div>
		)
	})

	if (inline) {
		return <>{chips}</>
	}

	return (
		<div
			style={{
				display: "flex",
				flexWrap: "wrap",
				gap: 8,
				rowGap: 6,
				paddingLeft: 16,
				paddingRight: 16,
				marginTop: 4,
			}}>
			{chips}
		</div>
	)
}

export default memo(DocumentAttachments)
