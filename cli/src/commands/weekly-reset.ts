import type { ExtensionMessage } from "../types/messages.js"
import type { ExtensionService } from "../services/extension.js"
import type { Command } from "./core/types.js"

function waitForReset(service: ExtensionService, timeoutMs = 10_000): Promise<ExtensionMessage | null> {
	return new Promise((resolve) => {
		const listener = (message: ExtensionMessage) => {
			if (message.type !== "resetWeeklyUsageResponse") return
			clearTimeout(timer)
			service.off("message", listener)
			resolve(message)
		}
		const timer = setTimeout(() => {
			service.off("message", listener)
			resolve(null)
		}, timeoutMs)
		service.on("message", listener)
	})
}

export const weeklyResetCommand: Command = {
	name: "weekly-reset",
	aliases: ["reset-weekly"],
	description: "Reset Axon Code weekly usage (Pro and above, once per month)",
	usage: "/weekly-reset",
	examples: ["/weekly-reset"],
	category: "settings",
	priority: 8,
	arguments: [],
	handler: async (context) => {
		if (context.currentProvider?.provider !== "kilocode" || !context.currentProvider.kilocodeToken) {
			context.addMessage({
				id: Date.now().toString(),
				type: "error",
				content: "Weekly reset requires an authenticated Axon Code provider.",
				ts: Date.now(),
			})
			return
		}
		if (!context.extensionService) {
			context.addMessage({
				id: Date.now().toString(),
				type: "error",
				content: "Cannot reach the extension host. Start a task, then try again.",
				ts: Date.now(),
			})
			return
		}

		const responsePromise = waitForReset(context.extensionService)
		await context.sendMessage({ type: "resetWeeklyUsageRequest" })
		const response = await responsePromise
		if (!response) {
			throw new Error("Timed out waiting for the weekly reset")
		}
		if (!response.payload?.success) {
			context.addMessage({
				id: Date.now().toString(),
				type: "error",
				content: response.payload?.error || "Failed to reset weekly usage.",
				ts: Date.now(),
			})
			return
		}

		context.addMessage({
			id: Date.now().toString(),
			type: "system",
			content: "Weekly usage reset. Your once-per-month reset has been used for this billing cycle.",
			ts: Date.now(),
		})
	},
}
