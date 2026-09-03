import React, { useEffect, useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { ProviderLogo } from "@/components/ui"
import { vscode } from "@/utils/vscode"
import { useExtensionState } from "@/context/ExtensionStateContext"
import { ProfileData, WebviewMessage, AxonCodeTieredUsage } from "@roo/WebviewMessage"
import { Activity, Cpu, Gauge, Sparkles, Wallet, ShieldCheck, Layers } from "lucide-react"

interface UsageDialogProps {
	open: boolean
	onOpenChange: (open: boolean) => void
	currentTaskLabel?: string | null
	tokensIn?: number
	tokensOut?: number
	cacheWrites?: number
	cacheReads?: number
	totalCost?: number
	contextTokens?: number
	hasActiveTask?: boolean
}

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

export const UsageDialog: React.FC<UsageDialogProps> = ({
	open,
	onOpenChange,
	currentTaskLabel,
	tokensIn = 0,
	tokensOut = 0,
	cacheReads = 0,
	// cacheWrites is accepted for API compatibility but intentionally not used:
	// Axon models charge nothing for cache writes, so they are not counted
	// toward the displayed total or shown as a separate line.
	cacheWrites: _cacheWrites = 0,
	// totalCost is accepted for API compatibility but intentionally not used:
	// per-task cost is currently surfaced only on the CLI's /usage output, not
	// in the webview dialog.
	totalCost: _totalCost = 0,
	// contextTokens = 0,
	hasActiveTask = false,
}) => {
	const { apiConfiguration } = useExtensionState()
	const [profileData, setProfileData] = useState<ProfileData | null>(null)
	const [balance, setBalance] = useState<number | null>(null)
	const [isLoading, setIsLoading] = useState(false)

	useEffect(() => {
		if (open) {
			setIsLoading(true)
			vscode.postMessage({ type: "fetchProfileDataRequest" })
			vscode.postMessage({ type: "fetchBalanceDataRequest" })
		}
	}, [open, apiConfiguration?.kilocodeToken])

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
			if (message.type === "balanceDataResponse") {
				const payload = message.payload as any
				if (payload?.success && payload.data) {
					setBalance(payload.data.balance ?? null)
				}
				setIsLoading(false)
			}
		}

		window.addEventListener("message", handleMessage)
		return () => {
			window.removeEventListener("message", handleMessage)
		}
	}, [])

	// Billable input combines fresh input tokens with cache reads (which Axon
	// charges at a discounted rate). Cache writes are intentionally omitted —
	// Axon models make cache writes free.
	const billableInput = tokensIn + cacheReads
	const tiered = profileData?.tieredUsage as AxonCodeTieredUsage | undefined

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
				<DialogHeader>
					<div className="flex items-center gap-2">
						<Gauge className="size-5 text-[var(--vscode-textLink-foreground)]" />
						<DialogTitle className="text-base font-semibold">Usage & Plan Details</DialogTitle>
					</div>
					<DialogDescription className="text-xs text-[var(--vscode-descriptionForeground)]">
						Current session metrics and subscription limits
					</DialogDescription>
				</DialogHeader>

				<div className="flex flex-col gap-4 py-2 text-xs">
					{/* 1. CURRENT TASK TOKEN USAGE */}
					<div className="rounded-lg border border-[var(--vscode-panel-border)] p-3 bg-[var(--vscode-editor-background)] flex flex-col gap-2.5">
						<div className="flex items-center justify-between">
							<div className="flex items-center gap-1.5 font-medium text-[var(--vscode-foreground)]">
								<Activity className="size-4 text-[var(--vscode-textLink-foreground)]" />
								<span>Current Task Token Usage</span>
							</div>
							{hasActiveTask ? (
								<span className="text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400">
									Active
								</span>
							) : (
								<span className="text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded bg-[var(--vscode-badge-background)] text-[var(--vscode-badge-foreground)]">
									No Active Task
								</span>
							)}
						</div>

						{hasActiveTask ? (
							<>
								{currentTaskLabel && (
									<div className="text-[11px] text-[var(--vscode-descriptionForeground)] truncate italic">
										&quot;{currentTaskLabel}&quot;
									</div>
								)}

								<div className="flex flex-col gap-1.5 text-[11px]">
									<div className="flex justify-between text-[var(--vscode-descriptionForeground)]">
										<span>Input + Cache Reads</span>
										<span className="font-medium text-[var(--vscode-foreground)]">
											{billableInput.toLocaleString()} tokens
										</span>
									</div>
									<div className="flex justify-between text-[var(--vscode-descriptionForeground)]">
										<span>Completions</span>
										<span className="font-medium text-[var(--vscode-foreground)]">
											{tokensOut.toLocaleString()} tokens
										</span>
									</div>
								</div>
							</>
						) : (
							<div className="text-[11px] text-[var(--vscode-descriptionForeground)] py-1">
								Start a task to view token usage for this session.
							</div>
						)}
					</div>

					{/* 2. PLAN DETAILS */}
					<div className="rounded-lg border border-[var(--vscode-panel-border)] p-3 bg-[var(--vscode-editor-background)] flex flex-col gap-2.5">
						<div className="flex items-center justify-between">
							<div className="flex items-center gap-1.5 font-medium text-[var(--vscode-foreground)]">
								<Sparkles className="size-4 text-amber-400" />
								<span>Plan & Account Details</span>
							</div>
							{profileData?.plan && (
								<span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-[var(--vscode-button-background)] text-[var(--vscode-button-foreground)]">
									{profileData.plan}
								</span>
							)}
						</div>

						{!apiConfiguration?.kilocodeToken ? (
							<div className="text-[11px] text-[var(--vscode-descriptionForeground)] py-1">
								Log in with your Kilocode / AxonCode account to see plan limits and balance.
							</div>
						) : isLoading && !profileData ? (
							<div className="text-[11px] text-[var(--vscode-descriptionForeground)] py-1">
								Loading plan details...
							</div>
						) : (
							<div className="flex flex-col gap-2.5">
								{/* Tiered / Window usage */}
								{tiered ? (
									<div className="flex flex-col gap-2">
										{/* Weekly */}
										{tiered.weekly && (
											<div className="flex flex-col gap-1 p-2 rounded bg-[var(--vscode-sideBar-background)] border border-[var(--vscode-panel-border)]/50">
												<div className="flex justify-between items-center text-[11px]">
													<span className="font-medium text-[var(--vscode-foreground)]">
														Weekly Limit
													</span>
													<span className="text-[var(--vscode-descriptionForeground)]">
														{Math.max(
															0,
															Math.min(100, tiered.weekly.percentage || 0),
														).toFixed(1)}
														% used
													</span>
												</div>
												<div className="w-full h-1.5 rounded-full bg-[var(--vscode-panel-border)] overflow-hidden">
													<div
														className="h-full bg-[var(--vscode-textLink-foreground)] rounded-full transition-all"
														style={{
															width: `${Math.min(100, Math.max(0, tiered.weekly.percentage || 0))}%`,
														}}
													/>
												</div>
												<div className="flex justify-between text-[10px] text-[var(--vscode-descriptionForeground)]">
													<span>Resets {formatRelativeTime(tiered.weekly.resetsAt)}</span>
												</div>
											</div>
										)}

										{/* Monthly */}
										{tiered.monthly && (
											<div className="flex flex-col gap-1 p-2 rounded bg-[var(--vscode-sideBar-background)] border border-[var(--vscode-panel-border)]/50">
												<div className="flex justify-between items-center text-[11px]">
													<span className="font-medium text-[var(--vscode-foreground)]">
														Monthly Limit
													</span>
													<span className="text-[var(--vscode-descriptionForeground)]">
														{Math.max(
															0,
															Math.min(100, tiered.monthly.percentage || 0),
														).toFixed(1)}
														% used
													</span>
												</div>
												<div className="w-full h-1.5 rounded-full bg-[var(--vscode-panel-border)] overflow-hidden">
													<div
														className="h-full bg-[var(--vscode-textLink-foreground)] rounded-full transition-all"
														style={{
															width: `${Math.min(100, Math.max(0, tiered.monthly.percentage || 0))}%`,
														}}
													/>
												</div>
												<div className="flex justify-between text-[10px] text-[var(--vscode-descriptionForeground)]">
													<span>Resets {formatRelativeTime(tiered.monthly.resetsAt)}</span>
												</div>
											</div>
										)}
									</div>
								) : profileData?.usagePercentage !== undefined ? (
									<div className="flex flex-col gap-1 p-2 rounded bg-[var(--vscode-sideBar-background)] border border-[var(--vscode-panel-border)]/50">
										<div className="flex justify-between items-center text-[11px]">
											<span className="font-medium text-[var(--vscode-foreground)]">
												Monthly Quota
											</span>
											<span className="text-[var(--vscode-descriptionForeground)]">
												{Math.max(0, Math.min(100, profileData.usagePercentage)).toFixed(1)}%
												used
											</span>
										</div>
										<div className="w-full h-1.5 rounded-full bg-[var(--vscode-panel-border)] overflow-hidden">
											<div
												className="h-full bg-[var(--vscode-textLink-foreground)] rounded-full transition-all"
												style={{
													width: `${Math.min(100, Math.max(0, profileData.usagePercentage))}%`,
												}}
											/>
										</div>
										{profileData.creditsResetDate && (
											<div className="text-[10px] text-[var(--vscode-descriptionForeground)] text-right">
												Resets {new Date(profileData.creditsResetDate).toLocaleDateString()}
											</div>
										)}
									</div>
								) : null}

								{/* Stats row: balance, reviews, org */}
								<div className="grid grid-cols-2 gap-2 pt-1 border-t border-[var(--vscode-panel-border)]/40 text-[11px]">
									{balance !== null && balance !== undefined && (
										<div className="flex items-center gap-1.5 text-[var(--vscode-descriptionForeground)]">
											<Wallet className="size-3.5 text-emerald-400 shrink-0" />
											<span>Balance:</span>
											<span className="font-semibold text-[var(--vscode-foreground)]">
												${balance.toFixed(2)}
											</span>
										</div>
									)}

									{profileData?.remainingReviews !== undefined && (
										<div className="flex items-center gap-1.5 text-[var(--vscode-descriptionForeground)]">
											<ShieldCheck className="size-3.5 text-blue-400 shrink-0" />
											<span>Reviews:</span>
											<span className="font-semibold text-[var(--vscode-foreground)]">
												{profileData.remainingReviews.toFixed(0)} left
											</span>
										</div>
									)}

									{profileData?.user?.name && (
										<div className="flex items-center gap-1.5 text-[var(--vscode-descriptionForeground)] col-span-2 truncate">
											<Layers className="size-3.5 text-purple-400 shrink-0" />
											<span>Account:</span>
											<span className="font-medium text-[var(--vscode-foreground)] truncate">
												{profileData.user.name} ({profileData.user.email || ""})
											</span>
										</div>
									)}
								</div>
							</div>
						)}
					</div>

					{/* 3. MODEL USAGE */}
					{profileData?.modelUsage && profileData.modelUsage.length > 0 && (
						<div className="rounded-lg border border-[var(--vscode-panel-border)] p-3 bg-[var(--vscode-editor-background)] flex flex-col gap-2.5">
							<div className="flex items-center gap-1.5 font-medium text-[var(--vscode-foreground)]">
								<Cpu className="size-4 text-cyan-400" />
								<span>Model Usage</span>
							</div>
							<div className="text-[10px] text-[var(--vscode-descriptionForeground)]">
								Each model&apos;s share of your plan windows (weekly / monthly).
							</div>
							<div className="flex flex-col gap-2">
								{profileData.modelUsage.map((entry) => (
									<div
										key={entry.model}
										className="flex flex-col gap-1.5 p-2 rounded bg-[var(--vscode-sideBar-background)] border border-[var(--vscode-panel-border)]/50">
										<div className="flex justify-between items-center gap-2 text-[11px]">
											<span className="flex min-w-0 items-center gap-1.5 font-medium text-[var(--vscode-foreground)]">
												<ProviderLogo src={entry.iconUrl} className="size-4" />
												<span className="truncate">{entry.model}</span>
											</span>
											<span className="text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded bg-[var(--vscode-badge-background)] text-[var(--vscode-badge-foreground)] shrink-0">
												{entry.multiplier}x cost
											</span>
										</div>
										{(["weekly", "monthly"] as const).map((window) => {
											const raw =
												window === "weekly" ? entry.weeklyPercentage : entry.monthlyPercentage
											const pct = Math.max(0, Math.min(100, raw || 0))
											return (
												<div key={window} className="flex items-center gap-2">
													<span className="w-12 shrink-0 text-[10px] text-[var(--vscode-descriptionForeground)] capitalize">
														{window}
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
											)
										})}
									</div>
								))}
							</div>
						</div>
					)}
				</div>
			</DialogContent>
		</Dialog>
	)
}
