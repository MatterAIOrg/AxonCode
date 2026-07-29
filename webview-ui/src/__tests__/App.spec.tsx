// npx vitest run src/__tests__/App.spec.tsx

import React from "react"
import { render, screen, act, cleanup } from "@/utils/test-utils"

import AppWithProviders from "../App"
import { vscode } from "@src/utils/vscode"

vi.mock("@src/utils/vscode", () => ({
	vscode: {
		postMessage: vi.fn(),
	},
}))

// Mock the ErrorBoundary component
vi.mock("@src/components/ErrorBoundary", () => ({
	__esModule: true,
	default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

// Mock the telemetry client
vi.mock("@src/utils/TelemetryClient", () => ({
	telemetryClient: {
		capture: vi.fn(),
		updateTelemetryState: vi.fn(),
	},
}))

vi.mock("@src/components/chat/ChatView", () => ({
	__esModule: true,
	default: function ChatView({ isHidden }: { isHidden: boolean }) {
		return (
			<div data-testid="chat-view" data-hidden={isHidden}>
				Chat View
			</div>
		)
	},
}))

vi.mock("@src/components/settings/SettingsView", () => ({
	__esModule: true,
	default: function SettingsView({
		onDone,
		standalone,
		targetSection,
	}: {
		onDone: () => void
		standalone?: boolean
		targetSection?: string
	}) {
		return (
			<div
				data-testid="settings-view"
				data-standalone={standalone}
				data-target-section={targetSection}
				onClick={onDone}>
				Settings View
			</div>
		)
	},
}))

vi.mock("@src/components/history/HistoryView", () => ({
	__esModule: true,
	default: function HistoryView({ onDone }: { onDone: () => void }) {
		return (
			<div data-testid="history-view" onClick={onDone}>
				History View
			</div>
		)
	},
}))

vi.mock("../components/kilocodeMcp/marketplace/McpMarketplaceView", () => ({
	__esModule: true,
	default: function McpMarketplaceView() {
		return <div data-testid="mcp-marketplace-view">MCP Marketplace View</div>
	},
}))

vi.mock("@src/components/modes/ModesView", () => ({
	__esModule: true,
	default: function ModesView({ onDone }: { onDone: () => void }) {
		return (
			<div data-testid="prompts-view" onClick={onDone}>
				Modes View
			</div>
		)
	},
}))

vi.mock("@src/components/marketplace/MarketplaceView", () => ({
	MarketplaceView: function MarketplaceView({ onDone }: { onDone: () => void }) {
		return (
			<div data-testid="marketplace-view" onClick={onDone}>
				Marketplace View
			</div>
		)
	},
}))

vi.mock("@src/components/skills/SkillsMarketplaceView", () => ({
	__esModule: true,
	SkillsMarketplaceView: function SkillsMarketplaceView({ onDone }: { onDone: () => void }) {
		return (
			<div data-testid="skills-marketplace-view" onClick={onDone}>
				Skills Marketplace View
			</div>
		)
	},
	default: function SkillsMarketplaceView({ onDone }: { onDone: () => void }) {
		return (
			<div data-testid="skills-marketplace-view" onClick={onDone}>
				Skills Marketplace View
			</div>
		)
	},
}))

vi.mock("@src/components/cloud/CloudView", () => ({
	CloudView: function CloudView({ onDone }: { onDone: () => void }) {
		return (
			<div data-testid="cloud-view" onClick={onDone}>
				Cloud View
			</div>
		)
	},
}))

const mockUseExtensionState = vi.fn()

// Mock the HumanRelayDialog component
vi.mock("@src/components/human-relay/HumanRelayDialog", () => ({
	HumanRelayDialog: ({ _children, isOpen, onClose }: any) => (
		<div data-testid="human-relay-dialog" data-open={isOpen} onClick={onClose}>
			Human Relay Dialog
		</div>
	),
}))

// Mock i18next and react-i18next
vi.mock("i18next", () => {
	const tFunction = (key: string) => key
	const i18n = {
		t: tFunction,
		use: () => i18n,
		init: () => Promise.resolve(tFunction),
		changeLanguage: vi.fn(() => Promise.resolve()),
	}
	return { default: i18n }
})

vi.mock("react-i18next", () => {
	const tFunction = (key: string) => key
	return {
		withTranslation: () => (Component: any) => {
			const MockedComponent = (props: any) => {
				return <Component t={tFunction} i18n={{ t: tFunction }} tReady {...props} />
			}
			MockedComponent.displayName = `withTranslation(${Component.displayName || Component.name || "Component"})`
			return MockedComponent
		},
		Trans: ({ children }: { children: React.ReactNode }) => <>{children}</>,
		useTranslation: () => {
			return {
				t: tFunction,
				i18n: {
					t: tFunction,
					changeLanguage: vi.fn(() => Promise.resolve()),
				},
			}
		},
		initReactI18next: {
			type: "3rdParty",
			init: vi.fn(),
		},
	}
})

// Mock TranslationProvider to pass through children
vi.mock("@src/i18n/TranslationContext", () => {
	const tFunction = (key: string) => key
	return {
		__esModule: true,
		default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
		useAppTranslation: () => ({
			t: tFunction,
			i18n: {
				t: tFunction,
				changeLanguage: vi.fn(() => Promise.resolve()),
			},
		}),
	}
})

vi.mock("@src/context/ExtensionStateContext", () => ({
	useExtensionState: () => mockUseExtensionState(),
	ExtensionStateContextProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

// Mock environment variables
vi.mock("process.env", () => ({
	NODE_ENV: "test",
	PKG_VERSION: "1.0.0-test",
}))

describe("App", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		window.removeEventListener("message", () => {})
		delete (window as any).MATTERCODE_INITIAL_VIEW
		delete (window as any).MATTERCODE_INITIAL_SETTINGS_SECTION

		// Set up default mock return value
		mockUseExtensionState.mockReturnValue({
			didHydrateState: true,
			showWelcome: false,
			shouldShowAnnouncement: false,
			experiments: {},
			language: "en",
		})
	})

	afterEach(() => {
		cleanup()
		window.removeEventListener("message", () => {})
	})

	const triggerMessage = (action: string) => {
		const messageEvent = new MessageEvent("message", {
			data: {
				type: "action",
				action,
			},
		})
		window.dispatchEvent(messageEvent)
	}

	it("shows chat view by default", () => {
		render(<AppWithProviders />)

		const chatView = screen.getByTestId("chat-view")
		expect(chatView).toBeInTheDocument()
		expect(chatView.getAttribute("data-hidden")).toBe("false")
	})

	it("opens settings in a dedicated editor when receiving settingsButtonClicked", () => {
		render(<AppWithProviders />)

		act(() => {
			triggerMessage("settingsButtonClicked")
		})

		const chatView = screen.getByTestId("chat-view")
		expect(chatView.getAttribute("data-hidden")).toBe("false")
		expect(screen.queryByTestId("settings-view")).not.toBeInTheDocument()
		expect(vscode.postMessage).toHaveBeenCalledWith({
			type: "openSettings",
			targetSection: undefined,
		})
	})

	it.each([
		["mcpButtonClicked", "mcp"],
		["skillsMarketplaceButtonClicked", "plugins"],
	])("opens %s in its Orbital Settings section", (action, targetSection) => {
		render(<AppWithProviders />)

		act(() => {
			triggerMessage(action)
		})

		expect(screen.queryByTestId("settings-view")).not.toBeInTheDocument()
		expect(vscode.postMessage).toHaveBeenCalledWith({
			type: "openSettings",
			targetSection,
		})
	})

	it("switches to history view when receiving historyButtonClicked action", async () => {
		render(<AppWithProviders />)

		act(() => {
			triggerMessage("historyButtonClicked")
		})

		const historyView = await screen.findByTestId("history-view")
		expect(historyView).toBeInTheDocument()

		const chatView = screen.getByTestId("chat-view")
		expect(chatView.getAttribute("data-hidden")).toBe("true")
	})

	it("switches to prompts view when receiving promptsButtonClicked action", async () => {
		render(<AppWithProviders />)

		act(() => {
			triggerMessage("promptsButtonClicked")
		})

		const promptsView = await screen.findByTestId("prompts-view")
		expect(promptsView).toBeInTheDocument()

		const chatView = screen.getByTestId("chat-view")
		expect(chatView.getAttribute("data-hidden")).toBe("true")
	})

	it("renders only settings in a dedicated settings editor", () => {
		;(window as any).MATTERCODE_INITIAL_VIEW = "settings"
		;(window as any).MATTERCODE_INITIAL_SETTINGS_SECTION = "terminal"

		render(<AppWithProviders />)

		const settingsView = screen.getByTestId("settings-view")
		expect(settingsView).toHaveAttribute("data-standalone", "true")
		expect(settingsView).toHaveAttribute("data-target-section", "terminal")
		expect(screen.queryByTestId("chat-view")).not.toBeInTheDocument()
	})

	it.each(["history", "prompts"])("returns to chat view when clicking done in %s view", async (view) => {
		render(<AppWithProviders />)

		act(() => {
			triggerMessage(`${view}ButtonClicked`)
		})

		const viewElement = await screen.findByTestId(`${view}-view`)

		act(() => {
			viewElement.click()
		})

		const chatView = screen.getByTestId("chat-view")
		expect(chatView.getAttribute("data-hidden")).toBe("false")
		expect(screen.queryByTestId(`${view}-view`)).not.toBeInTheDocument()
	})

	it.skip("switches to marketplace view when receiving marketplaceButtonClicked action", async () => {
		render(<AppWithProviders />)

		act(() => {
			triggerMessage("marketplaceButtonClicked")
		})

		const marketplaceView = await screen.findByTestId("marketplace-view")
		expect(marketplaceView).toBeInTheDocument()

		const chatView = screen.getByTestId("chat-view")
		expect(chatView.getAttribute("data-hidden")).toBe("true")
	})

	it.skip("returns to chat view when clicking done in marketplace view", async () => {
		render(<AppWithProviders />)

		act(() => {
			triggerMessage("marketplaceButtonClicked")
		})

		const marketplaceView = await screen.findByTestId("marketplace-view")

		act(() => {
			marketplaceView.click()
		})

		const chatView = screen.getByTestId("chat-view")
		expect(chatView.getAttribute("data-hidden")).toBe("false")
		expect(screen.queryByTestId("marketplace-view")).not.toBeInTheDocument()
	})
})
