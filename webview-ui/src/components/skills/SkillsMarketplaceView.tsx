import { useCallback, useEffect, useMemo, useState } from "react"
import { Trans } from "react-i18next"
import { ExternalLink, Library, RefreshCw, Search } from "lucide-react"

import type { MarketplaceItem } from "@roo-code/types"
import type { MarketplaceInstalledMetadata } from "@src/../../src/shared/ExtensionMessage"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { MatterProgressIndicator } from "@/components/chat/ProgressIndicator"
import { Tab, TabContent, TabHeader } from "@/components/common/Tab"
import { useAppTranslation } from "@/i18n/TranslationContext"
import { useExtensionState } from "@/context/ExtensionStateContext"
import { vscode } from "@/utils/vscode"
import { cn } from "@/lib/utils"

interface SkillsMarketplaceViewProps {
	onDone?: () => void
}

type SkillItem = Extract<MarketplaceItem, { type: "skill" }>

interface SkillCardProps {
	item: SkillItem
	installed: boolean
	busy: boolean
	onInstall: () => void
	onRemove: () => void
}

function SkillCard({ item, installed, busy, onInstall, onRemove }: SkillCardProps) {
	const { t } = useAppTranslation()
	const category = item.tags?.[0]
	const author = item.author

	return (
		<div className="flex flex-col gap-2 rounded-lg border border-vscode-panel-border bg-vscode-editor-background p-3 transition-colors hover:border-vscode-focusBorder">
			<div className="flex items-start justify-between gap-2">
				<div className="min-w-0 flex-1">
					<div className="flex items-center gap-2">
						<Library className="size-4 shrink-0 text-vscode-descriptionForeground" />
						<h3 className="m-0 truncate text-sm font-semibold text-vscode-foreground">{item.name}</h3>
					</div>
					<p className="m-0 mt-0.5 text-xs text-vscode-descriptionForeground">
						<span className="font-mono text-[10px]">{item.id}</span>
					</p>
				</div>
				<div className="flex shrink-0 items-center gap-1">
					{installed ? (
						<Button
							size="sm"
							variant="secondary"
							disabled={busy}
							onClick={onRemove}
							className="h-6 px-2 text-xs">
							{t("marketplace:skillsMarketplace.remove")}
						</Button>
					) : (
						<Button
							size="sm"
							variant="default"
							disabled={busy}
							onClick={onInstall}
							className="h-6 px-2 text-xs">
							{t("marketplace:skillsMarketplace.install")}
						</Button>
					)}
				</div>
			</div>

			{item.description && (
				<p className="m-0 line-clamp-3 text-xs text-vscode-foreground/90">{item.description}</p>
			)}

			<div className="flex flex-wrap items-center gap-1.5">
				{installed && (
					<span className="rounded-sm border border-green-600/30 bg-green-600/20 px-1.5 py-0.5 text-[10px] font-mono uppercase tracking-wider text-green-400">
						{t("marketplace:skillsMarketplace.installed")}
					</span>
				)}
				{category && (
					<span className="rounded-sm bg-vscode-badge-background px-1.5 py-0.5 text-[10px] font-mono uppercase tracking-wider text-vscode-badge-foreground">
						{category}
					</span>
				)}
				{author && (
					<span className="text-[10px] text-vscode-descriptionForeground">
						{t("marketplace:skillsMarketplace.author")}: {author}
					</span>
				)}
			</div>

			{item.sourceUrl && (
				<div className="flex items-center gap-1 text-[10px] text-vscode-descriptionForeground">
					<ExternalLink className="size-3" />
					<a
						href={item.sourceUrl}
						className="truncate text-vscode-textLink-foreground hover:text-vscode-textLink-activeForeground hover:underline"
						onClick={(e) => {
							e.preventDefault()
							vscode.postMessage({ type: "openExternal", url: item.sourceUrl! })
						}}>
						{t("marketplace:skillsMarketplace.viewSource")}
					</a>
				</div>
			)}
		</div>
	)
}

