import { useMemo } from "react"
import { vscode } from "@src/utils/vscode"
import { AxonCodeOverageUsage } from "@roo/WebviewMessage"

function formatCurrency(value: number): string {
	if (!Number.isFinite(value)) return "$0"
	return new Intl.NumberFormat(undefined, {
		style: "currency",
		currency: "USD",
		maximumFractionDigits: 2,
	}).format(value)
}

function formatResetDate(iso?: string): string | null {
	if (!iso) return null
	const date = new Date(iso)
	if (Number.isNaN(date.getTime())) return null
	try {
		return date.toLocaleString(undefined, {
			month: "short",
			day: "numeric",
			year: "numeric",
			hour: "numeric",
			minute: "2-digit",
		})
	} catch {
		return date.toString()
	}
}

type OverageActiveBannerProps = {
	usage?: AxonCodeOverageUsage | null
	className?: string
}

/**
 * Shown in place of the out-of-credits banner when overage is enabled for the
 * user. The plan keeps running on shared org API credits past the 98% plan
 * threshold, so instead of blocking the user we surface that overage is active
 * and how much of the monthly overage budget has been spent.
 */
export const OverageActiveBanner = ({ usage, className }: OverageActiveBannerProps) => {
	const formattedResetDate = useMemo(() => formatResetDate(usage?.resetsAt), [usage?.resetsAt])

	const hasBudget = usage && usage.budget !== null && Number.isFinite(usage.budget)
	const spent = usage?.spent ?? 0
	const budget = usage?.budget ?? 0
	const percentage = usage?.percentage ?? null

	return (
		<div className={className ?? "w-full min-w-0 my-2 pr-1"}>
			<div className="flex flex-col rounded-2xl gap-2 px-3 py-2 bg-[var(--vscode-input-background)] border border-[var(--vscode-panel-border)]">
				<div className="flex items-center justify-between gap-2">
					<div className="flex flex-col gap-1">
						<span className="text-lg font-medium text-[var(--vscode-foreground)]">Overage is enabled</span>
						<span className="text-md text-[var(--vscode-descriptionForeground)] max-w-[85%]">
							Your plan limits have been reached, but overage is keeping Orbital running on API credits.
						</span>
						{hasBudget && (
							<span className="text-xs mt-0.5 font-bold text-[var(--vscode-descriptionForeground)]">
								Overage spend: {formatCurrency(spent)} / {formatCurrency(budget)}
								{percentage !== null ? ` (${percentage}%)` : ""}
							</span>
						)}
						{!hasBudget && Number.isFinite(spent) && spent > 0 && (
							<span className="text-xs mt-0.5 font-bold text-[var(--vscode-descriptionForeground)]">
								Overage spend this month: {formatCurrency(spent)}
							</span>
						)}
						{formattedResetDate && (
							<span className="text-xs mt-0.5 font-bold text-[var(--vscode-descriptionForeground)]">
								Overage budget resets at {formattedResetDate}
							</span>
						)}
					</div>
					<div className="flex flex-col items-stretch justify-center gap-2 shrink-0 self-center">
						<button
							className="flex items-center justify-center gap-1 px-3 py-1 rounded-full bg-[var(--vscode-button-background)] hover:bg-[var(--vscode-button-hoverBackground)] text-[var(--vscode-button-foreground)] font-medium transition-all duration-200"
							style={{ lineHeight: 1.2 }}
							onClick={() =>
								vscode.postMessage({
									type: "openExternal",
									url: "https://app.matterai.so/orbital?tab=overage",
								})
							}>
							Manage Overage
						</button>
					</div>
				</div>
			</div>
		</div>
	)
}
