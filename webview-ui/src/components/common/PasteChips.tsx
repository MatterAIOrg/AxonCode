import React, { memo, useState } from "react"

import { FileTypeIcon } from "@/utils/customIcons"

export interface PasteChip {
	id: string
	// The full text that was pasted. It is merged back into the message at
	// insertPosition when the message is sent.
	text: string
	// Cursor offset in the chat input where the paste happened. The full text
	// is re-inserted at this position on send, as if it had been pasted there.
	insertPosition: number
}

// Name shown on a paste chip: first few words of the pasted text, normalized
// and truncated so it fits on a single line.
export const formatPasteChipName = (text: string): string => {
	const normalized = text.replace(/\s+/g, " ").trim()
	const words = normalized.split(" ").slice(0, 4).join(" ")
	return words.length > 32 ? `${words.slice(0, 29)}…` : words || "Pasted text"
}

// Strips the content of paste chips out of a message's text so that only the
// user's surrounding prompt is displayed, avoiding duplicate text when chips
// are rendered visually.
export const getDisplayTextWithoutPasteChips = (text: string, chips?: { text: string }[]): string => {
	if (!text || !chips || chips.length === 0) {
		return text || ""
	}
	let result = text
	for (const chip of chips) {
		const content = chip.text.trim()
		if (!content) continue

		if (result.includes(`\n\n${content}\n\n`)) {
			result = result.replace(`\n\n${content}\n\n`, "\n\n")
		} else if (result.includes(`\n\n${content}`)) {
			result = result.replace(`\n\n${content}`, "")
		} else if (result.includes(`${content}\n\n`)) {
			result = result.replace(`${content}\n\n`, "")
		} else if (result.includes(content)) {
			result = result.replace(content, "")
		} else if (result.includes(chip.text)) {
			result = result.replace(chip.text, "")
		}
	}
	return result.trim()
}

interface PasteChipsProps {
	chips: PasteChip[]
	onRemove?: (id: string) => void
	// When true, render only the chips (no wrapper) so they can live inside a
	// shared flex container alongside image thumbnails and document chips.
	inline?: boolean
	// When true, the chip strip is rendered without the editor-strip padding so
	// it can sit inline inside a chat message row or the sticky user message.
	compact?: boolean
	// When true, chips render without a remove button and clicking a chip
	// toggles an inline preview of the full pasted text underneath it.
	readonly?: boolean
}

function PasteChips({ chips, onRemove, inline = false, compact = false, readonly = false }: PasteChipsProps) {
	const isReadonly = readonly || !onRemove
	const [expandedChipId, setExpandedChipId] = useState<string | null>(null)

	if (chips.length === 0) {
		return null
	}

	const chipElements = chips.map((chip) => {
		const name = formatPasteChipName(chip.text)
		const isExpanded = expandedChipId === chip.id

		return (
			<div key={chip.id} style={{ position: "relative" }}>
				<div
					data-testid="paste-chip"
					title={`${name} (pasted text)`}
					onClick={
						isReadonly
							? (e) => {
									e.stopPropagation()
									setExpandedChipId((prev) => (prev === chip.id ? null : chip.id))
								}
							: undefined
					}
					style={{
						display: "flex",
						alignItems: "center",
						backgroundColor: "var(--vscode-badge-background)",
						borderRadius: 16,
						padding: "2px 10px 2px 2px",
						gap: 6,
						transition: "background-color 0.15s",
						cursor: isReadonly ? "pointer" : "default",
					}}
					onMouseEnter={(e) => {
						e.currentTarget.style.backgroundColor = "var(--vscode-list-hoverBackground)"
					}}
					onMouseLeave={(e) => {
						e.currentTarget.style.backgroundColor = "var(--vscode-badge-background)"
					}}>
					<div
						style={{
							width: 24,
							height: 24,
							borderRadius: "50%",
							flexShrink: 0,
							display: "flex",
							alignItems: "center",
							justifyContent: "center",
							color: "var(--vscode-badge-foreground)",
							backgroundColor: "var(--vscode-editor-background)",
						}}>
						<FileTypeIcon width={12} height={12} />
					</div>
					<span
						style={{
							fontSize: 11,
							color: "var(--vscode-badge-foreground)",
							whiteSpace: "nowrap",
							overflow: "hidden",
							textOverflow: "ellipsis",
							maxWidth: 140,
							fontFamily: "var(--vscode-font-family)",
						}}>
						{name}
					</span>
				</div>
				{!isReadonly && onRemove && (
					<div
						data-testid="remove-paste-chip"
						onClick={() => onRemove(chip.id)}
						title="Remove pasted text"
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
				{isReadonly && isExpanded && (
					<div
						data-testid="paste-chip-expanded"
						style={{
							marginTop: 4,
							padding: "6px 10px",
							borderRadius: 6,
							backgroundColor: "var(--vscode-textCodeBlock-background)",
							border: "1px solid var(--vscode-commandCenter-inactiveBorder)",
							color: "var(--vscode-foreground)",
							fontSize: 12,
							fontFamily: "var(--vscode-font-family)",
							whiteSpace: "pre-wrap",
							wordBreak: "break-word",
							maxHeight: 200,
							overflow: "auto",
						}}>
						{chip.text}
					</div>
				)}
			</div>
		)
	})

	if (inline) {
		return <>{chipElements}</>
	}

	return (
		<div
			data-testid="paste-chips"
			style={{
				display: "flex",
				flexWrap: "wrap",
				gap: 8,
				rowGap: 6,
				paddingLeft: compact ? 0 : 16,
				paddingRight: compact ? 0 : 16,
				marginTop: compact ? 0 : 4,
			}}>
			{chipElements}
		</div>
	)
}

export default memo(PasteChips)
