import { useExtensionState } from "@/context/ExtensionStateContext"
import {
	canAccessAxonModel,
	getAppUrl,
	getAxonPlanFallback,
	isPlanRestrictedAxonModel,
	type OrganizationAllowList,
	type ProviderSettings,
} from "@roo-code/types"
import type { RouterModels } from "@roo/api"
import { ProfileData, WebviewMessage } from "@roo/WebviewMessage"
import { MatterProgressIndicator } from "@src/components/chat/ProgressIndicator"
import { VSCodeButtonLink } from "@src/components/common/VSCodeButtonLink"
import { useAppTranslation } from "@src/i18n/TranslationContext"
import { vscode } from "@src/utils/vscode"
import { useEffect, useMemo, useRef, useState } from "react"
import { KiloCodeWrapperProperties } from "../../../../../../src/shared/kilocode/wrapper"
import { ModelPicker } from "../../../settings/ModelPicker"
import { OrganizationSelector } from "../../common/OrganizationSelector"
import { WeeklyResetButton } from "../../common/WeeklyResetButton"
import { getKiloCodeBackendSignInUrl } from "../../helpers"

function formatRelativeTime(isoStr?: string): string {
	if (!isoStr) return "on session start"
	const now = Date.now()
	const target = new Date(isoStr).getTime()
	if (Number.isNaN(target)) return "on session start"
	const diff = target - now
	if (diff <= 0) return "now"
	const sec = Math.floor(diff / 1000)
	const min = Math.floor(sec / 60)
	const hrs = Math.floor(min / 60)
	const days = Math.floor(hrs / 24)
	if (days >= 1) return `in ${days} day${days > 1 ? "s" : ""}`
	if (hrs >= 1) return `in ${hrs}h ${min % 60}m`
	if (min >= 1) return `in ${min}m`
	return "soon"
}

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
	const [isProfileLoading, setIsProfileLoading] = useState(Boolean(apiConfiguration?.kilocodeToken))
	const [isResettingWeekly, setIsResettingWeekly] = useState(false)
	const [weeklyResetError, setWeeklyResetError] = useState<string | null>(null)
	const previousMessagesRef = useRef<string>("")

	// Fetch profile data on mount if token exists
	useEffect(() => {
		if (apiConfiguration?.kilocodeToken) {
			setProfileData(null)
			setIsProfileLoading(true)
			vscode.postMessage({ type: "fetchProfileDataRequest" })
		} else {
			setProfileData(null)
			setIsProfileLoading(false)
		}
	}, [apiConfiguration?.kilocodeToken])

	// Listen for profile data response
	useEffect(() => {
		const handleMessage = (event: MessageEvent<WebviewMessage>) => {
			const message = event.data
			if (message.type === "profileDataResponse") {
				const payload = message.payload as any
				setIsProfileLoading(false)
				if (payload?.success && payload.data) {
					setProfileData(payload.data)
				}
			}
			if (message.type === "resetWeeklyUsageResponse") {
				const payload = message.payload as any
				setIsResettingWeekly(false)
				if (payload?.success && payload.data) {
					setWeeklyResetError(null)
					setProfileData((current) =>
						current
							? {
									...current,
									tieredUsage: payload.data.tieredUsage,
									weeklyReset: payload.data.weeklyReset,
								}
							: current,
					)
				} else {
					setWeeklyResetError(payload?.error || "Failed to reset weekly usage")
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
				setIsProfileLoading(true)
				vscode.postMessage({ type: "fetchProfileDataRequest" })
			}

			previousMessagesRef.current = currentMessagesHash
		}
	}, [clineMessages, apiConfiguration?.kilocodeToken])

	const handleWeeklyReset = () => {
		if (isResettingWeekly) return
		setWeeklyResetError(null)
		setIsResettingWeekly(true)
		vscode.postMessage({ type: "resetWeeklyUsageRequest" })
	}

	// Always show all models including axon-code-2-pro
	// The model will be marked as disabled if betaModelsEnabled is false
	const models = useMemo(() => routerModels?.["kilocode-openrouter"] ?? {}, [routerModels])
	const profilePlan = profileData?.plan ?? profileData?.tieredUsage?.plan
	const availableModels = useMemo(
		() =>
			Object.fromEntries(Object.entries(models).filter(([modelId]) => canAccessAxonModel(modelId, profilePlan))),
		[models, profilePlan],
	)

	useEffect(() => {
		const selectedModelId = apiConfiguration.kilocodeModel
		if (!profilePlan || !selectedModelId || !isPlanRestrictedAxonModel(selectedModelId)) return
		if (canAccessAxonModel(selectedModelId, profilePlan)) return

		const fallbackId = getAxonPlanFallback(selectedModelId, profilePlan)
		if (models[fallbackId]) setApiConfigurationField("kilocodeModel", fallbackId)
	}, [apiConfiguration.kilocodeModel, profilePlan, models, setApiConfigurationField])

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
				{isProfileLoading && !profileData ? (
					<div className="mt-1 text-sm text-[var(--vscode-descriptionForeground)]">
						<MatterProgressIndicator />
					</div>
				) : (
					profileData?.email && (
						<div className="text-sm text-[var(--vscode-descriptionForeground)] mt-1">
							{profileData.email}
						</div>
					)
				)}
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
										{profileData.plan?.replace("_", " ")?.toUpperCase()}
									</div>
								</div>
								{/* Tiered usage windows (weekly / monthly) */}
								{profileData?.tieredUsage &&
									(["weekly", "monthly"] as const).map((key) => {
										const w = profileData.tieredUsage![key]
										const pct = Math.max(0, Math.min(100, w.percentage || 0))
										const labelMap: Record<typeof key, string> = {
											weekly: "Weekly",
											monthly: "Monthly",
										}
										const relative = formatRelativeTime(w.resetsAt)
										return (
											<div className="space-y-1" key={key}>
												<div className="flex justify-between items-center">
													<div className="text-xs font-medium text-[var(--vscode-foreground)]">
														{labelMap[key]}
													</div>
													<div className="text-[10px] text-[var(--vscode-descriptionForeground)]">
														{pct.toFixed(0)}%
													</div>
												</div>
												<div
													className="w-full h-1.5 rounded-full overflow-hidden"
													style={{
														backgroundColor:
															"color-mix(in srgb, var(--vscode-input-background), black 20%)",
													}}>
													<div
														className="h-full transition-all duration-300"
														style={{
															width: `${pct}%`,
															backgroundColor:
																pct >= 80
																	? "var(--vscode-errorForeground)"
																	: pct > 50
																		? "var(--vscode-editorWarning-foreground)"
																		: "var(--vscode-descriptionForeground)",
														}}
													/>
												</div>
												<div className="text-[10px] text-[var(--vscode-descriptionForeground)]">
													Resets {relative}
												</div>
											</div>
										)
									})}
								<WeeklyResetButton
									plan={profileData?.plan}
									availability={profileData?.weeklyReset}
									isResetting={isResettingWeekly}
									error={weeklyResetError}
									onReset={handleWeeklyReset}
								/>
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
				models={availableModels}
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
