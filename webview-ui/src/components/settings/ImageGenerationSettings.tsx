import React, { useState, useEffect } from "react"
import { VSCodeTextField, VSCodeDropdown, VSCodeOption } from "@vscode/webview-ui-toolkit/react"
import { useAppTranslation } from "@/i18n/TranslationContext"
import { getAppUrl } from "@roo-code/types"
import { SettingsRow, SettingsSwitch } from "./ui/SettingsCard"

interface ImageGenerationSettingsProps {
	enabled: boolean
	onChange: (enabled: boolean) => void
	openRouterImageApiKey?: string
	openRouterImageGenerationSelectedModel?: string
	setOpenRouterImageApiKey: (apiKey: string) => void
	setImageGenerationSelectedModel: (model: string) => void
	// forked_change start
	kiloCodeImageApiKey?: string
	setKiloCodeImageApiKey: (apiKey: string) => void
	currentProfileKilocodeToken?: string
	// forked_change end
}

// Hardcoded list of image generation models
const IMAGE_GENERATION_MODELS = [
	{ value: "google/gemini-2.5-flash-image", label: "Gemini 2.5 Flash Image" },
	{ value: "openai/gpt-5-image", label: "GPT-5 Image" },
	{ value: "openai/gpt-5-image-mini", label: "GPT-5 Image Mini" },
	// Add more models as they become available
]

