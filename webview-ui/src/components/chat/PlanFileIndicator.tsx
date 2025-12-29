import { cn } from "@/lib/utils"

interface PlanFileIndicatorProps {
	filename: string
	isActive?: boolean
}

export const PlanFileIndicator = ({ filename, isActive = false }: PlanFileIndicatorProps) => {
	return (
		<div className={cn("flex items-center gap-1 px-2 py-1 rounded-md border")}>
			<span className="codicon codicon-file-code text-xs" />
			<span className="text-xs font-medium truncate max-w-[200px]">{filename}</span>
			{isActive && <span className="codicon codicon-check-all text-[var(--color-matterai-green)] text-xs" />}
		</div>
	)
}
