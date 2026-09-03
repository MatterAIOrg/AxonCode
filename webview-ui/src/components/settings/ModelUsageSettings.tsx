import React, { useEffect, useState } from "react"
import { vscode } from "@/utils/vscode"
import { useExtensionState } from "@/context/ExtensionStateContext"
import { AxonCodeModelUsage, AxonCodeTieredUsage, ProfileData, WebviewMessage } from "@roo/WebviewMessage"
import { Cpu, Gauge, RefreshCw } from "lucide-react"

function formatRelativeTime(isoStr?: string): string {
	if (!isoStr) return "on session start"
	const now = Date.now()
	const target = new Date(isoStr).getTime()
	if (Number.isNaN(target)) return "on session start"
	const diff = target - now
	if (diff <= 0) return "now"
	const sec = Math.floor(diff / 1000)
	const min = Math.floor(sec / 60)
	const hrs = Math.floor(min / 60)
	const days = Math.floor(hrs / 24)
	if (days >= 1) return `in ${days} day${days > 1 ? "s" : ""}`
	if (hrs >= 1) return `in ${hrs}h ${min % 60}m`
	if (min >= 1) return `in ${min}m`
	return "soon"
}

const clampPercentage = (value: number | undefined) => Math.max(0, Math.min(100, value || 0))

const WindowBar: React.FC<{ label: string; percentage: number | undefined; resetsAt?: string }> = ({
	label,
	percentage,
	resetsAt,
}) => {
	const pct = clampPercentage(percentage)
	return (
		<div className="flex flex-col gap-1 p-2 rounded bg-[var(--vscode-sideBar-background)] border border-[var(--vscode-panel-border)]/50">
			<div className="flex justify-between items-center text-[11px]">
				<span className="font-medium text-[var(--vscode-foreground)]">{label}</span>
				<span className="text-[var(--vscode-descriptionForeground)]">{pct.toFixed(1)}% used</span>
			</div>
			<div className="w-full h-1.5 rounded-full bg-[var(--vscode-panel-border)] overflow-hidden">
				<div
					className="h-full bg-[var(--vscode-textLink-foreground)] rounded-full transition-all"
					style={{ width: `${pct}%` }}
				/>
			</div>
			{resetsAt && (
				<div className="flex justify-between text-[10px] text-[var(--vscode-descriptionForeground)]">
					<span>Resets {formatRelativeTime(resetsAt)}</span>
				</div>
			)}
		</div>
	)
}

const ModelUsageRow: React.FC<{ entry: AxonCodeModelUsage }> = ({ entry }) => {
	const weeklyPct = clampPercentage(entry.weeklyPercentage)
	const monthlyPct = clampPercentage(entry.monthlyPercentage)
	return (
		<div className="flex flex-col gap-1.5 p-2 rounded bg-[var(--vscode-sideBar-background)] border border-[var(--vscode-panel-border)]/50">
			<div className="flex justify-between items-center gap-2 text-[11px]">
				<span className="font-medium text-[var(--vscode-foreground)] truncate">{entry.model}</span>
				<span className="text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded bg-[var(--vscode-badge-background)] text-[var(--vscode-badge-foreground)] shrink-0">
					{entry.multiplier}x limit
				</span>
			</div>
			{(
				[
					["Weekly", weeklyPct],
					["Monthly", monthlyPct],
				] as const
			).map(([label, pct]) => (
				<div key={label} className="flex items-center gap-2">
					<span className="w-12 shrink-0 text-[10px] text-[var(--vscode-descriptionForeground)]">
						{label}
					</span>
					<div className="flex-1 h-1.5 rounded-full bg-[var(--vscode-panel-border)] overflow-hidden">
						<div
							className="h-full bg-[var(--vscode-textLink-foreground)] rounded-full transition-all"
							style={{ width: `${pct}%` }}
						/>
					</div>
					<span className="w-11 shrink-0 text-right text-[10px] text-[var(--vscode-descriptionForeground)]">
						{pct.toFixed(1)}%
					</span>
				</div>
			))}
		</div>
	)
}

