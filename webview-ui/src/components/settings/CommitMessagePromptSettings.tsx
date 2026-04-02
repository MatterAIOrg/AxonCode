import React from "react"
import { useAppTranslation } from "@src/i18n/TranslationContext"
import { useExtensionState } from "@src/context/ExtensionStateContext"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@src/components/ui"
import { vscode } from "@src/utils/vscode"
import { SettingsRow } from "./ui/SettingsCard"

const CommitMessagePromptSettings = () => {
	const { t } = useAppTranslation()
	const { listApiConfigMeta, commitMessageApiConfigId, setCommitMessageApiConfigId } = useExtensionState()

	return (
		<SettingsRow
			title={t("prompts:supportPrompts.enhance.apiConfiguration")}
			description={t("prompts:supportPrompts.enhance.apiConfigDescription")}>
			<div className="w-[300px]">
				<Select
					value={commitMessageApiConfigId || "-"}
					onValueChange={(value) => {
						setCommitMessageApiConfigId(value === "-" ? "" : value)
						vscode.postMessage({
							type: "commitMessageApiConfigId",
							text: value,
						})
					}}>
					<SelectTrigger data-testid="commit-message-api-config-select" className="w-full">
						<SelectValue placeholder={t("prompts:supportPrompts.enhance.useCurrentConfig")} />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="-">{t("prompts:supportPrompts.enhance.useCurrentConfig")}</SelectItem>
						{(listApiConfigMeta || []).map((config) => (
							<SelectItem
								key={config.id}
								value={config.id}
								data-testid={`commit-message-${config.id}-option`}>
								{config.name}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</div>
		</SettingsRow>
	)
}

export default CommitMessagePromptSettings
