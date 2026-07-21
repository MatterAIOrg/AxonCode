import { render } from "@/utils/test-utils"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

import { showSystemNotification } from "@/kilocode/helpers"
import { ExtensionStateContextProvider } from "@src/context/ExtensionStateContext"

import ChatView, { ChatViewProps, shouldEnableCommandApproval } from "../ChatView"

vi.mock("@src/utils/vscode", () => ({
	vscode: {
		postMessage: vi.fn(),
	},
}))

vi.mock("@/kilocode/helpers", () => ({
	showSystemNotification: vi.fn(),
}))

vi.mock("rehype-highlight", () => ({ default: () => () => {} }))
vi.mock("hast-util-to-text", () => ({ default: () => "" }))
vi.mock("../BrowserSessionRow", () => ({ default: () => null }))
vi.mock("../ChatRow", () => ({ default: () => null }))
vi.mock("../TaskHeader", () => ({ default: () => null }))
vi.mock("../AutoApproveMenu", () => ({ default: () => null }))
vi.mock("@src/components/common/CodeBlock", () => ({ default: () => null, CODE_BLOCK_BG_COLOR: "" }))
vi.mock("@src/components/common/CodeAccordion", () => ({ default: () => null }))
vi.mock("@src/components/chat/ContextMenu", () => ({ default: () => null }))

const defaultProps: ChatViewProps = {
	isHidden: false,
	showAnnouncement: false,
	hideAnnouncement: () => {},
	inputValue: "",
	setInputValue: () => {},
	selectedImages: [],
	setSelectedImages: () => {},
}

describe("ChatView command approval notifications", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	it("does not notify when the backend already auto-approved the command", async () => {
		render(
			<ExtensionStateContextProvider>
				<QueryClientProvider client={new QueryClient()}>
					<ChatView {...defaultProps} />
				</QueryClientProvider>
			</ExtensionStateContextProvider>,
		)

		window.postMessage(
			{
				type: "state",
				state: {
					version: "1.0.0",
					taskHistory: [],
					shouldShowAnnouncement: false,
					autoApprovalEnabled: false,
					clineMessages: [
						{
							type: "say",
							say: "task",
							ts: Date.now() - 2_000,
							text: "Initial task",
						},
						{
							type: "ask",
							ask: "command",
							ts: Date.now(),
							text: "pnpm test",
							partial: false,
							autoApproved: true,
						},
					],
				},
			},
			"*",
		)

		await new Promise((resolve) => setTimeout(resolve, 100))
		expect(showSystemNotification).not.toHaveBeenCalled()
	})

	it("enables approval only when the backend did not auto-approve the completed command", () => {
		const pendingCommand = { type: "ask", ask: "command", ts: 1 } as const

		expect(shouldEnableCommandApproval({ ...pendingCommand, autoApproved: true }, false)).toBe(false)
		expect(shouldEnableCommandApproval(pendingCommand, false)).toBe(true)
		expect(shouldEnableCommandApproval(pendingCommand, true)).toBe(false)
	})
})
