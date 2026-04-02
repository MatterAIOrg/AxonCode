import { X } from "lucide-react"
import { HTMLAttributes, useState } from "react"

import { Button, Input } from "@/components/ui"
import { useAppTranslation } from "@/i18n/TranslationContext"
import { vscode } from "@/utils/vscode"

import { useExtensionState } from "@/context/ExtensionStateContext"
import { useAutoApprovalState } from "@/hooks/useAutoApprovalState"
import { useAutoApprovalToggles } from "@/hooks/useAutoApprovalToggles"
import { AutoApproveToggle } from "./AutoApproveToggle"
import { SettingsCard, SettingsRow, SettingsSwitch } from "./ui/SettingsCard"
import { SetCachedStateField } from "./types"

type AutoApproveSettingsProps = HTMLAttributes<HTMLDivElement> & {
	alwaysAllowReadOnly?: boolean
	alwaysAllowReadOnlyOutsideWorkspace?: boolean
	alwaysAllowWrite?: boolean
	alwaysAllowWriteOutsideWorkspace?: boolean
	alwaysAllowWriteProtected?: boolean
	alwaysAllowBrowser?: boolean
	alwaysApproveResubmit?: boolean
	requestDelaySeconds: number
	alwaysAllowMcp?: boolean
	alwaysAllowModeSwitch?: boolean
	alwaysAllowSubtasks?: boolean
	alwaysAllowExecute?: boolean
	alwaysAllowFollowupQuestions?: boolean
	alwaysAllowUpdateTodoList?: boolean
	// followupAutoApproveTimeoutMs?: number
	allowedCommands?: string[]
	allowedMaxRequests?: number | undefined
	allowedMaxCost?: number | undefined
	showAutoApproveMenu?: boolean // kilocode_change
	yoloMode?: boolean // kilocode_change
	deniedCommands?: string[]
	setCachedStateField: SetCachedStateField<
		| "alwaysAllowReadOnly"
		| "alwaysAllowReadOnlyOutsideWorkspace"
		| "alwaysAllowWrite"
		| "alwaysAllowWriteOutsideWorkspace"
		| "alwaysAllowWriteProtected"
		| "alwaysAllowBrowser"
		| "alwaysApproveResubmit"
		| "requestDelaySeconds"
		| "alwaysAllowMcp"
		| "alwaysAllowModeSwitch"
		| "alwaysAllowSubtasks"
		| "alwaysAllowExecute"
		| "alwaysAllowFollowupQuestions"
		| "followupAutoApproveTimeoutMs"
		| "allowedCommands"
		| "allowedMaxRequests"
		| "allowedMaxCost"
		| "showAutoApproveMenu" // kilocode_change
		| "yoloMode" // kilocode_change
		| "deniedCommands"
		| "alwaysAllowUpdateTodoList"
	>
}

