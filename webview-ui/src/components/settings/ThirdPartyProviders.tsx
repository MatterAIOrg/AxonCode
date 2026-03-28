import React, { useCallback } from "react"
import { VSCodeTextField } from "@vscode/webview-ui-toolkit/react"
import { Checkbox } from "vscrui"

import type { ProviderSettings } from "@roo-code/types"

interface ThirdPartyProvidersProps {
	apiConfiguration: ProviderSettings
	setApiConfigurationField: <K extends keyof ProviderSettings>(field: K, value: ProviderSettings[K]) => void
}

export const ThirdPartyProviders = ({ apiConfiguration, setApiConfigurationField }: ThirdPartyProvidersProps) => {
	// Provider enable states
	const ollamaEnabled = apiConfiguration?.thirdPartyProviders?.ollama?.enabled || false
	const opencodeEnabled = apiConfiguration?.thirdPartyProviders?.opencode?.enabled || false

	// Handle third-party provider configuration changes
	const updateThirdPartyProvider = useCallback(
		(provider: "ollama" | "opencode", updates: { enabled?: boolean; apiKey?: string }) => {
			const currentProviders = apiConfiguration?.thirdPartyProviders || {}
			const updatedProviders = {
				...currentProviders,
				[provider]: {
					...currentProviders[provider],
					...updates,
				},
			}
			setApiConfigurationField("thirdPartyProviders", updatedProviders as ProviderSettings["thirdPartyProviders"])
		},
		[apiConfiguration, setApiConfigurationField],
	)

	// Handle provider toggle
	const handleProviderToggle = useCallback(
		(provider: "ollama" | "opencode", enabled: boolean) => {
			updateThirdPartyProvider(provider, { enabled })
		},
		[updateThirdPartyProvider],
	)

	// Handle API key change for OpenCode
	const handleOpencodeApiKeyChange = useCallback(
		(value: string) => {
			updateThirdPartyProvider("opencode", { apiKey: value })
		},
		[updateThirdPartyProvider],
	)

	return (
		<div className="flex flex-col gap-4">
			<div className="text-sm text-vscode-descriptionForeground">
				Configure third-party AI model providers to expand your available models beyond Axon&apos;s built-in
				options.
			</div>

			{/* Ollama Provider */}
			<div className="flex flex-col gap-3 p-3 border border-vscode-input-border rounded-md">
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-2">
						<Checkbox
							checked={ollamaEnabled}
							onChange={(checked: boolean) => handleProviderToggle("ollama", checked)}>
							Enable Ollama
						</Checkbox>
					</div>
					<div className="text-xs text-vscode-descriptionForeground">http://localhost:11434/v1</div>
				</div>

				{ollamaEnabled && (
					<div className="text-xs text-vscode-descriptionForeground">
						Ollama is running locally. Models will appear in the model selector when available.
					</div>
				)}
			</div>

			{/* OpenCode Provider */}
			<div className="flex flex-col gap-3 p-3 border border-vscode-input-border rounded-md">
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-2">
						<Checkbox
							checked={opencodeEnabled}
							onChange={(checked: boolean) => handleProviderToggle("opencode", checked)}>
							Enable OpenCode Go
						</Checkbox>
					</div>
				</div>

				{opencodeEnabled && (
					<div className="flex flex-col gap-2">
						<VSCodeTextField
							value={apiConfiguration?.thirdPartyProviders?.opencode?.apiKey || ""}
							type="password"
							onInput={(e: any) => handleOpencodeApiKeyChange(e.target.value)}
							placeholder="Enter OpenCode API Key"
							className="w-full">
							<label className="block font-medium mb-1">OpenCode API Key</label>
							<div className="text-xs text-vscode-descriptionForeground mt-1">
								Required to access OpenCode models
							</div>
						</VSCodeTextField>
					</div>
				)}
			</div>

			<div className="text-xs text-vscode-descriptionForeground">
				Enabled providers will appear in the model selector below Axon models. Click &quot;Configure
				Models&quot; in the chat to manage these settings.
			</div>
		</div>
	)
}
