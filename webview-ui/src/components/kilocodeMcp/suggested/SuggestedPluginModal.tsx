import React, { useState } from "react"
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { SuggestedPlugin } from "./types"
import { vscode } from "@/utils/vscode"

interface SuggestedPluginModalProps {
	plugin: SuggestedPlugin | null
	isOpen: boolean
	onClose: () => void
	hasWorkspace: boolean
}

export const SuggestedPluginModal: React.FC<SuggestedPluginModalProps> = ({
	plugin,
	isOpen,
	onClose,
	hasWorkspace,
}) => {
	const [apiKey, setApiKey] = useState("")
	const [scope, setScope] = useState<"project" | "global">(hasWorkspace ? "project" : "global")
	const [isInstalling, setIsInstalling] = useState(false)
	const [error, setError] = useState<string | null>(null)

	// Reset state when plugin changes
	React.useEffect(() => {
		if (plugin) {
			setApiKey("")
			setScope(hasWorkspace ? "project" : "global")
			setError(null)
			setIsInstalling(false)
		}
	}, [plugin, hasWorkspace])

	const handleInstall = async () => {
		if (!plugin || !apiKey.trim()) {
			setError("Please enter an API key")
			return
		}

		setIsInstalling(true)
		setError(null)

		try {
			// Parse the code and replace the API key placeholder
			const config = JSON.parse(plugin.code)
			const configStr = JSON.stringify(config)
			const updatedConfigStr = configStr.replace(/YOUR_API_KEY/g, apiKey.trim())
			const updatedConfig = JSON.parse(updatedConfigStr)

			// Send message to extension to install
			vscode.postMessage({
				type: "installSuggestedPlugin",
				pluginName: plugin.name,
				config: updatedConfig,
				scope,
			})

			onClose()
		} catch (_err) {
			setError("Failed to process plugin configuration. Please try again.")
			setIsInstalling(false)
		}
	}

	if (!plugin) return null

	return (
		<Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
			<DialogContent className="sm:max-w-[500px]">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						{plugin.logo && (
							<img
								src={plugin.logo}
								alt={plugin.companyName}
								className="w-6 h-6 object-contain"
								onError={(e) => {
									;(e.target as HTMLImageElement).style.display = "none"
								}}
							/>
						)}
						{plugin.name}
					</DialogTitle>
					<DialogDescription>{plugin.description}</DialogDescription>
				</DialogHeader>

				<div className="space-y-4 py-4">
					{/* Scope Selection */}
					<div className="space-y-2">
						<div className="text-sm font-medium">Installation Scope</div>
						<div className="space-y-2">
							<label className="flex items-center space-x-2 cursor-pointer">
								<input
									type="radio"
									name="scope"
									value="project"
									checked={scope === "project"}
									onChange={() => setScope("project")}
									disabled={!hasWorkspace}
									className="rounded-full"
								/>
								<span className={!hasWorkspace ? "opacity-50" : ""}>Project only</span>
								{!hasWorkspace && (
									<span className="text-xs text-vscode-descriptionForeground ml-2">
										(No workspace open)
									</span>
								)}
							</label>
							<label className="flex items-center space-x-2 cursor-pointer">
								<input
									type="radio"
									name="scope"
									value="global"
									checked={scope === "global"}
									onChange={() => setScope("global")}
									className="rounded-full"
								/>
								<span>Global (all projects)</span>
							</label>
						</div>
					</div>

					{/* API Key Input */}
					<div className="space-y-2">
						<label htmlFor="api-key" className="text-sm font-medium">
							API Key
						</label>
						<Input
							id="api-key"
							type="password"
							placeholder="Enter your API key"
							value={apiKey}
							onChange={(e) => setApiKey(e.target.value)}
							onKeyDown={(e) => {
								if (e.key === "Enter" && apiKey.trim()) {
									handleInstall()
								}
							}}
						/>
						<p className="text-xs text-vscode-descriptionForeground">
							Your API key will be stored securely in the MCP settings file.
						</p>
					</div>

					{/* Error Display */}
					{error && (
						<div className="text-sm text-red-500 bg-red-500/10 border border-red-500/20 rounded p-2">
							{error}
						</div>
					)}
				</div>

				<DialogFooter>
					<Button variant="outline" onClick={onClose} disabled={isInstalling}>
						Cancel
					</Button>
					<Button onClick={handleInstall} disabled={!apiKey.trim() || isInstalling}>
						{isInstalling ? "Adding..." : "Add"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	)
}
