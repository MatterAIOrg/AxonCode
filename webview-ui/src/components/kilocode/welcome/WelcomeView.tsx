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
import { VSCodeButton } from "@vscode/webview-ui-toolkit/react"

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
					<div className="flex flex-col items-center pr-3">
						<KiloCodeAuth onManualConfigClick={() => setManualConfig(true)} />
					</div>
				)}

				{/* Always show the Configure Enterprise Settings button */}
				<div className="w-full mt-auto">
					<VSCodeButton
						appearance="secondary"
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
						className="w-full">
						<span className="codicon codicon-settings-gear mr-2 text-sm"></span>
						Configure Enterprise Settings
					</VSCodeButton>
				</div>
			</TabContent>
		</Tab>
	)
}

export default WelcomeView
