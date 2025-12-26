import React, { useEffect, useMemo, useRef, useState } from "react"
import { useExtensionState } from "@/context/ExtensionStateContext"
import { valueToHtml } from "@/utils/chat-render"
import { vscode } from "@/utils/vscode"

interface ReadOnlyChatTextProps {
	value: string
	className?: string
	onClick?: () => void
	title?: string
}

export const ReadOnlyChatText: React.FC<ReadOnlyChatTextProps> = ({ value, className, onClick, title }) => {
	const { customModes, filePaths, openedTabs } = useExtensionState()
	const [materialIconsBaseUri, setMaterialIconsBaseUri] = useState("")
	const contentRef = useRef<HTMLDivElement>(null)
	const mentionMapRef = useRef<Map<string, string>>(new Map())

	useEffect(() => {
		const w = window as any
		setMaterialIconsBaseUri(w.MATERIAL_ICONS_BASE_URI)
	}, [])

	// Build mention map similar to ChatTextArea
	useEffect(() => {
		mentionMapRef.current.clear()

		// Add opened tabs to mention map
		openedTabs
			.filter((tab) => tab.path)
			.forEach((tab) => {
				const fullPath = "/" + tab.path
				const segments = fullPath.split("/").filter(Boolean)
				const filename = segments.pop() || fullPath
				mentionMapRef.current.set(filename, fullPath)
			})

		// Add file paths to mention map (excluding already added opened tabs)
		filePaths
			.map((file) => "/" + file)
			.filter((path) => !openedTabs.some((tab) => tab.path && "/" + tab.path === path))
			.forEach((fullPath) => {
				const segments = fullPath.split("/").filter(Boolean)
				const filename = segments.pop() || fullPath
				mentionMapRef.current.set(filename, fullPath)
			})
	}, [filePaths, openedTabs])

	const htmlContent = useMemo(() => {
		if (!value) return '<br data-plain-break="true">'
		return valueToHtml(value, materialIconsBaseUri, mentionMapRef.current, customModes)
	}, [value, materialIconsBaseUri, customModes])

	const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
		const target = e.target as HTMLElement

		if (target.closest(".mention-chip")) {
			e.preventDefault()
			e.stopPropagation()
			const mentionValue = target.closest(".mention-chip")?.getAttribute("data-mention-value")
			if (mentionValue) {
				vscode.postMessage({ type: "openMention", text: mentionValue.replace(/^@/, "") })
			}
			return
		}

		if (onClick) {
			onClick()
		}
	}

	useEffect(() => {
		if (!contentRef.current) return

		contentRef.current.innerHTML = htmlContent
	}, [htmlContent])

	return (
		<div
			ref={contentRef}
			className={className}
			onClick={handleClick}
			title={title}
			style={{ cursor: onClick ? "pointer" : "default" }}
		/>
	)
}
