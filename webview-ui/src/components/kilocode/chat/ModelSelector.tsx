import { DropdownOption, DropdownOptionType, SelectDropdown, StandardTooltip } from "@/components/ui"
import { usePreferredModels } from "@/components/ui/hooks/kilocode/usePreferredModels"
import { useThirdPartyModels } from "@/components/ui/hooks/useOllamaModels"
import { Alert02Icon, BulbIcon } from "@/utils/customIcons"
import {
	canUse400kContext,
	get200kAxonFallback,
	is400kAxonModel,
	OPENROUTER_DEFAULT_PROVIDER_NAME,
	type ProviderSettings,
} from "@roo-code/types"
import { useAppTranslation } from "@src/i18n/TranslationContext"
import { cn } from "@src/lib/utils"
import { vscode } from "@src/utils/vscode"
import { useMemo, useCallback, useEffect } from "react"
import { prettyModelName, AXON_MODEL_TOOLTIPS } from "../../../utils/prettyModelName"
import { useProviderModels } from "../hooks/useProviderModels"
import { getModelIdKey, getSelectedModelId } from "../hooks/useSelectedModel"
import { useExtensionState } from "@/context/ExtensionStateContext"
import { Settings } from "lucide-react"

/**
 * Sanitizes a model ID to create a user-friendly display name.
 * Uses the centralized prettyModelName function for consistent formatting.
 * Examples:
 * - matterai3p:@cf/moonshotai/kimi-k2.5 → "Kimi K2.5 (Moonshotai)"
 * - ollama:llama3.2:latest → "Llama3.2 (Latest)"
 * - fireworks:accounts/fireworks/routers/kimi-k2p5-turbo → "Kimi K2.5 Turbo (Fireworks)"
 */
const sanitizeModelLabel = (modelId: string, provider: string): string => {
	// Use the centralized prettyModelName function for consistent formatting
	const baseName = prettyModelName(modelId)

	// For Fireworks, add provider suffix if not already present
	if (provider === "fireworks" && !baseName.includes("(Fireworks)")) {
		// Check for special case model names
		if (modelId.includes("kimi-k2p5-turbo")) {
			return "Kimi K2.5 Turbo (Fireworks)"
		}
		return `${baseName} (Fireworks)`
	}

	// For other third-party providers, add provider suffix if not already present
	if (["ollama", "opencode"].includes(provider) && !baseName.includes("(")) {
		const formattedProvider = provider.charAt(0).toUpperCase() + provider.slice(1)
		return `${baseName} (${formattedProvider})`
	}

	return baseName
}

const MODEL_QUALIFIER_PATTERN = /\s*(\((?:200k context|400k context|free)\))$/i

const ModelLabel = ({ label }: { label: string }) => {
	const match = label.match(MODEL_QUALIFIER_PATTERN)

	if (!match || typeof match.index === "undefined") {
		return <>{label}</>
	}

	return (
		<>
			<span>{label.slice(0, match.index)}</span>{" "}
			<span className="text-[0.85em] text-vscode-descriptionForeground opacity-70">{match[1]}</span>
		</>
	)
}

interface ModelSelectorProps {
	currentApiConfigName?: string
	apiConfiguration: ProviderSettings
	fallbackText: string
	profilePlan?: string
}

