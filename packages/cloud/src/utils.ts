import type { ExtensionContext } from "vscode"

export function getUserAgent(context?: ExtensionContext): string {
	return `Axon-Code ${context?.extension?.packageJSON?.version || "unknown"}`
}
