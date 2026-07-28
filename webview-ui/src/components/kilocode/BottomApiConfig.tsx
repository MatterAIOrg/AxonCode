import { useExtensionState } from "@/context/ExtensionStateContext"
import { GitBranchIcon } from "@/utils/customIcons"
import { vscode } from "@/utils/vscode"
import { ProfileData, WebviewMessage } from "@roo/WebviewMessage"
import { GaugeCircle } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { WeeklyResetButton } from "./common/WeeklyResetButton"

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

export const BottomApiConfig = () => {
	const { apiConfiguration, clineMessages } = useExtensionState()
	// const { id: selectedModelId, provider: selectedProvider } = useSelectedModel(apiConfiguration)
	const [profileData, setProfileData] = useState<ProfileData | null>(null)
	const [currentBranch, setCurrentBranch] = useState<string | null>(null)
	const [showHoverCard, setShowHoverCard] = useState(false)
	const [cardPosition, setCardPosition] = useState({ top: 0, left: 0 })
	const triggerRef = useRef<HTMLDivElement>(null)
	const cardRef = useRef<HTMLDivElement>(null)
	const [_isLoading, setIsLoading] = useState(false)
	const [isResettingWeekly, setIsResettingWeekly] = useState(false)
	const [weeklyResetError, setWeeklyResetError] = useState<string | null>(null)
	const previousMessagesRef = useRef<string>("")

	useEffect(() => {
		// Only fetch usage data if we have a kilocode token
		if (apiConfiguration?.kilocodeToken) {
			setIsLoading(true)
			vscode.postMessage({ type: "fetchProfileDataRequest" })
			vscode.postMessage({ type: "fetchGitBranchRequest" })
		}
	}, [apiConfiguration?.kilocodeToken])

	useEffect(() => {
		const handleMessage = (event: MessageEvent<WebviewMessage>) => {
			const message = event.data
			if (message.type === "profileDataResponse") {
				const payload = message.payload as any
				if (payload?.success && payload.data) {
					// Store the full profile data for the hover card
					setProfileData(payload.data)
				}
				setIsLoading(false)
			}
			if (message.type === "gitBranchResponse") {
				const payload = message.payload as any
				if (payload?.success) {
					setCurrentBranch(payload.branch)
				}
			}
			if (message.type === "resetWeeklyUsageResponse") {
				const payload = message.payload as any
				setIsResettingWeekly(false)
				if (payload?.success && payload.data) {
					setWeeklyResetError(null)
					setProfileData((current) =>
						current
							? {
									...current,
									tieredUsage: payload.data.tieredUsage,
									weeklyReset: payload.data.weeklyReset,
								}
							: current,
					)
				} else {
					setWeeklyResetError(payload?.error || "Failed to reset weekly usage")
				}
			}
		}

		window.addEventListener("message", handleMessage)
		return () => {
			window.removeEventListener("message", handleMessage)
		}
	}, [])

	// Watch for new assistant responses and fetch updated profile data
	useEffect(() => {
		if (!apiConfiguration?.kilocodeToken || !clineMessages) return

		const currentMessagesHash = JSON.stringify(
			clineMessages.map((msg) => ({
				type: msg.type,
				say: msg.say,
				partial: msg.partial,
				ts: msg.ts,
			})),
		)

		// If this is the first run or messages have changed
		if (previousMessagesRef.current !== currentMessagesHash) {
			// Check if there's a new non-partial assistant response (say: "text" or "completion_result")
			const hasNewAssistantResponse = clineMessages.some(
				(msg) => msg.type === "say" && (msg.say === "text" || msg.say === "completion_result") && !msg.partial,
			)

			if (hasNewAssistantResponse && previousMessagesRef.current !== "") {
				// New assistant response detected, fetch updated profile data
				vscode.postMessage({ type: "fetchProfileDataRequest" })
			}

			previousMessagesRef.current = currentMessagesHash
		}
	}, [clineMessages, apiConfiguration?.kilocodeToken])

	// Close the hover card when clicking outside of it (or the trigger).
	// The card stays visible until dismissed this way.
	useEffect(() => {
		if (!showHoverCard) return
		const handlePointerDown = (event: MouseEvent) => {
			const target = event.target as Node | null
			const trigger = triggerRef.current
			const card = cardRef.current
			if (target && trigger && !trigger.contains(target) && card && !card.contains(target)) {
				setShowHoverCard(false)
			}
		}
		document.addEventListener("mousedown", handlePointerDown)
		return () => {
			document.removeEventListener("mousedown", handlePointerDown)
		}
	}, [showHoverCard])

	if (!apiConfiguration) {
		return null
	}

	// Calculate usage percentage from profile data
	const usagePercentage = profileData?.usagePercentage ?? null

	// Calculate card position when showing
	const handleMouseEnter = () => {
		if (triggerRef.current) {
			const rect = triggerRef.current.getBoundingClientRect()
			setCardPosition({
				top: rect.top - 10,
				left: rect.left,
			})
		}
		setShowHoverCard(true)
	}

	const handleWeeklyReset = () => {
		if (isResettingWeekly) return
		setWeeklyResetError(null)
		setIsResettingWeekly(true)
		vscode.postMessage({ type: "resetWeeklyUsageRequest" })
	}

	return (
		<div className="flex items-center justify-center">
			{apiConfiguration.kilocodeToken && (
				<>
					<div ref={triggerRef} className="relative" onMouseEnter={handleMouseEnter}>
						<span className="items-center justify-center flex shrink-1 overflow-hidden w-auto ml-2 text-sm text-[var(--vscode-descriptionForeground)] cursor-pointer hover:text-[var(--vscode-foreground)] transition-colors">
							<GaugeCircle
								size={14}
								style={{
									color: "var(--vscode-descriptionForeground)",
									marginRight: 4,
									flexShrink: 0,
								}}
							/>
							{profileData?.tieredUsage?.weekly
								? (() => {
										const fh = profileData.tieredUsage!.weekly
										const pct = Math.max(0, Math.min(100, fh.percentage || 0))
										return `${pct.toFixed(0)}% (resets ${formatRelativeTime(fh.resetsAt)})`
									})()
								: usagePercentage !== null
									? `used ${usagePercentage.toFixed(0)}% monthly limit`
									: "loading..."}
						</span>
						{showHoverCard &&
							createPortal(
								<div
									ref={cardRef}
									className="fixed w-72 bg-[var(--vscode-editor-background)] border border-[var(--vscode-panel-border)] rounded-lg p-4 shadow-lg z-[9999]"
									style={{
										top: `${cardPosition.top}px`,
										left: `${cardPosition.left}px`,
										transform: "translate(0, -100%)",
									}}>
									<div className="space-y-3">
										<div className="space-y-1">
											<div className="text-md font-medium text-[var(--vscode-foreground)]">
												Current Plan
											</div>
											<div className="text-xs text-[var(--vscode-descriptionForeground)]">
												{profileData?.plan?.replace("_", " ")?.toUpperCase()}
											</div>
										</div>

										<div className="text-md font-medium text-[var(--vscode-foreground)]">
											Limits
										</div>

										{/* Tiered usage windows (weekly / monthly) */}
										{profileData?.tieredUsage &&
											(["weekly", "monthly"] as const).map((key) => {
												const w = profileData.tieredUsage![key]
												const pct = Math.max(0, Math.min(100, w.percentage || 0))
												const labelMap: Record<typeof key, string> = {
													weekly: "Weekly",
													monthly: "Monthly",
												}
												const relative = formatRelativeTime(w.resetsAt)
												return (
													<div className="space-y-1" key={key}>
														<div className="flex justify-between items-center">
															<div className="text-xs font-medium text-[var(--vscode-foreground)]">
																{labelMap[key]}
															</div>
															<div className="text-[10px] text-[var(--vscode-descriptionForeground)]">
																{pct.toFixed(0)}%
															</div>
														</div>
														<div
															className="w-full h-1.5 rounded-full overflow-hidden"
															style={{
																backgroundColor:
																	"color-mix(in srgb, var(--vscode-input-background), black 20%)",
															}}>
															<div
																className="h-full transition-all duration-300"
																style={{
																	width: `${pct}%`,
																	backgroundColor:
																		pct >= 80
																			? "var(--vscode-errorForeground)"
																			: pct > 50
																				? "var(--vscode-editorWarning-foreground)"
																				: "var(--vscode-descriptionForeground)",
																}}
															/>
														</div>
														<div className="text-[10px] text-[var(--vscode-descriptionForeground)]">
															Resets {relative}
														</div>
													</div>
												)
											})}

										<div className="pt-1">
											<WeeklyResetButton
												plan={profileData?.plan}
												availability={profileData?.weeklyReset}
												isResetting={isResettingWeekly}
												error={weeklyResetError}
												onReset={handleWeeklyReset}
											/>
										</div>
									</div>
								</div>,
								document.body,
							)}
					</div>
					{currentBranch && (
						<span className="items-center justify-center flex shrink-1 gap-1 overflow-hidden w-auto ml-1 text-sm text-[var(--vscode-descriptionForeground)]">
							<span style={{ margin: "0 6px", color: "var(--vscode-disabledForeground)" }}>|</span>
							<GitBranchIcon
								className="w-3.5 h-3.5 rtl:-scale-x-100"
								style={{ color: "var(--vscode-descriptionForeground)" }}
							/>
							{currentBranch}
						</span>
					)}
				</>
			)}
		</div>
	)
}
