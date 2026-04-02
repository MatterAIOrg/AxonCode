import { VSCodeTextField } from "@vscode/webview-ui-toolkit/react"
import { Eye, EyeOff } from "lucide-react"
import React, { useState } from "react"
import { SettingsCard, SettingsRow, SettingsSwitch } from "./ui/SettingsCard"
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
		<SettingsCard>
			<SettingsRow title="Enterprise HOST" description="Enter your enterprise API host URL">
				<VSCodeTextField
					value={enterpriseHost}
					onInput={handleHostChange}
					placeholder="https://api.matterai.so"
					className="w-[250px]"
				/>
			</SettingsRow>

			<SettingsRow title="Enterprise API Key" description="Enter your enterprise API key">
				<div className="flex items-center gap-2">
					<VSCodeTextField
						value={enterpriseApiKey}
						onInput={handleApiKeyChange}
						type={showApiKey ? "text" : "password"}
						placeholder="Enter your enterprise API key"
						className="w-[250px]"
					/>
					<button
						type="button"
						onClick={() => setShowApiKey(!showApiKey)}
						className="text-vscode-descriptionForeground hover:text-vscode-foreground">
						{showApiKey ? <EyeOff size={16} /> : <Eye size={16} />}
					</button>
				</div>
			</SettingsRow>

			<SettingsRow
				title="Review Only Mode"
				description='When enabled, hides the setup card, history, and chat text area. Only the "Run AI code reviews" button will be available.'>
				<SettingsSwitch checked={reviewOnlyMode} onChange={handleReviewOnlyModeChange} />
			</SettingsRow>
		</SettingsCard>
	)
}
