import { fireEvent, screen } from "@testing-library/react"
import { useState } from "react"
import { describe, expect, it, vi } from "vitest"

import { render } from "@src/utils/test-utils"

import { ChatTextArea, mergePasteChips } from "@/components/chat/ChatTextArea"
import { formatPasteChipName } from "@/components/common/PasteChips"
import { defaultModeSlug } from "@roo/modes"

vi.mock("@src/utils/vscode", () => ({
	vscode: {
		postMessage: vi.fn(),
		getState: vi.fn(),
		setState: vi.fn(),
	},
}))

vi.mock("@src/context/ExtensionStateContext", () => ({
	useExtensionState: vi.fn(() => ({
		filePaths: [],
		openedTabs: [],
		apiConfiguration: { apiProvider: "mock" },
		customModes: [],
		localWorkflows: [],
		globalWorkflows: [],
		clineMessages: [],
		taskHistoryVersion: 1,
		cwd: "/test/workspace",
	})),
}))

vi.mock("@tanstack/react-query", () => ({
	useQuery: vi.fn(() => ({
		data: undefined,
		isLoading: false,
		isError: false,
	})),
}))

vi.mock("@src/components/ui/hooks/useSelectedModel", () => ({
	useSelectedModel: () => ({ id: "mock-model-id", provider: "mock-provider" }),
}))

vi.mock("@src/utils/path-mentions", () => ({
	mentionRegex: /@/,
	mentionRegexGlobal: /@/g,
}))

const longText = `# Product Requirements Document

## Overview
This document specifies the requirements for the new chat paste chip feature. When a user pastes more than five hundred characters into the chat composer, the pasted content is collapsed into a single chip in the attachment strip so the input area stays clean and readable. The chip shows the first few words of the pasted text, and the full content is merged into the message at the exact cursor position where the paste happened when the message is sent.

## Requirements
1. Paste threshold must be configurable and default to 500 characters.
2. The chip must display a truncated preview of the pasted text.
3. Sending the message must merge the full pasted text seamlessly.
4. The cursor position must be preserved across the chip insertion.
5. Removing a chip must drop its text from the outgoing message.
6. The feature must work in both normal chat and edit modes.
7. Existing mention chips must continue to work unchanged.`

describe("ChatTextArea paste chips", () => {
	const defaultProps = {
		sendingDisabled: false,
		selectApiConfigDisabled: false,
		onSelectImages: vi.fn(),
		shouldDisableImages: false,
		placeholderText: "Type a message...",
		selectedImages: [],
		setSelectedImages: vi.fn(),
		onHeightChange: vi.fn(),
		mode: defaultModeSlug,
		setMode: vi.fn(),
		modeShortcutText: "(⌘. for next mode)",
	}

	const renderWrapper = (onSend: (text?: string) => void, initialValue = "") => {
		function Wrapper() {
			const [value, setValue] = useState(initialValue)
			return <ChatTextArea {...defaultProps} inputValue={value} setInputValue={setValue} onSend={onSend} />
		}
		return render(<Wrapper />)
	}

	const firePaste = (text: string) => {
		const input = screen.getByTestId("chat-input")
		fireEvent.paste(input, {
			clipboardData: {
				items: [],
				getData: (type: string) => (type === "text" ? text : ""),
			},
		})
		return input
	}

	const pasteChip = () => document.querySelector('[data-testid="paste-chip"]')

	it("adds a 500+ char paste as a chip in the attachment strip, leaving the input text unchanged", () => {
		const onSend = vi.fn()
		renderWrapper(onSend, "hello ")
		firePaste(longText)

		const chip = pasteChip()
		expect(chip).not.toBeNull()
		expect(chip?.textContent).toContain(formatPasteChipName(longText))
		// The typed text stays in the contenteditable; the chip lives in the strip.
		expect(screen.getByTestId("chat-input").textContent).toBe("hello ")
	})

	it("merges the full pasted text at the paste position when the message is sent, then clears the strip", async () => {
		const onSend = vi.fn()
		renderWrapper(onSend, "hello ")
		const input = firePaste(longText)

		fireEvent.keyDown(input, { key: "Enter" })
		await new Promise((resolve) => setTimeout(resolve, 50))

		expect(onSend).toHaveBeenCalledTimes(1)
		// The paste happened at cursor position 0 (jsdom has no caret), so the
		// text is inserted at the start, separated from the typed text by two
		// newlines, as if it had been pasted there directly.
		expect(onSend.mock.calls[0][0]).toBe(`${longText}\n\nhello `)
		// The strip is cleared after send because the text is now part of the message.
		expect(pasteChip()).toBeNull()
	})

	it("does not collapse pastes shorter than 500 chars", () => {
		const onSend = vi.fn()
		renderWrapper(onSend)
		firePaste("short text")

		expect(pasteChip()).toBeNull()
		expect(screen.getByTestId("chat-input").textContent).toContain("short text")
	})

	it("removes a chip via its close button and drops its text from the outgoing message", async () => {
		const onSend = vi.fn()
		renderWrapper(onSend)
		firePaste(longText)

		fireEvent.click(screen.getByTestId("remove-paste-chip"))
		expect(pasteChip()).toBeNull()

		fireEvent.keyDown(screen.getByTestId("chat-input"), { key: "Enter" })
		await new Promise((resolve) => setTimeout(resolve, 50))
		expect(onSend.mock.calls[0][0]).toBe("")
	})

	it("merges multiple chips at their recorded positions, from the end backwards", () => {
		expect(
			mergePasteChips("abcdefghij", [
				{ id: "0", text: "AAA", insertPosition: 2 },
				{ id: "1", text: "BBB", insertPosition: 8 },
			]),
		).toBe("ab\n\nAAA\n\ncdefgh\n\nBBB\n\nij")
	})

	it("clamps out-of-range chip positions to the text boundaries", () => {
		expect(mergePasteChips("ab", [{ id: "0", text: "XY", insertPosition: 99 }])).toBe("ab\n\nXY")
		expect(mergePasteChips("ab", [{ id: "0", text: "XY", insertPosition: -5 }])).toBe("XY\n\nab")
	})
})
