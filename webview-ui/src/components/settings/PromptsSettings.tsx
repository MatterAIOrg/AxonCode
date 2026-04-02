import React, { useState, useEffect } from "react"
import { VSCodeTextArea } from "@vscode/webview-ui-toolkit/react"

import { supportPrompt, SupportPromptType } from "@roo/support-prompt"

import { vscode } from "@src/utils/vscode"
import { useAppTranslation } from "@src/i18n/TranslationContext"
import { useExtensionState } from "@src/context/ExtensionStateContext"
import {
	Button,
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
	StandardTooltip,
} from "@src/components/ui"
import { SettingsCard, SettingsRow, SettingsSwitch } from "./ui/SettingsCard"
import { MessageSquare } from "lucide-react"
import CommitMessagePromptSettings from "./CommitMessagePromptSettings"

interface PromptsSettingsProps {
	customSupportPrompts: Record<string, string | undefined>
	setCustomSupportPrompts: (prompts: Record<string, string | undefined>) => void
	includeTaskHistoryInEnhance?: boolean
	setIncludeTaskHistoryInEnhance?: (value: boolean) => void
}

const PromptsSettings = ({
	customSupportPrompts,
	setCustomSupportPrompts,
	includeTaskHistoryInEnhance: propsIncludeTaskHistoryInEnhance,
	setIncludeTaskHistoryInEnhance: propsSetIncludeTaskHistoryInEnhance,
}: PromptsSettingsProps) => {
	const { t } = useAppTranslation()
	const {
		listApiConfigMeta,
		enhancementApiConfigId,
		setEnhancementApiConfigId,
		condensingApiConfigId,
		setCondensingApiConfigId,
		customCondensingPrompt,
		setCustomCondensingPrompt,
		includeTaskHistoryInEnhance: contextIncludeTaskHistoryInEnhance,
		setIncludeTaskHistoryInEnhance: contextSetIncludeTaskHistoryInEnhance,
	} = useExtensionState()

	// Use props if provided, otherwise fall back to context
	const includeTaskHistoryInEnhance = propsIncludeTaskHistoryInEnhance ?? contextIncludeTaskHistoryInEnhance ?? true
	const setIncludeTaskHistoryInEnhance = propsSetIncludeTaskHistoryInEnhance ?? contextSetIncludeTaskHistoryInEnhance

	const [testPrompt, setTestPrompt] = useState("")
	const [isEnhancing, setIsEnhancing] = useState(false)
	const [activeSupportOption, setActiveSupportOption] = useState<SupportPromptType>("ENHANCE")

	useEffect(() => {
		const handler = (event: MessageEvent) => {
			const message = event.data
			if (message.type === "enhancedPrompt") {
				if (message.text) {
					setTestPrompt(message.text)
				}
				setIsEnhancing(false)
			}
		}

		window.addEventListener("message", handler)
		return () => window.removeEventListener("message", handler)
	}, [])

	const updateSupportPrompt = (type: SupportPromptType, value: string | undefined) => {
		// Don't trim during editing to preserve intentional whitespace
		// Use nullish coalescing to preserve empty strings
		const finalValue = value ?? undefined

		if (type === "CONDENSE") {
			setCustomCondensingPrompt(finalValue ?? supportPrompt.default.CONDENSE)
			vscode.postMessage({
				type: "updateCondensingPrompt",
				text: finalValue ?? supportPrompt.default.CONDENSE,
			})
			// Also update the customSupportPrompts to trigger change detection
			const updatedPrompts = { ...customSupportPrompts }
			if (finalValue === undefined) {
				delete updatedPrompts[type]
			} else {
				updatedPrompts[type] = finalValue
			}
			setCustomSupportPrompts(updatedPrompts)
		} else {
			const updatedPrompts = { ...customSupportPrompts }
			if (finalValue === undefined) {
				delete updatedPrompts[type]
			} else {
				updatedPrompts[type] = finalValue
			}
			setCustomSupportPrompts(updatedPrompts)
		}
	}

	const handleSupportReset = (type: SupportPromptType) => {
		if (type === "CONDENSE") {
			setCustomCondensingPrompt(supportPrompt.default.CONDENSE)
			vscode.postMessage({
				type: "updateCondensingPrompt",
				text: supportPrompt.default.CONDENSE,
			})
			// Also update the customSupportPrompts to trigger change detection
			const updatedPrompts = { ...customSupportPrompts }
			delete updatedPrompts[type]
			setCustomSupportPrompts(updatedPrompts)
		} else {
			const updatedPrompts = { ...customSupportPrompts }
			delete updatedPrompts[type]
			setCustomSupportPrompts(updatedPrompts)
		}
	}

	const getSupportPromptValue = (type: SupportPromptType): string => {
		if (type === "CONDENSE") {
			// Preserve empty string - only fall back to default when value is nullish
			return customCondensingPrompt ?? supportPrompt.default.CONDENSE
		}
		return supportPrompt.get(customSupportPrompts, type)
	}

	const handleTestEnhancement = () => {
		if (!testPrompt.trim()) return

		setIsEnhancing(true)
		vscode.postMessage({
			type: "enhancePrompt",
			text: testPrompt,
		})
	}

	return (
		<div className="flex flex-col gap-2">
			<div className="ml-1 mt-2">
				<h3 className="text-sm font-medium text-vscode-foreground flex items-center gap-2 m-0 px-1">
					<MessageSquare className="w-4" />
					<span>{t("settings:sections.prompts")}</span>
				</h3>
				<div className="text-vscode-descriptionForeground text-xs px-1 mt-1">
					{t("settings:prompts.description")}
				</div>
			</div>

			<SettingsCard>
				<SettingsRow
					title={t("settings:common.select")}
					description={t(`prompts:supportPrompts.types.${activeSupportOption}.description`)}>
					<div className="w-[300px]">
						<Select
							value={activeSupportOption}
							onValueChange={(type) => setActiveSupportOption(type as SupportPromptType)}>
							<SelectTrigger className="w-full" data-testid="support-prompt-select-trigger">
								<SelectValue placeholder={t("settings:common.select")} />
							</SelectTrigger>
							<SelectContent>
								{Object.keys(supportPrompt.default).map((type) => (
									<SelectItem key={type} value={type} data-testid={`${type}-option`}>
										{t(`prompts:supportPrompts.types.${type}.label`)}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
				</SettingsRow>

				<div key={activeSupportOption} className="mt-4 px-3 pb-3">
					<div className="flex justify-between items-center mb-1">
						<label className="block font-medium">{t("prompts:supportPrompts.prompt")}</label>
						<StandardTooltip
							content={t("prompts:supportPrompts.resetPrompt", {
								promptType: activeSupportOption,
							})}>
							<Button variant="ghost" size="icon" onClick={() => handleSupportReset(activeSupportOption)}>
								<span className="codicon codicon-discard"></span>
							</Button>
						</StandardTooltip>
					</div>

					<VSCodeTextArea
						resize="vertical"
						value={getSupportPromptValue(activeSupportOption)}
						onInput={(e) => {
							const value =
								(e as unknown as CustomEvent)?.detail?.target?.value ??
								((e as any).target as HTMLTextAreaElement).value
							updateSupportPrompt(activeSupportOption, value)
						}}
						rows={6}
						className="w-full"
					/>

					{(activeSupportOption === "ENHANCE" || activeSupportOption === "CONDENSE") && (
						<div className="mt-4 flex flex-col gap-0 border-l border-vscode-button-background">
							<SettingsRow
								title={
									activeSupportOption === "ENHANCE"
										? t("prompts:supportPrompts.enhance.apiConfiguration")
										: t("prompts:supportPrompts.condense.apiConfiguration")
								}
								description={
									activeSupportOption === "ENHANCE"
										? t("prompts:supportPrompts.enhance.apiConfigDescription")
										: t("prompts:supportPrompts.condense.apiConfigDescription")
								}>
								<div className="w-[300px]">
									<Select
										value={
											activeSupportOption === "ENHANCE"
												? enhancementApiConfigId || "-"
												: condensingApiConfigId || "-"
										}
										onValueChange={(value) => {
											const newConfigId = value === "-" ? "" : value
											if (activeSupportOption === "ENHANCE") {
												setEnhancementApiConfigId(newConfigId)
												vscode.postMessage({
													type: "enhancementApiConfigId",
													text: value,
												})
											} else {
												setCondensingApiConfigId(newConfigId)
												vscode.postMessage({
													type: "condensingApiConfigId",
													text: newConfigId,
												})
											}
										}}>
										<SelectTrigger data-testid="api-config-select" className="w-full">
											<SelectValue
												placeholder={
													activeSupportOption === "ENHANCE"
														? t("prompts:supportPrompts.enhance.useCurrentConfig")
														: t("prompts:supportPrompts.condense.useCurrentConfig")
												}
											/>
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="-">
												{activeSupportOption === "ENHANCE"
													? t("prompts:supportPrompts.enhance.useCurrentConfig")
													: t("prompts:supportPrompts.condense.useCurrentConfig")}
											</SelectItem>
											{(listApiConfigMeta || []).map((config) => (
												<SelectItem
													key={config.id}
													value={config.id}
													data-testid={`${config.id}-option`}>
													{config.name}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								</div>
							</SettingsRow>

							{activeSupportOption === "ENHANCE" && (
								<>
									<SettingsRow
										title={t("prompts:supportPrompts.enhance.includeTaskHistory")}
										description={t("prompts:supportPrompts.enhance.includeTaskHistoryDescription")}>
										<SettingsSwitch
											checked={includeTaskHistoryInEnhance ?? false}
											onChange={(checked) => {
												setIncludeTaskHistoryInEnhance(checked)
												vscode.postMessage({
													type: "includeTaskHistoryInEnhance",
													bool: checked,
												})
											}}
										/>
									</SettingsRow>

									<SettingsRow title={t("prompts:supportPrompts.enhance.testEnhancement")}>
										<div className="flex flex-col gap-2 w-[400px]">
											<VSCodeTextArea
												resize="vertical"
												value={testPrompt}
												onChange={(e) => setTestPrompt((e.target as HTMLTextAreaElement).value)}
												placeholder={t("prompts:supportPrompts.enhance.testPromptPlaceholder")}
												rows={3}
												className="w-full"
												data-testid="test-prompt-textarea"
											/>
											<div className="flex justify-start">
												<Button
													variant="default"
													onClick={handleTestEnhancement}
													disabled={isEnhancing}>
													{t("prompts:supportPrompts.enhance.previewButton")}
												</Button>
											</div>
										</div>
									</SettingsRow>
								</>
							)}
						</div>
					)}

					{/* forked_change start */}
					{activeSupportOption === "COMMIT_MESSAGE" && <CommitMessagePromptSettings />}
					{/* forked_change end */}
				</div>
			</SettingsCard>
		</div>
	)
}

export default PromptsSettings
