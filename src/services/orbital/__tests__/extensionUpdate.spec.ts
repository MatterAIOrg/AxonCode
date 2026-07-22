import * as vscode from "vscode"

import {
	installOrbitalExtensionUpdate,
	PENDING_ORBITAL_UPDATE_KEY,
	recoverPendingOrbitalExtensionUpdate,
} from "../extensionUpdate"

vi.mock("vscode", () => ({
	commands: {
		executeCommand: vi.fn(),
	},
	env: {
		appName: "Orbital",
		uriScheme: "orbital",
	},
}))

function createContext(initialState?: unknown) {
	let state = initialState
	const globalState = {
		get: vi.fn(() => state),
		update: vi.fn(async (_key: string, value: unknown) => {
			state = value
		}),
	}

	return {
		context: { globalState } as unknown as vscode.ExtensionContext,
		globalState,
		getState: () => state,
	}
}

describe("Orbital extension updates", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	it("installs the exact version reported by Open VSX", async () => {
		const { context, globalState, getState } = createContext()

		await installOrbitalExtensionUpdate(context, "v6.6.6")

		expect(globalState.update).toHaveBeenCalledWith(PENDING_ORBITAL_UPDATE_KEY, {
			targetVersion: "6.6.6",
			recoveryReloadAttempted: false,
		})
		expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
			"workbench.extensions.installExtension",
			"matterai.axon-code@6.6.6",
		)
		expect(getState()).toEqual({ targetVersion: "6.6.6", recoveryReloadAttempted: false })
	})

	it("clears the pending update when installation fails", async () => {
		const { context, getState } = createContext()
		vi.mocked(vscode.commands.executeCommand).mockRejectedValueOnce(new Error("install failed"))

		await expect(installOrbitalExtensionUpdate(context, "6.6.6")).rejects.toThrow("install failed")

		expect(getState()).toBeUndefined()
	})

	it("requests one recovery reload when the old version activates again", async () => {
		const { context, getState } = createContext({
			targetVersion: "99.0.0",
			recoveryReloadAttempted: false,
		})

		await expect(recoverPendingOrbitalExtensionUpdate(context)).resolves.toBe(true)

		expect(getState()).toEqual({ targetVersion: "99.0.0", recoveryReloadAttempted: true })
		expect(vscode.commands.executeCommand).toHaveBeenCalledWith("workbench.action.reloadWindow")
	})

	it("does not loop when a recovery reload still activates the old version", async () => {
		const { context, getState } = createContext({
			targetVersion: "99.0.0",
			recoveryReloadAttempted: true,
		})

		await expect(recoverPendingOrbitalExtensionUpdate(context)).resolves.toBe(false)

		expect(getState()).toBeUndefined()
		expect(vscode.commands.executeCommand).not.toHaveBeenCalled()
	})

	it("continues normal activation when the recovery reload fails", async () => {
		const { context, getState } = createContext({
			targetVersion: "99.0.0",
			recoveryReloadAttempted: false,
		})
		vi.mocked(vscode.commands.executeCommand).mockRejectedValueOnce(new Error("reload unavailable"))

		await expect(recoverPendingOrbitalExtensionUpdate(context)).resolves.toBe(false)

		expect(getState()).toBeUndefined()
	})

	it("clears the pending update after the target version activates", async () => {
		const { context, getState } = createContext({
			targetVersion: "0.0.1",
			recoveryReloadAttempted: false,
		})

		await expect(recoverPendingOrbitalExtensionUpdate(context)).resolves.toBe(false)

		expect(getState()).toBeUndefined()
		expect(vscode.commands.executeCommand).not.toHaveBeenCalled()
	})
})
