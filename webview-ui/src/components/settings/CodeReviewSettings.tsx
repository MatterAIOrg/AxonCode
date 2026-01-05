import { VSCodeCheckbox, VSCodeTextField } from "@vscode/webview-ui-toolkit/react"
import { Eye, EyeOff } from "lucide-react"
import React, { useState } from "react"
import { Section } from "./Section"
import { SectionHeader } from "./SectionHeader"
import { SetCachedStateField } from "./types"

interface CodeReviewSettingsProps {
	codeReviewSettings: {
		enterpriseHost?: string
		enterpriseApiKey?: string
		reviewOnlyMode?: boolean
	}
	setCachedStateField: SetCachedStateField<"codeReviewSettings">
}

export const CodeReviewSettings: React.FC<CodeReviewSettingsProps> = ({ codeReviewSettings, setCachedStateField }) => {
	const enterpriseHost = codeReviewSettings?.enterpriseHost || ""
	const enterpriseApiKey = codeReviewSettings?.enterpriseApiKey || ""
	const reviewOnlyMode = codeReviewSettings?.reviewOnlyMode || false
	// const { t } = useAppTranslation()
	const [showApiKey, setShowApiKey] = useState(false)

	const handleHostChange = (event: any) => {
		const newHost = event.target.value
		setCachedStateField("codeReviewSettings", {
			...codeReviewSettings,
			enterpriseHost: newHost,
		})
	}

	const handleApiKeyChange = (event: any) => {
		const newApiKey = event.target.value
		setCachedStateField("codeReviewSettings", {
			...codeReviewSettings,
			enterpriseApiKey: newApiKey,
		})
	}

	const handleReviewOnlyModeChange = (event: any) => {
		const newReviewOnlyMode = event.target.checked
		setCachedStateField("codeReviewSettings", {
			...codeReviewSettings,
			reviewOnlyMode: newReviewOnlyMode,
		})
	}

	return (
		<div>
			<SectionHeader>
				<div className="flex items-center gap-2">
					<span className="text-lg font-semibold">AI Code Review Settings</span>
				</div>
			</SectionHeader>

			<Section>
				<div className="space-y-6">
					<div>
						<label className="block font-medium mb-2">Enterprise HOST</label>
						<VSCodeTextField
							value={enterpriseHost}
							onInput={handleHostChange}
							placeholder="https://api.matterai.so"
							className="w-full">
							<div className="flex justify-between items-center mb-1">
								<span className="text-sm text-vscode-descriptionForeground">
									Enter your enterprise API host URL
								</span>
							</div>
						</VSCodeTextField>
					</div>

					<div>
						<label className="block font-medium mb-2">Enterprise API Key</label>
						<div className="relative">
							<VSCodeTextField
								value={enterpriseApiKey}
								onInput={handleApiKeyChange}
								type={showApiKey ? "text" : "password"}
								placeholder="Enter your enterprise API key"
								className="w-full pr-10">
								<div className="flex justify-between items-center mb-1">
									<span className="text-sm text-vscode-descriptionForeground">
										Enter your enterprise API key
									</span>
								</div>
							</VSCodeTextField>
							<button
								type="button"
								onClick={() => setShowApiKey(!showApiKey)}
								className="absolute right-3 top-1/2 transform -translate-y-1/2 text-vscode-descriptionForeground hover:text-vscode-foreground">
								{showApiKey ? <EyeOff size={16} /> : <Eye size={16} />}
							</button>
						</div>
					</div>

					<div>
						<VSCodeCheckbox checked={reviewOnlyMode} onChange={handleReviewOnlyModeChange}>
							<span className="font-medium">Review Only Mode</span>
						</VSCodeCheckbox>
						<div className="text-sm text-vscode-descriptionForeground mt-1">
							When enabled, hides the setup card, history, and chat text area. Only the &quot;Run AI code
							reviews&quot; button will be available.
						</div>
					</div>
				</div>
			</Section>
		</div>
	)
}
