import React from "react"
import type { ClineMessage } from "@roo-code/types"
import { fireEvent, render, screen } from "@/utils/test-utils"
import { ExplorationGroupRow } from "../ExplorationGroupRow"

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string) => key,
	}),
}))

vi.mock("../ChatRow", () => ({
	default: ({
		message,
		disableReasoningAutoExpand,
	}: {
		message: ClineMessage
		disableReasoningAutoExpand?: boolean
	}) => (
		<div
			data-testid={`chat-row-${message.ts}`}
			data-reasoning-auto-expand={disableReasoningAutoExpand ? "disabled" : "enabled"}
		/>
	),
}))

const createToolMessage = (ts: number, partial = false) =>
	({
		type: "ask",
		ask: "tool",
		text: JSON.stringify({ tool: "readFile" }),
		ts,
		partial,
	}) as ClineMessage

const createProps = (
	messages: ClineMessage[],
	overrides: Partial<React.ComponentProps<typeof ExplorationGroupRow>> = {},
) => ({
	messages,
	isLast: true,
	isStreaming: false,
	onToggleExpand: vi.fn(),
	isExpanded: false,
	onHeightChange: vi.fn(),
	expandedRows: {},
	toggleRowExpansion: vi.fn(),
	handleSuggestionClickInRow: vi.fn(),
	handleBatchFileResponse: vi.fn(),
	highlightedMessageIndex: null,
	enableCheckpoints: false,
	handleFollowUpUnmount: vi.fn(),
	currentFollowUpTs: null,
	enableButtons: false,
	handlePrimaryButtonClick: vi.fn(),
	handleSecondaryButtonClick: vi.fn(),
	isAgentManagerMode: false,
	...overrides,
})

describe("ExplorationGroupRow expansion lifecycle", () => {
	it("stays open across entries inside the group and closes when an outside entry follows", () => {
		const initialMessages = [createToolMessage(1), createToolMessage(2, true)]
		const { rerender } = render(<ExplorationGroupRow {...createProps(initialMessages, { isStreaming: true })} />)

		expect(screen.getByTestId("chat-row-2")).toBeInTheDocument()
		expect(screen.getByTestId("chat-row-2")).toHaveAttribute("data-reasoning-auto-expand", "disabled")

		const messagesWithNextGroupEntry = [...initialMessages, createToolMessage(3)]
		rerender(<ExplorationGroupRow {...createProps(messagesWithNextGroupEntry)} />)

		expect(screen.getByTestId("chat-row-3")).toBeInTheDocument()

		rerender(<ExplorationGroupRow {...createProps(messagesWithNextGroupEntry, { isLast: false })} />)

		expect(screen.queryByTestId("chat-row-3")).not.toBeInTheDocument()
	})

	it("preserves a manual open when the next entry belongs to the group", () => {
		const initialMessages = [createToolMessage(1), createToolMessage(2)]
		const { rerender } = render(<ExplorationGroupRow {...createProps(initialMessages)} />)
		const headerText = screen.getByText(/chat:exploration\.explored/)

		fireEvent.click(headerText)
		expect(screen.queryByTestId("chat-row-2")).not.toBeInTheDocument()

		fireEvent.click(headerText)
		expect(screen.getByTestId("chat-row-2")).toBeInTheDocument()

		const messagesWithNextGroupEntry = [...initialMessages, createToolMessage(3)]
		rerender(<ExplorationGroupRow {...createProps(messagesWithNextGroupEntry)} />)

		expect(screen.getByTestId("chat-row-3")).toBeInTheDocument()

		rerender(<ExplorationGroupRow {...createProps(messagesWithNextGroupEntry, { isLast: false })} />)

		expect(screen.queryByTestId("chat-row-3")).not.toBeInTheDocument()
	})
})
