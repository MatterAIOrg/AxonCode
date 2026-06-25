import {
	VSCodeButton,
	VSCodeCheckbox,
	VSCodeLink,
	VSCodePanels,
	VSCodePanelTab,
	VSCodePanelView,
} from "@vscode/webview-ui-toolkit/react"
import React, { useCallback, useEffect, useState } from "react"
import { Trans } from "react-i18next"

import { McpServer } from "@roo/mcp"

import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	ToggleSwitch,
} from "@src/components/ui"
import { useExtensionState } from "@src/context/ExtensionStateContext"
import { useAppTranslation } from "@src/i18n/TranslationContext"
import { buildDocLink } from "@src/utils/docLinks"
import { vscode } from "@src/utils/vscode"
import { cn } from "@/lib/utils"

import { Tab, TabContent, TabHeader } from "../common/Tab"

import McpResourceRow from "./McpResourceRow"
import McpToolRow from "./McpToolRow"
// import McpEnabledToggle from "./McpEnabledToggle" // kilocode_change not used
import { McpErrorRow } from "./McpErrorRow"
import { Delete01Icon, Refresh04Icon, PencilEdit02Icon, ClipboardCopyIcon, LockKeyIcon } from "@/utils/customIcons"
import { SuggestedPluginsView } from "../kilocodeMcp/suggested"
import McpMigrationView, { type MigrationEntryLike, type MigrationResultLike } from "./McpMigrationView"
import type { ExtensionMessage } from "@roo/ExtensionMessage"

type McpViewProps = {
	onDone: () => void
	hideHeader?: boolean // kilocode_change
}

// Small ghost icon button used for the per-server row actions. Inherits the
// theme's toolbar hover treatment so it adapts to any installed VSCode theme.
const RowIconButton = ({
	children,
	disabled,
	title,
	onClick,
}: {
	children: React.ReactNode
	disabled?: boolean
	title?: string
	onClick: () => void
}) => (
	<button
		type="button"
		title={title}
		disabled={disabled}
		onClick={onClick}
		className={cn(
			"flex size-6 shrink-0 items-center justify-center rounded-md text-vscode-descriptionForeground transition-colors",
			"hover:bg-vscode-toolbar-hoverBackground hover:text-vscode-foreground",
			"disabled:pointer-events-none disabled:opacity-40",
		)}>
		{children}
	</button>
)