export const ImageGenerationSettings = ({
	enabled,
	onChange,
	openRouterImageApiKey,
	openRouterImageGenerationSelectedModel,
	setOpenRouterImageApiKey,
	setImageGenerationSelectedModel,
	// forked_change start
	kiloCodeImageApiKey,
	setKiloCodeImageApiKey,
	currentProfileKilocodeToken,
	// forked_change end
}: ImageGenerationSettingsProps) => {
	const { t } = useAppTranslation()

	// forked_change start
	const [isUsingOpenRouter, setIsUsingOpenRouter] = useState(!!openRouterImageApiKey)
	useEffect(() => {
		if (!enabled) {
			return
		}
		const paidImageGenerationModel = IMAGE_GENERATION_MODELS[0].value
		if (isUsingOpenRouter) {
			if (!openRouterImageGenerationSelectedModel) {
				setImageGenerationSelectedModel(paidImageGenerationModel)
			}
		} else {
			if (openRouterImageApiKey) {
				setOpenRouterImageApiKey("")
			}
			if (openRouterImageGenerationSelectedModel !== paidImageGenerationModel) {
				setImageGenerationSelectedModel(paidImageGenerationModel)
			}
		}
	}, [
		enabled,
		isUsingOpenRouter,
		openRouterImageApiKey,
		setOpenRouterImageApiKey,
		kiloCodeImageApiKey,
		setKiloCodeImageApiKey,
		openRouterImageGenerationSelectedModel,
		setImageGenerationSelectedModel,
		currentProfileKilocodeToken,
	])
	// forked_change end

	// Handle API key changes
	const handleApiKeyChange = (value: string) => {
		// setApiKey(value) // kilocode_change
		setOpenRouterImageApiKey(value)
	}

	const handleKiloApiKeyChange = (value: string) => {
		setKiloCodeImageApiKey(value)
	}

	// Handle model selection changes
	const handleModelChange = (value: string) => {
		// setSelectedModel(value) // kilocode_change
		setImageGenerationSelectedModel(value)
	}

	return (
		<SettingsRow
			title={t("settings:experimental.IMAGE_GENERATION.name")}
			description={t("settings:experimental.IMAGE_GENERATION.description")}>
			<div className="flex flex-col gap-4 w-full">
				<div className="flex justify-end">
					<SettingsSwitch checked={enabled} onChange={onChange} />
				</div>

				{enabled && (
					<div className="flex flex-col gap-4 mt-2 p-4 bg-vscode-settings-focusedRowBackground rounded-md">
						{/* API Key Configuration */}

						{
							// forked_change start
							<div className="flex items-center gap-2">
								<label className="block font-medium w-1/3">
									{t("settings:experimental.IMAGE_GENERATION.apiProvider")}
								</label>
								<VSCodeDropdown
									value={isUsingOpenRouter ? "openrouter" : "kilocode"}
									onChange={(e: any) => {
										setIsUsingOpenRouter(e.target.value === "openrouter")
									}}
									className="flex-1">
									<VSCodeOption className="py-2 px-3" value="kilocode">
										Orbital
									</VSCodeOption>
									<VSCodeOption className="py-2 px-3" value="openrouter">
										OpenRouter
									</VSCodeOption>
								</VSCodeDropdown>
							</div>
							// forked_change end
						}

						{
							// forked_change start
							<div
								style={{ display: isUsingOpenRouter ? "none" : undefined }}
								className="flex items-center gap-2">
								<label className="block font-medium w-1/3">
									{t("settings:experimental.IMAGE_GENERATION.kiloCodeApiKeyLabel")}
								</label>
								<div className="flex-1 flex flex-col gap-1">
									<VSCodeTextField
										value={kiloCodeImageApiKey}
										onInput={(e: any) => handleKiloApiKeyChange(e.target.value)}
										placeholder={t(
											"settings:experimental.IMAGE_GENERATION.kiloCodeApiKeyPlaceholder",
										)}
										className="w-full"
										type="password"
									/>
									<div className="text-vscode-descriptionForeground text-xs">
										{currentProfileKilocodeToken ? (
											<a
												href="#"
												onClick={() => handleKiloApiKeyChange(currentProfileKilocodeToken)}
												className="text-vscode-textLink-foreground hover:text-vscode-textLink-activeForeground">
												{t("settings:experimental.IMAGE_GENERATION.kiloCodeApiKeyPaste")}
											</a>
										) : (
											<>
												{t("settings:experimental.IMAGE_GENERATION.getApiKeyText")}{" "}
												<a
													href={getAppUrl("/profile?personal=true")}
													target="_blank"
													rel="noopener noreferrer"
													className="text-vscode-textLink-foreground hover:text-vscode-textLink-activeForeground">
													{getAppUrl("/profile")}
												</a>
											</>
										)}
									</div>
								</div>
							</div>
							// forked_change end
						}

						<div
							style={{ display: isUsingOpenRouter ? "flex" : "none" } /*kilocode_change*/}
							className="items-center gap-2">
							<label className="block font-medium w-1/3">
								{t("settings:experimental.IMAGE_GENERATION.openRouterApiKeyLabel")}
							</label>
							<div className="flex-1 flex flex-col gap-1">
								<VSCodeTextField
									value={openRouterImageApiKey /*kilocode_change*/}
									onInput={(e: any) => handleApiKeyChange(e.target.value)}
									placeholder={t(
										"settings:experimental.IMAGE_GENERATION.openRouterApiKeyPlaceholder",
									)}
									className="w-full"
									type="password"
								/>
								<div className="text-vscode-descriptionForeground text-xs">
									{t("settings:experimental.IMAGE_GENERATION.getApiKeyText")}{" "}
									<a
										href="https://openrouter.ai/keys"
										target="_blank"
										rel="noopener noreferrer"
										className="text-vscode-textLink-foreground hover:text-vscode-textLink-activeForeground">
										openrouter.ai/keys
									</a>
								</div>
							</div>
						</div>

						{/* Model Selection */}
						<div className="flex items-center gap-2">
							<label className="block font-medium w-1/3">
								{t("settings:experimental.IMAGE_GENERATION.modelSelectionLabel")}
							</label>
							<div className="flex-1 flex flex-col gap-1">
								<VSCodeDropdown
									value={openRouterImageGenerationSelectedModel /*kilocode_change*/}
									onChange={(e: any) => handleModelChange(e.target.value)}
									className="w-full">
									{IMAGE_GENERATION_MODELS.map((model) => (
										<VSCodeOption key={model.value} value={model.value} className="py-2 px-3">
											{model.label}
										</VSCodeOption>
									))}
								</VSCodeDropdown>
								<div className="text-vscode-descriptionForeground text-xs">
									{t("settings:experimental.IMAGE_GENERATION.modelSelectionDescription")}
								</div>
							</div>
						</div>

						{/* Status Message */}
						{enabled && (isUsingOpenRouter ? !openRouterImageApiKey : !kiloCodeImageApiKey) && (
							<div className="p-2 bg-vscode-editorWarning-background text-vscode-editorWarning-foreground rounded text-sm">
								{t("settings:experimental.IMAGE_GENERATION.warningMissingKey")}
							</div>
						)}

						{enabled && (isUsingOpenRouter ? openRouterImageApiKey : kiloCodeImageApiKey) && (
							<div className="p-2 bg-vscode-editorInfo-background text-vscode-editorInfo-foreground rounded text-sm">
								{t("settings:experimental.IMAGE_GENERATION.successConfigured")}
							</div>
						)}
					</div>
				)}
			</div>
		</SettingsRow>
	)
}
