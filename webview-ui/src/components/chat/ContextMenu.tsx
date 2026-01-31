import React, { useEffect, useMemo, useRef, useState } from "react"
import { getIconForFilePath, getIconUrlByName, getIconForDirectoryPath } from "vscode-material-icons"
import { File, Folder, Image, Info } from "lucide-react"

import {
	ContextMenuOptionType,
	ContextMenuQueryItem,
	getContextMenuOptions,
	SearchResult,
} from "@src/utils/context-mentions"
import { removeLeadingNonAlphanumeric } from "@src/utils/removeLeadingNonAlphanumeric"
import { t } from "i18next"

interface ContextMenuProps {
	onSelect: (type: ContextMenuOptionType, value?: string) => void
	searchQuery: string
	inputValue: string
	onMouseDown: () => void
	selectedIndex: number
	setSelectedIndex: (index: number) => void
	selectedType: ContextMenuOptionType | null
	queryItems: ContextMenuQueryItem[]
	loading?: boolean
	dynamicSearchResults?: SearchResult[]
}

const ContextMenu: React.FC<ContextMenuProps> = ({
	onSelect,
	searchQuery,
	onMouseDown,
	selectedIndex,
	setSelectedIndex,
	selectedType,
	queryItems,
	dynamicSearchResults = [],
}) => {
	const [materialIconsBaseUri, setMaterialIconsBaseUri] = useState("")
	const menuRef = useRef<HTMLDivElement>(null)

	const filteredOptions = useMemo(() => {
		return getContextMenuOptions(searchQuery, selectedType, queryItems, dynamicSearchResults)
	}, [searchQuery, selectedType, queryItems, dynamicSearchResults])

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

	// get the icons base uri on mount
	useEffect(() => {
		const w = window as any
		setMaterialIconsBaseUri(w.MATERIAL_ICONS_BASE_URI)
	}, [])

	const renderOptionContent = (option: ContextMenuQueryItem) => {
		switch (option.type) {
			case ContextMenuOptionType.NoResults:
				return <span>{t("chat:contextMenu.noResults")}</span>
			case ContextMenuOptionType.Image:
				return <span>Add Image</span>
			case ContextMenuOptionType.File:
			case ContextMenuOptionType.Folder:
				if (option.value) {
					// remove trailing slash
					const path = removeLeadingNonAlphanumeric(option.value || "").replace(/\/$/, "")
					const pathList = path.split("/")
					const filename = pathList.at(-1)
					const folderPath = pathList.slice(0, -1).join("/")
					return (
						<div
							style={{
								flex: 1,
								overflow: "hidden",
								display: "flex",
								gap: "0.5em",
								whiteSpace: "nowrap",
								alignItems: "center",
								justifyContent: "space-between",
								textAlign: "left",
							}}>
							<span>{filename}</span>
							<span
								style={{
									whiteSpace: "nowrap",
									overflow: "hidden",
									textOverflow: "ellipsis",
									direction: "rtl",
									textAlign: "right",
									flex: 1,
									opacity: 0.75,
									fontSize: "0.75em",
								}}>
								{folderPath}
							</span>
						</div>
					)
				} else {
					return <span>Add {option.type === ContextMenuOptionType.File ? "File" : "Folder"}</span>
				}
		}
	}

	const getIconForOption = (option: ContextMenuQueryItem): React.ReactNode => {
		switch (option.type) {
			case ContextMenuOptionType.File:
				return <File size={16} style={{ marginRight: "6px", flexShrink: 0 }} />
			case ContextMenuOptionType.Folder:
				return <Folder size={16} style={{ marginRight: "6px", flexShrink: 0 }} />
			case ContextMenuOptionType.Image:
				return <Image size={16} style={{ marginRight: "6px", flexShrink: 0 }} />
			case ContextMenuOptionType.NoResults:
				return <Info size={16} style={{ marginRight: "6px", flexShrink: 0 }} />
			default:
				return <File size={16} style={{ marginRight: "6px", flexShrink: 0 }} />
		}
	}

	const getMaterialIconForOption = (option: ContextMenuQueryItem): string => {
		// only take the last part of the path to handle both file and folder icons
		// since material-icons have specific folder icons, we use them if available
		const name = option.value?.split("/").filter(Boolean).at(-1) ?? ""
		const iconName =
			option.type === ContextMenuOptionType.Folder ? getIconForDirectoryPath(name) : getIconForFilePath(name)
		return getIconUrlByName(iconName, materialIconsBaseUri)
	}

	const isOptionSelectable = (option: ContextMenuQueryItem): boolean => {
		return option.type !== ContextMenuOptionType.NoResults
	}

	return (
		<div
			style={{
				position: "absolute",
				bottom: "calc(100% - 10px)",
				left: 15,
				right: 15,
				overflowX: "hidden",
			}}
			onMouseDown={onMouseDown}>
			<div
				ref={menuRef}
				style={{
					backgroundColor: "var(--vscode-dropdown-background)",
					borderRadius: "12px",
					border: "1px solid var(--vscode-editorGroup-border)",
					outline: "none",
					boxShadow: "0 4px 10px rgba(0, 0, 0, 0.25)",
					zIndex: 1000,
					display: "flex",
					padding: "4px",
					flexDirection: "column",
					maxHeight: "300px",
					overflowY: "auto",
					overflowX: "hidden",
				}}>
				{filteredOptions && filteredOptions.length > 0 ? (
					filteredOptions.map((option, index) => (
						<div
							key={`${option.type}-${option.value || index}`}
							onClick={() => isOptionSelectable(option) && onSelect(option.type, option.value)}
							style={{
								padding: "4px 8px",
								cursor: isOptionSelectable(option) ? "pointer" : "default",
								color: "var(--vscode-dropdown-foreground)",
								display: "flex",
								alignItems: "center",
								justifyContent: "space-between",
								position: "relative",
								...(index === selectedIndex && isOptionSelectable(option)
									? {
											backgroundColor: "var(--vscode-list-activeSelectionBackground)",
											color: "var(--vscode-list-activeSelectionForeground)",
										}
									: {}),
							}}
							onMouseEnter={() => isOptionSelectable(option) && setSelectedIndex(index)}>
							<div
								style={{
									display: "flex",
									alignItems: "center",
									flex: 1,
									minWidth: 0,
									overflow: "hidden",
									paddingTop: 0,
									position: "relative",
								}}>
								{(option.type === ContextMenuOptionType.File ||
									option.type === ContextMenuOptionType.Folder) && (
									<img
										src={getMaterialIconForOption(option)}
										alt="Mode"
										style={{
											marginRight: "6px",
											flexShrink: 0,
											width: "16px",
											height: "16px",
										}}
									/>
								)}
								{option.type !== ContextMenuOptionType.File &&
									option.type !== ContextMenuOptionType.Folder &&
									getIconForOption(option)}
								{renderOptionContent(option)}
							</div>
							{(option.type === ContextMenuOptionType.File ||
								option.type === ContextMenuOptionType.Folder) &&
								!option.value && (
									<i
										className="codicon codicon-chevron-right"
										style={{ fontSize: "10px", flexShrink: 0, marginLeft: 8 }}
									/>
								)}
						</div>
					))
				) : (
					<div
						style={{
							padding: "4px",
							display: "flex",
							alignItems: "center",
							justifyContent: "center",
							color: "var(--vscode-foreground)",
							opacity: 0.7,
						}}>
						<span>{t("chat:contextMenu.noResults")}</span>
					</div>
				)}
			</div>
		</div>
	)
}

export default ContextMenu
