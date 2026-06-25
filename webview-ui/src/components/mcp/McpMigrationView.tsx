import React, { useMemo, useState } from "react"
import { VSCodeButton, VSCodeProgressRing } from "@vscode/webview-ui-toolkit/react"

import { Modal } from "@src/components/common/Modal"
import { useAppTranslation } from "@src/i18n/TranslationContext"
import { vscode } from "@src/utils/vscode"

export interface MigrationEntryLike {
	key: string
	source: string
	sourceLabel: string
	name: string
	config: { type: "stdio" | "sse" | "streamable-http"; command?: string; url?: string; args?: string[] }
}

export interface MigrationResultLike {
	added: { name: string; source: string; sourceLabel: string }[]
	skipped: { name: string; source: string; sourceLabel: string; reason: string }[]
	destinationPath: string
}

interface McpMigrationViewProps {
	open: boolean
	onClose: () => void
	entries: MigrationEntryLike[]
	result: MigrationResultLike | null
	loading: boolean
}

function describeEntry(entry: MigrationEntryLike): string {
	const cfg = entry.config
	if (cfg.type === "sse" || cfg.type === "streamable-http") {
		return `${cfg.type} ${cfg.url ?? ""}`
	}
	const args = cfg.args ?? []
	return `stdio ${cfg.command ?? ""}${args.length ? " " + args.join(" ") : ""}`
}

const McpMigrationView: React.FC<McpMigrationViewProps> = ({ open, onClose, entries, result, loading }) => {
	const { t } = useAppTranslation()
	// All entries checked by default. No render-phase setState — the modal
	// is re-mounted each time it opens (keyed by the parent), so the
	// initializer is sufficient.
	const [checked, setChecked] = useState<Set<string>>(() => new Set(entries.map((e) => e.key)))

	const checkedCount = useMemo(
		() => entries.reduce((n, e) => (checked.has(e.key) ? n + 1 : n), 0),
		[entries, checked],
	)

	const toggle = (key: string) => {
		setChecked((prev) => {
			const next = new Set(prev)
			if (next.has(key)) next.delete(key)
			else next.add(key)
			return next
		})
	}

	const toggleAll = () => {
		if (checkedCount === entries.length) {
			setChecked(new Set())
		} else {
			setChecked(new Set(entries.map((e) => e.key)))
		}
	}

	const apply = () => {
		const keys = entries.filter((e) => checked.has(e.key)).map((e) => e.key)
		if (keys.length === 0) return
		vscode.postMessage({ type: "mcpMigrateApply", keys })
	}

	const groups = useMemo(() => {
		const map = new Map<string, MigrationEntryLike[]>()
		for (const entry of entries) {
			const list = map.get(entry.sourceLabel) ?? []
			list.push(entry)
			map.set(entry.sourceLabel, list)
		}
		return Array.from(map.entries())
	}, [entries])

	if (!open) return null

	return (
		<Modal isOpen={open} onClose={onClose} className="max-w-[700px] h-auto max-h-[80vh]">
			<div className="flex flex-col gap-4 p-6 overflow-y-auto">
				<div className="flex flex-col gap-1">
					<h2 className="text-lg font-semibold my-0">{t("mcp:migration.title")}</h2>
					<p className="text-sm text-vscode-descriptionForeground my-0">{t("mcp:migration.description")}</p>
				</div>

				{loading ? (
					<div
						className="flex items-center gap-2 py-4 text-sm"
						style={{ color: "var(--vscode-descriptionForeground)" }}>
						<VSCodeProgressRing />
						<span>{t("mcp:migration.scanning")}</span>
					</div>
				) : entries.length === 0 ? (
					<div className="py-4 text-sm" style={{ color: "var(--vscode-descriptionForeground)" }}>
						{t("mcp:migration.empty")}
					</div>
				) : (
					<>
						<div
							className="flex items-center justify-between py-2 text-sm"
							style={{ color: "var(--vscode-descriptionForeground)" }}>
							<span>
								{t("mcp:migration.selectedCount", { selected: checkedCount, total: entries.length })}
							</span>
							<VSCodeButton appearance="secondary" onClick={toggleAll}>
								{checkedCount === entries.length
									? t("mcp:migration.deselectAll")
									: t("mcp:migration.selectAll")}
							</VSCodeButton>
						</div>
						<div className="flex flex-col gap-3 overflow-y-auto pr-1" style={{ maxHeight: "40vh" }}>
							{groups.map(([sourceLabel, list]) => (
								<div key={sourceLabel} className="flex flex-col gap-1">
									<div
										className="text-xs font-semibold uppercase tracking-wide"
										style={{ color: "var(--vscode-descriptionForeground)" }}>
										{sourceLabel}
									</div>
									{list.map((entry) => (
										<div
											key={entry.key}
											className="flex cursor-pointer items-start gap-2 rounded px-2 py-1 text-sm hover:bg-[var(--vscode-list-hoverBackground)]"
											onClick={() => toggle(entry.key)}>
											<input
												type="checkbox"
												checked={checked.has(entry.key)}
												onClick={(e) => e.stopPropagation()}
												onChange={() => toggle(entry.key)}
												style={{ marginTop: "3px" }}
											/>
											<div className="flex flex-col">
												<span className="font-medium">{entry.name}</span>
												<span
													className="text-xs"
													style={{ color: "var(--vscode-descriptionForeground)" }}>
													{describeEntry(entry)}
												</span>
											</div>
										</div>
									))}
								</div>
							))}
						</div>
					</>
				)}

				{result ? (
					<div
						className="mt-1 rounded border p-2 text-xs"
						style={{
							borderColor: "var(--vscode-input-border)",
							background: "var(--vscode-editor-background)",
						}}>
						<div>
							{t("mcp:migration.added", {
								count: result.added.length,
								names: result.added.map((a: { name: string }) => a.name).join(", ") || "—",
							})}
						</div>
						{result.skipped.length > 0 && (
							<div className="mt-1" style={{ color: "var(--vscode-descriptionForeground)" }}>
								{t("mcp:migration.skipped", { count: result.skipped.length })}
							</div>
						)}
						<div className="mt-1" style={{ color: "var(--vscode-descriptionForeground)" }}>
							{t("mcp:migration.destination", { path: result.destinationPath })}
						</div>
					</div>
				) : null}

				<div className="flex gap-2 justify-end">
					<VSCodeButton appearance="secondary" onClick={onClose}>
						{t("mcp:migration.close")}
					</VSCodeButton>
					<VSCodeButton
						appearance="primary"
						onClick={apply}
						disabled={loading || entries.length === 0 || checkedCount === 0 || result !== null}>
						{t("mcp:migration.apply", { count: checkedCount })}
					</VSCodeButton>
				</div>
			</div>
		</Modal>
	)
}

export default McpMigrationView
