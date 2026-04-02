import { useAppTranslation } from "@/i18n/TranslationContext"
import { VSCodeCheckbox } from "@vscode/webview-ui-toolkit/react"
import { FoldVertical } from "lucide-react"
import React, { HTMLAttributes } from "react"

import { Button, Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Slider } from "@/components/ui"
import { cn } from "@/lib/utils"
import { vscode } from "@/utils/vscode"
import { SettingsCard, SettingsRow, SettingsSwitch } from "./ui/SettingsCard"
import { SetCachedStateField } from "./types"

type ContextManagementSettingsProps = HTMLAttributes<HTMLDivElement> & {
	autoCondenseContext: boolean
	autoCondenseContextPercent: number
	listApiConfigMeta: any[]
	maxOpenTabsContext: number
	maxWorkspaceFiles: number
	showRooIgnoredFiles?: boolean
	maxReadFileLine?: number
	maxImageFileSize?: number
	maxTotalImageSize?: number
	maxConcurrentFileReads?: number
	allowVeryLargeReads?: boolean // kilocode_change
	profileThresholds?: Record<string, number>
	includeDiagnosticMessages?: boolean
	maxDiagnosticMessages?: number
	writeDelayMs: number
	setCachedStateField: SetCachedStateField<
		| "autoCondenseContext"
		| "autoCondenseContextPercent"
		| "maxOpenTabsContext"
		| "maxWorkspaceFiles"
		| "showRooIgnoredFiles"
		| "maxReadFileLine"
		| "maxImageFileSize"
		| "maxTotalImageSize"
		| "maxConcurrentFileReads"
		| "allowVeryLargeReads" // kilocode_change
		| "profileThresholds"
		| "includeDiagnosticMessages"
		| "maxDiagnosticMessages"
		| "writeDelayMs"
	>
}

