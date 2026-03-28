import { useQuery } from "@tanstack/react-query"

import { ModelRecord } from "@roo/api"
import { ExtensionMessage } from "@roo/ExtensionMessage"

import { vscode } from "@src/utils/vscode"

const getOllamaModels = async () =>
	new Promise<ModelRecord>((resolve, reject) => {
		const cleanup = () => {
			window.removeEventListener("message", handler)
		}

		const timeout = setTimeout(() => {
			cleanup()
			reject(new Error("Ollama models request timed out"))
		}, 10000)

		const handler = (event: MessageEvent) => {
			const message: ExtensionMessage = event.data

			if (message.type === "ollamaModels") {
				clearTimeout(timeout)
				cleanup()

				if (message.ollamaModels) {
					resolve(message.ollamaModels)
				} else {
					reject(new Error("No Ollama models in response"))
				}
			}
		}

		window.addEventListener("message", handler)
		vscode.postMessage({ type: "requestOllamaModels" })
	})

export const useOllamaModels = (modelId?: string) =>
	useQuery({ queryKey: ["ollamaModels"], queryFn: () => (modelId ? getOllamaModels() : {}) })

// Hook for third-party provider models (Ollama and OpenCode)
const getThirdPartyModels = async (provider: string) =>
	new Promise<ModelRecord>((resolve, reject) => {
		const cleanup = () => {
			window.removeEventListener("message", handler)
		}

		const timeout = setTimeout(() => {
			cleanup()
			reject(new Error(`${provider} models request timed out`))
		}, 10000)

		const handler = (event: MessageEvent) => {
			const message = event.data as ExtensionMessage

			if (message.type === "thirdPartyModels" && message.thirdPartyModels) {
				const msgProvider = message.thirdPartyModels.provider
				if (msgProvider === provider) {
					clearTimeout(timeout)
					cleanup()

					const models = message.thirdPartyModels.models
					if (models) {
						resolve(models)
					} else {
						reject(new Error(`No ${provider} models in response`))
					}
				}
			}
		}

		window.addEventListener("message", handler)
		vscode.postMessage({ type: "requestThirdPartyModels", provider })
	})

export const useThirdPartyModels = (provider: string, enabled: boolean) => {
	return useQuery({
		queryKey: [`${provider}Models`],
		queryFn: () => getThirdPartyModels(provider),
		enabled,
		retry: false,
		staleTime: 0, // Always refetch on mount
		refetchOnMount: true, // Ensure refetch when component mounts
	})
}
