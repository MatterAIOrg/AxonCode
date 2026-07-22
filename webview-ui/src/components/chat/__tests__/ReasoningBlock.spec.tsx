import React from "react"
import { fireEvent, render, screen } from "@/utils/test-utils"
import { ReasoningBlock } from "../ReasoningBlock"

vi.mock("@src/context/ExtensionStateContext", () => ({
	useExtensionState: () => ({ reasoningBlockCollapsed: true }),
}))

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string) => key,
	}),
}))

vi.mock("../../common/MarkdownBlock", () => ({
	default: ({ markdown }: { markdown: string }) => <div>{markdown}</div>,
}))

describe("ReasoningBlock", () => {
	it("does not auto-expand while streaming when disabled by an exploration group", () => {
		const reasoningStartedAt = Date.now() - 3000
		const { rerender } = render(
			<ReasoningBlock
				content="Initial reasoning"
				ts={reasoningStartedAt}
				isStreaming
				_isLast
				disableAutoExpand
				partial
			/>,
		)

		expect(screen.queryByText("Initial reasoning")).not.toBeInTheDocument()

		fireEvent.click(screen.getByText(/chat:reasoning\.thinking/))
		expect(screen.getByText("Initial reasoning")).toBeInTheDocument()

		rerender(
			<ReasoningBlock
				content="Updated reasoning"
				ts={reasoningStartedAt}
				isStreaming
				_isLast
				disableAutoExpand
				partial
			/>,
		)

		expect(screen.getByText("Updated reasoning")).toBeInTheDocument()
	})

	it("keeps auto-expansion for standalone streaming reasoning", () => {
		render(<ReasoningBlock content="Standalone reasoning" ts={Date.now() - 3000} isStreaming _isLast partial />)

		expect(screen.getByText("Standalone reasoning")).toBeInTheDocument()
	})

	it("does not render completed brief reasoning", () => {
		const { container } = render(
			<ReasoningBlock
				content="Brief reasoning"
				ts={Date.now() - 1000}
				isStreaming={false}
				_isLast={false}
				metadata={{ kiloCode: { reasoningDuration: 1000 } }}
			/>,
		)

		expect(container).toBeEmptyDOMElement()
	})

	it("does not render live reasoning before it reaches the brief threshold", () => {
		const { container } = render(
			<ReasoningBlock content="Brief live reasoning" ts={Date.now() - 1000} isStreaming _isLast partial />,
		)

		expect(container).toBeEmptyDOMElement()
	})

	it("renders completed reasoning at or above the brief threshold", () => {
		render(
			<ReasoningBlock
				content="Longer reasoning"
				ts={Date.now() - 2000}
				isStreaming={false}
				_isLast={false}
				metadata={{ kiloCode: { reasoningDuration: 2000 } }}
			/>,
		)

		expect(screen.getByText("chat:reasoning.thought")).toBeInTheDocument()
	})
})
