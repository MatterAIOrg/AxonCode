import { HTMLAttributes } from "react"
import { useAppTranslation } from "@/i18n/TranslationContext"
import { Glasses } from "lucide-react"
import { telemetryClient } from "@/utils/TelemetryClient"

import { SetCachedStateField } from "./types"
import { SettingsCard, SettingsRow, SettingsSwitch } from "./ui/SettingsCard"
import { ExtensionStateContextType } from "@/context/ExtensionStateContext"

interface UISettingsProps extends HTMLAttributes<HTMLDivElement> {
	reasoningBlockCollapsed: boolean
	setCachedStateField: SetCachedStateField<keyof ExtensionStateContextType>
}

export const UISettings = ({ reasoningBlockCollapsed, setCachedStateField, ...props }: UISettingsProps) => {
	const { t } = useAppTranslation()

	const handleReasoningBlockCollapsedChange = (value: boolean) => {
		setCachedStateField("reasoningBlockCollapsed", value)

		// Track telemetry event
		telemetryClient.capture("ui_settings_collapse_thinking_changed", {
			enabled: value,
		})
	}

	return (
		<div {...props}>
			<SettingsCard>
				<SettingsRow
					title={
						<div className="flex items-center gap-2">
							<Glasses className="w-4" />
							{t("settings:ui.collapseThinking.label")}
						</div>
					}
					description={t("settings:ui.collapseThinking.description")}>
					<SettingsSwitch
						checked={reasoningBlockCollapsed ?? false}
						onChange={handleReasoningBlockCollapsedChange}
					/>
				</SettingsRow>
			</SettingsCard>
		</div>
	)
}
