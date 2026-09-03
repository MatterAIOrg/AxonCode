import { useEffect } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"

import { RouterModels } from "@roo/api"
import { ExtensionMessage } from "@roo/ExtensionMessage"

import { vscode } from "@src/utils/vscode"

const getRouterModels = async (forceRefresh: boolean = false) =>
	new Promise<RouterModels>((resolve, reject) => {
		const cleanup = () => {
			window.removeEventListener("message", handler)
		}

		const timeout = setTimeout(() => {
			cleanup()
			reject(new Error("Router models request timed out"))
		}, 10000)

		const handler = (event: MessageEvent) => {
			const message: ExtensionMessage = event.data

			if (message.type === "routerModels") {
				clearTimeout(timeout)
				cleanup()

				if (message.routerModels) {
					resolve(message.routerModels)
				} else {
					reject(new Error("No router models in response"))
				}
			}
		}

		window.addEventListener("message", handler)
		vscode.postMessage({ type: "requestRouterModels", values: { forceRefresh } })
	})

// forked_change start
type RouterModelsQueryKey = {
	openRouterBaseUrl?: string
	openRouterApiKey?: string
	lmStudioBaseUrl?: string
	ollamaBaseUrl?: string
	kilocodeOrganizationId?: string
	deepInfraApiKey?: string
	geminiApiKey?: string
	googleGeminiBaseUrl?: string
	chutesApiKey?: string
	betaModelsEnabled?: boolean // kilocode_change: Beta models availability
	// Requesty, Unbound, etc should perhaps also be here, but they already have their own hacks for reloading
}

export const useRouterModels = (queryKey: RouterModelsQueryKey) => {
	const queryClient = useQueryClient()

	useEffect(() => {
		let lastRefresh = 0
		const triggerRefresh = () => {
			const now = Date.now()
			if (now - lastRefresh > 5000) {
				lastRefresh = now
				queryClient.invalidateQueries({ queryKey: ["routerModels"] })
			}
		}

		const onFocus = () => triggerRefresh()
		window.addEventListener("focus", onFocus)

		const onMessage = (event: MessageEvent) => {
			if (event.data?.type === "action" && event.data?.action === "didBecomeVisible") {
				triggerRefresh()
			}
		}
		window.addEventListener("message", onMessage)

		return () => {
			window.removeEventListener("focus", onFocus)
			window.removeEventListener("message", onMessage)
		}
	}, [queryClient])

	return useQuery({
		queryKey: ["routerModels", queryKey],
		queryFn: () => getRouterModels(),
		refetchInterval: 10 * 60 * 1000,
		refetchOnWindowFocus: true,
	})
}
// forked_change end
