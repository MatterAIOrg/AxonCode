import { HTMLAttributes } from "react"
import { useAppTranslation } from "@/i18n/TranslationContext"
import { VSCodeLink } from "@vscode/webview-ui-toolkit/react"
import { GitBranch } from "lucide-react"
import { Trans } from "react-i18next"
import { buildDocLink } from "@src/utils/docLinks"

import { SettingsCard, SettingsRow, SettingsSwitch } from "./ui/SettingsCard"
import { SetCachedStateField } from "./types"

type CheckpointSettingsProps = HTMLAttributes<HTMLDivElement> & {
	enableCheckpoints?: boolean
	setCachedStateField: SetCachedStateField<"enableCheckpoints">
}

export const CheckpointSettings = ({ enableCheckpoints, setCachedStateField, ...props }: CheckpointSettingsProps) => {
	const { t } = useAppTranslation()
	return (
		<div {...props}>
			<SettingsCard>
				<SettingsRow
					title={
						<div className="flex items-center gap-2">
							<GitBranch className="w-4" />
							{t("settings:checkpoints.enable.label")}
						</div>
					}
					description={
						<Trans i18nKey="settings:checkpoints.enable.description">
							<VSCodeLink
								href={buildDocLink("features/checkpoints", "settings_checkpoints")}
								style={{ display: "inline" }}>
								{" "}
							</VSCodeLink>
						</Trans>
					}>
					<SettingsSwitch
						checked={enableCheckpoints ?? false}
						onChange={(checked) => setCachedStateField("enableCheckpoints", checked)}
					/>
				</SettingsRow>
			</SettingsCard>
		</div>
	)
}
