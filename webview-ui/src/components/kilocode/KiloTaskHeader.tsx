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
}

const KiloTaskHeader = ({
	onClose,
	// todos,
	title,
}: TaskHeaderProps) => {
	return (
		<div className="px-3">
			<div
				className={cn("py-1 flex flex-col relative z-1")}
				style={{
					boxShadow:
						"0 4px 6px -1px rgba(0, 0, 0, 80%), 0 2px 4px -1px rgba(0, 0, 0, 0.06), 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)",
					position: "relative",
					zIndex: 1,
				}}>
				{/* Title with close button */}
				<div className="flex justify-between items-center gap-2">
					<div className="px-2 py-1 flex items-center gap-2 min-w-0 bg-[var(--color-matterai-background-dark)] rounded-md border border-[var(--color-matterai-border)] outline-none">
						<span className="font-bold text-sm truncate">{title || "New task"}</span>
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
