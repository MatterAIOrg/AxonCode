import { useCallback, useEffect, useMemo, useState } from "react"
import { Trans } from "react-i18next"
import { ExternalLink, Package, RefreshCw, Search } from "lucide-react"

import type { MarketplaceItem } from "@roo-code/types"
import type { MarketplaceInstalledMetadata, MarketplacePluginInventory } from "@src/../../src/shared/ExtensionMessage"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { MatterProgressIndicator } from "@/components/chat/ProgressIndicator"
import { Tab, TabContent, TabHeader } from "@/components/common/Tab"
import { useAppTranslation } from "@/i18n/TranslationContext"
import { useExtensionState } from "@/context/ExtensionStateContext"
import { vscode } from "@/utils/vscode"
import { cn } from "@/lib/utils"
import { VSCodeButton } from "@vscode/webview-ui-toolkit/react"

interface SkillsMarketplaceViewProps {
	onDone?: () => void
	embedded?: boolean
}

type PluginItem = Extract<MarketplaceItem, { type: "plugin" }>

interface PluginCardProps {
	item: PluginItem
	installed: boolean
	inventory?: MarketplacePluginInventory
	busy: boolean
	onInstall: () => void
	onRemove: () => void
}

function declaredCount(value: string | string[] | undefined): number {
	if (Array.isArray(value)) return value.length
	return value ? 1 : 0
}

function PluginCard({ item, installed, inventory, busy, onInstall, onRemove }: PluginCardProps) {
	const { t } = useAppTranslation()
	const category = item.category || item.tags?.[0]
	const capabilities = inventory ?? {
		skills: item.skills?.length ?? 0,
		commands: declaredCount(item.commands),
		agents: declaredCount(item.agents),
		mcpServers: item.mcpServers ? 1 : 0,
		hooks: item.hooks ? 1 : 0,
	}
	const badges = [
		capabilities.skills > 0 ? `${capabilities.skills} ${capabilities.skills === 1 ? "skill" : "skills"}` : null,
		capabilities.commands > 0
			? `${capabilities.commands} ${capabilities.commands === 1 ? "command" : "commands"}`
			: null,
		capabilities.agents > 0 ? `${capabilities.agents} ${capabilities.agents === 1 ? "agent" : "agents"}` : null,
		capabilities.mcpServers > 0 ? `${capabilities.mcpServers} MCP` : null,
		capabilities.hooks > 0 ? `${capabilities.hooks} ${capabilities.hooks === 1 ? "hook" : "hooks"}` : null,
	].filter((badge): badge is string => Boolean(badge))

	return (
		<div className="flex flex-col gap-2 rounded-2xl border border-vscode-panel-border bg-vscode-editor-background p-4 transition-colors hover:border-vscode-focusBorder">
			<div className="flex items-start justify-between gap-2">
				<div className="min-w-0 flex-1">
					<div className="flex items-center gap-2">
						<Package className="size-4 shrink-0 text-vscode-descriptionForeground" />
						<h3 className="m-0 truncate text-sm font-semibold text-vscode-foreground">{item.name}</h3>
					</div>
					<p className="m-0 mt-0.5 text-xs text-vscode-descriptionForeground">
						<span className="font-mono text-[10px]">
							{item.id}@{item.marketplace}
						</span>
					</p>
				</div>
				<VSCodeButton
					appearance={installed ? "secondary" : "primary"}
					className="text-xs h-5 py-0 px-2"
					disabled={busy}
					onClick={installed ? onRemove : onInstall}>
					{busy
						? t("marketplace:skillsMarketplace.working")
						: installed
							? t("marketplace:skillsMarketplace.remove")
							: t("marketplace:skillsMarketplace.install")}
				</VSCodeButton>
			</div>

			{item.description && (
				<p className="m-0 line-clamp-3 text-xs text-vscode-foreground/90">{item.description}</p>
			)}

			<div className="flex flex-wrap items-center gap-1.5">
				<span className="rounded-sm bg-vscode-badge-background px-1.5 py-0.5 text-[10px] font-mono uppercase tracking-wider text-vscode-badge-foreground">
					Plugin
				</span>
				{installed && (
					<span className="rounded-sm border border-green-600/30 bg-green-600/20 px-1.5 py-0.5 text-[10px] font-mono uppercase tracking-wider text-green-400">
						{t("marketplace:skillsMarketplace.installed")}
					</span>
				)}
				{badges.map((badge) => (
					<span
						key={badge}
						className="rounded-sm border border-vscode-panel-border px-1.5 py-0.5 text-[10px] text-vscode-descriptionForeground">
						{badge}
					</span>
				))}
				{category && <span className="text-[10px] text-vscode-descriptionForeground">{category}</span>}
				{item.author && (
					<span className="text-[10px] text-vscode-descriptionForeground">
						{t("marketplace:skillsMarketplace.author")}: {item.author}
					</span>
				)}
			</div>

			{item.sourceUrl && (
				<div className="flex items-center gap-1 text-[10px] text-vscode-descriptionForeground">
					<ExternalLink className="size-3" />
					<a
						href={item.sourceUrl}
						className="truncate text-vscode-textLink-foreground hover:text-vscode-textLink-activeForeground hover:underline"
						onClick={(event) => {
							event.preventDefault()
							vscode.postMessage({ type: "openExternal", url: item.sourceUrl! })
						}}>
						{t("marketplace:skillsMarketplace.viewSource")}
					</a>
				</div>
			)}
		</div>
	)
}

