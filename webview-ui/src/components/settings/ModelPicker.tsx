import { Check, ChevronsUpDown, X } from "lucide-react"
import { Fragment, useCallback, useEffect, useRef, useState } from "react" // kilocode_change Fragment

import type { ModelInfo, OrganizationAllowList, ProviderSettings } from "@roo-code/types"

import { usePreferredModels } from "@/components/ui/hooks/kilocode/usePreferredModels" // kilocode_change
import { useSelectedModel } from "@/components/ui/hooks/useSelectedModel"
import { useAppTranslation } from "@src/i18n/TranslationContext"
// import { filterModels } from "./utils/organizationFilters" // kilocode_change: not doing this
import {
	Button,
	Command,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
	Popover,
	PopoverContent,
	PopoverTrigger,
	SelectSeparator, // kilocode_change
	StandardTooltip, // kilocode_change
} from "@src/components/ui"
import { useEscapeKey } from "@src/hooks/useEscapeKey"
import { cn } from "@src/lib/utils"
import { vscode } from "@src/utils/vscode" // kilocode_change

import { ApiErrorMessage } from "./ApiErrorMessage"
import { Alert02Icon } from "@/utils/customIcons"

type ModelIdKey = keyof Pick<
	ProviderSettings,
	| "glamaModelId"
	| "openRouterModelId"
	| "unboundModelId"
	| "requestyModelId"
	| "openAiModelId"
	| "litellmModelId"
	// forked_change start
	| "apiModelId"
	| "kilocodeModel"
	| "ovhCloudAiEndpointsModelId"
	// forked_change end
	| "deepInfraModelId"
	| "ioIntelligenceModelId"
	| "vercelAiGatewayModelId"
>

interface ModelPickerProps {
	defaultModelId: string
	models: Record<string, ModelInfo> | null
	modelIdKey: ModelIdKey
	serviceName: string
	serviceUrl: string
	apiConfiguration: ProviderSettings
	setApiConfigurationField: <K extends keyof ProviderSettings>(
		field: K,
		value: ProviderSettings[K],
		isUserAction?: boolean,
	) => void
	organizationAllowList: OrganizationAllowList
	errorMessage?: string
	// kilocode_change: pro models support
	proModelIds?: string[]
	proModelsEnabled?: boolean
}