export function SkillsMarketplaceView({ onDone }: SkillsMarketplaceViewProps) {
	const { t } = useAppTranslation()
	const { cwd } = useExtensionState()
	const [items, setItems] = useState<SkillItem[]>([])
	const [installedMetadata, setInstalledMetadata] = useState<MarketplaceInstalledMetadata>({
		project: {},
		global: {},
	})
	const [isLoading, setIsLoading] = useState(true)
	const [error, setError] = useState<string | null>(null)
	const [search, setSearch] = useState("")
	const [busyIds, setBusyIds] = useState<Set<string>>(new Set())

	const hasWorkspace = !!cwd

	const fetchData = useCallback(() => {
		setIsLoading(true)
		setError(null)
		vscode.postMessage({ type: "fetchSkillsMarketplaceData" })
	}, [])

	useEffect(() => {
		fetchData()
	}, [fetchData])

	useEffect(() => {
		const handler = (event: MessageEvent) => {
			const message = event.data
			if (message?.type === "skillsMarketplaceData") {
				const next: SkillItem[] = (message.marketplaceItems ?? []).filter(
					(item: MarketplaceItem) => item.type === "skill",
				)
				setItems(next)
				if (message.marketplaceInstalledMetadata) {
					setInstalledMetadata(message.marketplaceInstalledMetadata)
				}
				if (Array.isArray(message.errors) && message.errors.length > 0) {
					setError(message.errors.join("\n"))
				} else {
					setError(null)
				}
				setIsLoading(false)
			} else if (message?.type === "marketplaceInstallResult") {
				// Refresh installed metadata after install/remove.
				setBusyIds((prev) => {
					const next = new Set(prev)
					next.delete(message.slug)
					return next
				})
				vscode.postMessage({ type: "fetchSkillsMarketplaceData" })
			} else if (message?.type === "marketplaceRemoveResult") {
				setBusyIds((prev) => {
					const next = new Set(prev)
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
		return items.filter((item) => {
			const haystack = `${item.name} ${item.description} ${item.id} ${(item.tags ?? []).join(" ")}`.toLowerCase()
			return haystack.includes(term)
		})
	}, [items, search])

	const isInstalled = useCallback(
		(item: SkillItem) => {
			// Skills are keyed by their folder name (the part after `:` in the id).
			const folder = item.id.includes(":") ? item.id.split(":").pop()! : item.id
			return Boolean(installedMetadata.project?.[folder] || installedMetadata.global?.[folder])
		},
		[installedMetadata],
	)

	const handleInstall = useCallback(
		(item: SkillItem) => {
			if (!hasWorkspace) {
				vscode.postMessage({
					type: "showToast",
					toastType: "error",
					toastMessage: t("marketplace:skillsMarketplace.noWorkspace"),
				})
				return
			}
			setBusyIds((prev) => new Set(prev).add(item.id))
			vscode.postMessage({
				type: "installMarketplaceItem",
				mpItem: item,
				mpInstallOptions: { target: "project" },
			})
		},
		[hasWorkspace, t],
	)

	const handleRemove = useCallback((item: SkillItem) => {
		setBusyIds((prev) => new Set(prev).add(item.id))
		vscode.postMessage({
			type: "removeInstalledMarketplaceItem",
			mpItem: item,
			mpInstallOptions: { target: "project" },
		})
	}, [])

	return (
		<Tab className="relative">
			<TabHeader className="flex flex-col gap-2">
				<div className="flex items-center justify-between gap-2">
					<div className="flex items-center gap-2">
						<Library className="size-4 text-vscode-foreground" />
						<h3 className="m-0 text-sm font-bold text-vscode-foreground">
							{t("marketplace:skillsMarketplace.title")}
						</h3>
					</div>
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
							<Button size="sm" variant="default" onClick={onDone} className="h-7 px-3 text-xs">
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
							1: (
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
						onChange={(e) => setSearch(e.target.value)}
						className="h-7 pl-7 text-xs"
					/>
				</div>
				<div className="flex items-center justify-between text-[10px] text-vscode-descriptionForeground">
					<span>{t("marketplace:skillsMarketplace.itemsCount", { count: filteredItems.length })}</span>
					<span className="font-mono">{t("marketplace:skillsMarketplace.poweredBy")}</span>
				</div>
			</TabHeader>

			<TabContent className="p-3">
				{isLoading && items.length === 0 && (
					<div className="flex flex-col items-center justify-center gap-2 py-12 text-vscode-descriptionForeground">
						<MatterProgressIndicator />
						<p className="m-0 text-xs">{t("marketplace:skillsMarketplace.loading")}</p>
					</div>
				)}

				{!isLoading && error && items.length === 0 && (
					<div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-vscode-panel-border bg-vscode-editor-background p-6 text-center">
						<p className="m-0 text-sm font-semibold text-vscode-errorForeground">
							{t("marketplace:skillsMarketplace.errorTitle")}
						</p>
						<p className="m-0 max-w-md text-xs text-vscode-descriptionForeground">
							{t("marketplace:skillsMarketplace.errorBody")}
						</p>
						{error && (
							<pre className="m-0 mt-2 max-w-md overflow-auto whitespace-pre-wrap break-words rounded bg-vscode-textCodeBlock-background p-2 text-left text-[10px] text-vscode-descriptionForeground">
								{error}
							</pre>
						)}
						<Button size="sm" variant="secondary" onClick={fetchData} className="mt-2">
							<RefreshCw className="mr-1 size-3" />
							{t("marketplace:skillsMarketplace.refresh")}
						</Button>
					</div>
				)}

				{!isLoading && !error && items.length === 0 && (
					<div className="flex flex-col items-center justify-center gap-2 py-12 text-vscode-descriptionForeground">
						<Library className="size-8 opacity-50" />
						<p className="m-0 text-sm">{t("marketplace:skillsMarketplace.empty")}</p>
						<p className="m-0 text-xs">{t("marketplace:skillsMarketplace.emptyHint")}</p>
					</div>
				)}

				{filteredItems.length > 0 && (
					<div className="grid grid-cols-1 gap-2 md:grid-cols-2">
						{filteredItems.map((item) => (
							<SkillCard
								key={item.id}
								item={item}
								installed={isInstalled(item)}
								busy={busyIds.has(item.id)}
								onInstall={() => handleInstall(item)}
								onRemove={() => handleRemove(item)}
							/>
						))}
					</div>
				)}
			</TabContent>
		</Tab>
	)
}

export default SkillsMarketplaceView
