import { HTMLAttributes } from "react"
import { useAppTranslation } from "@/i18n/TranslationContext"

import { SetCachedStateField } from "./types"
import { SettingsCard, SettingsRow, SettingsSwitch } from "./ui/SettingsCard"
import { Slider } from "../ui"
import { vscode } from "../../utils/vscode"
import { Button } from "vscrui"

type NotificationSettingsProps = HTMLAttributes<HTMLDivElement> & {
	ttsEnabled?: boolean
	ttsSpeed?: number
	soundEnabled?: boolean
	soundVolume?: number
	systemNotificationsEnabled?: boolean // kilocode_change
	areSettingsCommitted?: boolean // kilocode_change
	setCachedStateField: SetCachedStateField<
		"ttsEnabled" | "ttsSpeed" | "soundEnabled" | "soundVolume" | "systemNotificationsEnabled"
	>
}

export const NotificationSettings = ({
	ttsEnabled,
	ttsSpeed,
	soundEnabled,
	soundVolume,
	systemNotificationsEnabled, // kilocode_change
	areSettingsCommitted, // kilocode_change
	setCachedStateField,
	...props
}: NotificationSettingsProps) => {
	const { t } = useAppTranslation()

	// forked_change start
	const onTestNotificationClick = () => {
		vscode.postMessage({
			type: "showSystemNotification",
			notificationOptions: {
				title: t("kilocode:settings.systemNotifications.testTitle"),
				message: t("kilocode:settings.systemNotifications.testMessage"),
			},
			alwaysAllow: true,
		})
	}
	// forked_change end

	return (
		<div {...props}>
			<SettingsCard>
				<SettingsRow
					title={t("settings:notifications.sound.label")}
					description={t("settings:notifications.sound.description")}>
					<SettingsSwitch
						checked={soundEnabled ?? false}
						onChange={(checked) => setCachedStateField("soundEnabled", checked)}
					/>
				</SettingsRow>

				{soundEnabled && (
					<SettingsRow title={t("settings:notifications.sound.volumeLabel")}>
						<div className="flex items-center gap-2 w-[180px]">
							<Slider
								min={0}
								max={1}
								step={0.01}
								value={[soundVolume ?? 0.5]}
								onValueChange={([value]) => setCachedStateField("soundVolume", value)}
								data-testid="sound-volume-slider"
								className="flex-1"
							/>
							<span className="w-10 text-right text-xs">{((soundVolume ?? 0.5) * 100).toFixed(0)}%</span>
						</div>
					</SettingsRow>
				)}

				<SettingsRow
					title={t("kilocode:settings.systemNotifications.label")}
					description={t("kilocode:settings.systemNotifications.description")}>
					<SettingsSwitch
						checked={systemNotificationsEnabled ?? false}
						onChange={(checked) => setCachedStateField("systemNotificationsEnabled", checked)}
					/>
				</SettingsRow>

				{systemNotificationsEnabled && (
					<SettingsRow title="Test Notification">
						<Button className="px-3" onClick={onTestNotificationClick}>
							{t("kilocode:settings.systemNotifications.testButton")}
						</Button>
					</SettingsRow>
				)}
			</SettingsCard>
		</div>
	)
}
