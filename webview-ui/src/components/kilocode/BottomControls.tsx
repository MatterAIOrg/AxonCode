import React, { useEffect, useState } from "react"
import { BottomApiConfig } from "./BottomApiConfig" // kilocode_change
import { vscode } from "@/utils/vscode"
import { StandardTooltip } from "@/components/ui"
import { ProfileData, WebviewMessage } from "@roo/WebviewMessage"
import { Sparkle } from "lucide-react"

interface BottomControlsProps {
	showApiConfig?: boolean
}

// Plan hierarchy: free -> Pro -> Pro Plus -> Ultra
const PLAN_ORDER = ["free", "Pro", "Pro Plus", "Ultra"]

const getNextPlan = (currentPlan?: string): string | null => {
	if (!currentPlan) return "Pro"
	const normalizedCurrent = currentPlan.toLowerCase().trim()
	const currentIndex = PLAN_ORDER.findIndex((p) => p.toLowerCase().trim() === normalizedCurrent)
	if (currentIndex === -1 || currentIndex === PLAN_ORDER.length - 1) return null
	return PLAN_ORDER[currentIndex + 1]
}

const BottomControls: React.FC<BottomControlsProps> = ({ showApiConfig = false }) => {
	const [profileData, setProfileData] = useState<ProfileData | null>(null)

	// Fetch profile data to get current plan
	useEffect(() => {
		vscode.postMessage({ type: "fetchProfileDataRequest" })

		const handleMessage = (event: MessageEvent<WebviewMessage>) => {
			const message = event.data
			if (message.type === "profileDataResponse") {
				const payload = message.payload as any
				if (payload?.success && payload.data) {
					setProfileData(payload.data)
				}
			}
		}

		window.addEventListener("message", handleMessage)
		return () => {
			window.removeEventListener("message", handleMessage)
		}
	}, [])

	const openExternalLink = (url: string) => {
		vscode.postMessage({ type: "openExternal", url })
	}

	const currentPlan = profileData?.plan
	const nextPlan = getNextPlan(currentPlan)

	return (
		<div className="flex flex-row w-auto items-center justify-between h-[36px] mx-3.5 mb-1 gap-1">
			<div className="flex flex-item flex-row justify-start gap-1 grow overflow-hidden">
				{showApiConfig && <BottomApiConfig />}
			</div>
			<div className="flex flex-row justify-end w-auto items-center gap-0.5">
				{nextPlan && (
					<StandardTooltip content={`Upgrade to ${nextPlan}`}>
						<button
							className="flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[var(--vscode-button-background)]/15 hover:bg-[var(--vscode-button-hoverBackground)] hover:text-[var(--vscode-button-foreground)] text-[var(--vscode-button-background)] text-xs font-medium transition-all duration-200 hover:scale-105"
							onClick={() => openExternalLink("https://app.matterai.so/orbital")}
							aria-label={`Upgrade to ${nextPlan}`}>
							<Sparkle size={12} />
							<span>Upgrade to {nextPlan}</span>
						</button>
					</StandardTooltip>
				)}
			</div>
		</div>
	)
}

export default BottomControls
