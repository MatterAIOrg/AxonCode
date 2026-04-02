import React, { useCallback, useState } from "react"
import { VSCodeTextField } from "@vscode/webview-ui-toolkit/react"
import { SettingsCard, SettingsRow, SettingsSwitch } from "./ui/SettingsCard"

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
			<div className="text-xs text-vscode-descriptionForeground">
				Configure third-party AI model providers to expand your available models beyond Axon&apos;s built-in
				options. Enabled providers will appear in the model selector.
			</div>

			<SettingsCard>
				{/* Ollama Provider */}
				<SettingsRow
					title={
						<div className="flex items-center gap-2">
							<img src={iconsBaseUri + "/ollama-ic.png"} alt="Ollama" className="w-5 h-5 rounded-sm" />
							<span>Ollama</span>
						</div>
					}
					description={
						ollamaEnabled
							? "Ollama is running locally. Models will appear in the model selector when available."
							: "http://localhost:11434/v1"
					}>
					<SettingsSwitch
						checked={ollamaEnabled}
						onChange={(checked) => handleProviderToggle("ollama", checked)}
					/>
				</SettingsRow>

				{/* OpenCode Provider */}
				<SettingsRow
					title={
						<div className="flex items-center gap-2">
							<img
								src={iconsBaseUri + "/opencode-ic.png"}
								alt="OpenCode"
								className="w-5 h-5 rounded-sm"
							/>
							<span>OpenCode Go</span>
						</div>
					}
					description={opencodeEnabled ? "" : "Access OpenCode models"}>
					<SettingsSwitch
						checked={opencodeEnabled}
						onChange={(checked) => handleProviderToggle("opencode", checked)}
					/>
				</SettingsRow>

				{opencodeEnabled && (
					<SettingsRow title={<span className="font-normal text-sm pl-7">API Key</span>}>
						<div className="flex items-center gap-2 w-[300px]">
							<VSCodeTextField
								value={apiConfiguration?.thirdPartyProviders?.opencode?.apiKey || ""}
								type="password"
								onInput={(e: any) => handleOpencodeApiKeyChange(e.target.value)}
								placeholder="Enter OpenCode API Key"
								className="w-full h-7"
							/>
						</div>
					</SettingsRow>
				)}

				{/* Fireworks Fire Pass Provider */}
				<SettingsRow
					title={
						<div className="flex items-center gap-2">
							<img
								src={iconsBaseUri + "/fireworks-ic.png"}
								alt="Fireworks"
								className="w-5 h-5 rounded-sm"
							/>
							<span>Fireworks Fire Pass</span>
						</div>
					}
					description={
						!fireworksEnabled && (
							<a
								href="https://app.fireworks.ai/fire-pass"
								className="text-vscode-textLink-foreground hover:underline"
								target="_blank"
								rel="noopener noreferrer">
								Activate Fire Pass
							</a>
						)
					}>
					<SettingsSwitch
						checked={fireworksEnabled}
						onChange={(checked) => handleProviderToggle("fireworks", checked)}
					/>
				</SettingsRow>

				{fireworksEnabled && (
					<SettingsRow title={<span className="font-normal text-sm pl-7">API Key</span>}>
						<div className="flex items-center gap-2 w-[300px]">
							<VSCodeTextField
								value={apiConfiguration?.thirdPartyProviders?.fireworks?.apiKey || ""}
								type="password"
								onInput={(e: any) => handleFireworksApiKeyChange(e.target.value)}
								placeholder="Enter Fireworks API Key"
								className="w-full h-7"
							/>
						</div>
					</SettingsRow>
				)}
			</SettingsCard>
		</div>
	)
}
