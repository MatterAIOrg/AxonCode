import { useEffect, useMemo, useState } from "react"
import { vscode } from "@src/utils/vscode"
import { useExtensionState } from "@src/context/ExtensionStateContext"
import { getModelIdKey } from "../hooks/useSelectedModel"
import { OPENROUTER_DEFAULT_PROVIDER_NAME } from "@roo-code/types"
import { ProfileData, WebviewMessage } from "@roo/WebviewMessage"

const FREE_MODEL_ID = "axon-code-2-5-mini"

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

type OutOfCreditsBannerProps = {
	creditsResetDate?: string
	className?: string
}

export const OutOfCreditsBanner = ({ creditsResetDate, className }: OutOfCreditsBannerProps) => {
	const { apiConfiguration, currentApiConfigName, currentTaskItem } = useExtensionState()
	const [profileResetDate, setProfileResetDate] = useState<string | undefined>(undefined)

	// If the parent didn't pass creditsResetDate, fetch it ourselves so the
	// banner can show "Pro models limits reset at XXX" wherever it's used.
	useEffect(() => {
		if (creditsResetDate || !apiConfiguration?.kilocodeToken) return

		const handleMessage = (event: MessageEvent<WebviewMessage>) => {
			const message = event.data
			if (message.type === "profileDataResponse") {
				const payload = message.payload as { success: boolean; data?: ProfileData }
				if (payload?.success && payload.data?.creditsResetDate) {
					setProfileResetDate(payload.data.creditsResetDate)
				}
			}
		}
		window.addEventListener("message", handleMessage)
		vscode.postMessage({ type: "fetchProfileDataRequest" })
		return () => window.removeEventListener("message", handleMessage)
	}, [creditsResetDate, apiConfiguration?.kilocodeToken])

	const formattedResetDate = useMemo(
		() => formatResetDate(creditsResetDate ?? profileResetDate),
		[creditsResetDate, profileResetDate],
	)

	const handleContinueWithFreeModel = () => {
		const provider = apiConfiguration?.apiProvider
		if (!provider) {
			return
		}
		const modelIdKey = getModelIdKey({ provider })

		// If there's an active task, update task-local configuration for isolation.
		if (currentTaskItem) {
			vscode.postMessage({
				type: "updateTaskModel",
				apiProvider: provider,
				apiModelId: FREE_MODEL_ID,
				thirdPartySelectedModel: undefined,
			})
			return
		}

		// Otherwise, update the global/default configuration.
		vscode.postMessage({
			type: "upsertApiConfiguration",
			text: currentApiConfigName ?? "default",
			apiConfiguration: {
				...apiConfiguration,
				[modelIdKey]: FREE_MODEL_ID,
				openRouterSpecificProvider: OPENROUTER_DEFAULT_PROVIDER_NAME,
				thirdPartySelectedModel: undefined,
			},
		})
	}

	return (
		<div className={className ?? "w-full min-w-0 my-2 pr-1"}>
			<div className="flex flex-col rounded-2xl gap-2 px-3 py-2 bg-[var(--vscode-input-background)] border border-[var(--vscode-panel-border)]">
				<div className="flex items-center justify-between gap-2">
					<div className="flex flex-col gap-1">
						<span className="text-lg font-medium text-[var(--vscode-foreground)]">
							You are out of Orbital Credits
						</span>
						<span className="text-md text-[var(--vscode-descriptionForeground)] max-w-[85%]">
							To continue using Orbital, upgrade your plan or switch to the Free model.
						</span>
						{formattedResetDate && (
							<span className="text-xs mt-0.5 font-bold text-[var(--vscode-descriptionForeground)]">
								Pro models limits reset at {formattedResetDate}
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
									url: "https://app.matterai.so/orbital",
								})
							}>
							Upgrade
						</button>
						<button
							className="flex items-center justify-center gap-1 px-2.5 py-0.5 rounded-full border border-[var(--vscode-button-border,transparent)] bg-[var(--vscode-button-secondaryBackground)] hover:bg-[var(--vscode-button-secondaryHoverBackground)] text-[var(--vscode-button-secondaryForeground)] text-md font-medium transition-all duration-200"
							onClick={handleContinueWithFreeModel}>
							Continue with Free model
						</button>
					</div>
				</div>
			</div>
		</div>
	)
}
