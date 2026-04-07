import { useExtensionState } from "@/context/ExtensionStateContext"
import { GitBranchIcon } from "@/utils/customIcons"
import { vscode } from "@/utils/vscode"
import { ProfileData, WebviewMessage } from "@roo/WebviewMessage"
import { GaugeCircle } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"

export const BottomApiConfig = () => {
	const { apiConfiguration, clineMessages } = useExtensionState()
	// const { id: selectedModelId, provider: selectedProvider } = useSelectedModel(apiConfiguration)
	const [profileData, setProfileData] = useState<ProfileData | null>(null)
	const [currentBranch, setCurrentBranch] = useState<string | null>(null)
	const [showHoverCard, setShowHoverCard] = useState(false)
	const [cardPosition, setCardPosition] = useState({ top: 0, left: 0 })
	const triggerRef = useRef<HTMLDivElement>(null)
	const [_isLoading, setIsLoading] = useState(false)
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

	return (
		<div className="flex items-center justify-center">
			{apiConfiguration.kilocodeToken && (
				<>
					<div
						ref={triggerRef}
						className="relative"
						onMouseEnter={handleMouseEnter}
						onMouseLeave={() => setShowHoverCard(false)}>
						<span className="items-center justify-center flex shrink-1 overflow-hidden w-auto ml-2 text-sm text-[var(--vscode-descriptionForeground)] cursor-pointer hover:text-[var(--vscode-foreground)] transition-colors">
							<GaugeCircle
								size={14}
								style={{
									color: "var(--vscode-descriptionForeground)",
									marginRight: 4,
									flexShrink: 0,
								}}
							/>
							{usagePercentage !== null
								? `used ${usagePercentage.toFixed(0)}% monthly limit`
								: "loading..."}
						</span>
						{showHoverCard &&
							createPortal(
								<div
									className="fixed w-45 bg-[var(--vscode-editor-background)] border border-[var(--vscode-panel-border)] rounded-lg p-4 shadow-lg z-[9999]"
									style={{
										top: `${cardPosition.top}px`,
										left: `${cardPosition.left}px`,
										transform: "translate(0, -100%)",
									}}>
									<div className="space-y-3">
										<div className="space-y-1">
											<div className="text-xs font-medium text-[var(--vscode-foreground)]">
												Current Plan
											</div>
											<div className="text-xs text-[var(--vscode-descriptionForeground)]">
												{profileData?.plan}
											</div>
										</div>
										{usagePercentage !== null && (
											<div className="space-y-2">
												<div className="flex justify-between items-center">
													<div className="text-xs font-medium text-[var(--vscode-foreground)]">
														Monthly Usage
													</div>
													<div className="text-xs text-[var(--vscode-descriptionForeground)]">
														{usagePercentage.toFixed(0)}%
													</div>
												</div>
												<div
													className="w-full h-2 rounded-full overflow-hidden"
													style={{
														backgroundColor:
															"color-mix(in srgb, var(--vscode-input-background), black 20%)",
													}}>
													<div
														className="h-full bg-[var(--vscode-button-background)] transition-all duration-300"
														style={{ width: `${Math.min(usagePercentage, 100)}%` }}
													/>
												</div>
											</div>
										)}
										<div className="space-y-1">
											<div className="text-xs font-medium text-[var(--vscode-foreground)]">
												Monthly Code Reviews
											</div>
											<div className="text-xs text-[var(--vscode-descriptionForeground)]">
												{(profileData?.remainingReviews || 0).toFixed(0)} reviews remaining
											</div>
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