const McpView = ({ onDone, hideHeader = false }: McpViewProps) => {
	const {
		mcpServers: servers,
		alwaysAllowMcp,
		mcpEnabled,
		enableMcpServerCreation,
		setEnableMcpServerCreation,
	} = useExtensionState()

	const { t } = useAppTranslation()

	// /migrate-equivalent UI: opens a picker that imports MCP server entries
	// from Cursor / Claude Code / Claude Desktop. State stays local because
	// the result is only relevant while this view is mounted.
	const [migrationOpen, setMigrationOpen] = useState(false)
	const [migrationEntries, setMigrationEntries] = useState<MigrationEntryLike[]>([])
	const [migrationResult, setMigrationResult] = useState<MigrationResultLike | null>(null)
	const [migrationLoading, setMigrationLoading] = useState(false)

	const openMigration = () => {
		setMigrationOpen(true)
		setMigrationResult(null)
		setMigrationLoading(true)
		vscode.postMessage({ type: "mcpMigrateList" })
	}

	const closeMigration = () => {
		setMigrationOpen(false)
		setMigrationResult(null)
	}

	// Stable message handler. We intentionally subscribe with a function that
	// doesn't read any state setters through closure, so re-renders don't
	// re-subscribe and re-process the same message (which would loop).
	const handleMessage = useCallback((event: MessageEvent) => {
		const message = event.data as ExtensionMessage
		if (!message || typeof message !== "object") return
		if (message.type === "mcpMigrationEntries" && Array.isArray(message.mcpMigrationEntries)) {
			setMigrationEntries(message.mcpMigrationEntries as MigrationEntryLike[])
			setMigrationLoading(false)
		} else if (message.type === "mcpMigrationResult" && message.mcpMigrationResult) {
			setMigrationResult(message.mcpMigrationResult as MigrationResultLike)
		}
	}, [])

	useEffect(() => {
		window.addEventListener("message", handleMessage)
		return () => window.removeEventListener("message", handleMessage)
	}, [handleMessage])

	return (
		// kilocode_change: add relative className
		<Tab className="relative">
			{/*  kilocode_change: display header conditionally */}
			<TabHeader style={{ display: hideHeader ? "none" : "flex" }} className="flex justify-between items-center">
				<h3 className="text-vscode-foreground m-0">{t("mcp:title")}</h3>
				<VSCodeButton appearance="primary" onClick={onDone}>
					{t("mcp:done")}
				</VSCodeButton>
			</TabHeader>

			<TabContent>
				<p className="mt-1 mb-4 text-sm leading-relaxed text-vscode-descriptionForeground">
					<Trans i18nKey="mcp:description">
						<VSCodeLink
							href={buildDocLink("orbital/features/mcp", "mcp_settings")}
							style={{ display: "inline" }}>
							Learn More
						</VSCodeLink>
					</Trans>
				</p>

				{/* <McpEnabledToggle /> kilocode_change: we always enable MCP */}

				{mcpEnabled && (
					<>
						{/* kilocode_change: display: none; we always allow mcp server creation */}
						<div style={{ display: "none", marginBottom: 15 }}>
							<VSCodeCheckbox
								checked={enableMcpServerCreation}
								onChange={(e: any) => {
									setEnableMcpServerCreation(e.target.checked)
									vscode.postMessage({ type: "enableMcpServerCreation", bool: e.target.checked })
								}}>
								<span style={{ fontWeight: "500" }}>{t("mcp:enableServerCreation.title")}</span>
							</VSCodeCheckbox>
							<div
								style={{
									fontSize: "12px",
									marginTop: "5px",
									color: "var(--vscode-descriptionForeground)",
								}}>
								<Trans i18nKey="mcp:enableServerCreation.description">
									<VSCodeLink
										href={buildDocLink("orbital/features/mcp", "mcp_server_creation")}
										style={{ display: "inline" }}>
										Learn about server creation
									</VSCodeLink>
									<strong>new</strong>
								</Trans>
								<p style={{ marginTop: "8px" }}>{t("mcp:enableServerCreation.hint")}</p>
							</div>
						</div>

						{/* Server List */}
						<div className="mb-2 flex items-center gap-2">
							<span className="text-[10px] font-mono uppercase tracking-[0.15em] text-vscode-descriptionForeground">
								{t("mcp:serversSection.title")}
							</span>
							{servers.length > 0 && (
								<span className="rounded-full bg-vscode-badge-background px-1.5 py-px text-[10px] font-mono font-semibold text-vscode-badge-foreground">
									{servers.length}
								</span>
							)}
							<div className="h-px flex-1 bg-vscode-panel-border" />
						</div>

						{servers.length > 0 ? (
							<div className="flex flex-col gap-2">
								{servers.map((server) => (
									<ServerRow
										key={`${server.name}-${server.source || "global"}`}
										server={server}
										alwaysAllowMcp={alwaysAllowMcp}
									/>
								))}
							</div>
						) : (
							<div className="rounded-xl border border-dashed border-vscode-panel-border bg-vscode-editor-background px-4 py-8 text-center">
								<span className="codicon codicon-server mb-2 block text-2xl text-vscode-descriptionForeground opacity-60" />
								<p className="m-0 text-sm text-vscode-descriptionForeground">
									{t("mcp:serversSection.empty")}
								</p>
							</div>
						)}

						{/* Edit Settings Buttons */}
						<div
							className="mt-4 grid w-full gap-2"
							style={{ gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
							<VSCodeButton
								appearance="secondary"
								style={{ width: "100%" }}
								onClick={() => {
									vscode.postMessage({ type: "openMcpSettings" })
								}}>
								<PencilEdit02Icon className="mr-1.5 size-3.5" />
								{t("mcp:editGlobalMCP")}
							</VSCodeButton>
							<VSCodeButton
								appearance="secondary"
								style={{ width: "100%" }}
								onClick={() => {
									vscode.postMessage({ type: "openProjectMcpSettings" })
								}}>
								<PencilEdit02Icon className="mr-1.5 size-3.5" />
								{t("mcp:editProjectMCP")}
							</VSCodeButton>
							<VSCodeButton
								appearance="secondary"
								style={{ width: "100%" }}
								onClick={() => {
									vscode.postMessage({ type: "refreshAllMcpServers" })
								}}>
								<Refresh04Icon className="mr-1.5 size-3.5" />
								{t("mcp:refreshMCP")}
							</VSCodeButton>
							<VSCodeButton
								appearance="secondary"
								className="whitespace-nowrap"
								style={{ width: "100%", gridColumn: "1 / -1" }}
								onClick={openMigration}>
								<ClipboardCopyIcon className="mr-1.5 size-3.5" />
								{t("mcp:migration.open")}
							</VSCodeButton>
						</div>

						{/* Suggested Plugins Marketplace */}
						<div className="mt-6 rounded-xl border border-vscode-panel-border bg-vscode-editor-background overflow-hidden">
							<SuggestedPluginsView />
						</div>
					</>
				)}
			</TabContent>

			<McpMigrationView
				key={migrationOpen ? "open" : "closed"}
				open={migrationOpen}
				onClose={closeMigration}
				entries={migrationEntries}
				result={migrationResult}
				loading={migrationLoading}
			/>
		</Tab>
	)
}

const ServerRow = ({ server, alwaysAllowMcp }: { server: McpServer; alwaysAllowMcp?: boolean }) => {
	const { t } = useAppTranslation()
	const [isExpanded, setIsExpanded] = useState(false)
	const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
	const [timeoutValue, setTimeoutValue] = useState(() => {
		const configTimeout = JSON.parse(server.config)?.timeout
		return configTimeout ?? 60 // Default 1 minute (60 seconds)
	})

	// Computed property to check if server is expandable
	const isExpandable = server.status === "connected" && !server.disabled

	const timeoutOptions = [
		{ value: 15, label: t("mcp:networkTimeout.options.15seconds") },
		{ value: 30, label: t("mcp:networkTimeout.options.30seconds") },
		{ value: 60, label: t("mcp:networkTimeout.options.1minute") },
		{ value: 300, label: t("mcp:networkTimeout.options.5minutes") },
		{ value: 600, label: t("mcp:networkTimeout.options.10minutes") },
		{ value: 900, label: t("mcp:networkTimeout.options.15minutes") },
		{ value: 1800, label: t("mcp:networkTimeout.options.30minutes") },
		{ value: 3600, label: t("mcp:networkTimeout.options.60minutes") },
	]

	const getStatusColor = () => {
		// Disabled servers should always show grey regardless of connection status
		if (server.disabled) {
			return "var(--vscode-descriptionForeground)"
		}

		switch (server.status) {
			case "connected":
				return "var(--vscode-testing-iconPassed)"
			case "connecting":
				return "var(--color-matterai-yellow)"
			case "disconnected":
				return "var(--vscode-testing-iconFailed)"
			case "needs-auth":
				return "var(--color-matterai-yellow)"
		}
	}

	const getStatusLabel = () => {
		if (server.disabled) {
			return t("mcp:serverStatus.disabled")
		}
		switch (server.status) {
			case "connected":
				return t("mcp:serverStatus.connected")
			case "connecting":
				return t("mcp:serverStatus.connecting")
			case "disconnected":
				return t("mcp:serverStatus.disconnected")
			case "needs-auth":
				return t("mcp:serverStatus.needsAuthShort")
		}
	}

	const statusColor = getStatusColor()

	const handleRowClick = () => {
		// Only allow expansion for connected and enabled servers
		if (isExpandable) {
			setIsExpanded(!isExpanded)
		}
	}

	const handleRestart = () => {
		vscode.postMessage({
			type: "restartMcpServer",
			text: server.name,
			source: server.source || "global",
		})
	}

	const handleAuthenticate = () => {
		vscode.postMessage({
			type: "authenticateMcpServer",
			serverName: server.name,
			source: server.source || "global",
		})
	}

	const handleTimeoutChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
		const seconds = parseInt(event.target.value)
		setTimeoutValue(seconds)
		vscode.postMessage({
			type: "updateMcpTimeout",
			serverName: server.name,
			source: server.source || "global",
			timeout: seconds,
		})
	}

	const handleDelete = () => {
		vscode.postMessage({
			type: "deleteMcpServer",
			serverName: server.name,
			source: server.source || "global",
		})
		setShowDeleteConfirm(false)
	}

	return (
		<div
			className={cn(
				"group rounded-xl border border-vscode-panel-border bg-vscode-editor-background transition-colors",
				isExpandable && "hover:border-vscode-focusBorder",
				isExpanded && "border-vscode-focusBorder",
				server.disabled && "opacity-60",
			)}>
			{/* Header */}
			<div
				className={cn("flex items-center gap-2.5 p-3", isExpandable ? "cursor-pointer" : "cursor-default")}
				onClick={handleRowClick}>
				{/* Leading server icon */}
				<div className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-vscode-panel-border bg-vscode-textCodeBlock-background">
					<span className="codicon codicon-server text-sm text-vscode-descriptionForeground" />
				</div>

				{/* Name + status */}
				<div className="min-w-0 flex-1">
					<div className="flex items-center gap-2">
						<span className="truncate font-medium text-vscode-foreground">{server.name}</span>
						{server.source && (
							<span className="shrink-0 rounded-full bg-vscode-badge-background px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider text-vscode-badge-foreground">
								{server.source}
							</span>
						)}
					</div>
					<div className="mt-1 flex items-center gap-1.5">
						<span
							className="inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-mono font-semibold uppercase tracking-wider"
							style={{
								color: statusColor,
								backgroundColor: `color-mix(in srgb, ${statusColor} 12%, transparent)`,
								borderColor: `color-mix(in srgb, ${statusColor} 28%, transparent)`,
							}}>
							<span
								className={cn(
									"size-1.5 rounded-full",
									server.status === "connecting" && "animate-pulse",
								)}
								style={{ background: statusColor }}
							/>
							{getStatusLabel()}
						</span>
					</div>
				</div>

				{/* Actions */}
				<div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
					<RowIconButton title={t("mcp:deleteDialog.delete")} onClick={() => setShowDeleteConfirm(true)}>
						<Delete01Icon className="size-3.5" />
					</RowIconButton>
					<RowIconButton
						title={t("mcp:refreshMCP")}
						disabled={server.status === "connecting"}
						onClick={handleRestart}>
						<Refresh04Icon className={cn("size-3.5", server.status === "connecting" && "animate-spin")} />
					</RowIconButton>
					<div className="ml-1">
						<ToggleSwitch
							checked={!server.disabled}
							onChange={() => {
								vscode.postMessage({
									type: "toggleMcpServer",
									serverName: server.name,
									source: server.source || "global",
									disabled: !server.disabled,
								})
							}}
							size="medium"
							aria-label={`Toggle ${server.name} server`}
						/>
					</div>
				</div>

				{/* Expand affordance */}
				{isExpandable && (
					<span
						className={cn(
							"codicon shrink-0 text-vscode-descriptionForeground transition-transform",
							isExpanded ? "codicon-chevron-up" : "codicon-chevron-down",
						)}
					/>
				)}
			</div>

			{isExpandable
				? isExpanded && (
						<div className="border-t border-vscode-panel-border px-3 pb-3 text-sm">
							<VSCodePanels style={{ marginBottom: "10px" }}>
								<VSCodePanelTab id="tools">
									{t("mcp:tabs.tools")} ({server.tools?.length || 0})
								</VSCodePanelTab>
								<VSCodePanelTab id="resources">
									{t("mcp:tabs.resources")} (
									{[...(server.resourceTemplates || []), ...(server.resources || [])].length || 0})
								</VSCodePanelTab>
								{server.instructions && (
									<VSCodePanelTab id="instructions">{t("mcp:instructions")}</VSCodePanelTab>
								)}
								<VSCodePanelTab id="errors">
									{t("mcp:tabs.errors")} ({server.errorHistory?.length || 0})
								</VSCodePanelTab>

								<VSCodePanelView id="tools-view">
									{server.tools && server.tools.length > 0 ? (
										<div className="flex w-full flex-col gap-2">
											{server.tools.map((tool) => (
												<McpToolRow
													key={`${tool.name}-${server.name}-${server.source || "global"}`}
													tool={tool}
													serverName={server.name}
													serverSource={server.source || "global"}
													alwaysAllowMcp={alwaysAllowMcp}
												/>
											))}
										</div>
									) : (
										<div className="py-2.5 text-vscode-descriptionForeground">
											{t("mcp:emptyState.noTools")}
										</div>
									)}
								</VSCodePanelView>

								<VSCodePanelView id="resources-view">
									{(server.resources && server.resources.length > 0) ||
									(server.resourceTemplates && server.resourceTemplates.length > 0) ? (
										<div className="flex w-full flex-col gap-2">
											{[...(server.resourceTemplates || []), ...(server.resources || [])].map(
												(item) => (
													<McpResourceRow
														key={"uriTemplate" in item ? item.uriTemplate : item.uri}
														item={item}
													/>
												),
											)}
										</div>
									) : (
										<div className="py-2.5 text-vscode-descriptionForeground">
											{t("mcp:emptyState.noResources")}
										</div>
									)}
								</VSCodePanelView>

								{server.instructions && (
									<VSCodePanelView id="instructions-view">
										<div className="py-2.5 text-xs">
											<div className="opacity-80 whitespace-pre-wrap break-words">
												{server.instructions}
											</div>
										</div>
									</VSCodePanelView>
								)}

								<VSCodePanelView id="errors-view">
									{server.errorHistory && server.errorHistory.length > 0 ? (
										<div className="flex w-full flex-col gap-2">
											{[...server.errorHistory]
												.sort((a, b) => b.timestamp - a.timestamp)
												.map((error, index) => (
													<McpErrorRow key={`${error.timestamp}-${index}`} error={error} />
												))}
										</div>
									) : (
										<div className="py-2.5 text-vscode-descriptionForeground">
											{t("mcp:emptyState.noErrors")}
										</div>
									)}
								</VSCodePanelView>
							</VSCodePanels>

							{/* Network Timeout */}
							<div className="mt-1 rounded-lg border border-vscode-panel-border bg-vscode-textCodeBlock-background p-3">
								<div className="text-[10px] font-mono uppercase tracking-[0.15em] text-vscode-descriptionForeground">
									{t("mcp:networkTimeout.label")}
								</div>
								<select
									value={timeoutValue}
									onChange={handleTimeoutChange}
									className="mt-2 w-full cursor-pointer rounded-md border border-vscode-dropdown-border bg-vscode-dropdown-background px-2 py-1.5 text-vscode-dropdown-foreground outline-none">
									{timeoutOptions.map((option) => (
										<option key={option.value} value={option.value}>
											{option.label}
										</option>
									))}
								</select>
								<span className="mt-2 block text-xs text-vscode-descriptionForeground">
									{t("mcp:networkTimeout.description")}
								</span>
							</div>
						</div>
					)
				: // Only show error UI for non-disabled servers
					!server.disabled && (
						<div className="border-t border-vscode-panel-border p-3 text-sm">
							{server.status === "needs-auth" && (
								<div className="mb-2" style={{ color: "var(--color-matterai-yellow)" }}>
									{t("mcp:serverStatus.needsAuth")}
								</div>
							)}
							{server.error && (
								<div className="mb-2 break-words" style={{ color: "var(--vscode-testing-iconFailed)" }}>
									{server.error.split("\n").map((item, index) => (
										<React.Fragment key={index}>
											{index > 0 && <br />}
											{item}
										</React.Fragment>
									))}
								</div>
							)}
							{server.status === "needs-auth" && (
								<VSCodeButton
									appearance="primary"
									onClick={handleAuthenticate}
									style={{ width: "100%", marginBottom: "8px" }}>
									<LockKeyIcon className="mr-1.5 size-3.5" />
									{t("mcp:serverStatus.authenticate")}
								</VSCodeButton>
							)}
							<VSCodeButton
								appearance="secondary"
								onClick={handleRestart}
								disabled={server.status === "connecting"}
								style={{ width: "100%" }}>
								{server.status === "connecting"
									? t("mcp:serverStatus.retrying")
									: t("mcp:serverStatus.retryConnection")}
							</VSCodeButton>
						</div>
					)}

			{/* Delete Confirmation Dialog */}
			<Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>{t("mcp:deleteDialog.title")}</DialogTitle>
						<DialogDescription>
							{t("mcp:deleteDialog.description", { serverName: server.name })}
						</DialogDescription>
					</DialogHeader>
					<DialogFooter>
						<VSCodeButton appearance="secondary" onClick={() => setShowDeleteConfirm(false)}>
							{t("mcp:deleteDialog.cancel")}
						</VSCodeButton>
						<VSCodeButton appearance="secondary" onClick={handleDelete}>
							{t("mcp:deleteDialog.delete")}
						</VSCodeButton>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	)
}

export default McpView
