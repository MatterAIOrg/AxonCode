import React, { memo } from "react"
import { FileText, X } from "lucide-react"

import type { DocumentAttachment } from "@roo/ExtensionMessage"

interface DocumentAttachmentsProps {
	documents: DocumentAttachment[]
	setDocuments?: React.Dispatch<React.SetStateAction<DocumentAttachment[]>>
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

function DocumentAttachments({ documents, setDocuments }: DocumentAttachmentsProps) {
	if (documents.length === 0) {
		return null
	}

	return (
		<div className="flex flex-wrap gap-1.5 px-4 mt-1">
			{documents.map((document, index) => (
				<div
					key={`${document.name}-${index}`}
					title={document.truncated ? `${document.name} (content truncated)` : document.name}
					className="flex items-center gap-1.5 rounded-full bg-vscode-badge-background text-vscode-badge-foreground px-2 py-1 text-xs max-w-48">
					<FileText className="w-3.5 h-3.5 shrink-0" />
					<span className="truncate">{document.name}</span>
					{document.truncated && <span aria-label="Content truncated">…</span>}
					{setDocuments && (
						<button
							type="button"
							aria-label={`Remove ${document.name}`}
							className="border-0 bg-transparent p-0 cursor-pointer text-inherit opacity-70 hover:opacity-100"
							onClick={() =>
								setDocuments((current) => current.filter((_, itemIndex) => itemIndex !== index))
							}>
							<X className="w-3 h-3" />
						</button>
					)}
				</div>
			))}
		</div>
	)
}

export default memo(DocumentAttachments)
