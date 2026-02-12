import { DropdownOption, DropdownOptionType, SelectDropdown, StandardTooltip } from "@/components/ui"
import { usePreferredModels } from "@/components/ui/hooks/kilocode/usePreferredModels"
import { Alert02Icon } from "@/utils/customIcons"
import { OPENROUTER_DEFAULT_PROVIDER_NAME, type ProviderSettings } from "@roo-code/types"
import { useAppTranslation } from "@src/i18n/TranslationContext"
import { cn } from "@src/lib/utils"
import { vscode } from "@src/utils/vscode"
import { useMemo } from "react"
import { getModelCredits, prettyModelName } from "../../../utils/prettyModelName"
import { useProviderModels } from "../hooks/useProviderModels"
import { getModelIdKey, getSelectedModelId } from "../hooks/useSelectedModel"

interface ModelSelectorProps {
	currentApiConfigName?: string
	apiConfiguration: ProviderSettings
	fallbackText: string
}

export const ModelSelector = ({ currentApiConfigName, apiConfiguration, fallbackText }: ModelSelectorProps) => {
	const { t } = useAppTranslation()
	const { provider, providerModels, providerDefaultModel, isLoading, isError, proModelIds, proModelsEnabled } =
		useProviderModels(apiConfiguration)
	const selectedModelId = getSelectedModelId({
		provider,
		apiConfiguration,
		defaultModelId: providerDefaultModel,
	})
	const modelIdKey = getModelIdKey({ provider })

	const modelsIds = usePreferredModels(providerModels)
	const options = useMemo(() => {
		const missingModelIds = modelsIds.indexOf(selectedModelId) >= 0 ? [] : [selectedModelId]
		return missingModelIds.concat(modelsIds).map((modelId) => {
			const baseLabel = providerModels[modelId]?.displayName ?? prettyModelName(modelId)
			const credits = getModelCredits(modelId)
			const label = credits ? `${baseLabel} ${credits}` : baseLabel

			// kilocode_change: Check if this is a pro model that's disabled
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
	}, [modelsIds, providerModels, selectedModelId, proModelIds, proModelsEnabled])

	const disabled = isLoading || isError

	const onChange = (value: string) => {
		if (!currentApiConfigName) {
			return
		}
		if (apiConfiguration[modelIdKey] === value) {
			// don't reset openRouterSpecificProvider
			return
		}
		vscode.postMessage({
			type: "upsertApiConfiguration",
			text: currentApiConfigName,
			apiConfiguration: {
				...apiConfiguration,
				[modelIdKey]: value,
				openRouterSpecificProvider: OPENROUTER_DEFAULT_PROVIDER_NAME,
			},
		})
	}

	const renderItem = (option: DropdownOption & { isProModelDisabled?: boolean }) => {
		return (
			<div className="flex items-center justify-start gap-2 flex-1 py-1.5 px-3 hover:bg-[var(--vscode-menu-background)] hover:text-vscode-list-activeSelectionForeground">
				<div className="">
					<div>{option.label}</div>
				</div>
				{option.isProModelDisabled && (
					<StandardTooltip
						content={
							<div className="flex flex-col gap-2 text-[13px] p-2">
								<span className="font-semibold">Pro models are only available on the Paid Plan</span>
								<button
									className="text-[var(--color-matterai-green)] hover:underline text-left"
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
							<Alert02Icon className="size-4 text-yellow-500" />
						</span>
					</StandardTooltip>
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
		/>
	)
}
