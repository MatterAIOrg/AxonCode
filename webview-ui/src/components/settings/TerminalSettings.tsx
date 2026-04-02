import { HTMLAttributes, useState, useCallback } from "react"
import { useAppTranslation } from "@/i18n/TranslationContext"
import { vscode } from "@/utils/vscode"
import { VSCodeLink } from "@vscode/webview-ui-toolkit/react"
import { Trans } from "react-i18next"
import { buildDocLink } from "@src/utils/docLinks"
import { useEvent, useMount } from "react-use"

import { ExtensionMessage } from "@roo/ExtensionMessage"

import { cn } from "@/lib/utils"
import { Slider } from "@/components/ui"

import { SetCachedStateField } from "./types"
import { SettingsCard, SettingsRow, SettingsSwitch } from "./ui/SettingsCard"

type TerminalSettingsProps = HTMLAttributes<HTMLDivElement> & {
	terminalOutputLineLimit?: number
	terminalOutputCharacterLimit?: number
	terminalShellIntegrationTimeout?: number
	terminalShellIntegrationDisabled?: boolean
	terminalCommandDelay?: number
	terminalPowershellCounter?: boolean
	terminalZshClearEolMark?: boolean
	terminalZshOhMy?: boolean
	terminalZshP10k?: boolean
	terminalZdotdir?: boolean
	terminalCompressProgressBar?: boolean
	terminalCommandApiConfigId?: string // kilocode_change
	setCachedStateField: SetCachedStateField<
		| "terminalOutputLineLimit"
		| "terminalOutputCharacterLimit"
		| "terminalShellIntegrationTimeout"
		| "terminalShellIntegrationDisabled"
		| "terminalCommandDelay"
		| "terminalPowershellCounter"
		| "terminalZshClearEolMark"
		| "terminalZshOhMy"
		| "terminalZshP10k"
		| "terminalZdotdir"
		| "terminalCompressProgressBar"
		| "terminalCommandApiConfigId" // kilocode_change
	>
}