export const ContextManagementSettings = ({
	autoCondenseContext,
	autoCondenseContextPercent,
	listApiConfigMeta,
	maxOpenTabsContext,
	maxWorkspaceFiles,
	showRooIgnoredFiles,
	setCachedStateField,
	maxReadFileLine,
	maxImageFileSize,
	maxTotalImageSize,
	maxConcurrentFileReads,
	allowVeryLargeReads, // kilocode_change
	profileThresholds = {},
	includeDiagnosticMessages,
	maxDiagnosticMessages,
	writeDelayMs,
	className,
	...props
}: ContextManagementSettingsProps) => {
	const { t } = useAppTranslation()
	const [selectedThresholdProfile, setSelectedThresholdProfile] = React.useState<string>("default")

	// Helper function to get the current threshold value based on selected profile
	const getCurrentThresholdValue = () => {
		if (selectedThresholdProfile === "default") {
			return autoCondenseContextPercent
		}
		const profileThreshold = profileThresholds[selectedThresholdProfile]
		if (profileThreshold === undefined || profileThreshold === -1) {
			return autoCondenseContextPercent // Use default if profile not configured or set to -1
		}
		return profileThreshold
	}

	// Helper function to handle threshold changes
	const handleThresholdChange = (value: number) => {
		if (selectedThresholdProfile === "default") {
			setCachedStateField("autoCondenseContextPercent", value)
		} else {
			const newThresholds = {
				...profileThresholds,
				[selectedThresholdProfile]: value,
			}
			setCachedStateField("profileThresholds", newThresholds)
			vscode.postMessage({
				type: "profileThresholds",
				values: newThresholds,
			})
		}
	}
	return (
		<div className={cn("flex flex-col gap-4", className)} {...props}>
			<div className="ml-1 mt-2">
				<h3 className="text-sm font-medium text-vscode-foreground m-0 px-1">
					{t("settings:sections.contextManagement")}
				</h3>
				<div className="text-vscode-descriptionForeground text-xs px-1 mt-1">
					{t("settings:contextManagement.description")}
				</div>
			</div>

			<SettingsCard>
				<SettingsRow
					title={t("settings:contextManagement.openTabs.label")}
					description={t("settings:contextManagement.openTabs.description")}>
					<div className="flex items-center gap-2 w-[180px]">
						<Slider
							min={0}
							max={500}
							step={1}
							value={[maxOpenTabsContext ?? 20]}
							onValueChange={([value]) => setCachedStateField("maxOpenTabsContext", value)}
							data-testid="open-tabs-limit-slider"
							className="flex-1"
						/>
						<span className="w-10 text-right text-xs">{maxOpenTabsContext ?? 20}</span>
					</div>
				</SettingsRow>

				<SettingsRow
					title={t("settings:contextManagement.workspaceFiles.label")}
					description={t("settings:contextManagement.workspaceFiles.description")}>
					<div className="flex items-center gap-2 w-[180px]">
						<Slider
							min={0}
							max={500}
							step={1}
							value={[maxWorkspaceFiles ?? 200]}
							onValueChange={([value]) => setCachedStateField("maxWorkspaceFiles", value)}
							data-testid="workspace-files-limit-slider"
							className="flex-1"
						/>
						<span className="w-10 text-right text-xs">{maxWorkspaceFiles ?? 200}</span>
					</div>
				</SettingsRow>

				<SettingsRow
					title={t("settings:contextManagement.maxConcurrentFileReads.label")}
					description={t("settings:contextManagement.maxConcurrentFileReads.description")}>
					<div className="flex items-center gap-2 w-[180px]">
						<Slider
							min={1}
							max={100}
							step={1}
							value={[Math.max(1, maxConcurrentFileReads ?? 5)]}
							onValueChange={([value]) => setCachedStateField("maxConcurrentFileReads", value)}
							data-testid="max-concurrent-file-reads-slider"
							className="flex-1"
						/>
						<span className="w-10 text-right text-xs">{Math.max(1, maxConcurrentFileReads ?? 5)}</span>
					</div>
				</SettingsRow>

				<SettingsRow
					title={t("settings:contextManagement.rooignore.label")}
					description={t("settings:contextManagement.rooignore.description")}>
					<SettingsSwitch
						checked={showRooIgnoredFiles ?? false}
						onChange={(checked) => setCachedStateField("showRooIgnoredFiles", checked)}
					/>
				</SettingsRow>

				<SettingsRow
					title={t("settings:contextManagement.maxReadFile.label")}
					description={t("settings:contextManagement.maxReadFile.description")}>
					<div className="flex flex-col gap-2 items-end">
						<div className="flex items-center gap-2">
							<Input
								type="number"
								pattern="-?[0-9]*"
								className="w-20 bg-vscode-input-background text-vscode-input-foreground border border-vscode-input-border px-2 py-1 rounded text-right [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none disabled:opacity-50"
								value={maxReadFileLine ?? -1}
								min={-1}
								onChange={(e) => {
									const newValue = parseInt(e.target.value, 10)
									if (!isNaN(newValue) && newValue >= -1) {
										setCachedStateField("maxReadFileLine", newValue)
									}
								}}
								onClick={(e) => e.currentTarget.select()}
								data-testid="max-read-file-line-input"
								disabled={maxReadFileLine === -1}
							/>
							<span className="text-xs">{t("settings:contextManagement.maxReadFile.lines")}</span>
						</div>
						<div className="flex items-center gap-1">
							<VSCodeCheckbox
								checked={maxReadFileLine === -1}
								onChange={(e: any) =>
									setCachedStateField("maxReadFileLine", e.target.checked ? -1 : 500)
								}
								data-testid="max-read-file-always-full-checkbox">
								<span className="text-xs">
									{t("settings:contextManagement.maxReadFile.always_full_read")}
								</span>
							</VSCodeCheckbox>
						</div>
					</div>
				</SettingsRow>

				{/*forked_change start*/}
				<SettingsRow
					title={t("kilocode:settings.contextManagement.allowVeryLargeReads.label")}
					description={t("kilocode:settings.contextManagement.allowVeryLargeReads.description")}>
					<SettingsSwitch
						checked={allowVeryLargeReads ?? false}
						onChange={(checked) => setCachedStateField("allowVeryLargeReads", checked)}
					/>
				</SettingsRow>
				{/*forked_change end*/}

				<SettingsRow
					title={t("settings:contextManagement.maxImageFileSize.label")}
					description={t("settings:contextManagement.maxImageFileSize.description")}>
					<div className="flex items-center gap-2">
						<Input
							type="number"
							pattern="[0-9]*"
							className="w-20 bg-vscode-input-background text-vscode-input-foreground border border-vscode-input-border px-2 py-1 rounded text-right [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
							value={maxImageFileSize ?? 5}
							min={1}
							max={100}
							onChange={(e) => {
								const newValue = parseInt(e.target.value, 10)
								if (!isNaN(newValue) && newValue >= 1 && newValue <= 100) {
									setCachedStateField("maxImageFileSize", newValue)
								}
							}}
							onClick={(e) => e.currentTarget.select()}
							data-testid="max-image-file-size-input"
						/>
						<span className="text-xs">{t("settings:contextManagement.maxImageFileSize.mb")}</span>
					</div>
				</SettingsRow>

				<SettingsRow
					title={t("settings:contextManagement.maxTotalImageSize.label")}
					description={t("settings:contextManagement.maxTotalImageSize.description")}>
					<div className="flex items-center gap-2">
						<Input
							type="number"
							pattern="[0-9]*"
							className="w-20 bg-vscode-input-background text-vscode-input-foreground border border-vscode-input-border px-2 py-1 rounded text-right [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
							value={maxTotalImageSize ?? 20}
							min={1}
							max={500}
							onChange={(e) => {
								const newValue = parseInt(e.target.value, 10)
								if (!isNaN(newValue) && newValue >= 1 && newValue <= 500) {
									setCachedStateField("maxTotalImageSize", newValue)
								}
							}}
							onClick={(e) => e.currentTarget.select()}
							data-testid="max-total-image-size-input"
						/>
						<span className="text-xs">{t("settings:contextManagement.maxTotalImageSize.mb")}</span>
					</div>
				</SettingsRow>

				<SettingsRow
					title={t("settings:contextManagement.diagnostics.includeMessages.label")}
					description={t("settings:contextManagement.diagnostics.includeMessages.description")}>
					<SettingsSwitch
						checked={includeDiagnosticMessages ?? false}
						onChange={(checked) => setCachedStateField("includeDiagnosticMessages", checked)}
					/>
				</SettingsRow>

				<SettingsRow
					title={t("settings:contextManagement.diagnostics.maxMessages.label")}
					description={t("settings:contextManagement.diagnostics.maxMessages.description")}>
					<div className="flex items-center gap-2 w-[180px]">
						<Slider
							min={1}
							max={100}
							step={1}
							value={[
								maxDiagnosticMessages !== undefined && maxDiagnosticMessages <= 0
									? 100
									: (maxDiagnosticMessages ?? 50),
							]}
							onValueChange={([value]) => {
								setCachedStateField("maxDiagnosticMessages", value === 100 ? -1 : value)
							}}
							data-testid="max-diagnostic-messages-slider"
							className="flex-1"
						/>
						<span className="w-16 text-right text-xs">
							{(maxDiagnosticMessages !== undefined && maxDiagnosticMessages <= 0) ||
							maxDiagnosticMessages === 100
								? t("settings:contextManagement.diagnostics.maxMessages.unlimitedLabel")
								: (maxDiagnosticMessages ?? 50)}
						</span>
						<Button
							variant="ghost"
							size="sm"
							onClick={() => setCachedStateField("maxDiagnosticMessages", 50)}
							title={t("settings:contextManagement.diagnostics.maxMessages.resetTooltip")}
							className="p-1 h-6 w-6 ml-1"
							disabled={maxDiagnosticMessages === 50}>
							<span className="codicon codicon-discard" />
						</Button>
					</div>
				</SettingsRow>

				<SettingsRow
					title={t("settings:contextManagement.diagnostics.delayAfterWrite.label")}
					description={t("settings:contextManagement.diagnostics.delayAfterWrite.description")}>
					<div className="flex items-center gap-2 w-[180px]">
						<Slider
							min={0}
							max={5000}
							step={100}
							value={[writeDelayMs]}
							onValueChange={([value]) => setCachedStateField("writeDelayMs", value)}
							data-testid="write-delay-slider"
							className="flex-1"
						/>
						<span className="w-10 text-right text-xs">{writeDelayMs}ms</span>
					</div>
				</SettingsRow>
			</SettingsCard>
			<div className="mt-4 pb-2">
				<SettingsCard>
					<SettingsRow title={t("settings:contextManagement.autoCondenseContext.name")}>
						<SettingsSwitch
							checked={autoCondenseContext ?? false}
							onChange={(checked) => setCachedStateField("autoCondenseContext", checked)}
						/>
					</SettingsRow>

					{autoCondenseContext && (
						<SettingsRow
							title={
								<div className="flex items-center gap-2">
									<FoldVertical size={16} />
									{t("settings:contextManagement.condensingThreshold.label")}
								</div>
							}
							description={
								selectedThresholdProfile === "default"
									? t("settings:contextManagement.condensingThreshold.defaultDescription", {
											threshold: autoCondenseContextPercent,
										})
									: t("settings:contextManagement.condensingThreshold.profileDescription")
							}>
							<div className="flex flex-col gap-3">
								<div className="w-[300px]">
									<Select
										value={selectedThresholdProfile || "default"}
										onValueChange={(value) => {
											setSelectedThresholdProfile(value)
										}}
										data-testid="threshold-profile-select">
										<SelectTrigger className="w-full">
											<SelectValue
												placeholder={
													t("settings:contextManagement.condensingThreshold.selectProfile") ||
													"Select profile for threshold"
												}
											/>
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="default">
												{t("settings:contextManagement.condensingThreshold.defaultProfile") ||
													"Default (applies to all unconfigured profiles)"}
											</SelectItem>
											{(listApiConfigMeta || []).map((config) => {
												const profileThreshold = profileThresholds[config.id]
												const thresholdDisplay =
													profileThreshold !== undefined
														? profileThreshold === -1
															? ` ${t(
																	"settings:contextManagement.condensingThreshold.usesGlobal",
																	{
																		threshold: autoCondenseContextPercent,
																	},
																)}`
															: ` (${profileThreshold}%)`
														: ""
												return (
													<SelectItem key={config.id} value={config.id}>
														{config.name}
														{thresholdDisplay}
													</SelectItem>
												)
											})}
										</SelectContent>
									</Select>
								</div>

								{/* Threshold Slider */}
								<div className="flex items-center gap-2 w-[180px]">
									<Slider
										min={10}
										max={100}
										step={1}
										value={[getCurrentThresholdValue()]}
										onValueChange={([value]) => handleThresholdChange(value)}
										data-testid="condense-threshold-slider"
										className="flex-1"
									/>
									<span className="w-10 text-right text-xs">{getCurrentThresholdValue()}%</span>
								</div>
							</div>
						</SettingsRow>
					)}
				</SettingsCard>
			</div>
		</div>
	)
}
