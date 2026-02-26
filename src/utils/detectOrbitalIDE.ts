import * as vscode from "vscode"

/**
 * Detects if the extension is running in the Orbital IDE
 * @returns true if running in Orbital IDE, false otherwise
 */
export function isOrbitalIDE(): boolean {
	const appName = vscode.env.appName || ""
	return appName.toLowerCase().includes("orbital")
}
