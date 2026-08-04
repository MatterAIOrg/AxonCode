import { useEffect, useMemo, useState } from "react"
import { vscode } from "@src/utils/vscode"
import { useExtensionState } from "@src/context/ExtensionStateContext"
import { AxonCodeTieredUsage, AxonCodeWindowUsage, ProfileData, WebviewMessage } from "@roo/WebviewMessage"

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

// Parse an ISO timestamp into epoch millis, or null when missing/invalid.
function parseResetTime(iso?: string): number | null {
	if (!iso) return null
	const time = new Date(iso).getTime()
	return Number.isNaN(time) ? null : time
}

// Choose which reset time to surface on the banner. Under tiered usage a user
// can have several limit windows (weekly / monthly) maxed at once, and
// can only use Pro models again once every exhausted window has reset — so we
// surface the latest reset among the exhausted windows. When no single window
// is maxed (near-limit warning), fall back to the soonest upcoming reset, then
// to the legacy monthly creditsResetDate.
function selectResetIso(creditsResetDate?: string, tieredUsage?: AxonCodeTieredUsage): string | undefined {
	if (tieredUsage) {
		const windows = [tieredUsage.weekly, tieredUsage.monthly].filter((usage): usage is AxonCodeWindowUsage =>
			Boolean(usage),
		)
		const isExhausted = (usage: AxonCodeWindowUsage) => usage.remaining <= 0 || usage.percentage >= 100

		const exhaustedResets = windows
			.filter(isExhausted)
			.map((usage) => parseResetTime(usage.resetsAt))
			.filter((time): time is number => time !== null)
		if (exhaustedResets.length > 0) {
			return new Date(Math.max(...exhaustedResets)).toISOString()
		}

		const now = Date.now()
		const upcomingResets = windows
			.map((usage) => parseResetTime(usage.resetsAt))
			.filter((time): time is number => time !== null && time > now)
		if (upcomingResets.length > 0) {
			return new Date(Math.min(...upcomingResets)).toISOString()
		}
	}
	return creditsResetDate
}

type OutOfCreditsBannerProps = {
	creditsResetDate?: string
	tieredUsage?: AxonCodeTieredUsage
	className?: string
}

export const OutOfCreditsBanner = ({ creditsResetDate, tieredUsage, className }: OutOfCreditsBannerProps) => {
	const { apiConfiguration } = useExtensionState()
	const [fetchedProfile, setFetchedProfile] = useState<{
		creditsResetDate?: string
		tieredUsage?: AxonCodeTieredUsage
	}>({})

	// If the parent didn't pass reset info, fetch it ourselves so the banner can
	// show "Pro models limits reset at XXX" wherever it's used.
	useEffect(() => {
		if (creditsResetDate || tieredUsage || !apiConfiguration?.kilocodeToken) return

		const handleMessage = (event: MessageEvent<WebviewMessage>) => {
			const message = event.data
			if (message.type === "profileDataResponse") {
				const payload = message.payload as { success: boolean; data?: ProfileData }
				if (payload?.success && payload.data) {
					setFetchedProfile({
						creditsResetDate: payload.data.creditsResetDate,
						tieredUsage: payload.data.tieredUsage,
					})
				}
			}
		}
		window.addEventListener("message", handleMessage)
		vscode.postMessage({ type: "fetchProfileDataRequest" })
		return () => window.removeEventListener("message", handleMessage)
	}, [creditsResetDate, tieredUsage, apiConfiguration?.kilocodeToken])

	const formattedResetDate = useMemo(
		() =>
			formatResetDate(
				selectResetIso(
					creditsResetDate ?? fetchedProfile.creditsResetDate,
					tieredUsage ?? fetchedProfile.tieredUsage,
				),
			),
		[creditsResetDate, tieredUsage, fetchedProfile],
	)

	return (
		<div className={className ?? "w-full min-w-0 my-2 pr-1"}>
			<div className="flex flex-col rounded-2xl gap-2 px-3 py-2 bg-[var(--vscode-input-background)] border border-[var(--vscode-panel-border)]">
				<div className="flex items-center justify-between gap-2">
					<div className="flex flex-col gap-1">
						<span className="text-lg font-medium text-[var(--vscode-foreground)]">
							You are out of Orbital Credits
						</span>
						<span className="text-md text-[var(--vscode-descriptionForeground)] max-w-[85%]">
							To continue using Orbital, upgrade your plan or enable Overage.
						</span>
						{formattedResetDate && (
							<span className="text-xs mt-0.5 font-bold text-[var(--vscode-descriptionForeground)]">
								Limits reset at {formattedResetDate}
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
									url: "https://app.matterai.so/orbital?tab=plans",
								})
							}>
							Upgrade
						</button>

						<button
							className="flex items-center justify-center gap-1 px-2.5 py-0.5 rounded-full border border-[var(--vscode-button-border,transparent)] bg-[var(--vscode-button-secondaryBackground)] hover:bg-[var(--vscode-button-secondaryHoverBackground)] text-[var(--vscode-button-secondaryForeground)] text-md font-medium transition-all duration-200"
							style={{ lineHeight: 1.2 }}
							onClick={() =>
								vscode.postMessage({
									type: "openExternal",
									url: "https://app.matterai.so/orbital?tab=overage",
								})
							}>
							Enable Overage
						</button>
						{/* <button
							className="flex items-center justify-center gap-1 px-2.5 py-0.5 rounded-full border border-[var(--vscode-button-border,transparent)] bg-[var(--vscode-button-secondaryBackground)] hover:bg-[var(--vscode-button-secondaryHoverBackground)] text-[var(--vscode-button-secondaryForeground)] text-md font-medium transition-all duration-200"
							onClick={handleContinueWithFreeModel}>
							Continue with Free model
						</button> */}
					</div>
				</div>
			</div>
		</div>
	)
}
