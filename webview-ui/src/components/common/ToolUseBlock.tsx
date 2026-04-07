import { cn } from "@/lib/utils"
import { forwardRef } from "react"

export const ToolUseBlock = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
	({ className, ...props }, ref) => (
		<div
			ref={ref}
			className={cn(" w-full m-0 rounded-lg py-0 cursor-pointer hover:matterai-green", className)}
			{...props}
		/>
	),
)

ToolUseBlock.displayName = "ToolUseBlock"

export const ToolUseBlockHeader = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
	({ className, ...props }, ref) => (
		<div
			ref={ref}
			className={cn(
				"flex w-fit m-0 p-0 font-mono items-center select-none text-sm hover:text-[var(--vscode-button-background)] text-vscode-descriptionForeground",
				className,
			)}
			{...props}
		/>
	),
)

ToolUseBlockHeader.displayName = "ToolUseBlockHeader"
