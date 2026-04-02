// kilocode_change - new file
import { useAppTranslation } from "@/i18n/TranslationContext"
import { Monitor } from "lucide-react"
import { HTMLAttributes } from "react"

import { SettingsCard, SettingsRow, SettingsSwitch } from "./ui/SettingsCard"
import { SetCachedStateField } from "./types"

type DisplaySettingsProps = HTMLAttributes<HTMLDivElement> & {
	// showTaskTimeline?: boolean
	sendMessageOnEnter?: boolean // kilocode_change
	showTimestamps?: boolean
	// reasoningBlockCollapsed: boolean
	setCachedStateField: SetCachedStateField<
		// | "showTaskTimeline"
		| "sendMessageOnEnter"
		// | "reasoningBlockCollapsed"
		// | "hideCostBelowThreshold"
		| "showTimestamps"
	>
	// hideCostBelowThreshold?: number
}

export const DisplaySettings = ({
	// showTaskTimeline,
	showTimestamps,
	sendMessageOnEnter,
	// ghostServiceSettings,
	setCachedStateField,
	// reasoningBlockCollapsed,
	// hideCostBelowThreshold,
	...props
}: DisplaySettingsProps) => {
	const { t } = useAppTranslation()

	// Get the icons base URI for the animated logo
	// const [iconsBaseUri] = useState(() => {
	// 	const w = window as any
	// 	return w.ICONS_BASE_URI || ""
	// })

	// const sampleTimelineData = useMemo(() => generateSampleTimelineData(), [])

	// const onShowGutterAnimationChange = (newValue: boolean) => {
	// 	setCachedStateField("ghostServiceSettings", {
	// 		...(ghostServiceSettings || {}),
	// 		showGutterAnimation: newValue,
	// 	})
	// }

	// const handleReasoningBlockCollapsedChange = (value: boolean) => {
	// 	setCachedStateField("reasoningBlockCollapsed", value)

	// 	// Track telemetry event
	// 	telemetryClient.capture("ui_settings_collapse_thinking_changed", {
	// 		enabled: value,
	// 	})
	// }

	return (
		<div {...props}>
			<SettingsCard>
				<SettingsRow
					title={
						<div className="flex items-center gap-2">
							<Monitor className="w-4" />
							{t("settings:display.showTimestamps.label")}
						</div>
					}
					description={t("settings:display.showTimestamps.description")}>
					<SettingsSwitch
						checked={showTimestamps ?? false}
						onChange={(checked) => setCachedStateField("showTimestamps", checked)}
					/>
				</SettingsRow>

				<SettingsRow
					title={t("settings:display.sendMessageOnEnter.label")}
					description={t("settings:display.sendMessageOnEnter.description")}>
					<SettingsSwitch
						checked={sendMessageOnEnter ?? false}
						onChange={(checked) => setCachedStateField("sendMessageOnEnter", checked)}
					/>
				</SettingsRow>
			</SettingsCard>
		</div>
	)
}
