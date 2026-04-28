import React, { useMemo } from "react"
import { StandardTooltip } from "@/components/ui"
import { useExtensionState } from "@/context/ExtensionStateContext"
import { cn } from "@/lib/utils"

interface ContextUsageIndicatorProps {
	className?: string
}

export const ContextUsageIndicator: React.FC<ContextUsageIndicatorProps> = ({ className }) => {
	const { contextWindowUsage } = useExtensionState()

	const { currentUsage, maxContext, percentage } = useMemo(() => {
		// Use the context window usage from state if available
		if (contextWindowUsage) {
			const currentUsage = contextWindowUsage.currentTokens
			const maxContext = contextWindowUsage.maxTokens
			const percentage = maxContext > 0 ? Math.min((currentUsage / maxContext) * 100, 100) : 0
			return { currentUsage, maxContext, percentage }
		}

		// Default values when no usage data is available
		return { currentUsage: 0, maxContext: 200000, percentage: 0 }
	}, [contextWindowUsage])

	// SVG circle calculations
	const size = 16
	const strokeWidth = 2
	const radius = (size - strokeWidth) / 2
	const circumference = 2 * Math.PI * radius
	const strokeDashoffset = circumference - (percentage / 100) * circumference

	return (
		<StandardTooltip
			content={
				<div className="text-xs">
					<div className="font-semibold mb-1">Context Window Usage</div>
					<div>
						{currentUsage.toLocaleString()} / {maxContext.toLocaleString()} tokens
					</div>
					<div className="text-vscode-descriptionForeground mt-1">{percentage.toFixed(1)}% used</div>
				</div>
			}>
			<div className={cn("relative inline-flex items-center justify-center mr-1", className)}>
				<svg width={size} height={size} className="transform -rotate-90">
					{/* Background circle */}
					<circle
						cx={size / 2}
						cy={size / 2}
						r={radius}
						fill="none"
						stroke="var(--vscode-descriptionForeground)"
						strokeWidth={strokeWidth}
						strokeOpacity={0.2}
					/>
					{/* Progress circle */}
					<circle
						cx={size / 2}
						cy={size / 2}
						r={radius}
						fill="none"
						stroke="var(--vscode-descriptionForeground)"
						strokeWidth={strokeWidth}
						strokeDasharray={circumference}
						strokeDashoffset={strokeDashoffset}
						strokeLinecap="round"
						className="transition-all duration-300 ease-out"
					/>
				</svg>
			</div>
		</StandardTooltip>
	)
}
