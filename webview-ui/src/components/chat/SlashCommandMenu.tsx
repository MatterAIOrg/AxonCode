import React, { useCallback, useRef, useEffect } from "react"
import { SlashCommand, getMatchingSlashCommands } from "@/utils/slash-commands"
import { useExtensionState } from "@/context/ExtensionStateContext" // kilocode_change
import { cn } from "@/lib/utils"

interface SlashCommandMenuProps {
	onSelect: (command: SlashCommand) => void
	selectedIndex: number
	setSelectedIndex: (index: number) => void
	onMouseDown: () => void
	query: string
	customModes?: any[]
}

// Helper to map slash commands to codicon icons
const getCommandIcon = (name: string): string => {
	switch (name) {
		case "newtask":
			return "codicon-add"
		case "compact":
			return "codicon-fold"
		case "commit":
			return "codicon-git-commit"
		case "code-review":
			return "codicon-shield"
		case "migrate":
			return "codicon-cloud-download"
		case "init":
			return "codicon-notebook"
		case "create-skill":
			return "codicon-tools"
		case "link":
			return "codicon-link"
		case "usage":
			return "codicon-dashboard"
		// Modes
		case "architect":
			return "codicon-organization"
		case "ask":
			return "codicon-comment-discussion"
		case "debug":
			return "codicon-bug"
		case "code":
			return "codicon-code"
		default:
			return "codicon-terminal"
	}
}

const SlashCommandMenu: React.FC<SlashCommandMenuProps> = ({
	onSelect,
	selectedIndex,
	setSelectedIndex,
	onMouseDown,
	query,
	customModes,
}) => {
	const { localWorkflows, globalWorkflows } = useExtensionState() // kilocode_change
	const menuRef = useRef<HTMLDivElement>(null)

	const handleClick = useCallback(
		(command: SlashCommand) => {
			onSelect(command)
		},
		[onSelect],
	)

	// Auto-scroll logic remains the same...
	useEffect(() => {
		if (menuRef.current) {
			const selectedElement = menuRef.current.children[selectedIndex] as HTMLElement
			if (selectedElement) {
				const menuRect = menuRef.current.getBoundingClientRect()
				const selectedRect = selectedElement.getBoundingClientRect()

				if (selectedRect.bottom > menuRect.bottom) {
					menuRef.current.scrollTop += selectedRect.bottom - menuRect.bottom
				} else if (selectedRect.top < menuRect.top) {
					menuRef.current.scrollTop -= menuRect.top - selectedRect.top
				}
			}
		}
	}, [selectedIndex])

	// Filter commands based on query
	const filteredCommands = getMatchingSlashCommands(query, customModes, localWorkflows, globalWorkflows) // kilocode_change

	// Separate core commands/modes from custom workflows (Skills)
	const coreCommands = filteredCommands.filter((cmd) => cmd.section !== "custom")
	const skillCommands = filteredCommands.filter((cmd) => cmd.section === "custom")

	const renderItem = (command: SlashCommand, index: number) => {
		const isSelected = index === selectedIndex
		const iconClass = getCommandIcon(command.name)

		return (
			<div key={command.name} className="px-1.5 py-0.5" onMouseEnter={() => setSelectedIndex(index)}>
				<div
					className={cn(
						"flex items-center gap-2.5 px-3 py-2 cursor-pointer transition-colors duration-150 rounded-lg",
						isSelected
							? "bg-[var(--vscode-list-activeSelectionBackground)] text-[var(--vscode-list-activeSelectionForeground)]"
							: "hover:bg-[var(--vscode-list-hoverBackground)] text-[var(--vscode-foreground)]",
					)}
					onClick={() => handleClick(command)}>
					<span className={cn("codicon shrink-0 text-sm opacity-80", iconClass)} />
					<div className="flex items-baseline gap-2 min-w-0 flex-1">
						<span className="font-bold text-sm shrink-0">/{command.name}</span>
						{command.description && (
							<span
								className={cn(
									"text-xs truncate",
									isSelected
										? "text-[var(--vscode-list-activeSelectionForeground)] opacity-70"
										: "text-[var(--vscode-descriptionForeground)]",
								)}>
								{command.description}
							</span>
						)}
					</div>
				</div>
			</div>
		)
	}

	return (
		<div
			className="absolute bottom-[calc(100%-10px)] left-[15px] right-[15px] overflow-hidden z-[1000] rounded-xl border border-[var(--vscode-commandCenter-inactiveBorder)] bg-[var(--vscode-editor-background)] shadow-lg"
			onMouseDown={onMouseDown}>
			<div
				ref={menuRef}
				className="flex flex-col max-h-[280px] overflow-y-auto py-1 scrollbar-none [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
				{filteredCommands.length > 0 ? (
					<>
						{coreCommands.map((command, index) => renderItem(command, index))}

						{skillCommands.length > 0 && (
							<>
								<div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-[var(--vscode-descriptionForeground)] border-t border-[var(--vscode-commandCenter-inactiveBorder)] mt-1">
									Skills
								</div>
								{skillCommands.map((command, index) =>
									renderItem(command, coreCommands.length + index),
								)}
							</>
						)}
					</>
				) : (
					<div className="py-2 px-3 cursor-default flex flex-col">
						<div className="text-xs text-[var(--vscode-descriptionForeground)]">
							No matching commands found
						</div>
					</div>
				)}
			</div>
		</div>
	)
}

export default SlashCommandMenu
