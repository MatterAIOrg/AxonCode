import { useState } from "react"
import { useTranslation } from "react-i18next"

import type { HistoryItem } from "@roo-code/types"

import { vscode } from "@/utils/vscode"
import { useCopyToClipboard } from "@/utils/clipboard"

import { DeleteTaskDialog } from "../history/DeleteTaskDialog"
import { IconButton } from "./IconButton"
import { Copy01Icon, Tick02Icon } from "@/utils/customIcons"
// import { ShareButton } from "./ShareButton" // kilocode_change unused
// import { CloudTaskButton } from "./CloudTaskButton" // kilocode_change: unused

interface TaskActionsProps {
	item?: HistoryItem
	buttonsDisabled: boolean
}

export const TaskActions = ({ item, buttonsDisabled }: TaskActionsProps) => {
	const [deleteTaskId, setDeleteTaskId] = useState<string | null>(null)
	const { t } = useTranslation()
	const { copyWithFeedback, showCopyFeedback } = useCopyToClipboard()

	return (
		<div className="flex flex-row items-center">
			<IconButton
				iconClass="codicon-desktop-download"
				title={t("chat:task.export")}
				onClick={() => vscode.postMessage({ type: "exportCurrentTask" })}
			/>
			{item?.task && (
				<button
					className="relative inline-flex items-center justify-center bg-transparent border-none p-1.5 rounded-md min-w-[28px] min-h-[28px] text-vscode-foreground opacity-85 transition-all duration-150 hover:opacity-100 hover:bg-[rgba(255,255,255,0.03)] hover:border-[rgba(255,255,255,0.15)] focus:outline-none focus-visible:ring-1 focus-visible:ring-vscode-focusBorder active:bg-[rgba(255,255,255,0.1)] cursor-pointer"
					title={t("history:copyPrompt")}
					onClick={(e) => copyWithFeedback(item.task, e)}>
					{showCopyFeedback ? <Tick02Icon className="size-4" /> : <Copy01Icon className="size-3" />}
				</button>
			)}
			{!!item?.size && item.size > 0 && (
				<>
					<div className="flex items-center">
						<IconButton
							iconClass="codicon-trash"
							title={t("chat:task.delete")}
							disabled={buttonsDisabled}
							onClick={(e) => {
								e.stopPropagation()

								if (e.shiftKey) {
									vscode.postMessage({ type: "deleteTaskWithId", text: item.id })
								} else {
									setDeleteTaskId(item.id)
								}
							}}
						/>
					</div>
					{deleteTaskId && (
						<DeleteTaskDialog
							taskId={deleteTaskId}
							onOpenChange={(open) => !open && setDeleteTaskId(null)}
							open
						/>
					)}
				</>
			)}
			{/* <ShareButton item={item} disabled={false} showLabel={false} /> kilocode_change: unused */}
			{/* <CloudTaskButton item={item} disabled={buttonsDisabled} />  */}
		</div>
	)
}
