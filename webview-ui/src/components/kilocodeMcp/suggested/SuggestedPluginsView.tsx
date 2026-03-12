import React from "react"
import { useSuggestedPlugins } from "./useSuggestedPlugins"
import { useExtensionState } from "@/context/ExtensionStateContext"
import { Loader2, RefreshCw } from "lucide-react"
import { MarketplaceItemCard } from "@/components/marketplace/components/MarketplaceItemCard"
import { Button } from "@/components/ui/button"

export const SuggestedPluginsView: React.FC = () => {
	const { data: plugins, isLoading, error, refetch, isFetching } = useSuggestedPlugins()
	const { marketplaceInstalledMetadata } = useExtensionState()

	if (isLoading) {
		return (
			<div className="flex items-center justify-center p-8">
				<Loader2 className="w-6 h-6 animate-spin text-vscode-foreground" />
				<span className="ml-2 text-vscode-foreground">Loading suggested plugins...</span>
			</div>
		)
	}

	if (error) {
		return (
			<div className="p-8 text-center">
				<div className="text-vscode-errorForeground mb-2">Failed to load suggested plugins</div>
				<div className="text-sm text-vscode-descriptionForeground mb-4">
					Please try again later or check your connection.
				</div>
				<Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
					<RefreshCw className={`w-4 h-4 mr-2 mt-2 ${isFetching ? "animate-spin" : ""}`} />
					Retry
				</Button>
			</div>
		)
	}

	if (!plugins || plugins.length === 0) {
		return (
			<div className="p-8 text-center">
				<div className="flex items-center justify-center gap-2 text-vscode-descriptionForeground mb-2">
					<span>No MCP servers available</span>
				</div>
				<div className="text-sm text-vscode-descriptionForeground mb-4">Check back later.</div>
				<Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
					<RefreshCw className={`w-4 h-4 mr-2 ${isFetching ? "animate-spin" : ""}`} />
					Refresh
				</Button>
			</div>
		)
	}

	return (
		<div className="p-4">
			<div className="mb-4 flex items-start justify-between">
				<div>
					<h3 className="text-lg font-semibold text-vscode-foreground flex items-center gap-2">
						MCP Servers
					</h3>
					<p className="text-sm text-vscode-descriptionForeground mt-1">
						Quick-start MCP servers recommended for your workflow. Click to add with your API key.
					</p>
				</div>
				<Button
					variant="ghost"
					size="sm"
					onClick={() => refetch()}
					disabled={isFetching}
					className="text-vscode-descriptionForeground hover:text-vscode-foreground">
					<RefreshCw className={`w-4 h-4 ${isFetching ? "animate-spin" : ""}`} />
				</Button>
			</div>

			<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2 gap-3">
				{plugins.map((plugin) => (
					<MarketplaceItemCard
						key={plugin.id}
						item={plugin}
						filters={{ search: "", type: "", tags: [], installed: "all" }}
						setFilters={() => {}}
						installed={{
							project: marketplaceInstalledMetadata?.project?.[plugin.id],
							global: marketplaceInstalledMetadata?.global?.[plugin.id],
						}}
					/>
				))}
			</div>
		</div>
	)
}
