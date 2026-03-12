import { useExtensionState } from "@/context/ExtensionStateContext"
import { getAppUrl, type OrganizationAllowList, type ProviderSettings } from "@roo-code/types"
import type { RouterModels } from "@roo/api"
import { ProfileData, WebviewMessage } from "@roo/WebviewMessage"
import { VSCodeButtonLink } from "@src/components/common/VSCodeButtonLink"
import { useAppTranslation } from "@src/i18n/TranslationContext"
import { vscode } from "@src/utils/vscode"
import { useEffect, useRef, useState } from "react"
import { KiloCodeWrapperProperties } from "../../../../../../src/shared/kilocode/wrapper"
import { ModelPicker } from "../../../settings/ModelPicker"
import { OrganizationSelector } from "../../common/OrganizationSelector"
import { getKiloCodeBackendSignInUrl } from "../../helpers"

type KiloCodeProps = {
	apiConfiguration: ProviderSettings
	setApiConfigurationField: (field: keyof ProviderSettings, value: ProviderSettings[keyof ProviderSettings]) => void
	currentApiConfigName?: string
	hideKiloCodeButton?: boolean
	routerModels?: RouterModels
	organizationAllowList: OrganizationAllowList
	uriScheme: string | undefined
	kiloCodeWrapperProperties: KiloCodeWrapperProperties | undefined
	uiKind: string | undefined
	kilocodeDefaultModel: string
}

