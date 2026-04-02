import { VSCodeButton, VSCodeTextField, VSCodeLink } from "@vscode/webview-ui-toolkit/react"
import { HTMLAttributes, useEffect, useMemo, useState } from "react"
import { Trans } from "react-i18next"

import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue, Slider } from "@/components/ui"
import { useAppTranslation } from "@/i18n/TranslationContext"
import { vscode } from "@/utils/vscode"
import { buildDocLink } from "@src/utils/docLinks"

import { SettingsCard, SettingsRow, SettingsSwitch } from "./ui/SettingsCard"
import { SetCachedStateField } from "./types"

type BrowserSettingsProps = HTMLAttributes<HTMLDivElement> & {
	browserToolEnabled?: boolean
	browserViewportSize?: string
	screenshotQuality?: number
	remoteBrowserHost?: string
	remoteBrowserEnabled?: boolean
	setCachedStateField: SetCachedStateField<
		| "browserToolEnabled"
		| "browserViewportSize"
		| "screenshotQuality"
		| "remoteBrowserHost"
		| "remoteBrowserEnabled"
	>
}

export const BrowserSettings = ({
	browserToolEnabled,
	browserViewportSize,
	screenshotQuality,
	remoteBrowserHost,
	remoteBrowserEnabled,
	setCachedStateField,
	...props
}: BrowserSettingsProps) => {
	const { t } = useAppTranslation()

	const [testingConnection, setTestingConnection] = useState(false)
	const [testResult, setTestResult] = useState<{ success: boolean; text: string } | null>(null)
	const [discovering, setDiscovering] = useState(false)

	// We don't need a local state for useRemoteBrowser since we're using the
	// `enableRemoteBrowser` prop directly. This ensures the checkbox always
	// reflects the current global state.

	// Set up message listener for browser connection results.
	useEffect(() => {
		const handleMessage = (event: MessageEvent) => {
			const message = event.data

			if (message.type === "browserConnectionResult") {
				setTestResult({ success: message.success, text: message.text })
				setTestingConnection(false)
				setDiscovering(false)
			}
		}

		window.addEventListener("message", handleMessage)

		return () => {
			window.removeEventListener("message", handleMessage)
		}
	}, [])

	const testConnection = async () => {
		setTestingConnection(true)
		setTestResult(null)

		try {
			// Send a message to the extension to test the connection.
			vscode.postMessage({ type: "testBrowserConnection", text: remoteBrowserHost })
		} catch (error) {
			setTestResult({
				success: false,
				text: `Error: ${error instanceof Error ? error.message : String(error)}`,
			})
			setTestingConnection(false)
		}
	}

	const options = useMemo(
		() => [
			{
				value: "1280x800",
				label: t("settings:browser.viewport.options.largeDesktop"),
			},
			{
				value: "900x600",
				label: t("settings:browser.viewport.options.smallDesktop"),
			},
			{ value: "768x1024", label: t("settings:browser.viewport.options.tablet") },
			{ value: "360x640", label: t("settings:browser.viewport.options.mobile") },
		],
		[t],
	)

	return (
		<div {...props}>
			<SettingsCard>
				<SettingsRow
					title={t("settings:browser.enable.label")}
					description={
						<Trans i18nKey="settings:browser.enable.description">
							<VSCodeLink
								href={buildDocLink("features/browser-use", "settings_browser_tool")}
								style={{ display: "inline" }}>
								{" "}
							</VSCodeLink>
						</Trans>
					}>
					<SettingsSwitch
						checked={browserToolEnabled ?? false}
						onChange={(checked) => setCachedStateField("browserToolEnabled", checked)}
					/>
				</SettingsRow>

				{browserToolEnabled && (
					<>
						<SettingsRow
							title={t("settings:browser.viewport.label")}
							description={t("settings:browser.viewport.description")}>
							<Select
								value={browserViewportSize}
								onValueChange={(value) => setCachedStateField("browserViewportSize", value)}>
								<SelectTrigger className="w-[180px]">
									<SelectValue placeholder={t("settings:common.select")} />
								</SelectTrigger>
								<SelectContent>
									<SelectGroup>
										{options.map(({ value, label }) => (
											<SelectItem key={value} value={value}>
												{label}
											</SelectItem>
										))}
									</SelectGroup>
								</SelectContent>
							</Select>
						</SettingsRow>

						<SettingsRow
							title={t("settings:browser.screenshotQuality.label")}
							description={t("settings:browser.screenshotQuality.description")}>
							<div className="flex items-center gap-2 w-[180px]">
								<Slider
									min={1}
									max={100}
									step={1}
									value={[screenshotQuality ?? 75]}
									onValueChange={([value]) => setCachedStateField("screenshotQuality", value)}
									className="flex-1"
								/>
								<span className="w-10 text-right text-xs">{screenshotQuality ?? 75}%</span>
							</div>
						</SettingsRow>
					</>
				)}
			</SettingsCard>

			<div className="mb-2 ml-1">
				<h3 className="text-sm font-medium text-vscode-foreground m-0 px-1 py-1">Remote Browser</h3>
			</div>

			<SettingsCard>
				<SettingsRow
					title={t("settings:browser.remote.label")}
					description={t("settings:browser.remote.description")}>
					<SettingsSwitch
						checked={remoteBrowserEnabled ?? false}
						onChange={(checked) => {
							setCachedStateField("remoteBrowserEnabled", checked)
							if (!checked) {
								setCachedStateField("remoteBrowserHost", undefined)
							}
						}}
					/>
				</SettingsRow>

				{remoteBrowserEnabled && (
					<div className="p-4 border-t border-vscode-widget-border bg-vscode-editor-background/30 flex flex-col gap-3">
						<div className="flex items-center gap-2">
							<VSCodeTextField
								value={remoteBrowserHost ?? ""}
								onChange={(e: any) =>
									setCachedStateField("remoteBrowserHost", e.target.value || undefined)
								}
								placeholder={t("settings:browser.remote.urlPlaceholder")}
								style={{ flexGrow: 1 }}
							/>
							<VSCodeButton disabled={testingConnection} onClick={testConnection}>
								{testingConnection || discovering
									? t("settings:browser.remote.testingButton")
									: t("settings:browser.remote.testButton")}
							</VSCodeButton>
						</div>
						{testResult && (
							<div
								className={`p-2 rounded-xs text-sm ${
									testResult.success ? "bg-green-800/20 text-green-400" : "bg-red-800/20 text-red-400"
								}`}>
								{testResult.text}
							</div>
						)}
						<div className="text-vscode-descriptionForeground text-xs">
							{t("settings:browser.remote.instructions")}
						</div>
					</div>
				)}
			</SettingsCard>
		</div>
	)
}
