import { useAppTranslation } from "@/i18n/TranslationContext"
import { VSCodeButton, VSCodeLink } from "@vscode/webview-ui-toolkit/react"
import { Download, TriangleAlert, Upload } from "lucide-react"
import { HTMLAttributes } from "react"
import { Trans } from "react-i18next"

import type { TelemetrySetting } from "@roo-code/types"

import { Package } from "@roo/package"

import { cn } from "@/lib/utils"
import { vscode } from "@/utils/vscode"

import DangerButton from "../common/DangerButton"
import { SettingsCard, SettingsRow } from "./ui/SettingsCard"

type AboutProps = HTMLAttributes<HTMLDivElement> & {
	telemetrySetting: TelemetrySetting
	setTelemetrySetting: (setting: TelemetrySetting) => void
}

export const About = ({ telemetrySetting, setTelemetrySetting, className, ...props }: AboutProps) => {
	const { t } = useAppTranslation()

	return (
		<div className={cn("flex flex-col gap-2", className)} {...props}>
			<SettingsCard>
				<SettingsRow
					title="Version"
					description={Package.sha ? `${Package.version} (${Package.sha.slice(0, 8)})` : Package.version}
				/>

				<SettingsRow
					title="Support & Feedback"
					description={
						<div className="flex flex-col gap-1">
							<Trans
								i18nKey="settings:footer.feedback"
								components={{
									githubLink: <VSCodeLink href="https://github.com/MatterAIOrg/Orbital-Extension" />,
									redditLink: <VSCodeLink href="https://reddit.com/r/matter_ai" />,
									discordLink: <VSCodeLink href="https://discord.gg/fJU5DvanU3" />,
								}}
							/>
							<Trans
								i18nKey="settings:footer.support"
								components={{
									supportLink: <VSCodeLink href="https://www.matterai.so/contact" />,
								}}
							/>
						</div>
					}
				/>

				<SettingsRow title="Data" description="Export, import, or reset your extension state.">
					<div className="flex flex-wrap items-center gap-2 justify-end">
						<VSCodeButton
							appearance="secondary"
							onClick={() => vscode.postMessage({ type: "exportSettings" })}>
							<div className="flex items-center gap-1.5">
								<Upload className="w-3" />
								{t("settings:footer.settings.export")}
							</div>
						</VSCodeButton>
						<VSCodeButton
							appearance="secondary"
							onClick={() => vscode.postMessage({ type: "importSettings" })}>
							<div className="flex items-center gap-1.5">
								<Download className="w-3" />
								{t("settings:footer.settings.import")}
							</div>
						</VSCodeButton>
						<DangerButton appearance="secondary" onClick={() => vscode.postMessage({ type: "resetState" })}>
							<div className="flex items-center gap-1.5">
								<TriangleAlert className="w-3" />
								{t("settings:footer.settings.reset")}
							</div>
						</DangerButton>
					</div>
				</SettingsRow>
			</SettingsCard>
		</div>
	)
}
