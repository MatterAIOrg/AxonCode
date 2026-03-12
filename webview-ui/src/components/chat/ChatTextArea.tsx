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
import { FilePlus2, MessageSquareX, VolumeX } from "lucide-react"
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

// forked_change start: pull slash commands from Cline
import SlashCommandMenu from "@/components/chat/SlashCommandMenu"
import { ArrowRight02Icon } from "@/utils/customIcons"
import {
	SlashCommand,
	getMatchingSlashCommands,
	insertSlashCommand,
	shouldShowSlashCommandsMenu,
	validateSlashCommand,
} from "@/utils/slash-commands"
// forked_change end

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
			// sendingDisabled,
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

		// const [gitCommits, setGitCommits] = useState<any[]>([])
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
			// Match @word patterns that might be filenames or folder names
			return text.replace(/@([a-zA-Z0-9_.-]+(?:\.[a-zA-Z0-9]+)?)/g, (_match, name) => {
				const fullPath = mentionMapRef.current.get(name)
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
		// forked_change end

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
		// forked_change start: pull slash commands from Cline
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
			if (/^[a-f0-9]+$/i.test(searchQuery)) {
				const message: WebviewMessage = {
					type: "searchCommits",
					query: searchQuery || "",
				} as const
				vscode.postMessage(message)
			}
		}, [searchQuery])

		// forked_change start: Image warning handlers
		const showImageWarning = useCallback((messageKey: string) => {
			setImageWarning(messageKey)
		}, [])

		const dismissImageWarning = useCallback(() => {
			setImageWarning(null)
		}, [])
		// forked_change end: Image warning handlers

		// forked_change start: Clear images if unsupported
		// Track previous shouldDisableImages state to detect when model image support changes
		const prevShouldDisableImages = useRef<boolean>(shouldDisableImages)
		useEffect(() => {
			if (!prevShouldDisableImages.current && shouldDisableImages && selectedImages.length > 0) {
				setSelectedImages([])
				showImageWarning("kilocode:imageWarnings.imagesRemovedNoSupport")
			}
			prevShouldDisableImages.current = shouldDisableImages
		}, [shouldDisableImages, selectedImages.length, setSelectedImages, showImageWarning])
		// forked_change end: Clear images if unsupported

		const allModes = useMemo(() => getAllModes(customModes), [customModes])

		const queryItems = useMemo(() => {
			return [
				// { type: ContextMenuOptionType.Problems, value: "problems" },
				// { type: ContextMenuOptionType.Terminal, value: "terminal" },
				// ...gitCommits,
				// ...openedTabs
				// 	.filter((tab) => tab.path)
				// 	.map((tab) => ({
				// 		type: ContextMenuOptionType.OpenedFile,
				// 		value: "/" + tab.path,
				// 	})),
				...filePaths
					.map((file) => "/" + file)
					.map((path) => ({
						type: path.endsWith("/") ? ContextMenuOptionType.Folder : ContextMenuOptionType.File,
						value: path,
					})),
			]
		}, [filePaths])

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

		// forked_change start: pull slash commands from Cline
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
		// forked_change end

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
					// For text nodes, offset is a character offset — return directly.
					// For element nodes (e.g. the contenteditable div itself, or a <div>/<br>
					// wrapper inserted by the browser after Shift+Enter), offset is a child
					// index. We must sum the text lengths of children[0..offset) to get the
					// real character position.
					if (target.nodeType === Node.ELEMENT_NODE) {
						let total = 0
						const children = Array.from(target.childNodes)
						for (let i = 0; i < offset && i < children.length; i++) {
							total += getNodeTextLength(children[i])
						}
						return total
					}
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

		const getCurrentInputSnapshot = useCallback(() => {
			return {
				value: getPlainTextFromInput(),
				cursor: getCaretPosition(),
			}
		}, [getCaretPosition, getPlainTextFromInput])

		const handleMentionSelect = useCallback(
			(type: ContextMenuOptionType, value?: string) => {
				// forked_change start
				if (type === ContextMenuOptionType.Image) {
					setShowContextMenu(false)
					setSelectedType(null)

					const { value: currentValue, cursor: currentCursorPosition } = getCurrentInputSnapshot()
					const beforeCursor = currentValue.slice(0, currentCursorPosition)
					const afterCursor = currentValue.slice(currentCursorPosition)
					const lastAtIndex = beforeCursor.lastIndexOf("@")

					if (lastAtIndex !== -1) {
						const newValue = beforeCursor.slice(0, lastAtIndex) + afterCursor
						setInputValue(newValue)
						setCursorPosition(lastAtIndex)
						intendedCursorPositionRef.current = lastAtIndex
					} else if (currentValue !== inputValue) {
						setInputValue(currentValue)
						setCursorPosition(currentCursorPosition)
						intendedCursorPositionRef.current = currentCursorPosition
					}

					onSelectImages()
					return
				}
				// forked_change end

				if (type === ContextMenuOptionType.NoResults) {
					return
				}

				if (type === ContextMenuOptionType.File || type === ContextMenuOptionType.Folder) {
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

				if (type === ContextMenuOptionType.File || type === ContextMenuOptionType.Folder) {
					const fullPath = value || ""
					if (fullPath.startsWith("/")) {
						const segments = fullPath.split("/").filter(Boolean)
						const filename = segments.pop() || fullPath
						insertValue = filename
						mentionMapRef.current.set(filename, fullPath)
					} else {
						insertValue = fullPath
					}
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
			[cursorPosition, getCurrentInputSnapshot, inputValue, onSelectImages, setInputValue, setCursorPosition],
		)

		const handlePaste = useCallback(
			async (e: React.ClipboardEvent) => {
				const items = e.clipboardData.items

				const pastedText = e.clipboardData.getData("text")
				const _pastedHtml = e.clipboardData.getData("text/html")

				// Use actual DOM caret position and text content (React state may be stale
				// after Shift+Enter inserts a newline — inputValue won't re-render until next
				// cycle, but the DOM is already updated)
				const actualCursorPosition = getCaretPosition()
				const currentValue = getPlainTextFromInput()

				// Check if the pasted content is a URL, add space after so user
				// can easily delete if they don't want it.
				const urlRegex = /^\S+:\/\/\S+$/
				if (urlRegex.test(pastedText.trim())) {
					e.preventDefault()
					const trimmedUrl = pastedText.trim()
					const newValue =
						currentValue.slice(0, actualCursorPosition) +
						trimmedUrl +
						" " +
						currentValue.slice(actualCursorPosition)
					setInputValue(newValue)
					const newCursorPosition = actualCursorPosition + trimmedUrl.length + 1
					setCursorPosition(newCursorPosition)
					intendedCursorPositionRef.current = newCursorPosition
					setShowContextMenu(false)

					return
				}

				// Handle all text pastes (both HTML and plain text) manually to ensure correct
				// cursor position handling with mention chips. Browser default paste behavior
				// doesn't understand mention chips and can insert text in wrong positions.
				if (pastedText) {
					e.preventDefault()
					const plainText = pastedText

					const newValue =
						currentValue.slice(0, actualCursorPosition) +
						plainText +
						currentValue.slice(actualCursorPosition)
					const newCursorPosition = actualCursorPosition + plainText.length

					setInputValue(newValue)
					setCursorPosition(newCursorPosition)
					intendedCursorPositionRef.current = newCursorPosition
					setShowContextMenu(false)
					return
				}

				const acceptedTypes = ["png", "jpeg", "webp"]

				const imageItems = Array.from(items).filter((item) => {
					const [type, subtype] = item.type.split("/")
					return type === "image" && acceptedTypes.includes(subtype)
				})

				// forked_change start: Image validation with warning messages
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
					// forked_change end: Image validation with warning messages

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
				setInputValue,
				t,
				selectedImages.length, // kilocode_change - added selectedImages.length
				showImageWarning, // kilocode_change - added showImageWarning
				getCaretPosition,
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
					.replace(/@([a-zA-Z0-9_.-]+(?:\.[a-zA-Z0-9]+)?)(?=\s|$)/g, (_match, name) => {
						if (mentionMapRef.current.has(name)) {
							return renderMentionChipLocal(name, true)
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

					// Don't intercept modifier+Enter (e.g. cmd+enter for new line)
					if (
						(event.key === "Enter" || event.key === "Tab") &&
						selectedSlashCommandsIndex !== -1 &&
						!event.metaKey &&
						!event.ctrlKey
					) {
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
									// option.type !== ContextMenuOptionType.URL &&
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
					// Don't intercept modifier+Enter (e.g. cmd+enter for new line)
					if (
						(event.key === "Enter" || event.key === "Tab") &&
						selectedMenuIndex !== -1 &&
						!event.metaKey &&
						!event.ctrlKey
					) {
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
							// selectedOption.type !== ContextMenuOptionType.URL &&
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
					!event.metaKey &&
					!event.ctrlKey &&
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
						inputValue.slice(0, cursorPosition - 1).match(new RegExp(mentionRegex.source + "$"))
					) {
						const newCursorPosition = cursorPosition - 1
						if (!charAfterIsWhitespace) {
							event.preventDefault()
							setCaretPosition(newCursorPosition)
							setCursorPosition(newCursorPosition)
						}

						setCursorPosition(newCursorPosition)
						setJustDeletedSpaceAfterMention(true)
					} else if (justDeletedSpaceAfterMention) {
						const { newText, newPosition } = removeMention(inputValue, cursorPosition)

						if (newText !== inputValue) {
							event.preventDefault()
							setInputValue(newText)
							intendedCursorPositionRef.current = newPosition
						}

						setJustDeletedSpaceAfterMention(false)
						setShowContextMenu(false)
					} else {
						setJustDeletedSpaceAfterMention(false)
					}
				}
			},
			[
				showSlashCommandsMenu,
				localWorkflows,
				globalWorkflows,
				customModes,
				handleSlashCommandsSelect,
				selectedSlashCommandsIndex,
				slashCommandsQuery,
				handleSend,
				showContextMenu,
				searchQuery,
				selectedMenuIndex,
				handleMentionSelect,
				selectedType,
				inputValue,
				cursorPosition,
				setInputValue,
				justDeletedSpaceAfterMention,
				queryItems,
				allModes,
				fileSearchResults,
				handleHistoryNavigation,
				resetHistoryNavigation,
				sendMessageOnEnter,
				setCaretPosition,
			],
		)

		const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null)

		const handleInputChange = useCallback(() => {
			const newValue = getPlainTextFromInput()
			setInputValue(newValue)
			isUserInputRef.current = true // Mark this as user input using ref
			resetOnInputChange()

			const newCursorPosition = getCaretPosition()
			setCursorPosition(newCursorPosition)
			intendedCursorPositionRef.current = newCursorPosition

			let showMenu = shouldShowContextMenu(newValue, newCursorPosition)
			const slashMenuVisible = shouldShowSlashCommandsMenu(newValue, newCursorPosition)

			if (slashMenuVisible) {
				showMenu = false
			}

			setShowSlashCommandsMenu(slashMenuVisible)
			setShowContextMenu(showMenu)

			if (slashMenuVisible) {
				const slashIndex = newValue.indexOf("/")
				const query = newValue.slice(slashIndex + 1, newCursorPosition)
				setSlashCommandsQuery(query)
				setSelectedSlashCommandsIndex(0)
			} else {
				setSlashCommandsQuery("")
				setSelectedSlashCommandsIndex(0)
			}

			if (showMenu) {
				const lastAtIndex = newValue.lastIndexOf("@", newCursorPosition - 1)

				if (newValue.startsWith("/") && lastAtIndex === -1) {
					const query = newValue
					setSearchQuery(query)
					setSelectedMenuIndex(0)
				} else {
					const query = newValue.slice(lastAtIndex + 1, newCursorPosition)
					setSearchQuery(query)

					if (query.length > 0) {
						setSelectedMenuIndex(0)

						if (searchTimeoutRef.current) {
							clearTimeout(searchTimeoutRef.current)
						}

						searchTimeoutRef.current = setTimeout(() => {
							const reqId = Math.random().toString(36).substring(2, 9)
							setSearchRequestId(reqId)
							setSearchLoading(true)

							vscode.postMessage({
								type: "searchFiles",
								query: unescapeSpaces(query),
								requestId: reqId,
							})
						}, 200)
					} else {
						setSelectedMenuIndex(-1)
					}
				}
			} else {
				setSearchQuery("")
				setSelectedMenuIndex(-1)
				setFileSearchResults([])
			}

			if (textAreaRef.current) {
				onHeightChange?.(textAreaRef.current.clientHeight)
			}
		}, [
			getPlainTextFromInput,
			getCaretPosition,
			resetOnInputChange,
			setInputValue,
			setCursorPosition,
			setShowSlashCommandsMenu,
			setShowContextMenu,
			setSlashCommandsQuery,
			setSelectedSlashCommandsIndex,
			setSearchQuery,
			setSelectedMenuIndex,
			setSearchRequestId,
			setSearchLoading,
			setFileSearchResults,
			onHeightChange,
		])

		// Handle enhanced prompt response and search results.
		useEffect(() => {
			const messageHandler = (event: MessageEvent) => {
				const message = event.data

				if (message.type === "enhancedPrompt") {
					if (message.text && textAreaRef.current) {
						try {
							// Use execCommand to replace text while preserving undo history
							if (document.execCommand) {
								// Use native browser methods to preserve undo stack
								const textarea = textAreaRef.current

								// Focus the textarea to ensure it's the active element
								textarea.focus()

								// Select all text first
								const selection = window.getSelection()
								if (selection) {
									selection.removeAllRanges()
									const range = document.createRange()
									range.selectNodeContents(textarea)
									selection.addRange(range)
								}
								document.execCommand("insertText", false, message.text)
								handleInputChange()
							} else {
								setInputValue(message.text)
							}
						} catch {
							setInputValue(message.text)
						}
					}
				}
				// else if (message.type === "commitSearchResults") {
				// 	const commits = message.commits.map((commit: any) => ({
				// 		type: ContextMenuOptionType.Git,
				// 		value: commit.hash,
				// 		label: commit.subject,
				// 		description: `${commit.shortHash} by ${commit.author} on ${commit.date}`,
				// 		icon: "$(git-commit)",
				// 	}))

				// 	setGitCommits(commits)
				// }
				else if (message.type === "fileSearchResults") {
					setSearchLoading(false)
					if (message.requestId === searchRequestId) {
						setFileSearchResults(message.results || [])
					}
					// forked_change start
				} else if (message.type === "insertTextToChatArea") {
					if (message.text) {
						setInputValue(message.text)
						setTimeout(() => {
							if (textAreaRef.current) {
								textAreaRef.current.focus()
							}
						}, 0)
					}
				}
				// forked_change end
			}

			window.addEventListener("message", messageHandler)
			return () => window.removeEventListener("message", messageHandler)
		}, [handleInputChange, searchRequestId, setInputValue])

		const handleDrop = useCallback(
			async (e: React.DragEvent<HTMLDivElement>) => {
				e.preventDefault()
				setIsDraggingOver(false)

				const textFieldList = e.dataTransfer.getData("text")
				const textUriList = e.dataTransfer.getData("application/vnd.code.uri-list")
				// When textFieldList is empty, it may attempt to use textUriList obtained from drag-and-drop tabs; if not empty, it will use textFieldList.
				const text = textFieldList || textUriList
				if (text) {
					// Split text on newlines to handle multiple files
					const lines = text.split(/\r?\n/).filter((line) => line.trim() !== "")

					if (lines.length > 0) {
						// Process each line as a separate file path
						let newValue = inputValue.slice(0, cursorPosition)
						let totalLength = 0

						// Using a standard for loop instead of forEach for potential performance gains.
						for (let i = 0; i < lines.length; i++) {
							const line = lines[i]
							// Convert each path to a mention-friendly format
							const fullMention = convertToMentionPath(line, cwd)
							// Extract filename for compact display
							let mentionText = fullMention
							if (fullMention.startsWith("@/")) {
								const pathWithoutAt = fullMention.slice(1) // Remove @
								const segments = pathWithoutAt.split("/").filter(Boolean)
								const filename = segments.pop() || pathWithoutAt
								mentionText = `${filename}`
								// Store mapping for expansion
								mentionMapRef.current.set(filename, pathWithoutAt)
							}
							newValue += mentionText
							totalLength += mentionText.length

							// Add space after each mention except the last one
							if (i < lines.length - 1) {
								newValue += " "
								totalLength += 1
							}
						}

						// Add space after the last mention and append the rest of the input
						newValue += " " + inputValue.slice(cursorPosition)
						totalLength += 1

						setInputValue(newValue)
						const newCursorPosition = cursorPosition + totalLength + 1
						setCursorPosition(newCursorPosition)
						intendedCursorPositionRef.current = newCursorPosition
					}

					return
				}

				const files = Array.from(e.dataTransfer.files)

				if (files.length > 0) {
					const acceptedTypes = ["png", "jpeg", "webp"]

					const imageFiles = files.filter((file) => {
						const [type, subtype] = file.type.split("/")
						return type === "image" && acceptedTypes.includes(subtype)
					})

					// forked_change start: Image validation with warning messages for drag and drop
					if (imageFiles.length > 0) {
						if (shouldDisableImages) {
							showImageWarning("kilocode:imageWarnings.modelNoImageSupport")
							return
						}
						if (selectedImages.length >= MAX_IMAGES_PER_MESSAGE) {
							showImageWarning("kilocode:imageWarnings.maxImagesReached")
							return
						}
						// forked_change end: Image validation with warning messages for drag and drop

						const imagePromises = imageFiles.map((file) => {
							return new Promise<string | null>((resolve) => {
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

								reader.readAsDataURL(file)
							})
						})

						const imageDataArray = await Promise.all(imagePromises)
						const dataUrls = imageDataArray.filter((dataUrl): dataUrl is string => dataUrl !== null)

						if (dataUrls.length > 0) {
							setSelectedImages((prevImages) =>
								[...prevImages, ...dataUrls].slice(0, MAX_IMAGES_PER_MESSAGE),
							)

							if (typeof vscode !== "undefined") {
								vscode.postMessage({ type: "draggedImages", dataUrls: dataUrls })
							}
						} else {
							console.warn(t("chat:noValidImages"))
						}
					}
				}
			},
			[
				cursorPosition,
				cwd,
				inputValue,
				setInputValue,
				setCursorPosition,
				shouldDisableImages,
				setSelectedImages,
				t,
				selectedImages.length, // kilocode_change - added selectedImages.length
				showImageWarning, // kilocode_change - added showImageWarning
			],
		)

		const [isTtsPlaying, setIsTtsPlaying] = useState(false)

		useEvent("message", (event: MessageEvent) => {
			const message: ExtensionMessage = event.data

			if (message.type === "ttsStart") {
				setIsTtsPlaying(true)
			} else if (message.type === "ttsStop") {
				setIsTtsPlaying(false)
			}
		})

		const placeholderBottomText = `${t("chat:addContext")}${shouldDisableImages ? `, ${t("chat:dragFiles")}` : `, ${t("chat:dragFilesImages")}`}`

		// Common mode selector handler
		// const handleModeChange = useCallback(
		// 	(value: Mode) => {
		// 		setMode(value)
		// 		vscode.postMessage({ type: "mode", text: value })
		// 	},
		// 	[setMode],
		// )

		// // Helper function to get API config dropdown options
		// // kilocode_change: unused
		// const _getApiConfigOptions = useMemo(() => {
		// 	const pinnedConfigs = (listApiConfigMeta || [])
		// 		.filter((config) => pinnedApiConfigs && pinnedApiConfigs[config.id])
		// 		.map((config) => ({
		// 			value: config.id,
		// 			label: config.name,
		// 			name: config.name,
		// 			type: DropdownOptionType.ITEM,
		// 			pinned: true,
		// 		}))
		// 		.sort((a, b) => a.label.localeCompare(b.label))

		// 	const unpinnedConfigs = (listApiConfigMeta || [])
		// 		.filter((config) => !pinnedApiConfigs || !pinnedApiConfigs[config.id])
		// 		.map((config) => ({
		// 			value: config.id,
		// 			label: config.name,
		// 			name: config.name,
		// 			type: DropdownOptionType.ITEM,
		// 			pinned: false,
		// 		}))
		// 		.sort((a, b) => a.label.localeCompare(b.label))

		// 	const hasPinnedAndUnpinned = pinnedConfigs.length > 0 && unpinnedConfigs.length > 0

		// 	return [
		// 		...pinnedConfigs,
		// 		...(hasPinnedAndUnpinned
		// 			? [
		// 				{
		// 					value: "sep-pinned",
		// 					label: t("chat:separator"),
		// 					type: DropdownOptionType.SEPARATOR,
		// 				},
		// 			]
		// 			: []),
		// 		...unpinnedConfigs,
		// 		{
		// 			value: "sep-2",
		// 			label: t("chat:separator"),
		// 			type: DropdownOptionType.SEPARATOR,
		// 		},
		// 		{
		// 			value: "settingsButtonClicked",
		// 			label: t("chat:edit"),
		// 			type: DropdownOptionType.ACTION,
		// 		},
		// 	]
		// }, [listApiConfigMeta, pinnedApiConfigs, t])

		// Helper function to handle API config change
		// kilocode_change: unused
		// const _handleApiConfigChange = useCallback((value: string) => {
		// 	if (value === "settingsButtonClicked") {
		// 		vscode.postMessage({
		// 			type: "loadApiConfiguration",
		// 			text: value,
		// 			values: { section: "providers" },
		// 		})
		// 	} else {
		// 		vscode.postMessage({ type: "loadApiConfigurationById", text: value })
		// 	}
		// }, [])

		// Helper function to render API config item
		// kilocode_change: unused
		// const _renderApiConfigItem = useCallback(
		// 	({ type, value, label, pinned }: any) => {
		// 		if (type !== DropdownOptionType.ITEM) {
		// 			return label
		// 		}

		// 		const config = listApiConfigMeta?.find((c) => c.id === value)
		// 		const isCurrentConfig = config?.name === currentApiConfigName

		// 		return (
		// 			<div className="flex justify-between gap-2 w-full h-5">
		// 				<div
		// 					className={cn("truncate min-w-0 overflow-hidden", {
		// 						"font-medium": isCurrentConfig,
		// 					})}>
		// 					{label}
		// 				</div>
		// 				<div className="flex justify-end w-10 flex-shrink-0">
		// 					<div
		// 						className={cn("size-5 p-1", {
		// 							"block group-hover:hidden": !pinned,
		// 							hidden: !isCurrentConfig,
		// 						})}>
		// 						<Check className="size-3" />
		// 					</div>
		// 					<StandardTooltip content={pinned ? t("chat:unpin") : t("chat:pin")}>
		// 						<Button
		// 							variant="ghost"
		// 							size="icon"
		// 							onClick={(e) => {
		// 								e.stopPropagation()
		// 								togglePinnedApiConfig(value)
		// 								vscode.postMessage({
		// 									type: "toggleApiConfigPin",
		// 									text: value,
		// 								})
		// 							}}
		// 							className={cn("size-5", {
		// 								"hidden group-hover:flex": !pinned,
		// 								"bg-accent": pinned,
		// 							})}>
		// 							<Pin className="size-3 p-0.5 opacity-50" />
		// 						</Button>
		// 					</StandardTooltip>
		// 				</div>
		// 			</div>
		// 		)
		// 	},
		// 	[listApiConfigMeta, currentApiConfigName, t, togglePinnedApiConfig],
		// )

		// Helper function to render the text area section
		const renderTextAreaSection = () => (
			<div
				ref={containerRef}
				className={cn(
					"relative",
					"flex-1",
					"flex",
					"flex-col",
					"min-h-0",
					"overflow-hidden",
					"rounded-xl",
					isFocused
						? "border border-[var(--vscode-activityBar-border)]"
						: isDraggingOver
							? "border-2 border-dashed border-[var(--vscode-activityBar-border)]"
							: "border border-[var(--vscode-activityBar-border)]",
					isDraggingOver
						? "bg-[color-mix(in_srgb,var(--vscode-input-background)_95%,white)]"
						: "bg-vscode-input-background",
					"transition-background-color duration-150 ease-in-out",
					"will-change-background-color",
					"outline-none",
				)}>
				<div
					ref={(el) => {
						if (typeof ref === "function") {
							ref(el)
						} else if (ref) {
							ref.current = el
						}
						textAreaRef.current = el
					}}
					role="textbox"
					contentEditable
					suppressContentEditableWarning
					aria-multiline="true"
					data-testid="chat-input"
					onInput={handleInputChange}
					onFocus={() => setIsFocused(true)}
					onKeyDown={(e) => {
						if (isEditMode && e.key === "Escape" && !e.nativeEvent?.isComposing) {
							e.preventDefault()
							onCancel?.()
							return
						}
						handleKeyDown(e)
					}}
					onKeyUp={handleKeyUp}
					onBlur={handleBlur}
					onPaste={handlePaste}
					onSelect={updateCursorPosition}
					onMouseUp={updateCursorPosition}
					onScroll={updateCursorPosition}
					spellCheck={false}
					autoFocus
					className={cn(
						"w-full",
						"text-vscode-input-foreground",
						"font-vscode-font-family",
						"text-vscode-editor-font-size",
						"cursor-text",
						"outline-none",
						isEditMode ? "pt-1.5 pb-2 px-2" : "py-1.5 px-2",
						"min-h-[80px]",
						"max-h-[calc(100vh/2.5)]",
						"box-border",
						"overflow-x-hidden",
						"overflow-y-auto",
						"flex-grow",
						"scrollbar-none",
						"scrollbar-hide",
						"whitespace-pre-wrap",
						"break-words",
					)}
					style={{
						caretColor: "var(--vscode-input-foreground)",
						lineHeight: "16px",
					}}
				/>

				{isTtsPlaying && (
					<StandardTooltip content={t("chat:stopTts")}>
						<Button
							variant="ghost"
							size="icon"
							className="absolute top-0 right-0 opacity-25 hover:opacity-100 z-10"
							onClick={() => vscode.postMessage({ type: "stopTts" })}>
							<VolumeX className="size-4" />
						</Button>
					</StandardTooltip>
				)}

				{!inputValue && (
					<div
						className="absolute inset-0 z-[3] px-2 flex items-start pt-1.5"
						style={{
							color: "var(--vscode-tab-inactiveForeground)",
							userSelect: "none",
							pointerEvents: "none",
							whiteSpace: "pre-wrap",
							lineHeight: "var(--vscode-editor-line-height)",
						}}>
						<span>{placeholderBottomText}</span>
					</div>
				)}

				{/* Bottom controls section */}
				<div className="flex items-center justify-between px-2 pb-1.5 pt-0 shrink-0">
					<div className="flex items-center gap-1 min-w-0">
						<div className="shrink-0">
							<KiloModeSelector
								value={mode}
								onChange={setMode}
								modeShortcutText={modeShortcutText}
								customModes={customModes}
							/>
						</div>
						{apiConfiguration && (
							<div className="mt-1 w-auto overflow-hidden min-w-0" data-testid="model-selector">
								<ModelSelector
									currentApiConfigName={currentApiConfigName}
									apiConfiguration={apiConfiguration}
									fallbackText={`${selectedProvider}:${selectedModelId}`}
								/>
							</div>
						)}
					</div>
					<div className="flex items-center gap-0">
						{!isEditMode && (
							<div className="flex items-center gap-0.5">
								<ContextUsageIndicator className={cn({ hidden: containerWidth < 235 })} />
								<IndexingStatusBadge className={cn({ hidden: containerWidth < 235 })} />
							</div>
						)}
						<StandardTooltip content="Add Context (@)">
							<button
								aria-label="Add Context (@)"
								disabled={showContextMenu}
								onClick={() => {
									if (showContextMenu || !textAreaRef.current) return

									textAreaRef.current.focus()
									const { value: currentValue, cursor: currentCursorPosition } =
										getCurrentInputSnapshot()
									const nextValue =
										currentValue.slice(0, currentCursorPosition) +
										" @" +
										currentValue.slice(currentCursorPosition)
									const nextCursorPosition = currentCursorPosition + 2

									setInputValue(nextValue)
									setCursorPosition(nextCursorPosition)
									intendedCursorPositionRef.current = nextCursorPosition
									setShowContextMenu(true)
									setSearchQuery("")
									setSelectedMenuIndex(4)
								}}
								className={cn(
									"relative inline-flex items-center justify-center",
									"bg-transparent border-none py-1.5",
									"rounded-md min-w-[24px] min-h-[28px]",
									"opacity-80 hover:opacity-100 text-vscode-descriptionForeground hover:text-vscode-foreground",
									"transition-all duration-150",
									"focus-visible:ring-1 focus-visible:ring-white/50",
									"active:bg-[rgba(255,255,255,0.1)]",
									!showContextMenu && "cursor-pointer",
									showContextMenu &&
										"opacity-40 cursor-not-allowed grayscale-[30%] hover:bg-transparent hover:border-[rgba(255,255,255,0.08)] active:bg-transparent",
								)}>
								<FilePlus2 className={cn("w-4", "h-4", { hidden: containerWidth < 235 })} />
							</button>
						</StandardTooltip>
						{isEditMode && (
							<StandardTooltip content={t("chat:cancel.title")}>
								<button
									aria-label={t("chat:cancel.title")}
									disabled={false}
									onClick={onCancel}
									className={cn(
										"relative inline-flex items-center justify-center",
										"bg-transparent border-none py-1.5",
										"rounded-md min-w-[24px] min-h-[28px]",
										"opacity-60 hover:opacity-100 text-vscode-descriptionForeground hover:text-vscode-foreground",
										"transition-all duration-150",
										"focus-visible:ring-1 focus-visible:ring-white/50",
										"active:bg-[rgba(255,255,255,0.1)]",
										"cursor-pointer",
									)}>
									<MessageSquareX className="w-4 h-4" />
								</button>
							</StandardTooltip>
						)}
						<StandardTooltip content={isStreaming ? t("chat:cancel.title") : t("chat:sendMessage")}>
							<button
								aria-label={isStreaming ? t("chat:cancel.title") : t("chat:sendMessage")}
								disabled={false}
								onClick={isStreaming && !inputValue.trim() ? onCancelStreaming : handleSend}
								className={cn(
									"relative inline-flex items-center justify-center",
									"bg-transparent border-none",
									"rounded-md min-w-[28px] min-h-[28px]",
									"opacity-100 hover:opacity-100 text-vscode-descriptionForeground hover:text-vscode-foreground",
									"transition-all duration-150",
									"focus-visible:ring-1 focus-visible:ring-white/50",
									"active:bg-[rgba(255,255,255,0.1)]",
									"cursor-pointer",
									isStreaming &&
										!inputValue.trim() &&
										"text-red-400 hover:text-red-300 hover:bg-red-500/10",
								)}>
								{isStreaming ? (
									<div className="w-4 h-4 bg-current rounded-sm"></div>
								) : (
									<div className="w-5.5 h-5.5 rounded-full bg-current/20 flex items-center justify-center">
										<ArrowRight02Icon className="w-4 h-4 rtl:-scale-x-100" />
									</div>
								)}
							</button>
						</StandardTooltip>
					</div>
				</div>
			</div>
		)

		return (
			<div
				className={cn(
					"relative",
					"flex",
					"flex-col",
					"gap-1",
					"bg-editor-background",
					isEditMode ? "px-0" : "px-1.5",
					"outline-none",
					"border-none",
					isEditMode ? "w-full" : "w-[calc(100%-16px)]",
					"ml-auto",
					"mr-auto",
					"box-border",
				)}
				style={{}}>
				{/* Pinned file review actions (not a chat row) */}
				{!isEditMode && (
					<div className="px-0.5">
						<AcceptRejectButtons onDismiss={() => {}} />
					</div>
				)}
				<div className="relative">
					<div
						className={cn(
							"chat-text-area",
							"relative",
							"flex",
							"flex-col",
							"outline-none",
							"rounded-xl",
							"border-none",
						)}
						onDrop={handleDrop}
						onDragOver={(e) => {
							// Only allowed to drop images/files on shift key pressed.
							if (!e.shiftKey) {
								setIsDraggingOver(false)
								return
							}

							e.preventDefault()
							setIsDraggingOver(true)
							e.dataTransfer.dropEffect = "copy"
						}}
						onDragLeave={(e) => {
							e.preventDefault()
							const rect = e.currentTarget.getBoundingClientRect()

							if (
								e.clientX <= rect.left ||
								e.clientX >= rect.right ||
								e.clientY <= rect.top ||
								e.clientY >= rect.bottom
							) {
								setIsDraggingOver(false)
							}
						}}>
						{/* forked_change start: ImageWarningBanner integration */}
						<ImageWarningBanner
							messageKey={imageWarning ?? ""}
							onDismiss={dismissImageWarning}
							isVisible={!!imageWarning}
						/>
						{/* forked_change end: ImageWarningBanner integration */}
						{/* forked_change start: pull slash commands from Cline */}
						{showSlashCommandsMenu && (
							<div ref={slashCommandsMenuContainerRef}>
								<SlashCommandMenu
									onSelect={handleSlashCommandsSelect}
									selectedIndex={selectedSlashCommandsIndex}
									setSelectedIndex={setSelectedSlashCommandsIndex}
									onMouseDown={handleMenuMouseDown}
									query={slashCommandsQuery}
									customModes={customModes}
								/>
							</div>
						)}
						{/* forked_change end: pull slash commands from Cline */}
						{showContextMenu && (
							<div
								ref={contextMenuContainerRef}
								className={cn(
									"absolute",
									"bottom-full",
									"left-0",
									"right-0",
									"z-[1000]",
									"mb-2",
									"filter",
									"drop-shadow-md",
									"rounded-xl",
									"border",
									"border-[var(--vscode-activityBar-border)]",
									"outline-none",
								)}>
								<ContextMenu
									onSelect={handleMentionSelect}
									searchQuery={searchQuery}
									inputValue={inputValue}
									onMouseDown={handleMenuMouseDown}
									selectedIndex={selectedMenuIndex}
									setSelectedIndex={setSelectedMenuIndex}
									selectedType={selectedType}
									queryItems={queryItems}
									// modes={allModes}
									loading={searchLoading}
									dynamicSearchResults={fileSearchResults}
								/>
							</div>
						)}

						{renderTextAreaSection()}
					</div>
				</div>

				{selectedImages.length > 0 && (
					<Thumbnails
						images={selectedImages}
						setImages={setSelectedImages}
						style={{
							left: "16px",
							zIndex: 2,
							marginTop: "4px",
							marginBottom: 0,
						}}
					/>
				)}
			</div>
		)
	},
)
