import { useAppTranslation } from "@/i18n/TranslationContext"
import { VSCodeButton, VSCodeLink } from "@vscode/webview-ui-toolkit/react"
import { Download, Info, TriangleAlert, Upload } from "lucide-react"
import { HTMLAttributes } from "react"
import { Trans } from "react-i18next"

import type { TelemetrySetting } from "@roo-code/types"

import { Package } from "@roo/package"

import { cn } from "@/lib/utils"
import { vscode } from "@/utils/vscode"

import DangerButton from "../common/DangerButton"
import { Section } from "./Section"
import { SectionHeader } from "./SectionHeader"

type AboutProps = HTMLAttributes<HTMLDivElement> & {
	telemetrySetting: TelemetrySetting
	setTelemetrySetting: (setting: TelemetrySetting) => void
}

export const About = ({ telemetrySetting, setTelemetrySetting, className, ...props }: AboutProps) => {
	const { t } = useAppTranslation()

	return (
		<div className={cn("flex flex-col gap-2", className)} {...props}>
			<div className={cn("ml-2", className)}>
				<SectionHeader
					description={
						Package.sha
							? `Version: ${Package.version} (${Package.sha.slice(0, 8)})`
							: `Version: ${Package.version}`
					}>
					<div className="flex items-center gap-2">
						<Info className="w-4" />
						<div>{t("settings:sections.about")}</div>
					</div>
				</SectionHeader>
			</div>
			<Section>
				<div>
					<Trans
						i18nKey="settings:footer.feedback"
						components={{
							githubLink: <VSCodeLink href="hhttps://github.com/MatterAIOrg/Orbital-Extension" />,
							redditLink: <VSCodeLink href="https://reddit.com/r/matter_ai" />,
							discordLink: <VSCodeLink href="https://discord.gg/fJU5DvanU3" />,
						}}
					/>
				</div>

				{/* forked_change start */}
				<div>
					<Trans
						i18nKey="settings:footer.support"
						components={{
							supportLink: <VSCodeLink href="https://www.matterai.so/contact" />,
						}}
					/>
				</div>
				{/* forked_change end */}

				<div className="flex flex-wrap items-center gap-2 mt-2">
					<VSCodeButton
						appearance="primary"
						onClick={() => vscode.postMessage({ type: "exportSettings" })}
						className="w-28">
						<Upload className="p-0.5" />
						{t("settings:footer.settings.export")}
					</VSCodeButton>
					<VSCodeButton
						appearance="primary"
						onClick={() => vscode.postMessage({ type: "importSettings" })}
						className="w-28">
						<Download className="p-0.5" />
						{t("settings:footer.settings.import")}
					</VSCodeButton>
					<DangerButton
						appearance="primary"
						onClick={() => vscode.postMessage({ type: "resetState" })}
						className="w-28">
						<TriangleAlert className="p-0.5" />
						{t("settings:footer.settings.reset")}
					</DangerButton>
				</div>
			</Section>
		</div>
	)
}
