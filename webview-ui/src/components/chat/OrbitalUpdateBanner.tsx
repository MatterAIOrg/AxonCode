import { useEffect, useState } from "react"

import { useAppTranslation } from "@src/i18n/TranslationContext"
import { vscode } from "@src/utils/vscode"
import type { ExtensionMessage } from "@roo/ExtensionMessage"

type UpdateStatus = "hidden" | "current" | "available" | "downloading" | "installing" | "restarting" | "error"

interface UpdateState {
	status: UpdateStatus
	latestVersion?: string
	error?: string
}

const OrbitalUpdateBanner = () => {
	const { t } = useAppTranslation()
	const [update, setUpdate] = useState<UpdateState>({ status: "hidden" })

	useEffect(() => {
		const handleMessage = (event: MessageEvent<ExtensionMessage>) => {
			if (event.data.type !== "orbitalUpdateStatus") {
				return
			}

			const values = event.data.values as UpdateState | undefined
			if (values?.status) {
				setUpdate(values)
			}
		}

		window.addEventListener("message", handleMessage)
		vscode.postMessage({ type: "checkForOrbitalUpdate" })
		return () => window.removeEventListener("message", handleMessage)
	}, [])

	if (update.status === "hidden" || update.status === "current") {
		return null
	}

	const isWorking = ["downloading", "installing", "restarting"].includes(update.status)
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
			className="mx-4 mb-2 flex items-center gap-3 rounded-xl border border-[var(--vscode-commandCenter-inactiveBorder)] bg-vscode-editor-background px-3 py-2 text-xs text-[var(--vscode-notifications-foreground)]"
			role="status"
			title={update.error}>
			<span
				className={`codicon ${isWorking ? "codicon-loading codicon-modifier-spin" : "codicon-cloud-download"}`}
			/>
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
					onClick={() => vscode.postMessage({ type: "installOrbitalUpdate" })}>
					{update.status === "error"
						? t("chat:orbitalUpdate.retry")
						: t("chat:orbitalUpdate.updateAndRestart")}
				</button>
			)}
		</div>
	)
}

export default OrbitalUpdateBanner
