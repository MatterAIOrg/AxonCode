// kilocode_change: new file
import { memo } from "react"

import type { ClineMessage } from "@roo-code/types"

import { cn } from "@src/lib/utils"
import { StandardTooltip } from "@src/components/ui"
import { ListVideoIcon } from "@src/utils/customIcons"
import { vscode } from "@src/utils/vscode"

// import { TodoListDisplay } from "../chat/TodoListDisplay"

export interface TaskHeaderProps {
	task: ClineMessage
	tokensIn: number
	tokensOut: number
	cacheWrites?: number
	cacheReads?: number
	totalCost: number
	contextTokens: number
	handleCondenseContext: (taskId: string) => void
	onClose: () => void
	groupedMessages: (ClineMessage | ClineMessage[])[]
	onMessageClick?: (index: number) => void
	isTaskActive?: boolean
	todos?: any[]
	title?: string
	isAgentManagerMode?: boolean
}

const KiloTaskHeader = ({
	onClose,
	isAgentManagerMode,
	// todos,
	title,
}: TaskHeaderProps) => {
	return (
		<div className="px-3">
			<div
				className={cn("py-1 flex flex-col relative z-1")}
				style={{
					boxShadow: `${isAgentManagerMode ? "none" : "rgb(18 18 18 / 88%) 0px 7px 29px 0px"}`,
					position: "relative",
					zIndex: 1,
				}}>
				{/* Title with close button */}
				<div className="flex items-center gap-1">
					<div className="px-1 py-1 flex items-center gap-1 min-w-0 outline-none">
						<span className="text-sm truncate opacity-70">{title?.trim() || "New agent..."}</span>
						{!title?.trim() && (
							<span
								className="codicon codicon-loading codicon-modifier-spin shrink-0"
								style={{ fontSize: "8px" }}
							/>
						)}
					</div>
					<StandardTooltip content="Move Agent to Background">
						<button
							onClick={() => vscode.postMessage({ type: "plusButtonClicked" })}
							className="shrink-0 w-5 h-5 flex items-center justify-center hover:bg-[var(--vscode-toolbar-hoverBackground)] rounded cursor-pointer">
							<ListVideoIcon className="w-3.5 h-3.5" />
						</button>
					</StandardTooltip>
					<StandardTooltip content="Close Agent">
						<button
							onClick={onClose}
							className="shrink-0 w-5 h-5 flex items-center justify-center hover:bg-[var(--vscode-toolbar-hoverBackground)] rounded cursor-pointer">
							<span className="codicon codicon-close text-xs" />
						</button>
					</StandardTooltip>
				</div>
			</div>
			{/* <TodoListDisplay todos={todos ?? []} /> */}
		</div>
	)
}

export default memo(KiloTaskHeader)