export const ModelSelector = ({
	currentApiConfigName,
	apiConfiguration,
	fallbackText,
	profilePlan,
}: ModelSelectorProps) => {
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
	const has400kAccess = canUse400kContext(profilePlan)

	const modelsIds = usePreferredModels(providerModels)

	// Get third-party provider settings
	const ollamaEnabled = apiConfiguration?.thirdPartyProviders?.ollama?.enabled || false
	const opencodeEnabled = apiConfiguration?.thirdPartyProviders?.opencode?.enabled || false
	const fireworksEnabled = apiConfiguration?.thirdPartyProviders?.fireworks?.enabled || false

	// Fetch third-party models using hooks
	// matterai3p is always enabled (no settings required)
	const { data: matterai3pModels, refetch: refetchMatterai3pModels } = useThirdPartyModels("matterai3p", true)
	const { data: ollamaModels, refetch: refetchOllamaModels } = useThirdPartyModels("ollama", ollamaEnabled)
	const { data: opencodeModels, refetch: refetchOpencodeModels } = useThirdPartyModels("opencode", opencodeEnabled)
	const { data: fireworksModels, refetch: refetchFireworksModels } = useThirdPartyModels(
		"fireworks",
		fireworksEnabled,
	)

	// Refresh all third-party models
	const handleRefreshModels = useCallback(() => {
		refetchMatterai3pModels()
		if (ollamaEnabled) {
			refetchOllamaModels()
		}
		if (opencodeEnabled) {
			refetchOpencodeModels()
		}
		if (fireworksEnabled) {
			refetchFireworksModels()
		}
	}, [
		ollamaEnabled,
		opencodeEnabled,
		fireworksEnabled,
		refetchMatterai3pModels,
		refetchOllamaModels,
		refetchOpencodeModels,
		refetchFireworksModels,
	])

	// Separate matterai3p models (always shown after Axon models)
	const matterai3pOptions = useMemo(() => {
		const models: { [key: string]: { label: string; provider: string } } = {}
		if (matterai3pModels) {
			for (const [modelId, _modelInfo] of Object.entries(matterai3pModels)) {
				// Add matterai3p: prefix to the model ID for consistent identification
				const fullModelId = modelId.startsWith("matterai3p:") ? modelId : `matterai3p:${modelId}`
				// Always sanitize the label for consistent display
				models[fullModelId] = {
					label: sanitizeModelLabel(modelId, "matterai3p"),
					provider: "matterai3p",
				}
			}
		}
		return models
	}, [matterai3pModels])

	// Other third-party models (shown after matterai3p)
	const thirdPartyModels = useMemo(() => {
		const models: { [key: string]: { label: string; provider: string } } = {}

		// Add Ollama models
		if (ollamaEnabled && ollamaModels) {
			for (const [modelId, _modelInfo] of Object.entries(ollamaModels)) {
				// Add ollama: prefix to the model ID for consistent identification
				const fullModelId = modelId.startsWith("ollama:") ? modelId : `ollama:${modelId}`
				// Always sanitize the label for consistent display
				models[fullModelId] = {
					label: sanitizeModelLabel(modelId, "ollama"),
					provider: "ollama",
				}
			}
		}

		// Add OpenCode models
		if (opencodeEnabled && opencodeModels) {
			for (const [modelId, _modelInfo] of Object.entries(opencodeModels)) {
				// Add opencode: prefix to the model ID for consistent identification
				const fullModelId = modelId.startsWith("opencode:") ? modelId : `opencode:${modelId}`
				// Always sanitize the label for consistent display
				models[fullModelId] = {
					label: sanitizeModelLabel(modelId, "opencode"),
					provider: "opencode",
				}
			}
		}

		// Add Fireworks models
		if (fireworksEnabled && fireworksModels) {
			for (const [modelId, _modelInfo] of Object.entries(fireworksModels)) {
				// Add fireworks: prefix to the model ID for consistent identification
				const fullModelId = modelId.startsWith("fireworks:") ? modelId : `fireworks:${modelId}`
				// Always sanitize the label for consistent display
				models[fullModelId] = {
					label: sanitizeModelLabel(modelId, "fireworks"),
					provider: "fireworks",
				}
			}
		}

		return models
	}, [ollamaEnabled, opencodeEnabled, fireworksEnabled, ollamaModels, opencodeModels, fireworksModels])

	const options = useMemo(() => {
		// Check if selected model is a third-party model
		const isSelectedThirdParty =
			selectedModelId?.startsWith("ollama:") ||
			selectedModelId?.startsWith("opencode:") ||
			selectedModelId?.startsWith("matterai3p:") ||
			selectedModelId?.startsWith("fireworks:")

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
			const isExtendedContextDisabled = is400kAxonModel(modelId) && !has400kAccess

			return {
				value: modelId,
				label,
				type: DropdownOptionType.ITEM,
				disabled: isProModelDisabled || isExtendedContextDisabled,
				isProModelDisabled,
				isExtendedContextDisabled,
			}
		})
		const groupedContextWindows = [200000, 400000]
		const contextOptions = groupedContextWindows.flatMap((contextWindow) => {
			const modelsInGroup = allOptions.filter(
				(option) => providerModels[option.value]?.contextWindow === contextWindow,
			)

			return modelsInGroup.length > 0
				? [
						{
							value: `__context_${contextWindow}__`,
							label: `Context: ${contextWindow / 1000}k`,
							type: DropdownOptionType.GROUP,
							disabled: true,
							isProModelDisabled: false,
							isExtendedContextDisabled: false,
						},
						...modelsInGroup,
					]
				: []
		})
		const ungroupedOptions = allOptions.filter(
			(option) => !groupedContextWindows.includes(providerModels[option.value]?.contextWindow),
		)

		// Add matterai3p models (always shown after Axon models)
		const matterai3pOpts = Object.entries(matterai3pOptions).map(([modelId, { label }]) => ({
			value: modelId,
			label,
			type: DropdownOptionType.ITEM,
			disabled: false,
			isProModelDisabled: false,
			isExtendedContextDisabled: false,
		}))

		// Add other third-party provider models (shown after matterai3p)
		const thirdPartyOptions = Object.entries(thirdPartyModels).map(([modelId, { label }]) => ({
			value: modelId,
			label,
			type: DropdownOptionType.ITEM,
			disabled: false,
			isProModelDisabled: false,
			isExtendedContextDisabled: false,
		}))

		// Add "Configure Models" option at the end
		const configureOption = {
			value: "__configure_models__",
			label: "Configure Models...",
			codicon: "settings",
			type: DropdownOptionType.ITEM,
			disabled: false,
			isProModelDisabled: false,
			isExtendedContextDisabled: false,
		}

		// Order: Axon models -> matterai3p models -> other 3p models -> configure
		return [...contextOptions, ...ungroupedOptions, ...matterai3pOpts, ...thirdPartyOptions, configureOption]
	}, [
		modelsIds,
		providerModels,
		selectedModelId,
		proModelIds,
		proModelsEnabled,
		matterai3pOptions,
		thirdPartyModels,
		has400kAccess,
	])

	const disabled = isLoading || isError
	const selectAxonModel = useCallback(
		(value: string) => {
			if (currentTaskItem && provider) {
				vscode.postMessage({
					type: "updateTaskModel",
					apiProvider: provider,
					apiModelId: value,
					thirdPartySelectedModel: undefined,
				})
			} else {
				vscode.postMessage({
					type: "upsertApiConfiguration",
					text: currentApiConfigName || "default",
					apiConfiguration: {
						...apiConfiguration,
						[modelIdKey]: value,
						openRouterSpecificProvider: OPENROUTER_DEFAULT_PROVIDER_NAME,
						thirdPartySelectedModel: undefined,
					},
				})
			}
		},
		[currentTaskItem, provider, currentApiConfigName, apiConfiguration, modelIdKey],
	)

	const onChange = (value: string) => {
		if (is400kAxonModel(value) && !has400kAccess) return

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
		if (
			value.startsWith("ollama:") ||
			value.startsWith("opencode:") ||
			value.startsWith("matterai3p:") ||
			value.startsWith("fireworks:")
		) {
			const [_provider, ...modelParts] = value.split(":")
			const modelId = modelParts.join(":") // Handle model IDs that might contain colons

			// Log for debugging
			console.log("[ModelSelector] Third-party model selected:", {
				fullValue: value,
				extractedModelId: modelId,
				provider: _provider,
			})

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
					apiProvider: apiConfiguration?.apiProvider,
					apiModelId: modelId,
					thirdPartySelectedModel: value,
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

		selectAxonModel(value)
	}

	useEffect(() => {
		if (!profilePlan || has400kAccess || !is400kAxonModel(selectedModelId)) return

		const fallbackId = get200kAxonFallback(selectedModelId)
		if (providerModels[fallbackId]) selectAxonModel(fallbackId)
	}, [profilePlan, has400kAccess, selectedModelId, providerModels, selectAxonModel])

	const renderItem = (
		option: DropdownOption & { isProModelDisabled?: boolean; isExtendedContextDisabled?: boolean },
	) => {
		const isConfigureOption = option.value === "__configure_models__"
		const isThirdPartyModel =
			option.value.startsWith("ollama:") ||
			option.value.startsWith("opencode:") ||
			option.value.startsWith("matterai3p:") ||
			option.value.startsWith("fireworks:")
		const axonTooltip = AXON_MODEL_TOOLTIPS[option.value]
		const axonDescription = providerModels[option.value]?.description
		const isSelected = option.value === selectedModelId

		const itemContent = (
			<div
				className={cn(
					"flex w-full items-center gap-2.5 px-3 py-2 cursor-pointer transition-colors duration-150 rounded-lg",
					option.disabled
						? "opacity-50 cursor-not-allowed"
						: isSelected
							? "bg-[var(--vscode-list-activeSelectionBackground)] text-[var(--vscode-list-activeSelectionForeground)]"
							: "hover:bg-[var(--vscode-list-hoverBackground)] text-[var(--vscode-foreground)] opacity-80",
				)}>
				{isConfigureOption ? (
					<Settings className="opacity-80 mr-2 size-4 shrink-0" />
				) : isThirdPartyModel ? null : (
					<BulbIcon className="opacity-80 mr-2 size-4 shrink-0" />
				)}
				<div className="flex-1 min-w-0 flex items-baseline gap-2">
					<div className="font-bold text-sm shrink-0">
						<ModelLabel label={option.label} />
					</div>
				</div>
				{option.isProModelDisabled && (
					<StandardTooltip
						content={
							<div className="flex flex-col gap-2 text-[13px] p-2">
								<span className="font-semibold">Pro models are only available on the Paid Plan</span>
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
				{option.isExtendedContextDisabled && (
					<StandardTooltip
						content={
							<div className="flex flex-col gap-2 text-[13px] p-2">
								<span className="font-semibold">
									400k context is available on Pro Plus and Ultra plans
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
			</div>
		)

		// Wrap with tooltip for Axon models
		if ((axonTooltip || axonDescription) && !isConfigureOption && !isThirdPartyModel) {
			return (
				<StandardTooltip
					content={
						axonTooltip ? (
							<div className="flex flex-col">
								<span>{axonTooltip[0]}</span>
								<span>{axonTooltip[1]}</span>
							</div>
						) : (
							axonDescription
						)
					}
					side="right"
					sideOffset={8}>
					{itemContent}
				</StandardTooltip>
			)
		}

		return itemContent
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
			triggerClassName={cn(
				"w-full h-7 px-2 py-0 bg-[var(--vscode-editor-background)] rounded-lg border-none",
				"hover:bg-[var(--vscode-activityBar-border)]",
			)}
			triggerIcon={false}
			itemClassName="group"
			renderItem={renderItem}
			renderValue={(option) => <ModelLabel label={option.label} />}
			onRefresh={handleRefreshModels} // Always show refresh since matterai3p is always enabled
		/>
	)
}
