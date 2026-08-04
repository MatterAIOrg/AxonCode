import { useEffect, useRef, useState } from "react"

import { useAppTranslation } from "@src/i18n/TranslationContext"
import { vscode } from "@src/utils/vscode"
import type { ExtensionMessage } from "@roo/ExtensionMessage"
import { MatterProgressIndicator } from "./ProgressIndicator"

type UpdateStatus = "hidden" | "current" | "available" | "downloading" | "installing" | "restarting" | "error"

interface UpdateState {
	status: UpdateStatus
	latestVersion?: string
	error?: string
}

export const ORBITAL_UPDATE_POLL_INTERVAL_MS = 5 * 60 * 1000
const ORBITAL_UPDATE_RECHECK_THROTTLE_MS = 60 * 1000

const OrbitalUpdateBanner = () => {
	const { t } = useAppTranslation()
	const [update, setUpdate] = useState<UpdateState>({ status: "hidden" })
	const updateStatusRef = useRef<UpdateStatus>("hidden")

	useEffect(() => {
		let lastCheckAt: number | undefined

		const requestUpdateCheck = () => {
			// Keep checking while a banner is visible so a newer release can replace it.
			// Only pause checks while an installation or restart is actively in progress.
			if (["downloading", "installing", "restarting"].includes(updateStatusRef.current)) {
				return
			}

			const now = Date.now()
			if (lastCheckAt !== undefined && now - lastCheckAt < ORBITAL_UPDATE_RECHECK_THROTTLE_MS) {
				return
			}

			lastCheckAt = now
			vscode.postMessage({ type: "checkForOrbitalUpdate" })
		}

		const handleMessage = (event: MessageEvent<ExtensionMessage>) => {
			if (event.data.type === "action" && event.data.action === "didBecomeVisible") {
				requestUpdateCheck()
				return
			}

			if (event.data.type !== "orbitalUpdateStatus") {
				return
			}

			const values = event.data.values as UpdateState | undefined
			if (values?.status) {
				updateStatusRef.current = values.status
				setUpdate(values)
			}
		}

		const handleFocus = () => requestUpdateCheck()

		window.addEventListener("message", handleMessage)
		window.addEventListener("focus", handleFocus)
		requestUpdateCheck()
		const pollInterval = window.setInterval(requestUpdateCheck, ORBITAL_UPDATE_POLL_INTERVAL_MS)

		return () => {
			window.removeEventListener("message", handleMessage)
			window.removeEventListener("focus", handleFocus)
			window.clearInterval(pollInterval)
		}
	}, [])

	if (update.status === "hidden" || update.status === "current") {
		return null
	}

	const isWorking = ["downloading", "installing", "restarting"].includes(update.status)
	const installUpdate = () => {
		updateStatusRef.current = "installing"
		setUpdate((currentUpdate) => ({ ...currentUpdate, status: "installing" }))
		vscode.postMessage({ type: "installOrbitalUpdate" })
	}
	const label =
		update.status === "downloading"
			? t("chat:orbitalUpdate.downloading")
			: update.status === "installing"
				? t("chat:orbitalUpdate.installing")
				: update.status === "restarting"
					? t("chat:orbitalUpdate.restarting")
					: update.status === "error"
						? t("chat:orbitalUpdate.failed")
						: t("chat:orbitalUpdate.available", { version: update.latestVersion })

	return (
		<div
			className="mx-5 mb-2 flex items-center gap-3 rounded-md border border-[var(--vscode-commandCenter-inactiveBorder)] bg-vscode-editor-background px-3 py-2 text-xs text-[var(--vscode-notifications-foreground)]"
			role="status"
			title={update.error}>
			{isWorking ? (
				<MatterProgressIndicator className="shrink-0 text-vscode-descriptionForeground" />
			) : (
				<span className="codicon codicon-cloud-download" />
			)}
			<div className="min-w-0 flex-1">
				<div className="font-medium">{label}</div>
				{update.status === "available" && (
					<div className="mt-0.5 text-[var(--vscode-descriptionForeground)]">
						{t("chat:orbitalUpdate.description")}
					</div>
				)}
			</div>
			{!isWorking && (
				<button
					type="button"
					className="shrink-0 rounded-lg bg-[var(--vscode-button-background)] px-2.5 py-1.5 text-[var(--vscode-button-foreground)] hover:bg-[var(--vscode-button-hoverBackground)]"
					onClick={installUpdate}>
					{update.status === "error"
						? t("chat:orbitalUpdate.retry")
						: t("chat:orbitalUpdate.updateAndRestart")}
				</button>
			)}
		</div>
	)
}

export default OrbitalUpdateBanner