export const TerminalSettings = ({
	terminalOutputLineLimit,
	terminalOutputCharacterLimit,
	terminalShellIntegrationTimeout,
	terminalShellIntegrationDisabled,
	terminalCommandDelay,
	terminalPowershellCounter,
	terminalZshClearEolMark,
	terminalZshOhMy,
	terminalZshP10k,
	terminalZdotdir,
	terminalCompressProgressBar,
	terminalCommandApiConfigId, // kilocode_change
	setCachedStateField,
	className,
	...props
}: TerminalSettingsProps) => {
	const { t } = useAppTranslation()

	const [inheritEnv, setInheritEnv] = useState<boolean>(true)

	useMount(() => vscode.postMessage({ type: "getVSCodeSetting", setting: "terminal.integrated.inheritEnv" }))

	const onMessage = useCallback((event: MessageEvent) => {
		const message: ExtensionMessage = event.data

		switch (message.type) {
			case "vsCodeSetting":
				switch (message.setting) {
					case "terminal.integrated.inheritEnv":
						setInheritEnv(message.value ?? true)
						break
					default:
						break
				}
				break
			default:
				break
		}
	}, [])

	useEvent("message", onMessage)

	return (
		<div className={cn("flex flex-col gap-4", className)} {...props}>
			{/* Basic Settings */}
			<div className="flex flex-col gap-2">
				<div className="ml-1">
					<h3 className="text-sm font-medium text-vscode-foreground m-0 px-1">
						{t("settings:terminal.basic.label")}
					</h3>
				</div>
				<SettingsCard className="mb-0">
					<SettingsRow
						title={t("settings:terminal.outputLineLimit.label")}
						description={
							<Trans i18nKey="settings:terminal.outputLineLimit.description">
								<VSCodeLink
									href={buildDocLink(
										"features/shell-integration#terminal-output-limit",
										"settings_terminal_output_limit",
									)}
									style={{ display: "inline" }}>
									{" "}
								</VSCodeLink>
							</Trans>
						}>
						<div className="flex items-center gap-2 w-[180px]">
							<Slider
								min={100}
								max={5000}
								step={100}
								value={[terminalOutputLineLimit ?? 500]}
								onValueChange={([value]) => setCachedStateField("terminalOutputLineLimit", value)}
								data-testid="terminal-output-limit-slider"
								className="flex-1"
							/>
							<span className="w-10 text-right text-xs">{terminalOutputLineLimit ?? 500}</span>
						</div>
					</SettingsRow>

					<SettingsRow
						title={t("settings:terminal.outputCharacterLimit.label")}
						description={
							<Trans i18nKey="settings:terminal.outputCharacterLimit.description">
								<VSCodeLink
									href={buildDocLink(
										"features/shell-integration#terminal-output-limit",
										"settings_terminal_output_character_limit",
									)}
									style={{ display: "inline" }}>
									{" "}
								</VSCodeLink>
							</Trans>
						}>
						<div className="flex items-center gap-2 w-[180px]">
							<Slider
								min={1000}
								max={100000}
								step={1000}
								value={[terminalOutputCharacterLimit ?? 50000]}
								onValueChange={([value]) => setCachedStateField("terminalOutputCharacterLimit", value)}
								data-testid="terminal-output-character-limit-slider"
								className="flex-1"
							/>
							<span className="w-16 text-right text-xs">{terminalOutputCharacterLimit ?? 50000}</span>
						</div>
					</SettingsRow>

					<SettingsRow
						title={t("settings:terminal.compressProgressBar.label")}
						description={
							<Trans i18nKey="settings:terminal.compressProgressBar.description">
								<VSCodeLink
									href={buildDocLink(
										"features/shell-integration#compress-progress-bar-output",
										"settings_terminal_compress_progress_bar",
									)}
									style={{ display: "inline" }}>
									{" "}
								</VSCodeLink>
							</Trans>
						}>
						<SettingsSwitch
							checked={terminalCompressProgressBar ?? true}
							onChange={(checked) => setCachedStateField("terminalCompressProgressBar", checked)}
						/>
					</SettingsRow>
				</SettingsCard>
			</div>

			{/* Advanced Settings */}
			<div className="flex flex-col gap-2">
				<div className="ml-1">
					<h3 className="text-sm font-medium text-vscode-foreground m-0 px-1">
						{t("settings:terminal.advanced.label")}
					</h3>
					<div className="text-vscode-descriptionForeground text-xs px-1 mt-1">
						{t("settings:terminal.advanced.description")}
					</div>
				</div>
				<SettingsCard className="mb-0">
					<SettingsRow
						title={t("settings:terminal.inheritEnv.label")}
						description={
							<Trans i18nKey="settings:terminal.inheritEnv.description">
								<VSCodeLink
									href={buildDocLink(
										"features/shell-integration#inherit-environment-variables",
										"settings_terminal_inherit_env",
									)}
									style={{ display: "inline" }}>
									{" "}
								</VSCodeLink>
							</Trans>
						}>
						<SettingsSwitch
							checked={inheritEnv}
							onChange={(checked) => {
								setInheritEnv(checked)
								vscode.postMessage({
									type: "updateVSCodeSetting",
									setting: "terminal.integrated.inheritEnv",
									value: checked as any,
								})
							}}
						/>
					</SettingsRow>

					<SettingsRow
						title={t("settings:terminal.shellIntegrationDisabled.label")}
						description={
							<Trans i18nKey="settings:terminal.shellIntegrationDisabled.description">
								<VSCodeLink
									href={buildDocLink(
										"features/shell-integration#disable-terminal-shell-integration",
										"settings_terminal_shell_integration_disabled",
									)}
									style={{ display: "inline" }}>
									{" "}
								</VSCodeLink>
							</Trans>
						}>
						<SettingsSwitch
							checked={terminalShellIntegrationDisabled ?? true}
							onChange={(checked) => setCachedStateField("terminalShellIntegrationDisabled", checked)}
						/>
					</SettingsRow>

					{!terminalShellIntegrationDisabled && (
						<>
							<SettingsRow
								title={t("settings:terminal.shellIntegrationTimeout.label")}
								description={
									<Trans i18nKey="settings:terminal.shellIntegrationTimeout.description">
										<VSCodeLink
											href={buildDocLink(
												"features/shell-integration#terminal-shell-integration-timeout",
												"settings_terminal_shell_integration_timeout",
											)}
											style={{ display: "inline" }}>
											{" "}
										</VSCodeLink>
									</Trans>
								}>
								<div className="flex items-center gap-2 w-[180px]">
									<Slider
										min={1000}
										max={60000}
										step={1000}
										value={[terminalShellIntegrationTimeout ?? 5000]}
										onValueChange={([value]) =>
											setCachedStateField(
												"terminalShellIntegrationTimeout",
												Math.min(60000, Math.max(1000, value)),
											)
										}
										className="flex-1"
									/>
									<span className="w-10 text-right text-xs">
										{(terminalShellIntegrationTimeout ?? 5000) / 1000}s
									</span>
								</div>
							</SettingsRow>

							<SettingsRow
								title={t("settings:terminal.commandDelay.label")}
								description={
									<Trans i18nKey="settings:terminal.commandDelay.description">
										<VSCodeLink
											href={buildDocLink(
												"features/shell-integration#terminal-command-delay",
												"settings_terminal_command_delay",
											)}
											style={{ display: "inline" }}>
											{" "}
										</VSCodeLink>
									</Trans>
								}>
								<div className="flex items-center gap-2 w-[180px]">
									<Slider
										min={0}
										max={1000}
										step={10}
										value={[terminalCommandDelay ?? 0]}
										onValueChange={([value]) =>
											setCachedStateField(
												"terminalCommandDelay",
												Math.min(1000, Math.max(0, value)),
											)
										}
										className="flex-1"
									/>
									<span className="w-10 text-right text-xs">{terminalCommandDelay ?? 50}ms</span>
								</div>
							</SettingsRow>

							<SettingsRow
								title={t("settings:terminal.powershellCounter.label")}
								description={
									<Trans i18nKey="settings:terminal.powershellCounter.description">
										<VSCodeLink
											href={buildDocLink(
												"features/shell-integration#enable-powershell-counter-workaround",
												"settings_terminal_powershell_counter",
											)}
											style={{ display: "inline" }}>
											{" "}
										</VSCodeLink>
									</Trans>
								}>
								<SettingsSwitch
									checked={terminalPowershellCounter ?? false}
									onChange={(checked) => setCachedStateField("terminalPowershellCounter", checked)}
								/>
							</SettingsRow>

							<SettingsRow
								title={t("settings:terminal.zshClearEolMark.label")}
								description={
									<Trans i18nKey="settings:terminal.zshClearEolMark.description">
										<VSCodeLink
											href={buildDocLink(
												"features/shell-integration#clear-zsh-eol-mark",
												"settings_terminal_zsh_clear_eol_mark",
											)}
											style={{ display: "inline" }}>
											{" "}
										</VSCodeLink>
									</Trans>
								}>
								<SettingsSwitch
									checked={terminalZshClearEolMark ?? true}
									onChange={(checked) => setCachedStateField("terminalZshClearEolMark", checked)}
								/>
							</SettingsRow>

							<SettingsRow
								title={t("settings:terminal.zshOhMy.label")}
								description={
									<Trans i18nKey="settings:terminal.zshOhMy.description">
										<VSCodeLink
											href={buildDocLink(
												"features/shell-integration#enable-oh-my-zsh-integration",
												"settings_terminal_zsh_oh_my",
											)}
											style={{ display: "inline" }}>
											{" "}
										</VSCodeLink>
									</Trans>
								}>
								<SettingsSwitch
									checked={terminalZshOhMy ?? false}
									onChange={(checked) => setCachedStateField("terminalZshOhMy", checked)}
								/>
							</SettingsRow>

							<SettingsRow
								title={t("settings:terminal.zshP10k.label")}
								description={
									<Trans i18nKey="settings:terminal.zshP10k.description">
										<VSCodeLink
											href={buildDocLink(
												"features/shell-integration#enable-powerlevel10k-integration",
												"settings_terminal_zsh_p10k",
											)}
											style={{ display: "inline" }}>
											{" "}
										</VSCodeLink>
									</Trans>
								}>
								<SettingsSwitch
									checked={terminalZshP10k ?? false}
									onChange={(checked) => setCachedStateField("terminalZshP10k", checked)}
								/>
							</SettingsRow>

							<SettingsRow
								title={t("settings:terminal.zdotdir.label")}
								description={
									<Trans i18nKey="settings:terminal.zdotdir.description">
										<VSCodeLink
											href={buildDocLink(
												"features/shell-integration#enable-zdotdir-handling",
												"settings_terminal_zdotdir",
											)}
											style={{ display: "inline" }}>
											{" "}
										</VSCodeLink>
									</Trans>
								}>
								<SettingsSwitch
									checked={terminalZdotdir ?? false}
									onChange={(checked) => setCachedStateField("terminalZdotdir", checked)}
								/>
							</SettingsRow>
						</>
					)}
				</SettingsCard>
			</div>
			{/* forked_change start */}
			{/* <TerminalCommandGeneratorSettings
				terminalCommandApiConfigId={terminalCommandApiConfigId}
				setCachedStateField={setCachedStateField}
			/> */}
			{/* forked_change end */}
		</div>
	)
}