export function SkillsMarketplaceView({ onDone, embedded = false }: SkillsMarketplaceViewProps) {
	const { t } = useAppTranslation()
	const { cwd } = useExtensionState()
	const [items, setItems] = useState<PluginItem[]>([])
	const [installedMetadata, setInstalledMetadata] = useState<MarketplaceInstalledMetadata>({
		project: {},
		global: {},
	})
	const [isLoading, setIsLoading] = useState(true)
	const [error, setError] = useState<string | null>(null)
	const [search, setSearch] = useState("")
	const [busyIds, setBusyIds] = useState<Set<string>>(new Set())
	const hasWorkspace = Boolean(cwd)

	const fetchData = useCallback(() => {
		setIsLoading(true)
		setError(null)
		vscode.postMessage({ type: "fetchSkillsMarketplaceData" })
	}, [])

	useEffect(() => fetchData(), [fetchData])

	useEffect(() => {
		const handler = (event: MessageEvent) => {
			const message = event.data
			if (message?.type === "skillsMarketplaceData") {
				setItems(
					(message.marketplaceItems ?? []).filter(
						(item: MarketplaceItem): item is PluginItem => item.type === "plugin",
					),
				)
				setInstalledMetadata(message.marketplaceInstalledMetadata ?? { project: {}, global: {} })
				setError(Array.isArray(message.errors) && message.errors.length ? message.errors.join("\n") : null)
				setIsLoading(false)
			} else if (message?.type === "marketplaceInstallResult" || message?.type === "marketplaceRemoveResult") {
				setBusyIds((previous) => {
					const next = new Set(previous)
					next.delete(message.slug)
					return next
				})
				vscode.postMessage({ type: "fetchSkillsMarketplaceData" })
			}
		}
		window.addEventListener("message", handler)
		return () => window.removeEventListener("message", handler)
	}, [])

	const filteredItems = useMemo(() => {
		const term = search.trim().toLowerCase()
		if (!term) return items
		return items.filter((item) =>
			`${item.name} ${item.description} ${item.id} ${(item.tags ?? []).join(" ")}`.toLowerCase().includes(term),
		)
	}, [items, search])

	const handleInstall = useCallback(
		(item: PluginItem) => {
			if (!hasWorkspace) {
				vscode.postMessage({
					type: "showToast",
					toastType: "error",
					toastMessage: t("marketplace:skillsMarketplace.noWorkspace"),
				})
				return
			}
			setBusyIds((previous) => new Set(previous).add(item.id))
			vscode.postMessage({
				type: "installMarketplaceItem",
				mpItem: item,
				mpInstallOptions: { target: "project" },
			})
		},
		[hasWorkspace, t],
	)

	const handleRemove = useCallback((item: PluginItem) => {
		setBusyIds((previous) => new Set(previous).add(item.id))
		vscode.postMessage({
			type: "removeInstalledMarketplaceItem",
			mpItem: item,
			mpInstallOptions: { target: "project" },
		})
	}, [])

	return (
		<Tab className="relative" embedded={embedded}>
			<TabHeader className={cn("flex flex-col gap-3", embedded && "border-0 p-0")}>
				<div className="flex items-center justify-between gap-2">
					{!embedded && (
						<div className="flex items-center gap-2">
							<Package className="size-4 text-vscode-foreground" />
							<h3 className="m-0 text-sm font-bold text-vscode-foreground">
								{t("marketplace:skillsMarketplace.title")}
							</h3>
						</div>
					)}
					<div className="flex items-center gap-1">
						<Button
							size="sm"
							variant="ghost"
							disabled={isLoading}
							onClick={fetchData}
							className="h-7 px-2 text-xs">
							<RefreshCw className={cn("mr-1 size-3", isLoading && "animate-spin")} />
							{t("marketplace:skillsMarketplace.refresh")}
						</Button>
						{onDone && (
							<Button size="sm" onClick={onDone} className="h-7 px-3 text-xs">
								{t("marketplace:done")}
							</Button>
						)}
					</div>
				</div>
				<p className="m-0 text-xs leading-relaxed text-vscode-descriptionForeground">
					<Trans
						i18nKey="marketplace:skillsMarketplace.description"
						components={{
							0: (
								<code className="rounded bg-vscode-textCodeBlock-background px-1 font-mono text-[11px]" />
							),
						}}
					/>
				</p>
				<div className="relative">
					<Search className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-vscode-descriptionForeground" />
					<Input
						type="text"
						placeholder={t("marketplace:filters.search.placeholder")}
						value={search}
						onChange={(event) => setSearch(event.target.value)}
						className="h-7 pl-7 text-xs"
					/>
				</div>
				<div className="flex items-center justify-between text-[10px] text-vscode-descriptionForeground">
					<span>{t("marketplace:skillsMarketplace.itemsCount", { count: filteredItems.length })}</span>
					<span className="font-mono">{t("marketplace:skillsMarketplace.poweredBy")}</span>
				</div>
			</TabHeader>

			<TabContent className={embedded ? "pt-4" : "p-3"} embedded={embedded}>
				{isLoading && items.length === 0 && (
					<div className="flex flex-col items-center justify-center gap-2 py-12 text-vscode-descriptionForeground">
						<MatterProgressIndicator />
						<p className="m-0 text-xs">{t("marketplace:skillsMarketplace.loading")}</p>
					</div>
				)}
				{!isLoading && error && items.length === 0 && (
					<div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-vscode-panel-border bg-vscode-editor-background p-6 text-center">
						<p className="m-0 text-sm font-semibold text-vscode-errorForeground">
							{t("marketplace:skillsMarketplace.errorTitle")}
						</p>
						<p className="m-0 max-w-md text-xs text-vscode-descriptionForeground">
							{t("marketplace:skillsMarketplace.errorBody")}
						</p>
						<pre className="m-0 mt-2 max-w-md overflow-auto whitespace-pre-wrap break-words rounded bg-vscode-textCodeBlock-background p-2 text-left text-[10px] text-vscode-descriptionForeground">
							{error}
						</pre>
						<Button size="sm" variant="secondary" onClick={fetchData}>
							<RefreshCw className="mr-1 size-3" />
							{t("marketplace:skillsMarketplace.refresh")}
						</Button>
					</div>
				)}
				{!isLoading && !error && items.length === 0 && (
					<div className="flex flex-col items-center justify-center gap-2 py-12 text-vscode-descriptionForeground">
						<Package className="size-8 opacity-50" />
						<p className="m-0 text-sm">{t("marketplace:skillsMarketplace.empty")}</p>
						<p className="m-0 text-xs">{t("marketplace:skillsMarketplace.emptyHint")}</p>
					</div>
				)}
				{filteredItems.length > 0 && (
					<div className="grid grid-cols-1 gap-2 md:grid-cols-2">
						{filteredItems.map((item) => {
							const metadata = installedMetadata.project[item.id] || installedMetadata.global[item.id]
							return (
								<PluginCard
									key={item.id}
									item={item}
									installed={Boolean(metadata)}
									inventory={metadata?.inventory}
									busy={busyIds.has(item.id)}
									onInstall={() => handleInstall(item)}
									onRemove={() => handleRemove(item)}
								/>
							)
						})}
					</div>
				)}
			</TabContent>
		</Tab>
	)
}

export default SkillsMarketplaceView
