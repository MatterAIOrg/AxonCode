// npx vitest src/components/chat/__tests__/ContextUsageIndicator.spec.tsx

import { render, screen, fireEvent } from "@/utils/test-utils"

import { ContextUsageIndicator } from "../ContextUsageIndicator"

vi.mock("@/utils/format", () => ({
	formatLargeNumber: (num: number) => (num >= 1000 ? `${(num / 1000).toFixed(1)}K` : String(num)),
}))

const baseUsage = {
	currentTokens: 21800,
	maxTokens: 200000,
	breakdown: {
		systemPrompt: 467,
		toolDefinitions: 8100,
		rules: 2900,
		skills: 2300,
		mcp: 1300,
		subagentDefinitions: 0,
		conversation: 5800,
	},
}

const useExtensionStateMock = vi.fn()

vi.mock("@/context/ExtensionStateContext", () => ({
	useExtensionState: () => useExtensionStateMock(),
}))

describe("ContextUsageIndicator", () => {
	beforeEach(() => {
		// Reset window.postMessage between tests so we can assert the popover
		// fires a `refreshContextBreakdown` message when opened.
		;(window as any).__postedMessages = []
		const originalPostMessage = window.postMessage.bind(window)
		window.postMessage = vi.fn((message: any, targetOrigin?: string) => {
			;(window as any).__postedMessages.push(message)
			// jsdom's postMessage requires a targetOrigin argument; fall back to
			// a safe default when the caller doesn't provide one.
			return originalPostMessage(message, targetOrigin ?? "*")
		}) as typeof window.postMessage
	})

	it("renders the trigger button even when no usage data is available", () => {
		useExtensionStateMock.mockReturnValue({ contextWindowUsage: undefined })
		render(<ContextUsageIndicator />)
		expect(screen.getByTestId("context-usage-indicator-trigger")).toBeInTheDocument()
	})

	it("opens the popover and shows all non-zero categories", () => {
		useExtensionStateMock.mockReturnValue({ contextWindowUsage: baseUsage })
		render(<ContextUsageIndicator />)

		fireEvent.click(screen.getByTestId("context-usage-indicator-trigger"))

		expect(screen.getByTestId("context-usage-popover")).toBeInTheDocument()
		expect(screen.getByTestId("context-usage-popover-tokens")).toHaveTextContent("~21.8K / 200.0K Tokens")

		// The subagent definitions slice is zero in the fixture and should be hidden.
		expect(screen.queryByTestId("context-usage-row-subagentDefinitions")).toBeNull()

		// The other six categories should all be rendered.
		;["systemPrompt", "toolDefinitions", "rules", "skills", "mcp", "conversation"].forEach((key) => {
			expect(screen.getByTestId(`context-usage-row-${key}`)).toBeInTheDocument()
		})
	})

	it("requests a fresh breakdown when the popover opens", () => {
		useExtensionStateMock.mockReturnValue({ contextWindowUsage: baseUsage })
		render(<ContextUsageIndicator />)

		fireEvent.click(screen.getByTestId("context-usage-indicator-trigger"))

		const messages = (window as any).__postedMessages as Array<{ type: string }>
		expect(messages.some((m) => m.type === "refreshContextBreakdown")).toBe(true)
	})

	it("renders an empty-state message when no categories have any tokens", () => {
		useExtensionStateMock.mockReturnValue({
			contextWindowUsage: {
				currentTokens: 0,
				maxTokens: 200000,
				breakdown: {
					systemPrompt: 0,
					toolDefinitions: 0,
					rules: 0,
					skills: 0,
					mcp: 0,
					subagentDefinitions: 0,
					conversation: 0,
				},
			},
		})
		render(<ContextUsageIndicator />)

		fireEvent.click(screen.getByTestId("context-usage-indicator-trigger"))

		expect(screen.getByText("No context usage yet.")).toBeInTheDocument()
	})
})
