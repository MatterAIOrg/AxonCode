import type { AxonCodeWeeklyResetAvailability } from "@roo/WebviewMessage"
import { VSCodeButton } from "@vscode/webview-ui-toolkit/react"

const WEEKLY_RESET_PLANS = new Set(["pro", "pro_plus", "ultra"])

function formatRelativeTime(isoStr?: string | null): string {
	if (!isoStr) return "soon"
	const target = new Date(isoStr).getTime()
	if (Number.isNaN(target)) return "soon"
	const diff = target - Date.now()
	if (diff <= 0) return "now"
	const min = Math.floor(diff / 60_000)
	const hrs = Math.floor(min / 60)
	const days = Math.floor(hrs / 24)
	if (days >= 1) return `in ${days} day${days > 1 ? "s" : ""}`
	if (hrs >= 1) return `in ${hrs}h ${min % 60}m`
	if (min >= 1) return `in ${min}m`
	return "soon"
}

type WeeklyResetButtonProps = {
	plan?: string
	availability?: AxonCodeWeeklyResetAvailability
	isResetting: boolean
	error?: string | null
	onReset: () => void
}

export const WeeklyResetButton = ({ plan, availability, isResetting, error, onReset }: WeeklyResetButtonProps) => {
	// The plan fallback keeps the control usable while profile responses from
	// older backend instances are still rolling out. The reset API remains the
	// source of truth and enforces both eligibility and monthly availability.
	const eligible = availability?.eligible ?? WEEKLY_RESET_PLANS.has(plan ?? "")
	const available = availability?.available ?? eligible

	if (!eligible) return null

	return (
		<div className="flex flex-col items-start gap-1">
			<VSCodeButton
				appearance="primary"
				disabled={!available || isResetting}
				onClick={onReset}
				className="inline-flex w-auto cursor-pointer items-center rounded text-xs h-5 py-0 px-2 leading-4 text-[var(--vscode-button-foreground)] bg-[var(--vscode-button-background)] hover:bg-[var(--vscode-button-hoverBackground)] disabled:cursor-not-allowed disabled:opacity-50">
				{isResetting ? "Resetting…" : `Reset Weekly Limit, ${available ? "1/1" : "0/1"} Remaining`}
			</VSCodeButton>
			{!available && availability?.nextAvailableAt && (
				<div className="text-[10px] ml-2 text-[var(--vscode-descriptionForeground)]">
					Available again {formatRelativeTime(availability.nextAvailableAt)}
				</div>
			)}
			{error && <div className="text-[10px] text-[var(--vscode-errorForeground)]">{error}</div>}
		</div>
	)
}
