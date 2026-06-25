import { useCallback, useState } from "react"
import { useExtensionState } from "../../../context/ExtensionStateContext"
import { validateApiConfiguration } from "../../../utils/validate"
import { vscode } from "../../../utils/vscode"
import { Tab, TabContent } from "../../common/Tab"
import { useAppTranslation } from "../../../i18n/TranslationContext"
import { ButtonPrimary } from "../common/ButtonPrimary"
import { ButtonLink } from "../common/ButtonLink"
import ApiOptions from "../../settings/ApiOptions"
import KiloCodeAuth from "../common/KiloCodeAuth"
import { getKiloCodeBackendSignInUrl } from "../helpers"

const WelcomeView = () => {
	const {
		apiConfiguration,
		currentApiConfigName,
		setApiConfiguration,
		uriScheme,
		uiKind,
		kiloCodeWrapperProperties,
	} = useExtensionState()
	const [errorMessage, setErrorMessage] = useState<string | undefined>()
	const [manualConfig, setManualConfig] = useState(false)
	const { t } = useAppTranslation()

	const handleSubmit = useCallback(() => {
		const error = apiConfiguration ? validateApiConfiguration(apiConfiguration) : undefined

		if (error) {
			setErrorMessage(error)
			return
		}

		setErrorMessage(undefined)
		vscode.postMessage({ type: "upsertApiConfiguration", text: currentApiConfigName, apiConfiguration })
	}, [apiConfiguration, currentApiConfigName])

	const isSettingUpKiloCode =
		!apiConfiguration?.apiProvider ||
		(apiConfiguration?.apiProvider === "kilocode" && !apiConfiguration?.kilocodeToken)

	return (
		<Tab>
			<TabContent className="flex flex-col gap-5">
				{manualConfig ? (
					<>
						<ApiOptions
							fromWelcomeView
							apiConfiguration={apiConfiguration || {}}
							uriScheme={uriScheme}
							setApiConfigurationField={(field, value) => setApiConfiguration({ [field]: value })}
							errorMessage={errorMessage}
							setErrorMessage={setErrorMessage}
							hideKiloCodeButton
						/>
						{isSettingUpKiloCode ? (
							<ButtonLink
								href={getKiloCodeBackendSignInUrl(uriScheme, uiKind, kiloCodeWrapperProperties)}>
								{t("kilocode:settings.provider.login")}
							</ButtonLink>
						) : (
							<ButtonPrimary onClick={handleSubmit}>{t("welcome:start")}</ButtonPrimary>
						)}
					</>
				) : (
					<div className="flex w-full flex-col items-center">
						<KiloCodeAuth onManualConfigClick={() => setManualConfig(true)} />
					</div>
				)}

				{/* Always show the Configure Enterprise Settings chip, centered at the bottom */}
				<div className="mt-auto flex justify-center pt-2">
					<button
						type="button"
						onClick={(e) => {
							e.preventDefault()
							window.postMessage(
								{
									type: "action",
									action: "settingsButtonClicked",
									values: { section: "codeReview" },
								},
								"*",
							)
						}}
						className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-vscode-panel-border bg-vscode-textCodeBlock-background px-3 py-1 text-xs text-vscode-descriptionForeground transition-colors hover:border-vscode-focusBorder hover:text-vscode-foreground">
						<span className="codicon codicon-settings-gear text-[12px]!"></span>
						Configure Enterprise Settings
					</button>
				</div>
			</TabContent>
		</Tab>
	)
}

export default WelcomeView
