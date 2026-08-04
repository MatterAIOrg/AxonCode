import React, { memo } from "react"

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

interface PasteChipsProps {
	chips: PasteChip[]
	onRemove?: (id: string) => void
	// When true, render only the chips (no wrapper) so they can live inside a
	// shared flex container alongside image thumbnails and document chips.
	inline?: boolean
}

function PasteChips({ chips, onRemove, inline = false }: PasteChipsProps) {
	if (chips.length === 0) {
		return null
	}

	const chipElements = chips.map((chip) => {
		const name = formatPasteChipName(chip.text)

		return (
			<div key={chip.id} style={{ position: "relative" }}>
				<div
					data-testid="paste-chip"
					title={`${name} (pasted text)`}
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
				{onRemove && (
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
			</div>
		)
	})

	if (inline) {
		return <>{chipElements}</>
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
			{chipElements}
		</div>
	)
}

export default memo(PasteChips)
