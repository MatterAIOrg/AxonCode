import React, { useCallback, useEffect, useMemo, useState } from "react"

import { useSelectedModel } from "@/components/ui/hooks/useSelectedModel"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { useExtensionState } from "@/context/ExtensionStateContext"
import { cn } from "@/lib/utils"
import { formatLargeNumber } from "@/utils/format"

interface ContextUsageIndicatorProps {
	className?: string
}

interface ContextBreakdown {
	systemPrompt: number
	toolDefinitions: number
	rules: number
	skills: number
	mcp: number
	subagentDefinitions: number
	cacheReads: number
	conversation: number
}

interface BreakdownCategory {
	key: keyof ContextBreakdown
	label: string
	color: string
}

const BREAKDOWN_CATEGORIES: BreakdownCategory[] = [
	{ key: "systemPrompt", label: "System prompt", color: "#808080" },
	{ key: "toolDefinitions", label: "Tool definitions", color: "#a87ffb" },
	{ key: "rules", label: "Rules", color: "#3fb950" },
	{ key: "skills", label: "Skills", color: "#f1b454" },
	{ key: "mcp", label: "MCP", color: "#c084fc" },
	{ key: "subagentDefinitions", label: "Subagent definitions", color: "#79addc" },
	{ key: "cacheReads", label: "Cache reads", color: "#56b6c2" },
	{ key: "conversation", label: "Conversation", color: "#70c0d0" },
]

const FALLBACK_BREAKDOWN: ContextBreakdown = {
	systemPrompt: 0,
	toolDefinitions: 0,
	rules: 0,
	skills: 0,
	mcp: 0,
	subagentDefinitions: 0,
	cacheReads: 0,
	conversation: 0,
}

export const ContextUsageIndicator: React.FC<ContextUsageIndicatorProps> = ({ className }) => {
	const { contextWindowUsage, apiConfiguration } = useExtensionState()
	const { info: selectedModelInfo } = useSelectedModel(apiConfiguration)
	const [open, setOpen] = useState(false)

	const { currentUsage, maxContext, percentage, breakdown } = useMemo(() => {
		if (contextWindowUsage) {
			const currentUsage = contextWindowUsage.currentTokens
			const maxContext = contextWindowUsage.maxTokens
			const percentage = maxContext > 0 ? Math.min((currentUsage / maxContext) * 100, 100) : 0
			return {
				currentUsage,
				maxContext,
				percentage,
				breakdown: contextWindowUsage.breakdown ?? FALLBACK_BREAKDOWN,
			}
		}

		// No task is open: fall back to the currently selected model's context window.
		const maxContext = selectedModelInfo?.contextWindow ?? 400000
		return { currentUsage: 0, maxContext, percentage: 0, breakdown: FALLBACK_BREAKDOWN }
	}, [contextWindowUsage, selectedModelInfo])

	// SVG circle calculations
	const size = 16
	const strokeWidth = 2
	const radius = (size - strokeWidth) / 2
	const circumference = 2 * Math.PI * radius
	const strokeDashoffset = circumference - (percentage / 100) * circumference

	// Total tokens accounted for in the breakdown (the residual is empty space).
	const accountedTokens = useMemo(
		() => Object.values(breakdown).reduce<number>((sum, value) => sum + (typeof value === "number" ? value : 0), 0),
		[breakdown],
	)

	// Segments for the horizontal bar. Skip categories with 0 tokens so we don't
	// draw empty cells, and compute each segment's width as a fraction of the
	// total accounted tokens (the bar always visualises the *full* context).
	const segments = useMemo(() => {
		const safeAccounted = Math.max(accountedTokens, 1)
		return BREAKDOWN_CATEGORIES.filter((category) => (breakdown[category.key] ?? 0) > 0).map((category) => ({
			...category,
			tokens: breakdown[category.key],
			width: (breakdown[category.key] / safeAccounted) * 100,
		}))
	}, [breakdown, accountedTokens])

	const refreshBreakdown = useCallback(() => {
		window.postMessage({ type: "refreshContextBreakdown" })
	}, [])

	// When the popover opens, ask the extension to rebuild the breakdown from
	// the latest system prompt so the numbers reflect the current state of the
	// mode/MCP/skills rather than stale values from the last API response.
	useEffect(() => {
		if (open) {
			refreshBreakdown()
		}
	}, [open, refreshBreakdown])

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>
				<button
					type="button"
					aria-label="Context usage"
					data-testid="context-usage-indicator-trigger"
					className={cn("relative inline-flex items-center justify-center mr-1 cursor-pointer", className)}>
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
				</button>
			</PopoverTrigger>
			<PopoverContent
				side="bottom"
				align="center"
				sideOffset={8}
				className="w-screen max-w-md mx-4 p-0 overflow-hidden"
				data-testid="context-usage-popover">
				<div className="flex items-center justify-between px-3 py-2">
					<span className="text-sm font-semibold text-vscode-foreground">Context Usage</span>
					<button
						type="button"
						aria-label="Close context usage"
						onClick={() => setOpen(false)}
						className="text-vscode-descriptionForeground hover:text-vscode-foreground rounded-sm p-0.5">
						<span className="codicon codicon-close" aria-hidden="true" />
					</button>
				</div>
				<div className="px-3 pb-2">
					<div className="flex items-center justify-between text-xs text-vscode-descriptionForeground">
						<span>{Math.round(percentage)}% Full</span>
						<span data-testid="context-usage-popover-tokens">
							~{formatLargeNumber(currentUsage)} / {formatLargeNumber(maxContext)} Tokens
						</span>
					</div>
				</div>
				<div className="px-3 pb-3">
					<div
						className="flex h-1.5 w-full overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--vscode-foreground)_20%,transparent)]"
						role="img"
						aria-label="Context window token distribution"
						data-testid="context-usage-bar">
						{segments.length === 0 ? (
							<div className="h-full w-full" />
						) : (
							segments.map((segment) => (
								<div
									key={segment.key}
									className="h-full"
									style={{ width: `${segment.width}%`, backgroundColor: segment.color }}
									title={`${segment.label}: ${formatLargeNumber(segment.tokens)} tokens`}
								/>
							))
						)}
					</div>
				</div>
				<div className="px-3 pb-3 space-y-1" data-testid="context-usage-list">
					{segments.length === 0 ? (
						<div className="text-xs text-vscode-descriptionForeground py-1">No context usage yet.</div>
					) : (
						segments.map((segment) => (
							<div
								key={segment.key}
								className="flex items-center justify-between text-xs text-vscode-foreground"
								data-testid={`context-usage-row-${segment.key}`}>
								<div className="flex items-center gap-2 min-w-0">
									<span
										className="inline-block h-2.5 w-2.5 rounded-sm flex-shrink-0"
										style={{ backgroundColor: segment.color }}
										aria-hidden="true"
									/>
									<span className="truncate">{segment.label}</span>
								</div>
								<span className="ml-2 text-vscode-descriptionForeground tabular-nums">
									{formatLargeNumber(segment.tokens)}
								</span>
							</div>
						))
					)}
				</div>
			</PopoverContent>
		</Popover>
	)
}