export const ModelPicker = ({
	defaultModelId,
	models,
	modelIdKey,
	// serviceName,
	// serviceUrl,
	apiConfiguration,
	setApiConfigurationField,
	// organizationAllowList, // kilocode_change: unused
	errorMessage,
	// kilocode_change: pro models support
	proModelIds = [],
	proModelsEnabled = true,
}: ModelPickerProps) => {
	const { t } = useAppTranslation()

	const [open, setOpen] = useState(false)
	// const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false)
	const isInitialized = useRef(false)
	const searchInputRef = useRef<HTMLInputElement>(null)
	const selectTimeoutRef = useRef<NodeJS.Timeout | null>(null)
	const closeTimeoutRef = useRef<NodeJS.Timeout | null>(null)

	// forked_change start
	const modelIds = usePreferredModels(models)
	// const [isPricingExpanded, setIsPricingExpanded] = useState(false)
	// forked_change end

	const { id: selectedModelId } = useSelectedModel(apiConfiguration)

	const [searchValue, setSearchValue] = useState("")

	const onSelect = useCallback(
		(modelId: string) => {
			if (!modelId) {
				return
			}

			// kilocode_change: prevent selection of pro models when not enabled
			const isProModel = proModelIds.includes(modelId)
			if (isProModel && !proModelsEnabled) {
				return
			}

			setOpen(false)
			setApiConfigurationField(modelIdKey, modelId)

			// Clear any existing timeout
			if (selectTimeoutRef.current) {
				clearTimeout(selectTimeoutRef.current)
			}

			// Delay to ensure the popover is closed before setting the search value.
			selectTimeoutRef.current = setTimeout(() => setSearchValue(""), 100)
		},
		[modelIdKey, setApiConfigurationField, proModelIds, proModelsEnabled],
	)

	const onOpenChange = useCallback((open: boolean) => {
		setOpen(open)

		// Abandon the current search if the popover is closed.
		if (!open) {
			// Clear any existing timeout
			if (closeTimeoutRef.current) {
				clearTimeout(closeTimeoutRef.current)
			}

			// Clear the search value when closing instead of prefilling it
			closeTimeoutRef.current = setTimeout(() => setSearchValue(""), 100)
		}
	}, [])

	const onClearSearch = useCallback(() => {
		setSearchValue("")
		searchInputRef.current?.focus()
	}, [])

	useEffect(() => {
		if (!selectedModelId && !isInitialized.current) {
			const initialValue = modelIds.includes(selectedModelId) ? selectedModelId : defaultModelId
			setApiConfigurationField(modelIdKey, initialValue, false) // false = automatic initialization
		}

		isInitialized.current = true
	}, [modelIds, setApiConfigurationField, modelIdKey, selectedModelId, defaultModelId])

	// Cleanup timeouts on unmount to prevent test flakiness
	useEffect(() => {
		return () => {
			if (selectTimeoutRef.current) {
				clearTimeout(selectTimeoutRef.current)
			}
			if (closeTimeoutRef.current) {
				clearTimeout(closeTimeoutRef.current)
			}
		}
	}, [])

	// Use the shared ESC key handler hook
	useEscapeKey(open, () => setOpen(false))

	return (
		<>
			<div>
				<label className="block font-semibold mb-2 mt-2">{t("settings:modelPicker.label")}</label>
				<Popover open={open} onOpenChange={onOpenChange}>
					<PopoverTrigger asChild>
						<Button
							variant="combobox"
							role="combobox"
							aria-expanded={open}
							className="w-full justify-between"
							data-testid="model-picker-button">
							<div className="truncate">{selectedModelId ?? t("settings:common.select")}</div>
							<ChevronsUpDown className="opacity-50" />
						</Button>
					</PopoverTrigger>
					<PopoverContent className="p-0 w-[var(--radix-popover-trigger-width)]">
						<Command>
							<div className="relative">
								<CommandInput
									ref={searchInputRef}
									value={searchValue}
									onValueChange={setSearchValue}
									placeholder={t("settings:modelPicker.searchPlaceholder")}
									className="h-9 mr-4"
									data-testid="model-input"
								/>
								{searchValue.length > 0 && (
									<div className="absolute right-2 top-0 bottom-0 flex items-center justify-center">
										<X
											className="text-vscode-input-foreground opacity-50 hover:opacity-100 size-4 p-0.5 cursor-pointer"
											onClick={onClearSearch}
										/>
									</div>
								)}
							</div>
							<CommandList>
								<CommandEmpty>
									{searchValue && (
										<div className="py-2 px-1 text-sm">
											{t("settings:modelPicker.noMatchFound")}
										</div>
									)}
								</CommandEmpty>
								<CommandGroup>
									{/* forked_change start */}
									{modelIds.map((model, i) => {
										const isPreferred = Number.isInteger(models?.[model]?.preferredIndex)
										const previousModelWasPreferred = Number.isInteger(
											models?.[modelIds[i - 1]]?.preferredIndex,
										)
										// kilocode_change: check if this is a pro model that's disabled
										const isProModel = proModelIds.includes(model)
										const isProModelDisabled = isProModel && !proModelsEnabled

										return (
											<Fragment key={model}>
												{!isPreferred && previousModelWasPreferred ? <SelectSeparator /> : null}
												<CommandItem
													value={model}
													onSelect={onSelect}
													data-testid={`model-option-${model}`}
													className={cn(
														isPreferred ? "font-semibold" : "",
														isProModelDisabled ? "opacity-60 cursor-not-allowed" : "",
													)}>
													<span className="truncate" title={model}>
														{model}
													</span>
													{isProModelDisabled && (
														<StandardTooltip
															content={
																<div className="flex flex-col gap-2 text-[13px] p-2">
																	<span className="font-semibold">
																		Pro models are only available on the Paid Plan
																	</span>
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
													<Check
														className={cn(
															"size-4 p-0.5 ml-auto",
															model === selectedModelId ? "opacity-100" : "opacity-0",
														)}
													/>
												</CommandItem>
											</Fragment>
										)
									})}
									{/* forked_change end */}
								</CommandGroup>
							</CommandList>
							{searchValue && !modelIds.includes(searchValue) && (
								<div className="p-1 border-t border-vscode-input-border">
									<CommandItem data-testid="use-custom-model" value={searchValue} onSelect={onSelect}>
										{t("settings:modelPicker.useCustomModel", { modelId: searchValue })}
									</CommandItem>
								</div>
							)}
						</Command>
					</PopoverContent>
				</Popover>
			</div>
			{errorMessage && <ApiErrorMessage errorMessage={errorMessage} />}
		</>
	)
}
