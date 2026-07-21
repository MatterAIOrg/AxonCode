import { act, fireEvent, render, screen } from "@/utils/test-utils"

import { vscode } from "@src/utils/vscode"
import OrbitalUpdateBanner from "../OrbitalUpdateBanner"

vi.mock("@src/utils/vscode", () => ({
	vscode: {
		postMessage: vi.fn(),
	},
}))

vi.mock("@src/i18n/TranslationContext", () => ({
	useAppTranslation: () => ({
		t: (key: string, options?: { version?: string }) => {
			const translations: Record<string, string> = {
				"chat:orbitalUpdate.available": `Axon Code ${options?.version} is available`,
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

		expect(screen.getByText("Axon Code 6.6.1 is available")).toBeInTheDocument()
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
})