export const AutoApproveSettings = ({
	alwaysAllowReadOnly,
	alwaysAllowReadOnlyOutsideWorkspace: _alwaysAllowReadOnlyOutsideWorkspace,
	alwaysAllowWrite,
	alwaysAllowWriteOutsideWorkspace: _alwaysAllowWriteOutsideWorkspace,
	alwaysAllowWriteProtected: _alwaysAllowWriteProtected,
	alwaysAllowBrowser,
	alwaysApproveResubmit,
	requestDelaySeconds: _requestDelaySeconds,
	alwaysAllowMcp,
	alwaysAllowModeSwitch,
	alwaysAllowSubtasks,
	alwaysAllowExecute,
	alwaysAllowFollowupQuestions,
	// followupAutoApproveTimeoutMs = 60000,
	alwaysAllowUpdateTodoList,
	allowedCommands,
	allowedMaxRequests: _allowedMaxRequests,
	allowedMaxCost: _allowedMaxCost,
	showAutoApproveMenu: _showAutoApproveMenu, // kilocode_change
	yoloMode: _yoloMode, // kilocode_change
	deniedCommands,
	setCachedStateField,
}: AutoApproveSettingsProps) => {
	const { t } = useAppTranslation()
	const [commandInput, setCommandInput] = useState("")
	const [deniedCommandInput, setDeniedCommandInput] = useState("")
	const { autoApprovalEnabled, setAutoApprovalEnabled } = useExtensionState()

	const toggles = useAutoApprovalToggles()

	const { effectiveAutoApprovalEnabled } = useAutoApprovalState(toggles, autoApprovalEnabled)

	const handleAddCommand = () => {
		const currentCommands = allowedCommands ?? []

		if (commandInput && !currentCommands.includes(commandInput)) {
			const newCommands = [...currentCommands, commandInput]
			setCachedStateField("allowedCommands", newCommands)
			setCommandInput("")
			vscode.postMessage({ type: "allowedCommands", commands: newCommands })
		}
	}

	const handleAddDeniedCommand = () => {
		const currentCommands = deniedCommands ?? []

		if (deniedCommandInput && !currentCommands.includes(deniedCommandInput)) {
			const newCommands = [...currentCommands, deniedCommandInput]
			setCachedStateField("deniedCommands", newCommands)
			setDeniedCommandInput("")
			vscode.postMessage({ type: "deniedCommands", commands: newCommands })
		}
	}

	return (
		<div className="flex flex-col gap-4">
			<SettingsCard>
				<SettingsRow
					title={t("settings:autoApprove.enabled")}
					description={t("settings:autoApprove.description")}>
					<SettingsSwitch
						checked={effectiveAutoApprovalEnabled ?? false}
						onChange={() => {
							const newValue = !(autoApprovalEnabled ?? false)
							setAutoApprovalEnabled(newValue)
							vscode.postMessage({ type: "autoApprovalEnabled", bool: newValue })
						}}
					/>
				</SettingsRow>
			</SettingsCard>

			{effectiveAutoApprovalEnabled && (
				<AutoApproveToggle
					alwaysAllowReadOnly={alwaysAllowReadOnly}
					alwaysAllowWrite={alwaysAllowWrite}
					alwaysAllowBrowser={alwaysAllowBrowser}
					alwaysApproveResubmit={alwaysApproveResubmit}
					alwaysAllowMcp={alwaysAllowMcp}
					alwaysAllowModeSwitch={alwaysAllowModeSwitch}
					alwaysAllowSubtasks={alwaysAllowSubtasks}
					alwaysAllowExecute={alwaysAllowExecute}
					alwaysAllowFollowupQuestions={alwaysAllowFollowupQuestions}
					alwaysAllowUpdateTodoList={alwaysAllowUpdateTodoList}
					onToggle={(key, value) => setCachedStateField(key, value)}
				/>
			)}

			{alwaysAllowExecute && effectiveAutoApprovalEnabled && (
				<div className="mt-4">
					<div className="mb-2 ml-1">
						<h3 className="text-sm font-medium text-vscode-foreground m-0 px-1 py-1">Terminal Commands</h3>
					</div>

					<SettingsCard>
						<SettingsRow
							title={
								<div>
									<span className="block font-medium mb-1">
										{t("settings:autoApprove.execute.allowedCommands")}
									</span>
									<div className="text-vscode-descriptionForeground text-xs mb-3">
										{t("settings:autoApprove.execute.allowedCommandsDescription")}
									</div>

									<div className="flex flex-col gap-3">
										<div className="flex gap-2 font-normal">
											<Input
												value={commandInput}
												onChange={(e: any) => setCommandInput(e.target.value)}
												onKeyDown={(e: any) => {
													if (e.key === "Enter") {
														e.preventDefault()
														handleAddCommand()
													}
												}}
												placeholder={t("settings:autoApprove.execute.commandPlaceholder")}
												className="grow"
												data-testid="command-input"
											/>
											<Button
												className="h-8 bg-vscode-button-background text-vscode-button-foreground hover:bg-vscode-button-hoverBackground"
												onClick={handleAddCommand}
												data-testid="add-command-button">
												{t("settings:autoApprove.execute.addButton")}
											</Button>
										</div>

										<div className="flex flex-wrap gap-2 text-xs font-normal">
											{(allowedCommands ?? []).map((cmd, index) => (
												<Button
													key={index}
													variant="secondary"
													data-testid={`remove-command-${index}`}
													onClick={() => {
														const newCommands = (allowedCommands ?? []).filter(
															(_, i) => i !== index,
														)
														setCachedStateField("allowedCommands", newCommands)
														vscode.postMessage({
															type: "allowedCommands",
															commands: newCommands,
														})
													}}>
													<div className="flex flex-row items-center gap-1">
														<div>{cmd}</div>
														<X className="text-foreground scale-75" />
													</div>
												</Button>
											))}
										</div>
									</div>
								</div>
							}
						/>

						<SettingsRow
							title={
								<div>
									<span className="block font-medium mb-1">
										{t("settings:autoApprove.execute.deniedCommands")}
									</span>
									<div className="text-vscode-descriptionForeground text-xs mb-3">
										{t("settings:autoApprove.execute.deniedCommandsDescription")}
									</div>

									<div className="flex flex-col gap-3">
										<div className="flex gap-2 font-normal">
											<Input
												value={deniedCommandInput}
												onChange={(e: any) => setDeniedCommandInput(e.target.value)}
												onKeyDown={(e: any) => {
													if (e.key === "Enter") {
														e.preventDefault()
														handleAddDeniedCommand()
													}
												}}
												placeholder={t("settings:autoApprove.execute.deniedCommandPlaceholder")}
												className="grow"
												data-testid="denied-command-input"
											/>
											<Button
												className="h-8 bg-vscode-button-background text-vscode-button-foreground hover:bg-vscode-button-hoverBackground"
												onClick={handleAddDeniedCommand}
												data-testid="add-denied-command-button">
												{t("settings:autoApprove.execute.addButton")}
											</Button>
										</div>

										<div className="flex flex-wrap gap-2 text-xs font-normal">
											{(deniedCommands ?? []).map((cmd, index) => (
												<Button
													key={index}
													variant="secondary"
													data-testid={`remove-denied-command-${index}`}
													onClick={() => {
														const newCommands = (deniedCommands ?? []).filter(
															(_, i) => i !== index,
														)
														setCachedStateField("deniedCommands", newCommands)
														vscode.postMessage({
															type: "deniedCommands",
															commands: newCommands,
														})
													}}>
													<div className="flex flex-row items-center gap-1">
														<div>{cmd}</div>
														<X className="text-foreground scale-75" />
													</div>
												</Button>
											))}
										</div>
									</div>
								</div>
							}
						/>
					</SettingsCard>
				</div>
			)}
		</div>
	)
}
