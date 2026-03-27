import { DropdownOption, DropdownOptionType, SelectDropdown, StandardTooltip } from "@/components/ui"
import { usePreferredModels } from "@/components/ui/hooks/kilocode/usePreferredModels"
import { useThirdPartyModels } from "@/components/ui/hooks/useOllamaModels"
import { Alert02Icon, Brain01Icon } from "@/utils/customIcons"
import { OPENROUTER_DEFAULT_PROVIDER_NAME, type ProviderSettings } from "@roo-code/types"
import { useAppTranslation } from "@src/i18n/TranslationContext"
import { cn } from "@src/lib/utils"
import { vscode } from "@src/utils/vscode"
import { useMemo, useCallback } from "react"
import { prettyModelName } from "../../../utils/prettyModelName"
import { useProviderModels } from "../hooks/useProviderModels"
import { getModelIdKey, getSelectedModelId } from "../hooks/useSelectedModel"
import { useExtensionState } from "@/context/ExtensionStateContext"
import { Settings } from "lucide-react"

interface ModelSelectorProps {
	currentApiConfigName?: string
	apiConfiguration: ProviderSettings
	fallbackText: string
}

export const ModelSelector = ({ currentApiConfigName, apiConfiguration, fallbackText }: ModelSelectorProps) => {
	const { t } = useAppTranslation()
	const { currentTaskItem } = useExtensionState()
	const { provider, providerModels, providerDefaultModel, isLoading, isError, proModelIds, proModelsEnabled } =
		useProviderModels(apiConfiguration)

	// Check if a third-party model is selected
	const thirdPartySelectedModel = apiConfiguration?.thirdPartySelectedModel

	const selectedModelId =
		thirdPartySelectedModel ||
		getSelectedModelId({
			provider,
			apiConfiguration,
			defaultModelId: providerDefaultModel,
		})
	const modelIdKey = getModelIdKey({ provider })

	const modelsIds = usePreferredModels(providerModels)

	// Get third-party provider settings
	const ollamaEnabled = apiConfiguration?.thirdPartyProviders?.ollama?.enabled || false
	const opencodeEnabled = apiConfiguration?.thirdPartyProviders?.opencode?.enabled || false

	// Fetch third-party models using hooks
	const { data: ollamaModels, refetch: refetchOllamaModels } = useThirdPartyModels("ollama", ollamaEnabled)
	const { data: opencodeModels, refetch: refetchOpencodeModels } = useThirdPartyModels("opencode", opencodeEnabled)

	// Refresh all third-party models
	const handleRefreshModels = useCallback(() => {
		if (ollamaEnabled) {
			refetchOllamaModels()
		}
		if (opencodeEnabled) {
			refetchOpencodeModels()
		}
	}, [ollamaEnabled, opencodeEnabled, refetchOllamaModels, refetchOpencodeModels])

	const thirdPartyModels = useMemo(() => {
		const models: { [key: string]: { label: string; provider: string } } = {}

		// Add Ollama models
		if (ollamaEnabled && ollamaModels) {
			for (const [modelId, modelInfo] of Object.entries(ollamaModels)) {
				models[modelId] = {
					label: modelInfo.description || modelId.replace("ollama:", ""),
					provider: "ollama",
				}
			}
		}

		// Add OpenCode models
		if (opencodeEnabled && opencodeModels) {
			for (const [modelId, modelInfo] of Object.entries(opencodeModels)) {
				models[modelId] = {
					label: modelInfo.description || modelId.replace("opencode:", ""),
					provider: "opencode",
				}
			}
		}

		return models
	}, [ollamaEnabled, opencodeEnabled, ollamaModels, opencodeModels])

	const options = useMemo(() => {
		// Check if selected model is a third-party model
		const isSelectedThirdParty = selectedModelId?.startsWith("ollama:") || selectedModelId?.startsWith("opencode:")

		// Only add to missingModelIds if it's not a third-party model and not already in the list
		const missingModelIds =
			!isSelectedThirdParty && modelsIds.indexOf(selectedModelId) >= 0
				? []
				: isSelectedThirdParty
					? []
					: [selectedModelId]
		const allOptions = missingModelIds.concat(modelsIds).map((modelId) => {
			const baseLabel = providerModels[modelId]?.displayName ?? prettyModelName(modelId)
			const label = baseLabel
			const isProModel = proModelIds?.includes(modelId)
			const isProModelDisabled = isProModel && !proModelsEnabled

			return {
				value: modelId,
				label,
				type: DropdownOptionType.ITEM,
				disabled: isProModelDisabled,
				isProModelDisabled,
			}
		})

		// Add third-party provider models
		const thirdPartyOptions = Object.entries(thirdPartyModels).map(([modelId, { label }]) => ({
			value: modelId,
			label,
			type: DropdownOptionType.ITEM,
			disabled: false,
			isProModelDisabled: false,
		}))

		// Add "Configure Models" option at the end
		const configureOption = {
			value: "__configure_models__",
			label: "Configure Models...",
			type: DropdownOptionType.ITEM,
			disabled: false,
			isProModelDisabled: false,
		}

		return [...allOptions, ...thirdPartyOptions, configureOption]
	}, [modelsIds, providerModels, selectedModelId, proModelIds, proModelsEnabled, thirdPartyModels])

	const disabled = isLoading || isError

	const onChange = (value: string) => {
		// Handle "Configure Models" option
		if (value === "__configure_models__") {
			vscode.postMessage({
				type: "openSettings",
				targetSection: "thirdPartyProviders",
			})
			return
		}

		// Handle third-party provider models
		// Third-party models use OpenAI-compatible API with custom base URL
		if (value.startsWith("ollama:") || value.startsWith("opencode:")) {
			const [_provider, ...modelParts] = value.split(":")
			const modelId = modelParts.join(":") // Handle model IDs that might contain colons

			// Build the configuration for third-party provider
			// We use the "openai" provider with custom base URL since both Ollama and OpenCode
			// are OpenAI-compatible APIs
			// IMPORTANT: We only update the model selection, NOT the apiProvider
			// The apiProvider should remain as the user's original Axon provider setting
			// The routing to the correct provider happens in buildApiHandler (src/api/index.ts)
			const thirdPartyConfig = {
				...apiConfiguration,
				// Store the third-party model selection separately
				thirdPartySelectedModel: value,
			}

			if (currentTaskItem) {
				// Update task-local configuration for isolation
				vscode.postMessage({
					type: "updateTaskModel",
					apiProvider: "openai",
					apiModelId: modelId,
				})
			} else if (currentApiConfigName) {
				vscode.postMessage({
					type: "upsertApiConfiguration",
					text: currentApiConfigName,
					apiConfiguration: thirdPartyConfig,
				})
			} else {
				vscode.postMessage({
					type: "upsertApiConfiguration",
					text: "default",
					apiConfiguration: thirdPartyConfig,
				})
			}
			return
		}

		if (apiConfiguration[modelIdKey] === value && !apiConfiguration.thirdPartySelectedModel) {
			// don't reset openRouterSpecificProvider
			return
		}

		// If there's an active task, use task-local model update for isolation
		// This prevents changing the model from affecting all tasks across all windows
		if (currentTaskItem && provider) {
			vscode.postMessage({
				type: "updateTaskModel",
				apiProvider: provider,
				apiModelId: value,
			})
		} else if (currentApiConfigName) {
			// No active task, update global configuration
			vscode.postMessage({
				type: "upsertApiConfiguration",
				text: currentApiConfigName,
				apiConfiguration: {
					...apiConfiguration,
					[modelIdKey]: value,
					openRouterSpecificProvider: OPENROUTER_DEFAULT_PROVIDER_NAME,
					// Clear third-party model selection when switching to Axon model
					thirdPartySelectedModel: undefined,
				},
			})
		} else {
			// No task and no config name - still try to update global configuration
			// This handles the case where model is selected before creating a task
			vscode.postMessage({
				type: "upsertApiConfiguration",
				text: "default",
				apiConfiguration: {
					...apiConfiguration,
					[modelIdKey]: value,
					openRouterSpecificProvider: OPENROUTER_DEFAULT_PROVIDER_NAME,
					// Clear third-party model selection when switching to Axon model
					thirdPartySelectedModel: undefined,
				},
			})
		}
	}

	const renderItem = (option: DropdownOption & { isProModelDisabled?: boolean }) => {
		const isConfigureOption = option.value === "__configure_models__"
		const isThirdPartyModel = option.value.startsWith("ollama:") || option.value.startsWith("opencode:")

		return (
			<div className="flex items-center justify-start gap-1 flex-1 py-1.5 px-3 hover:bg-[var(--vscode-menu-background)] hover:text-vscode-list-activeSelectionForeground">
				<div className="">
					<div>{option.label}</div>
				</div>
				{isConfigureOption ? (
					<Settings className="size-3.5 text-vscode-descriptionForeground" />
				) : isThirdPartyModel ? null : (
					<>
						<Brain01Icon className="size-3.5 text-white" />
						{option.isProModelDisabled && (
							<StandardTooltip
								content={
									<div className="flex flex-col gap-2 text-[13px] p-2">
										<span className="font-semibold">
											Pro models are only available on the Paid Plan
										</span>
										<button
											className="text-[var(--vscode-button-background)] hover:underline text-left"
											onClick={(e) => {
												e.stopPropagation()
												vscode.postMessage({
													type: "openExternal",
													url: "https://app.matterai.so/ai-coding-agent",
												})
											}}>
											Upgrade your plan here →
										</button>
									</div>
								}>
								<span className="flex items-center">
									<Alert02Icon className="size-4 ml-1 text-yellow-500" />
								</span>
							</StandardTooltip>
						)}
					</>
				)}
			</div>
		)
	}

	if (isLoading) {
		return null
	}

	if (isError || options.length <= 0) {
		return <span className="text-xs text-vscode-descriptionForeground opacity-70 truncate">{fallbackText}</span>
	}

	return (
		<SelectDropdown
			value={selectedModelId}
			disabled={disabled}
			title={t("chat:selectApiConfig")}
			options={options}
			onChange={onChange}
			contentClassName="max-h-[300px] overflow-y-auto"
			triggerClassName={cn(
				"w-full text-ellipsis overflow-hidden p-0",
				"bg-transparent border-transparent hover:bg-transparent hover:border-transparent",
			)}
			triggerIcon={true}
			itemClassName="group"
			renderItem={renderItem}
			onRefresh={ollamaEnabled || opencodeEnabled ? handleRefreshModels : undefined}
		/>
	)
}
