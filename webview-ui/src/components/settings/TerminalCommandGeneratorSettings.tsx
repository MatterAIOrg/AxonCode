import { HTMLAttributes } from "react"
import { useAppTranslation } from "@/i18n/TranslationContext"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui"
import { useExtensionState } from "@/context/ExtensionStateContext"
import { cn } from "@/lib/utils"

import { SetCachedStateField } from "./types"
import { SettingsCard, SettingsRow } from "./ui/SettingsCard"

type TerminalCommandGeneratorSettingsProps = HTMLAttributes<HTMLDivElement> & {
	terminalCommandApiConfigId?: string
	setCachedStateField: SetCachedStateField<"terminalCommandApiConfigId">
}

export const TerminalCommandGeneratorSettings = ({
	terminalCommandApiConfigId,
	setCachedStateField,
	className,
	...props
}: TerminalCommandGeneratorSettingsProps) => {
	const { t } = useAppTranslation()
	const { listApiConfigMeta } = useExtensionState()

	return (
		<div className={cn("flex flex-col gap-2", className)} {...props}>
			<div className="ml-1 mt-2">
				<h3 className="text-sm font-medium text-vscode-foreground m-0 px-1">
					{t("kilocode:settings.terminal.commandGenerator.provider")}
				</h3>
			</div>

			<SettingsCard>
				<SettingsRow
					title={t("kilocode:settings.terminal.commandGenerator.apiConfigId.label")}
					description={t("kilocode:settings.terminal.commandGenerator.apiConfigId.description")}>
					<div className="w-[300px]">
						<Select
							value={terminalCommandApiConfigId || "-"}
							onValueChange={(value) =>
								setCachedStateField("terminalCommandApiConfigId", value === "-" ? "" : value)
							}>
							<SelectTrigger data-testid="terminal-command-api-config-select" className="w-full">
								<SelectValue
									placeholder={t("kilocode:settings.terminal.commandGenerator.apiConfigId.current")}
								/>
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="-">
									{t("kilocode:settings.terminal.commandGenerator.apiConfigId.current")}
								</SelectItem>
								{(listApiConfigMeta || []).map((config) => (
									<SelectItem
										key={config.id}
										value={config.id}
										data-testid={`terminal-command-${config.id}-option`}>
										{config.name} ({config.apiProvider})
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
				</SettingsRow>
			</SettingsCard>
		</div>
	)
}
