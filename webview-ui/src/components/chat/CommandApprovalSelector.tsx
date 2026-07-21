// forked_change: dropdown in the chat textarea that controls how command-execution
// approvals are handled for the current task. Mirrors KiloModeSelector's use of
// SelectDropdown so it visually matches the mode/model selectors next to it.
import React from "react"

import { SelectDropdown, DropdownOptionType } from "@/components/ui"
import type { DropdownOption } from "@/components/ui/select-dropdown"
import { useExtensionState } from "@/context/ExtensionStateContext"
import { useAppTranslation } from "@/i18n/TranslationContext"
import { vscode } from "@/utils/vscode"
import { cn } from "@/lib/utils"

export type CommandApprovalMode = "ask" | "approveForMe" | "fullAccess"

export const DEFAULT_COMMAND_APPROVAL_MODE: CommandApprovalMode = "approveForMe"

interface CommandApprovalSelectorProps {
	disabled?: boolean
	triggerClassName?: string
}

export const CommandApprovalSelector = ({ disabled = false, triggerClassName }: CommandApprovalSelectorProps) => {
	const { t } = useAppTranslation()
	const { commandApprovalMode, setCommandApprovalMode } = useExtensionState()

	const value: CommandApprovalMode = commandApprovalMode ?? DEFAULT_COMMAND_APPROVAL_MODE

	const handleChange = React.useCallback(
		(selectedValue: string) => {
			const mode = selectedValue as CommandApprovalMode
			setCommandApprovalMode(mode)
			vscode.postMessage({ type: "commandApprovalMode", text: mode })
		},
		[setCommandApprovalMode],
	)

	const options = React.useMemo<DropdownOption[]>(
		() => [
			{
				value: "ask",
				label: t("chat:commandApproval.ask.label"),
				description: t("chat:commandApproval.ask.description"),
				codicon: "hand",
				type: DropdownOptionType.ITEM,
			},
			{
				value: "approveForMe",
				label: t("chat:commandApproval.approveForMe.label"),
				description: t("chat:commandApproval.approveForMe.description"),
				codicon: "shield-user",
				type: DropdownOptionType.ITEM,
			},
			{
				value: "fullAccess",
				label: t("chat:commandApproval.fullAccess.label"),
				description: t("chat:commandApproval.fullAccess.description"),
				codicon: "security-warning",
				type: DropdownOptionType.ITEM,
			},
		],
		[t],
	)

	return (
		<SelectDropdown
			value={value}
			title={t("chat:commandApproval.title")}
			disabled={disabled}
			disableSearch
			options={options}
			onChange={handleChange}
			triggerIcon={false}
			triggerClassName={cn(
				`w-full h-7 px-2 py-0
				bg-[var(--vscode-editor-background)]
				rounded-lg
				border-none
				hover:bg-[var(--vscode-activityBar-border)]`,
				triggerClassName,
			)}
		/>
	)
}

export default CommandApprovalSelector
