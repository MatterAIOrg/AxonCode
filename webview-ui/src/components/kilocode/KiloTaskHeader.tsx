// kilocode_change: new file
import { memo } from "react"

import type { ClineMessage } from "@roo-code/types"

import { cn } from "@src/lib/utils"

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
				<div className="flex items-center gap-0">
					<div className="px-1 py-1 flex items-center gap-2 min-w-0 outline-none">
						<span className="text-sm truncate opacity-70">{title?.trim() || "New task"}</span>
					</div>
					<button
						onClick={onClose}
						className="shrink-0 w-5 h-5 flex items-center justify-center hover:bg-[var(--vscode-toolbar-hoverBackground)] rounded cursor-pointer">
						<span className="codicon codicon-close text-xs" />
					</button>
				</div>
			</div>
			{/* <TodoListDisplay todos={todos ?? []} /> */}
		</div>
	)
}

export default memo(KiloTaskHeader)
