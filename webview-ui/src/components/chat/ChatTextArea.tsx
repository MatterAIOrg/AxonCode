import React, { forwardRef, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import { useEvent } from "react-use"

import { ExtensionMessage } from "@roo/ExtensionMessage"
import { WebviewMessage } from "@roo/WebviewMessage"
import { mentionRegex, mentionRegexGlobal, unescapeSpaces } from "@roo/context-mentions"
import { Mode, getAllModes } from "@roo/modes"

import { Button, StandardTooltip } from "@/components/ui" // kilocode_change
import { useExtensionState } from "@/context/ExtensionStateContext"
import { useAppTranslation } from "@/i18n/TranslationContext"
import { convertToMentionPath } from "@/utils/path-mentions"
import { vscode } from "@/utils/vscode"
import {
	ContextMenuOptionType,
	SearchResult,
	getContextMenuOptions,
	insertMention,
	removeMention,
	shouldShowContextMenu,
} from "@src/utils/context-mentions"

import { cn } from "@/lib/utils"
import { renderMentionChip } from "@/utils/chat-render"
import { MessageSquareX, Paperclip, SendHorizontal, VolumeX } from "lucide-react"
import Thumbnails from "../common/Thumbnails"
import KiloModeSelector from "../kilocode/KiloModeSelector"
import { ModelSelector } from "../kilocode/chat/ModelSelector"
import { useSelectedModel } from "../ui/hooks/useSelectedModel"
import { MAX_IMAGES_PER_MESSAGE } from "./ChatView"
import ContextMenu from "./ContextMenu"
import { ContextUsageIndicator } from "./ContextUsageIndicator" // kilocode_change
import { ImageWarningBanner } from "./ImageWarningBanner" // kilocode_change
import { IndexingStatusBadge } from "./IndexingStatusBadge"
import { usePromptHistory } from "./hooks/usePromptHistory"
import { AcceptRejectButtons } from "./kilocode/AcceptRejectButtons"

// kilocode_change start: pull slash commands from Cline
import SlashCommandMenu from "@/components/chat/SlashCommandMenu"
import {
	SlashCommand,
	getMatchingSlashCommands,
	insertSlashCommand,
	shouldShowSlashCommandsMenu,
	validateSlashCommand,
} from "@/utils/slash-commands"
// kilocode_change end

interface ChatTextAreaProps {
	inputValue: string
	setInputValue: (value: string) => void
	sendingDisabled: boolean
	selectApiConfigDisabled: boolean
	selectedImages: string[]
	setSelectedImages: React.Dispatch<React.SetStateAction<string[]>>
	onSend: () => void
	onSelectImages: () => void
	shouldDisableImages: boolean
	onHeightChange?: (height: number) => void
	mode: Mode
	setMode: (value: Mode) => void
	modeShortcutText: string
	// Edit mode props
	isEditMode?: boolean
	onCancel?: () => void
	sendMessageOnEnter?: boolean // kilocode_change
	// Streaming state and cancel handler
	isStreaming?: boolean
	onCancelStreaming?: () => void
}

export const ChatTextArea = forwardRef<HTMLDivElement, ChatTextAreaProps>(
	(
		{
			inputValue,
			setInputValue,
			sendingDisabled,
			// selectApiConfigDisabled,
			selectedImages,
			setSelectedImages,
			onSend,
			onSelectImages,
			shouldDisableImages,
			onHeightChange,
			mode,
			setMode,
			modeShortcutText,
			isEditMode = false,
			onCancel,
			sendMessageOnEnter = true,
			isStreaming = false,
			onCancelStreaming,
		},
		ref,
	) => {
		const { t } = useAppTranslation()
		const {
			filePaths,
			openedTabs,
			currentApiConfigName,
			apiConfiguration,
			customModes,
			cwd,
			localWorkflows, // kilocode_change
			globalWorkflows, // kilocode_change
			taskHistoryVersion, // kilocode_change
			clineMessages,
		} = useExtensionState()

		const { id: selectedModelId, provider: selectedProvider } = useSelectedModel(apiConfiguration)

		// Find the ID and display text for the currently selected API configuration
		// const { currentConfigId, displayName } = useMemo(() => {
		// 	const currentConfig = listApiConfigMeta?.find((config) => config.name === currentApiConfigName)
		// 	return {
		// 		currentConfigId: currentConfig?.id || "",
		// 		displayName: currentApiConfigName || "", // Use the name directly for display
		// 	}
		// }, [listApiConfigMeta, currentApiConfigName])

		const [gitCommits, setGitCommits] = useState<any[]>([])
		const [showDropdown, setShowDropdown] = useState(false)
		const [fileSearchResults, setFileSearchResults] = useState<SearchResult[]>([])

		// kilocode_change begin: remove button from chat when it gets to small
		const [containerWidth, setContainerWidth] = useState<number>(300) // Default to a value larger than our threshold

		const containerRef = useRef<HTMLDivElement>(null)

		// Map of short mention display text -> full path for file/folder mentions
		// Format in textarea: @[filename.ext] -> expands to @/full/path/filename.ext
		const mentionMapRef = useRef<Map<string, string>>(new Map())

		// Expand short mentions @filename to full paths @/full/path before sending
		const expandMentions = useCallback((text: string): string => {
			// Match @word patterns that might be filenames (has extension like .ts, .js, etc.)
			return text.replace(/@([a-zA-Z0-9_.-]+\.[a-zA-Z0-9]+)/g, (_match, filename) => {
				const fullPath = mentionMapRef.current.get(filename)
				if (fullPath) {
					return `${fullPath}`
				}
				// If no mapping found, keep original (might be a valid full path or other mention)
				return _match
			})
		}, [])

		// Wrapper for onSend that expands mentions first
		const handleSend = useCallback(() => {
			const expandedValue = expandMentions(inputValue)
			if (expandedValue !== inputValue) {
				setInputValue(expandedValue)
				// Give React time to update, then send
				setTimeout(() => {
					onSend()
				}, 0)
			} else {
				onSend()
			}
		}, [inputValue, setInputValue, expandMentions, onSend])

		useEffect(() => {
			if (!containerRef.current) return

			// Check if ResizeObserver is available (it won't be in test environment)
			if (typeof ResizeObserver === "undefined") return

			const resizeObserver = new ResizeObserver((entries) => {
				for (const entry of entries) {
					const width = entry.contentRect.width
					setContainerWidth(width)
				}
			})

			resizeObserver.observe(containerRef.current)

			return () => {
				resizeObserver.disconnect()
			}
		}, [])
		// kilocode_change end

		const [searchLoading, setSearchLoading] = useState(false)
		const [searchRequestId, setSearchRequestId] = useState<string>("")

		// Close dropdown when clicking outside.
		useEffect(() => {
			const handleClickOutside = () => {
				if (showDropdown) {
					setShowDropdown(false)
				}
			}

			document.addEventListener("mousedown", handleClickOutside)
			return () => document.removeEventListener("mousedown", handleClickOutside)
		}, [showDropdown])

		const [isDraggingOver, setIsDraggingOver] = useState(false)
		// kilocode_change start: pull slash commands from Cline
		const [showSlashCommandsMenu, setShowSlashCommandsMenu] = useState(false)
		const [selectedSlashCommandsIndex, setSelectedSlashCommandsIndex] = useState(0)
		const [slashCommandsQuery, setSlashCommandsQuery] = useState("")
		const slashCommandsMenuContainerRef = useRef<HTMLDivElement>(null)
		// kilocode_end
		const [showContextMenu, setShowContextMenu] = useState(false)
		const [cursorPosition, setCursorPosition] = useState(0)
		const [searchQuery, setSearchQuery] = useState("")
		const textAreaRef = useRef<HTMLDivElement | null>(null)
		const [isMouseDownOnMenu, setIsMouseDownOnMenu] = useState(false)
		const [selectedMenuIndex, setSelectedMenuIndex] = useState(-1)
		const [selectedType, setSelectedType] = useState<ContextMenuOptionType | null>(null)
		const [justDeletedSpaceAfterMention, setJustDeletedSpaceAfterMention] = useState(false)
		const contextMenuContainerRef = useRef<HTMLDivElement>(null)
		const [isFocused, setIsFocused] = useState(false)
		const [imageWarning, setImageWarning] = useState<string | null>(null) // kilocode_change
		const [materialIconsBaseUri, setMaterialIconsBaseUri] = useState("")

		// const [isUserInput, setIsUserInput] = useState(false)
		const isUserInputRef = useRef(false) // Use ref to avoid re-renders
		const intendedCursorPositionRef = useRef<number | null>(null) // Track intended cursor position for synchronous restoration

		// get the icons base uri on mount
		useEffect(() => {
			const w = window as any
			setMaterialIconsBaseUri(w.MATERIAL_ICONS_BASE_URI)
		}, [])

		const applyCursorPosition = useCallback((position: number) => {
			setCursorPosition(position)
			intendedCursorPositionRef.current = position
		}, [])

		// Use custom hook for prompt history navigation
		const { handleHistoryNavigation, resetHistoryNavigation, resetOnInputChange } = usePromptHistory({
			clineMessages,
			taskHistoryVersion, // kilocode_change
			cwd,
			inputValue,
			setInputValue,
			cursorPosition,
			applyCursorPosition,
		})

		// Fetch git commits when Git is selected or when typing a hash.
		useEffect(() => {
			if (selectedType === ContextMenuOptionType.Git || /^[a-f0-9]+$/i.test(searchQuery)) {
				const message: WebviewMessage = {
					type: "searchCommits",
					query: searchQuery || "",
				} as const
				vscode.postMessage(message)
			}
		}, [selectedType, searchQuery])

		// kilocode_change start: Image warning handlers
		const showImageWarning = useCallback((messageKey: string) => {
			setImageWarning(messageKey)
		}, [])

		const dismissImageWarning = useCallback(() => {
			setImageWarning(null)
		}, [])
		// kilocode_change end: Image warning handlers

		// kilocode_change start: Clear images if unsupported
		// Track previous shouldDisableImages state to detect when model image support changes
		const prevShouldDisableImages = useRef<boolean>(shouldDisableImages)
		useEffect(() => {
			if (!prevShouldDisableImages.current && shouldDisableImages && selectedImages.length > 0) {
				setSelectedImages([])
				showImageWarning("kilocode:imageWarnings.imagesRemovedNoSupport")
			}
			prevShouldDisableImages.current = shouldDisableImages
		}, [shouldDisableImages, selectedImages.length, setSelectedImages, showImageWarning])
		// kilocode_change end: Clear images if unsupported

		const allModes = useMemo(() => getAllModes(customModes), [customModes])

		const queryItems = useMemo(() => {
			return [
				{ type: ContextMenuOptionType.Problems, value: "problems" },
				{ type: ContextMenuOptionType.Terminal, value: "terminal" },
				...gitCommits,
				...openedTabs
					.filter((tab) => tab.path)
					.map((tab) => ({
						type: ContextMenuOptionType.OpenedFile,
						value: "/" + tab.path,
					})),
				...filePaths
					.map((file) => "/" + file)
					.filter((path) => !openedTabs.some((tab) => tab.path && "/" + tab.path === path)) // Filter out paths that are already in openedTabs
					.map((path) => ({
						type: path.endsWith("/") ? ContextMenuOptionType.Folder : ContextMenuOptionType.File,
						value: path,
					})),
			]
		}, [filePaths, gitCommits, openedTabs])

		useEffect(() => {
			const handleClickOutside = (event: MouseEvent) => {
				if (
					contextMenuContainerRef.current &&
					!contextMenuContainerRef.current.contains(event.target as Node)
				) {
					setShowContextMenu(false)
				}
			}

			if (showContextMenu) {
				document.addEventListener("mousedown", handleClickOutside)
			}

			return () => {
				document.removeEventListener("mousedown", handleClickOutside)
			}
		}, [showContextMenu, setShowContextMenu])

		const handleMentionSelect = useCallback(
			(type: ContextMenuOptionType, value?: string) => {
				// kilocode_change start
				if (type === ContextMenuOptionType.Image) {
					setShowContextMenu(false)
					setSelectedType(null)

					const beforeCursor = inputValue.slice(0, cursorPosition)
					const afterCursor = inputValue.slice(cursorPosition)
					const lastAtIndex = beforeCursor.lastIndexOf("@")

					if (lastAtIndex !== -1) {
						const newValue = beforeCursor.slice(0, lastAtIndex) + afterCursor
						setInputValue(newValue)
						intendedCursorPositionRef.current = lastAtIndex
					}

					onSelectImages()
					return
				}
				// kilocode_change end

				if (type === ContextMenuOptionType.NoResults) {
					return
				}

				if (type === ContextMenuOptionType.Mode && value) {
					// Handle mode selection.
					setMode(value)
					setInputValue("")
					setShowContextMenu(false)
					vscode.postMessage({ type: "mode", text: value })
					return
				}

				if (
					type === ContextMenuOptionType.File ||
					type === ContextMenuOptionType.Folder ||
					type === ContextMenuOptionType.Git
				) {
					if (!value) {
						setSelectedType(type)
						setSearchQuery("")
						setSelectedMenuIndex(0)
						return
					}
				}

				setShowContextMenu(false)
				setSelectedType(null)

				let insertValue = value || ""

				if (type === ContextMenuOptionType.URL) {
					insertValue = value || ""
				} else if (
					type === ContextMenuOptionType.File ||
					type === ContextMenuOptionType.Folder ||
					type === ContextMenuOptionType.OpenedFile
				) {
					const fullPath = value || ""
					if (fullPath.startsWith("/")) {
						const segments = fullPath.split("/").filter(Boolean)
						const filename = segments.pop() || fullPath
						insertValue = filename
						mentionMapRef.current.set(filename, fullPath)
					} else {
						insertValue = fullPath
					}
				} else if (type === ContextMenuOptionType.Problems) {
					insertValue = "problems"
				} else if (type === ContextMenuOptionType.Terminal) {
					insertValue = "terminal"
				} else if (type === ContextMenuOptionType.Git) {
					insertValue = value || ""
				}

				const { newValue, mentionIndex } = insertMention(inputValue, cursorPosition, insertValue)

				setInputValue(newValue)
				const newCursorPosition = newValue.indexOf(" ", mentionIndex + insertValue.length) + 1
				setCursorPosition(newCursorPosition)
				intendedCursorPositionRef.current = newCursorPosition

				setTimeout(() => {
					textAreaRef.current?.focus()
				}, 0)
			},
			[setInputValue, cursorPosition, inputValue, onSelectImages, setMode],
		)

		// kilocode_change start: pull slash commands from Cline
		const handleSlashCommandsSelect = useCallback(
			(command: SlashCommand) => {
				setShowSlashCommandsMenu(false)

				// Handle mode switching commands
				const modeSwitchCommands = getAllModes(customModes).map((mode) => mode.slug)
				if (modeSwitchCommands.includes(command.name)) {
					// Switch to the selected mode
					setMode(command.name as Mode)
					setInputValue("")
					vscode.postMessage({ type: "mode", text: command.name })
					return
				}

				// Handle other slash commands (like newtask)
				const { newValue, commandIndex } = insertSlashCommand(inputValue, command.name)
				const newCursorPosition = newValue.indexOf(" ", commandIndex + 1 + command.name.length) + 1

				setInputValue(newValue)
				setCursorPosition(newCursorPosition)
				intendedCursorPositionRef.current = newCursorPosition

				setTimeout(() => {
					textAreaRef.current?.focus()
				}, 0)
			},
			[inputValue, setInputValue, setMode, customModes],
		)
		// kilocode_change end

		useEffect(() => {
			if (!showContextMenu) {
				setSelectedType(null)
			}
		}, [showContextMenu])

		const handleBlur = useCallback(() => {
			// Only hide the context menu if the user didn't click on it.
			if (!isMouseDownOnMenu) {
				setShowContextMenu(false)
				setShowSlashCommandsMenu(false) // kilocode_change: pull slash commands from Cline
			}

			setIsFocused(false)
		}, [isMouseDownOnMenu])

		const toPlainText = useCallback((node: Node, isLastSibling: boolean): string => {
			if (node.nodeType === Node.TEXT_NODE) {
				return node.textContent || ""
			}

			if (node.nodeType === Node.ELEMENT_NODE) {
				const el = node as HTMLElement

				if (el.dataset?.mentionValue) {
					return el.dataset.mentionValue
				}

				if (el.tagName === "BR") {
					return "\n"
				}

				const children = Array.from(el.childNodes)
				const text = children.map((child, idx) => toPlainText(child, idx === children.length - 1)).join("")

				if ((el.tagName === "DIV" || el.tagName === "P") && !isLastSibling) {
					return text + "\n"
				}

				return text
			}

			return ""
		}, [])

		const getPlainTextFromInput = useCallback(() => {
			if (!textAreaRef.current) return ""
			const children = Array.from(textAreaRef.current.childNodes)
			return children.map((child, idx) => toPlainText(child, idx === children.length - 1)).join("")
		}, [toPlainText])

		const handlePaste = useCallback(
			async (e: React.ClipboardEvent) => {
				const items = e.clipboardData.items

				const pastedText = e.clipboardData.getData("text")
				const pastedHtml = e.clipboardData.getData("text/html")

				// Check if the pasted content is a URL, add space after so user
				// can easily delete if they don't want it.
				const urlRegex = /^\S+:\/\/\S+$/
				if (urlRegex.test(pastedText.trim())) {
					e.preventDefault()
					const trimmedUrl = pastedText.trim()
					const newValue =
						inputValue.slice(0, cursorPosition) + trimmedUrl + " " + inputValue.slice(cursorPosition)
					setInputValue(newValue)
					const newCursorPosition = cursorPosition + trimmedUrl.length + 1
					setCursorPosition(newCursorPosition)
					intendedCursorPositionRef.current = newCursorPosition
					setShowContextMenu(false)

					return
				}

				// If there's HTML data, paste as plain text to clear formatting
				if (pastedHtml && pastedText) {
					e.preventDefault()
					const plainText = pastedText

					// Insert plain text directly into the DOM to preserve existing formatting
					const selection = window.getSelection()
					if (selection && selection.rangeCount > 0) {
						const range = selection.getRangeAt(0)
						const textNode = document.createTextNode(plainText)
						range.deleteContents()
						range.insertNode(textNode)

						// Move cursor to end of inserted text
						range.setStartAfter(textNode)
						range.setEndAfter(textNode)
						selection.removeAllRanges()
						selection.addRange(range)

						// Update state to match the new content
						const newValue = getPlainTextFromInput()
						setInputValue(newValue)
						const newCursorPosition = cursorPosition + plainText.length
						setCursorPosition(newCursorPosition)
						intendedCursorPositionRef.current = newCursorPosition
					}

					setShowContextMenu(false)
					return
				}

				const acceptedTypes = ["png", "jpeg", "webp"]

				const imageItems = Array.from(items).filter((item) => {
					const [type, subtype] = item.type.split("/")
					return type === "image" && acceptedTypes.includes(subtype)
				})

				// kilocode_change start: Image validation with warning messages
				if (imageItems.length > 0) {
					e.preventDefault()

					if (shouldDisableImages) {
						showImageWarning(`kilocode:imageWarnings.modelNoImageSupport`)
						return
					}
					if (selectedImages.length >= MAX_IMAGES_PER_MESSAGE) {
						showImageWarning(`kilocode:imageWarnings.maxImagesReached`)
						return
					}
					// kilocode_change end: Image validation with warning messages

					const imagePromises = imageItems.map((item) => {
						return new Promise<string | null>((resolve) => {
							const blob = item.getAsFile()

							if (!blob) {
								resolve(null)
								return
							}

							const reader = new FileReader()

							reader.onloadend = () => {
								if (reader.error) {
									console.error(t("chat:errorReadingFile"), reader.error)
									resolve(null)
								} else {
									const result = reader.result
									resolve(typeof result === "string" ? result : null)
								}
							}

							reader.readAsDataURL(blob)
						})
					})

					const imageDataArray = await Promise.all(imagePromises)
					const dataUrls = imageDataArray.filter((dataUrl): dataUrl is string => dataUrl !== null)

					if (dataUrls.length > 0) {
						setSelectedImages((prevImages) => [...prevImages, ...dataUrls].slice(0, MAX_IMAGES_PER_MESSAGE))
					} else {
						console.warn(t("chat:noValidImages"))
					}
				}
			},
			[
				shouldDisableImages,
				setSelectedImages,
				cursorPosition,
				setInputValue,
				inputValue,
				t,
				selectedImages.length, // kilocode_change - added selectedImages.length
				showImageWarning, // kilocode_change - added showImageWarning
				getPlainTextFromInput,
			],
		)

		const handleMenuMouseDown = useCallback(() => {
			setIsMouseDownOnMenu(true)
		}, [])

		const escapeHtml = (value: string) =>
			value.replace(/[&<>"']/g, (char) => {
				const map: Record<string, string> = {
					"&": "&amp;",
					"<": "&lt;",
					">": "&gt;",
					'"': "&quot;",
					"'": "&#39;",
				}
				return map[char] || char
			})

		const renderMentionChipLocal = useCallback(
			(rawMention: string, isCompactFile: boolean = false) => {
				return renderMentionChip(rawMention, materialIconsBaseUri, isCompactFile)
			},
			[materialIconsBaseUri],
		)

		const valueToHtml = useCallback(
			(value: string) => {
				let processedText = escapeHtml(value || "")

				processedText = processedText
					.replace(/\n/g, '<br data-plain-break="true">')
					.replace(/@([a-zA-Z0-9_.-]+\.[a-zA-Z0-9]+)(?=\s|$)/g, (_match, filename) => {
						if (mentionMapRef.current.has(filename)) {
							return renderMentionChipLocal(filename, true)
						}
						return _match
					})
					.replace(mentionRegexGlobal, (_match, mention) => renderMentionChipLocal(mention, false))

				if (/^\s*\//.test(processedText)) {
					const slashIndex = processedText.indexOf("/")
					const spaceIndex = processedText.indexOf(" ", slashIndex)
					const endIndex = spaceIndex > -1 ? spaceIndex : processedText.length
					const commandText = processedText.substring(slashIndex + 1, endIndex)
					const isValidCommand = validateSlashCommand(commandText, customModes)

					if (isValidCommand) {
						const fullCommand = processedText.substring(slashIndex, endIndex)
						const highlighted = `<mark class="slash-command-match-textarea-highlight">${fullCommand}</mark>`
						processedText =
							processedText.substring(0, slashIndex) + highlighted + processedText.substring(endIndex)
					}
				}

				return processedText || '<br data-plain-break="true">'
			},
			[customModes, renderMentionChipLocal],
		)

		const getNodeTextLength = useCallback((node: Node): number => {
			if (node.nodeType === Node.TEXT_NODE) {
				return node.textContent?.length || 0
			}

			if (node.nodeType === Node.ELEMENT_NODE) {
				const el = node as HTMLElement
				if (el.dataset?.mentionValue) {
					return el.dataset.mentionValue.length
				}

				if (el.tagName === "BR") {
					return 1
				}

				return Array.from(el.childNodes).reduce((total, child) => total + getNodeTextLength(child), 0)
			}

			return 0
		}, [])

		const getCaretPosition = useCallback(() => {
			if (!textAreaRef.current) return 0
			const selection = window.getSelection()
			if (!selection || selection.rangeCount === 0) return 0

			const { anchorNode, anchorOffset } = selection
			if (!anchorNode || !textAreaRef.current.contains(anchorNode)) {
				return 0
			}

			const computeOffset = (root: Node, target: Node, offset: number): number => {
				if (root === target) {
					return offset
				}

				let total = 0
				for (const child of Array.from(root.childNodes)) {
					if (child === target) {
						return total + computeOffset(child, target, offset)
					}

					if (child.contains(target)) {
						return total + computeOffset(child, target, offset)
					}

					total += getNodeTextLength(child)
				}

				return total
			}

			return computeOffset(textAreaRef.current, anchorNode, anchorOffset)
		}, [getNodeTextLength])

		const setCaretPosition = useCallback(
			(position: number) => {
				const el = textAreaRef.current
				if (!el) return

				let remaining = position

				const createRangeAt = (node: Node, offset: number): Range => {
					const range = document.createRange()
					range.setStart(node, offset)
					range.collapse(true)
					return range
				}

				const walk = (node: Node): Range | null => {
					if (node.nodeType === Node.TEXT_NODE) {
						const textLength = node.textContent?.length || 0
						const pos = Math.min(remaining, textLength)
						remaining -= pos
						return createRangeAt(node, pos)
					}

					if (node.nodeType === Node.ELEMENT_NODE) {
						const elNode = node as HTMLElement

						if (elNode.dataset?.mentionValue) {
							const parent = elNode.parentNode
							if (!parent) return null
							const siblings = Array.from(parent.childNodes)
							const index = siblings.indexOf(elNode)
							const targetIndex = remaining === 0 ? index : index + 1
							remaining = Math.max(remaining - elNode.dataset.mentionValue.length, 0)
							return createRangeAt(parent, targetIndex)
						}

						if (elNode.tagName === "BR") {
							const parent = elNode.parentNode
							if (!parent) return null
							const siblings = Array.from(parent.childNodes)
							const index = siblings.indexOf(elNode)

							if (remaining === 0) {
								return createRangeAt(parent, index)
							} else if (remaining === 1) {
								return createRangeAt(parent, index + 1)
							} else {
								remaining -= 1
								return null // Continue to next sibling
							}
						}

						for (const child of Array.from(elNode.childNodes)) {
							const childLength = getNodeTextLength(child)
							if (remaining <= childLength) {
								const result = walk(child)
								if (result) return result
								// If walk returns null, continue to next child
							} else {
								remaining -= childLength
							}
						}
					}

					return null
				}

				const range = walk(el)
				if (!range) return

				const selection = window.getSelection()
				if (!selection) return
				selection.removeAllRanges()
				selection.addRange(range)
			},
			[getNodeTextLength],
		)

		useLayoutEffect(() => {
			if (!textAreaRef.current) return

			// Only update innerHTML if the change is not from user input
			// This prevents destroying the selection when user is typing or pressing Enter
			if (isUserInputRef.current) {
				// Reset the flag after checking it
				isUserInputRef.current = false
				return // Skip innerHTML update to preserve selection
			}

			const html = valueToHtml(inputValue)
			if (textAreaRef.current.innerHTML !== html) {
				textAreaRef.current.innerHTML = html
				// Restore cursor position synchronously after innerHTML update
				if (intendedCursorPositionRef.current !== null) {
					setCaretPosition(intendedCursorPositionRef.current)
					intendedCursorPositionRef.current = null
				}
			}
		}, [inputValue, valueToHtml, setCaretPosition])

		const updateCursorPosition = useCallback(() => {
			setCursorPosition(getCaretPosition())
		}, [getCaretPosition])

		const handleKeyUp = useCallback(
			(e: React.KeyboardEvent<HTMLDivElement>) => {
				if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"].includes(e.key)) {
					updateCursorPosition()
				}
			},
			[updateCursorPosition],
		)

		const handleKeyDown = useCallback(
			(event: React.KeyboardEvent<HTMLDivElement>) => {
				if (showSlashCommandsMenu) {
					if (event.key === "Escape") {
						setShowSlashCommandsMenu(false)
						return
					}

					if (event.key === "ArrowUp" || event.key === "ArrowDown") {
						event.preventDefault()
						setSelectedSlashCommandsIndex((prevIndex) => {
							const direction = event.key === "ArrowUp" ? -1 : 1
							const commands = getMatchingSlashCommands(
								slashCommandsQuery,
								customModes,
								localWorkflows,
								globalWorkflows,
							)

							if (commands.length === 0) {
								return prevIndex
							}

							const newIndex = (prevIndex + direction + commands.length) % commands.length
							return newIndex
						})
						return
					}

					if ((event.key === "Enter" || event.key === "Tab") && selectedSlashCommandsIndex !== -1) {
						event.preventDefault()
						const commands = getMatchingSlashCommands(
							slashCommandsQuery,
							customModes,
							localWorkflows,
							globalWorkflows,
						)
						if (commands.length > 0) {
							handleSlashCommandsSelect(commands[selectedSlashCommandsIndex])
						}
						return
					}
				}

				if (showContextMenu) {
					if (event.key === "Escape") {
						setSelectedType(null)
						setSelectedMenuIndex(3)
						return
					}

					if (event.key === "ArrowUp" || event.key === "ArrowDown") {
						event.preventDefault()
						setSelectedMenuIndex((prevIndex) => {
							const direction = event.key === "ArrowUp" ? -1 : 1
							const options = getContextMenuOptions(
								searchQuery,
								selectedType,
								queryItems,
								fileSearchResults,
								allModes,
							)
							const optionsLength = options.length

							if (optionsLength === 0) return prevIndex

							const selectableOptions = options.filter(
								(option) =>
									option.type !== ContextMenuOptionType.URL &&
									option.type !== ContextMenuOptionType.NoResults,
							)

							if (selectableOptions.length === 0) return -1

							const currentSelectableIndex = selectableOptions.findIndex(
								(option) => option === options[prevIndex],
							)

							const newSelectableIndex =
								(currentSelectableIndex + direction + selectableOptions.length) %
								selectableOptions.length

							return options.findIndex((option) => option === selectableOptions[newSelectableIndex])
						})
						return
					}
					if ((event.key === "Enter" || event.key === "Tab") && selectedMenuIndex !== -1) {
						event.preventDefault()
						const selectedOption = getContextMenuOptions(
							searchQuery,
							selectedType,
							queryItems,
							fileSearchResults,
							allModes,
						)[selectedMenuIndex]
						if (
							selectedOption &&
							selectedOption.type !== ContextMenuOptionType.URL &&
							selectedOption.type !== ContextMenuOptionType.NoResults
						) {
							handleMentionSelect(selectedOption.type, selectedOption.value)
						}
						return
					}
				}

				const isComposing = event.nativeEvent?.isComposing ?? false

				const shouldSendMessage =
					!isComposing &&
					event.key === "Enter" &&
					((sendMessageOnEnter && !event.shiftKey) || (!sendMessageOnEnter && event.shiftKey))

				if (shouldSendMessage) {
					event.preventDefault()

					resetHistoryNavigation()
					handleSend()
					return
				}

				if (handleHistoryNavigation(event, showContextMenu, isComposing)) {
					return
				}

				if (event.key === "Backspace" && !isComposing) {
					const charBeforeCursor = inputValue[cursorPosition - 1]
					const charAfterCursor = inputValue[cursorPosition + 1]

					const charBeforeIsWhitespace =
						charBeforeCursor === " " || charBeforeCursor === "\n" || charBeforeCursor === "\r\n"

					const charAfterIsWhitespace =
						charAfterCursor === " " || charAfterCursor === "\n" || charAfterCursor === "\r\n"

					if (
						charBeforeIsWhitespace &&
		