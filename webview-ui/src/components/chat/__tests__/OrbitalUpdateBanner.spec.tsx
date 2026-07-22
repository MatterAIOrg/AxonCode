import { act, fireEvent, render, screen } from "@/utils/test-utils"

import { vscode } from "@src/utils/vscode"
import OrbitalUpdateBanner, { ORBITAL_UPDATE_POLL_INTERVAL_MS } from "../OrbitalUpdateBanner"

vi.mock("@src/utils/vscode", () => ({
	vscode: {
		postMessage: vi.fn(),
	},
}))

vi.mock("@src/i18n/TranslationContext", () => ({
	useAppTranslation: () => ({
		t: (key: string, options?: { version?: string }) => {
			const translations: Record<string, string> = {
				"chat:orbitalUpdate.available": `Orbital ${options?.version} is available`,
				"chat:orbitalUpdate.description": "Install the update and reload Orbital to apply it.",
				"chat:orbitalUpdate.updateAndRestart": "Update & Restart",
				"chat:orbitalUpdate.downloading": "Downloading update…",
				"chat:orbitalUpdate.installing": "Installing update…",
				"chat:orbitalUpdate.restarting": "Reloading Orbital…",
				"chat:orbitalUpdate.failed": "Update failed",
				"chat:orbitalUpdate.retry": "Retry",
			}
			return translations[key] ?? key
		},
	}),
}))

describe("OrbitalUpdateBanner", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	afterEach(() => {
		vi.useRealTimers()
	})

	it("checks for an update when mounted and installs an available update", () => {
		render(<OrbitalUpdateBanner />)
		expect(vscode.postMessage).toHaveBeenCalledWith({ type: "checkForOrbitalUpdate" })

		act(() => {
			window.dispatchEvent(
				new MessageEvent("message", {
					data: {
						type: "orbitalUpdateStatus",
						values: { status: "available", latestVersion: "6.6.1" },
					},
				}),
			)
		})

		expect(screen.getByText("Orbital 6.6.1 is available")).toBeInTheDocument()
		fireEvent.click(screen.getByRole("button", { name: "Update & Restart" }))
		expect(vscode.postMessage).toHaveBeenLastCalledWith({ type: "installOrbitalUpdate" })
	})

	it("stays hidden when the extension is current", () => {
		const { container } = render(<OrbitalUpdateBanner />)

		act(() => {
			window.dispatchEvent(
				new MessageEvent("message", {
					data: { type: "orbitalUpdateStatus", values: { status: "current" } },
				}),
			)
		})

		expect(container).toBeEmptyDOMElement()
	})

	it("polls for an update while the extension is current", () => {
		vi.useFakeTimers()
		render(<OrbitalUpdateBanner />)

		act(() => {
			window.dispatchEvent(
				new MessageEvent("message", {
					data: { type: "orbitalUpdateStatus", values: { status: "current" } },
				}),
			)
			vi.advanceTimersByTime(ORBITAL_UPDATE_POLL_INTERVAL_MS)
		})

		expect(vscode.postMessage).toHaveBeenCalledTimes(2)
		expect(vscode.postMessage).toHaveBeenLastCalledWith({ type: "checkForOrbitalUpdate" })
	})

	it("checks again when a long-lived view becomes visible", () => {
		vi.useFakeTimers()
		render(<OrbitalUpdateBanner />)

		act(() => {
			window.dispatchEvent(
				new MessageEvent("message", {
					data: { type: "orbitalUpdateStatus", values: { status: "current" } },
				}),
			)
			vi.advanceTimersByTime(60 * 1000)
			window.dispatchEvent(
				new MessageEvent("message", {
					data: { type: "action", action: "didBecomeVisible" },
				}),
			)
		})

		expect(vscode.postMessage).toHaveBeenCalledTimes(2)
	})

	it("keeps polling and surfaces a newer release while an update is already available", () => {
		vi.useFakeTimers()
		render(<OrbitalUpdateBanner />)

		act(() => {
			window.dispatchEvent(
				new MessageEvent("message", {
					data: {
						type: "orbitalUpdateStatus",
						values: { status: "available", latestVersion: "6.6.1" },
					},
				}),
			)
			vi.advanceTimersByTime(ORBITAL_UPDATE_POLL_INTERVAL_MS)
		})

		expect(vscode.postMessage).toHaveBeenCalledTimes(2)

		act(() => {
			window.dispatchEvent(
				new MessageEvent("message", {
					data: {
						type: "orbitalUpdateStatus",
						values: { status: "available", latestVersion: "6.6.2" },
					},
				}),
			)
		})

		expect(screen.getByText("Orbital 6.6.2 is available")).toBeInTheDocument()
	})

	it("pauses polling while an update is being installed", () => {
		vi.useFakeTimers()
		render(<OrbitalUpdateBanner />)

		act(() => {
			window.dispatchEvent(
				new MessageEvent("message", {
					data: {
						type: "orbitalUpdateStatus",
						values: { status: "installing", latestVersion: "6.6.1" },
					},
				}),
			)
			vi.advanceTimersByTime(ORBITAL_UPDATE_POLL_INTERVAL_MS)
		})

		expect(vscode.postMessage).toHaveBeenCalledTimes(1)
	})
})
