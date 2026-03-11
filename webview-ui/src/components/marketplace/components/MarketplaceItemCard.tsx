import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	StandardTooltip,
} from "@/components/ui"
import { Button } from "@/components/ui/button"
import { useExtensionState } from "@/context/ExtensionStateContext"
import { useAppTranslation } from "@/i18n/TranslationContext"
import { telemetryClient } from "@/utils/TelemetryClient"
import { vscode } from "@/utils/vscode"
import { MarketplaceItem, TelemetryEventName } from "@roo-code/types"
import { VSCodeButton } from "@vscode/webview-ui-toolkit/react"
import React, { useEffect, useState } from "react"
import { isValidUrl } from "../../../utils/url"
import { ViewState } from "../MarketplaceViewStateManager"
import { MarketplaceInstallModal } from "./MarketplaceInstallModal"

interface ItemInstalledMetadata {
	type: string
}

interface MarketplaceItemCardProps {
	item: MarketplaceItem
	filters: ViewState["filters"]
	setFilters: (filters: Partial<ViewState["filters"]>) => void
	installed: {
		project: ItemInstalledMetadata | undefined
		global: ItemInstalledMetadata | undefined
	}
}

export const MarketplaceItemCard: React.FC<MarketplaceItemCardProps> = ({ item, installed }) => {
	const { t } = useAppTranslation()
	const { cwd } = useExtensionState()
	const [showInstallModal, setShowInstallModal] = useState(false)
	const [installModalVersion, setInstallModalVersion] = useState(0) // kilocode_change
	const [showRemoveConfirm, setShowRemoveConfirm] = useState(false)
	const [removeTarget, setRemoveTarget] = useState<"project" | "global">("project")
	const [removeError, setRemoveError] = useState<string | null>(null)

	// Listen for removal result messages
	useEffect(() => {
		const handleMessage = (event: MessageEvent) => {
			const message = event.data
			if (message.type === "marketplaceRemoveResult" && message.slug === item.id) {
				if (message.success) {
					// Removal succeeded - refresh marketplace data
					vscode.postMessage({
						type: "fetchMarketplaceData",
					})
				} else {
					// Removal failed - show error message to user
					setRemoveError(message.error || t("marketplace:items.unknownError"))
				}
			}
		}

		window.addEventListener("message", handleMessage)
		return () => window.removeEventListener("message", handleMessage)
	}, [item.id, t])

	// Determine installation status
	const isInstalledGlobally = !!installed.global
	const isInstalledInProject = !!installed.project
	const isInstalled = isInstalledGlobally || isInstalledInProject

	const handleInstallClick = () => {
		// Send telemetry for install button click
		telemetryClient.capture(TelemetryEventName.MARKETPLACE_INSTALL_BUTTON_CLICKED, {
			itemId: item.id,
			itemType: item.type,
			itemName: item.name,
		})

		setInstallModalVersion((prev) => prev + 1) // kilocode_change
		// Show modal for all item types (MCP and modes)
		setShowInstallModal(true)
	}

	return (
		<>
			<div className="border border-vscode-panel-border rounded-sm p-3 bg-vscode-editor-background">
				<div className="flex gap-2 items-start justify-between">
					<div className="flex gap-2 items-start">
						{/* Logo image */}
						<img
							src={item.logo}
							alt={item.name}
							className="w-8 h-8 rounded-sm object-contain flex-shrink-0"
						/>
						<div className="flex gap-0 flex-col">
							<h3 className="text-lg font-semibold text-vscode-foreground m-0 leading-none p-0">
								{item.type === "mcp" && item.url && isValidUrl(item.url) ? (
									<div className="p-0 h-auto text-lg font-semibold text-vscode-foreground">
										{item.name}
									</div>
								) : (
									item.name
								)}
							</h3>
							<p className="text-sm text-vscode-descriptionForeground p-0 m-0">{item.author}</p>
						</div>
					</div>
					<div className="flex items-center gap-1">
						{isInstalled ? (
							/* Single Remove button when installed */
							<StandardTooltip
								content={
									isInstalledInProject
										? t("marketplace:items.card.removeProjectTooltip")
										: t("marketplace:items.card.removeGlobalTooltip")
								}>
								<Button
									size="sm"
									variant="secondary"
									className="text-xs h-5 py-0 px-2"
									onClick={() => {
										// Determine which installation to remove (prefer project over global)
										const target = isInstalledInProject ? "project" : "global"
										setRemoveTarget(target)
										setShowRemoveConfirm(true)
									}}>
									{t("marketplace:items.card.remove")}
								</Button>
							</StandardTooltip>
						) : (
							/* Single Install button when not installed */
							<VSCodeButton
								appearance="primary"
								className="text-xs h-5 py-0 px-2"
								onClick={handleInstallClick}>
								{t("marketplace:items.card.install")}
							</VSCodeButton>
						)}

						{/* Error message display */}
						{removeError && (
							<div className="text-vscode-errorForeground text-sm mt-2">
								{t("marketplace:items.removeFailed", { error: removeError })}
							</div>
						)}
					</div>
				</div>

				<p className="text-xs text-vscode-foreground">{item.description}</p>

				{/* Installation status badges and tags in the same row */}
				{(isInstalled || (item.tags && item.tags.length > 0)) && (
					<div className="relative flex flex-wrap gap-1 my-2">
						{/* Installation status badge on the left */}
						{isInstalled && (
							<span className="text-xs px-2 py-0.5 rounded-sm h-5 flex items-center bg-green-600/20 text-green-400 border border-green-600/30 shrink-0">
								{t("marketplace:items.card.installed")}
							</span>
						)}
					</div>
				)}
			</div>

			{/* Installation Modal - Outside the clickable card */}
			<MarketplaceInstallModal
				key={`install-modal-${item.id}-${installModalVersion}` /* kilocode_change */}
				item={item}
				isOpen={showInstallModal}
				onClose={() => setShowInstallModal(false)}
				hasWorkspace={!!cwd}
			/>

			{/* Remove Confirmation Dialog */}
			<AlertDialog open={showRemoveConfirm} onOpenChange={setShowRemoveConfirm}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>
							{item.type === "mode"
								? t("marketplace:removeConfirm.mode.title")
								: t("marketplace:removeConfirm.mcp.title")}
						</AlertDialogTitle>
						<AlertDialogDescription>
							{item.type === "mode" ? (
								<>
									{t("marketplace:removeConfirm.mode.message", { modeName: item.name })}
									<div className="mt-2 text-sm">
										{t("marketplace:removeConfirm.mode.rulesWarning")}
									</div>
								</>
							) : (
								t("marketplace:removeConfirm.mcp.message", { mcpName: item.name })
							)}
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter className="flex-col gap-2 items-center justify-center">
						<AlertDialogCancel>{t("marketplace:removeConfirm.cancel")}</AlertDialogCancel>
						<AlertDialogAction
							onClick={() => {
								// Clear any previous error
								setRemoveError(null)

								vscode.postMessage({
									type: "removeInstalledMarketplaceItem",
									mpItem: item,
									mpInstallOptions: { target: removeTarget },
								})

								setShowRemoveConfirm(false)
							}}>
							{t("marketplace:removeConfirm.confirm")}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</>
	)
}