export const ModelUsageSettings = () => {
	const { apiConfiguration } = useExtensionState()
	const [profileData, setProfileData] = useState<ProfileData | null>(null)
	const [isLoading, setIsLoading] = useState(false)

	const requestUsage = React.useCallback(() => {
		setIsLoading(true)
		vscode.postMessage({ type: "fetchProfileDataRequest" })
	}, [])

	useEffect(() => {
		requestUsage()
	}, [apiConfiguration?.kilocodeToken, requestUsage])

	useEffect(() => {
		const handleMessage = (event: MessageEvent<WebviewMessage>) => {
			const message = event.data
			if (message.type === "profileDataResponse") {
				const payload = message.payload as any
				if (payload?.success && payload.data) {
					setProfileData(payload.data)
				}
				setIsLoading(false)
			}
		}

		window.addEventListener("message", handleMessage)
		return () => {
			window.removeEventListener("message", handleMessage)
		}
	}, [])

	const tiered = profileData?.tieredUsage as AxonCodeTieredUsage | undefined
	const modelUsage = profileData?.modelUsage ?? []

	return (
		<div className="flex flex-col gap-4 text-xs">
			{/* Plan windows */}
			<div className="rounded-lg border border-[var(--vscode-panel-border)] p-3 bg-[var(--vscode-editor-background)] flex flex-col gap-2.5">
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-1.5 font-medium text-[var(--vscode-foreground)]">
						<Gauge className="size-4 text-[var(--vscode-textLink-foreground)]" />
						<span>Plan Usage Windows</span>
					</div>
					<button
						onClick={requestUsage}
						disabled={isLoading}
						className="flex items-center gap-1 text-[10px] text-[var(--vscode-textLink-foreground)] hover:opacity-80 disabled:opacity-50 cursor-pointer"
						data-testid="model-usage-refresh">
						<RefreshCw className={`size-3 ${isLoading ? "animate-spin" : ""}`} />
						Refresh
					</button>
				</div>

				{!apiConfiguration?.kilocodeToken ? (
					<div className="text-[11px] text-[var(--vscode-descriptionForeground)] py-1">
						Log in with your Kilocode / AxonCode account to see plan usage.
					</div>
				) : isLoading && !profileData ? (
					<div className="text-[11px] text-[var(--vscode-descriptionForeground)] py-1">
						Loading plan usage...
					</div>
				) : tiered ? (
					<div className="flex flex-col gap-2">
						{tiered.weekly && (
							<WindowBar
								label="Weekly Limit"
								percentage={tiered.weekly.percentage}
								resetsAt={tiered.weekly.resetsAt}
							/>
						)}
						{tiered.monthly && (
							<WindowBar
								label="Monthly Limit"
								percentage={tiered.monthly.percentage}
								resetsAt={tiered.monthly.resetsAt}
							/>
						)}
					</div>
				) : profileData?.usagePercentage !== undefined ? (
					<WindowBar label="Monthly Quota" percentage={profileData.usagePercentage} />
				) : (
					<div className="text-[11px] text-[var(--vscode-descriptionForeground)] py-1">
						No usage data available.
					</div>
				)}
			</div>

			{/* Per-model usage */}
			<div className="rounded-lg border border-[var(--vscode-panel-border)] p-3 bg-[var(--vscode-editor-background)] flex flex-col gap-2.5">
				<div className="flex items-center gap-1.5 font-medium text-[var(--vscode-foreground)]">
					<Cpu className="size-4 text-cyan-400" />
					<span>Model Usage</span>
				</div>
				<div className="text-[10px] text-[var(--vscode-descriptionForeground)]">
					Each tracked model&apos;s share of your shared plan pool (weekly / monthly). Models with a cost
					multiplier drain the pool faster per request.
				</div>
				{!apiConfiguration?.kilocodeToken ? (
					<div className="text-[11px] text-[var(--vscode-descriptionForeground)] py-1">
						Log in to see per-model usage.
					</div>
				) : modelUsage.length > 0 ? (
					<div className="flex flex-col gap-2">
						{modelUsage.map((entry) => (
							<ModelUsageRow key={entry.model} entry={entry} />
						))}
					</div>
				) : (
					<div className="text-[11px] text-[var(--vscode-descriptionForeground)] py-1">
						{isLoading ? "Loading model usage..." : "No model usage recorded in this cycle yet."}
					</div>
				)}
			</div>
		</div>
	)
}
