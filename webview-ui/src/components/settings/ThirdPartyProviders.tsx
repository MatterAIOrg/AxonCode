import React, { useCallback, useState } from "react"
import { VSCodeTextField } from "@vscode/webview-ui-toolkit/react"
import { Checkbox } from "vscrui"

import type { ProviderSettings } from "@roo-code/types"

interface ThirdPartyProvidersProps {
	apiConfiguration: ProviderSettings
	setApiConfigurationField: <K extends keyof ProviderSettings>(field: K, value: ProviderSettings[K]) => void
}

export const ThirdPartyProviders = ({ apiConfiguration, setApiConfigurationField }: ThirdPartyProvidersProps) => {
	const [iconsBaseUri] = useState(() => {
		const w = window as any
		return w.ICONS_BASE_URI || ""
	})

	// Provider enable states
	const ollamaEnabled = apiConfiguration?.thirdPartyProviders?.ollama?.enabled || false
	const opencodeEnabled = apiConfiguration?.thirdPartyProviders?.opencode?.enabled || false
	const fireworksEnabled = apiConfiguration?.thirdPartyProviders?.fireworks?.enabled || false

	// Handle third-party provider configuration changes
	const updateThirdPartyProvider = useCallback(
		(provider: "ollama" | "opencode" | "fireworks", updates: { enabled?: boolean; apiKey?: string }) => {
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
		(provider: "ollama" | "opencode" | "fireworks", enabled: boolean) => {
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

	// Handle API key change for Fireworks
	const handleFireworksApiKeyChange = useCallback(
		(value: string) => {
			updateThirdPartyProvider("fireworks", { apiKey: value })
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
			<div className="flex flex-col gap-3 p-3 border border-vscode-panel-border rounded-md bg-vscode-sideBar-background">
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-2">
						<img src={iconsBaseUri + "/ollama-ic.png"} alt="Ollama" className="w-5 h-5" />
						<span className="text-sm">Enable Ollama</span>
						<Checkbox
							checked={ollamaEnabled}
							onChange={(checked: boolean) => handleProviderToggle("ollama", checked)}
						/>
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
			<div className="flex flex-col gap-3 p-3 border border-vscode-panel-border rounded-md bg-vscode-sideBar-background">
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-2">
						<img src={iconsBaseUri + "/opencode-ic.png"} alt="OpenCode" className="w-5 h-5" />
						<span className="text-sm">Enable OpenCode Go</span>
						<Checkbox
							checked={opencodeEnabled}
							onChange={(checked: boolean) => handleProviderToggle("opencode", checked)}
						/>
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

			{/* Fireworks Fire Pass Provider */}
			<div className="flex flex-col gap-3 p-3 border border-vscode-panel-border rounded-md bg-vscode-sideBar-background">
				<div className="flex items-center">
					<div className="flex items-center gap-2">
						<img src={iconsBaseUri + "/fireworks-ic.png"} alt="Fireworks" className="w-5 h-5" />
						<span className="text-sm">Enable Fireworks Fire Pass</span>
						<Checkbox
							checked={fireworksEnabled}
							onChange={(checked: boolean) => handleProviderToggle("fireworks", checked)}
						/>
					</div>
				</div>

				{fireworksEnabled && (
					<div className="flex flex-col gap-2">
						<VSCodeTextField
							value={apiConfiguration?.thirdPartyProviders?.fireworks?.apiKey || ""}
							type="password"
							onInput={(e: any) => handleFireworksApiKeyChange(e.target.value)}
							placeholder="Enter Fireworks API Key"
							className="w-full">
							<label className="block font-medium mb-1">Fireworks API Key</label>
							<div className="text-xs text-vscode-descriptionForeground mt-1">
								<a
									href="https://app.fireworks.ai/fire-pass"
									className="text-vscode-textLink-foreground hover:underline"
									target="_blank"
									rel="noopener noreferrer">
									Activate Fire Pass
								</a>
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