export const KiloCode = ({
	apiConfiguration,
	setApiConfigurationField,
	// currentApiConfigName,
	hideKiloCodeButton,
	routerModels,
	organizationAllowList,
	uriScheme,
	uiKind,
	kiloCodeWrapperProperties,
	kilocodeDefaultModel,
}: KiloCodeProps) => {
	const { t } = useAppTranslation()
	const { betaModelsEnabled, clineMessages } = useExtensionState()

	// Profile data state for usage info
	const [profileData, setProfileData] = useState<ProfileData | null>(null)
	const previousMessagesRef = useRef<string>("")

	// Fetch profile data on mount if token exists
	useEffect(() => {
		if (apiConfiguration?.kilocodeToken) {
			vscode.postMessage({ type: "fetchProfileDataRequest" })
		}
	}, [apiConfiguration?.kilocodeToken])

	// Listen for profile data response
	useEffect(() => {
		const handleMessage = (event: MessageEvent<WebviewMessage>) => {
			const message = event.data
			if (message.type === "profileDataResponse") {
				const payload = message.payload as any
				if (payload?.success && payload.data) {
					setProfileData(payload.data)
				}
			}
		}

		window.addEventListener("message", handleMessage)
		return () => {
			window.removeEventListener("message", handleMessage)
		}
	}, [])

	// Watch for new assistant responses and fetch updated profile data
	useEffect(() => {
		if (!apiConfiguration?.kilocodeToken || !clineMessages) return

		const currentMessagesHash = JSON.stringify(
			clineMessages.map((msg) => ({
				type: msg.type,
				say: msg.say,
				partial: msg.partial,
				ts: msg.ts,
			})),
		)

		if (previousMessagesRef.current !== currentMessagesHash) {
			const hasNewAssistantResponse = clineMessages.some(
				(msg) => msg.type === "say" && (msg.say === "text" || msg.say === "completion_result") && !msg.partial,
			)

			if (hasNewAssistantResponse && previousMessagesRef.current !== "") {
				vscode.postMessage({ type: "fetchProfileDataRequest" })
			}

			previousMessagesRef.current = currentMessagesHash
		}
	}, [clineMessages, apiConfiguration?.kilocodeToken])

	// Calculate usage percentage from profile data
	const usagePercentage = profileData?.usagePercentage ?? null

	// Always show all models including axon-code-2-pro
	// The model will be marked as disabled if betaModelsEnabled is false
	const models = routerModels?.["kilocode-openrouter"] ?? {}

	// List of pro model IDs which require paid plan
	const proModelIds = ["axon-code-2-pro"]

	// const handleInputChange = useCallback(
	// 	<K extends keyof ProviderSettings, E>(
	// 		field: K,
	// 		transform: (event: E) => ProviderSettings[K] = inputEventTransform,
	// 	) =>
	// 		(event: E | Event) => {
	// 			setApiConfigurationField(field, transform(event as E))
	// 		},
	// 	[setApiConfigurationField],
	// )

	// Use the existing hook to get user identity
	// const userIdentity = useKiloIdentity(apiConfiguration.kilocodeToken || "", "")
	// const isKiloCodeAiUser = userIdentity.endsWith("@matterai.so")

	// const areKilocodeWarningsDisabled = apiConfiguration.kilocodeTesterWarningsDisabledUntil
	// 	? apiConfiguration.kilocodeTesterWarningsDisabledUntil > Date.now()
	// 	: false

	// const handleToggleTesterWarnings = useCallback(() => {
	// 	const newTimestamp = Date.now() + (areKilocodeWarningsDisabled ? 0 : 24 * 60 * 60 * 1000)
	// 	setApiConfigurationField("kilocodeTesterWarningsDisabledUntil", newTimestamp)
	// }, [areKilocodeWarningsDisabled, setApiConfigurationField])

	return (
		<>
			<div>
				<label className="block font-bold text-lg">{t("kilocode:settings.provider.account")}</label>
			</div>
			{!hideKiloCodeButton &&
				(apiConfiguration.kilocodeToken ? (
					<div className="space-y-3">
						{/* Usage info */}
						{profileData && (
							<div className="space-y-2">
								<div>
									<div className="text-md font-medium text-[var(--vscode-foreground)]">
										Current Plan
									</div>
									<div className="mt-1 text-md text-[var(--vscode-descriptionForeground)]">
										{profileData.plan?.toLocaleUpperCase()}
									</div>
								</div>
								{usagePercentage !== null && (
									<div className="space-y-2">
										<div className="flex justify-between items-center">
											<div className="text-md font-medium text-[var(--vscode-foreground)]">
												Monthly Usage
											</div>
											<div className="text-md text-[var(--vscode-descriptionForeground)]">
												{usagePercentage.toFixed(0)}% used
											</div>
										</div>
										<div
											className="w-full h-2.5 rounded-full overflow-hidden"
											style={{
												backgroundColor:
													"color-mix(in srgb, var(--vscode-input-background), black 20%)",
											}}>
											<div
												className="h-full bg-[var(--vscode-button-background)] transition-all duration-300"
												style={{ width: `${Math.min(usagePercentage, 100)}%` }}
											/>
										</div>
									</div>
								)}
								{profileData.remainingReviews !== undefined && (
									<div>
										<div className="pt-1 text-md font-medium text-[var(--vscode-foreground)]">
											Monthly Code Reviews
										</div>
										<div className="mt-1 text-md text-[var(--vscode-descriptionForeground)]">
											{profileData.remainingReviews.toFixed(0)} reviews remaining
										</div>
									</div>
								)}
							</div>
						)}
					</div>
				) : (
					<VSCodeButtonLink
						variant="secondary"
						href={getKiloCodeBackendSignInUrl(uriScheme, uiKind, kiloCodeWrapperProperties)}>
						{t("kilocode:settings.provider.login")}
					</VSCodeButtonLink>
				))}
			{/* 
			<VSCodeTextField
				value={apiConfiguration?.kilocodeToken || ""}
				type="password"
				onInput={handleInputChange("kilocodeToken")}
				placeholder={t("kilocode:settings.provider.apiKey")}
				className="w-full">
				<div className="flex justify-between items-center mb-1">
					<label className="block font-medium">{t("kilocode:settings.provider.apiKey")}</label>
				</div>
			</VSCodeTextField> */}

			<OrganizationSelector showLabel />

			<ModelPicker
				apiConfiguration={apiConfiguration}
				setApiConfigurationField={setApiConfigurationField}
				defaultModelId={kilocodeDefaultModel}
				models={models}
				modelIdKey="kilocodeModel"
				serviceName="Orbital"
				serviceUrl={getAppUrl()}
				organizationAllowList={organizationAllowList}
				proModelIds={proModelIds}
				proModelsEnabled={betaModelsEnabled}
			/>
		</>
	)
}
