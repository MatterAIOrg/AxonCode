import React from "react"
import { ButtonLink } from "./ButtonLink"
// import { ButtonSecondary } from "./ButtonSecondary"
import Logo from "./Logo"
import { useAppTranslation } from "@/i18n/TranslationContext"
import { getKiloCodeBackendSignUpUrl } from "../helpers"
import { useExtensionState } from "@/context/ExtensionStateContext"

interface KiloCodeAuthProps {
	onManualConfigClick?: () => void
	className?: string
}

const KiloCodeAuth: React.FC<KiloCodeAuthProps> = ({ onManualConfigClick, className = "" }) => {
	const { uriScheme, uiKind, kiloCodeWrapperProperties } = useExtensionState()

	const { t } = useAppTranslation()

	return (
		<div className={`flex flex-col items-start ${className}`}>
			<Logo />

			<h2 className="m-0 p-0 mb-1" style={{ color: "#c4fdff" }}>
				{t("kilocode:welcome.greeting")}
			</h2>
			<h3 className="m-0 p-0 mb-4" style={{ color: "#c4fdff" }}>
				{t("kilocode:welcome.tagline")}
			</h3>
			<p className="text-left mb-2" style={{ color: "#8bf4f7" }}>
				{t("kilocode:welcome.introText1")}
			</p>
			<p className="text-left mb-5" style={{ color: "#8bf4f7" }}>
				{t("kilocode:welcome.introText2")}
			</p>

			<div className="w-full flex flex-col gap-4">
				<ButtonLink
					href={getKiloCodeBackendSignUpUrl(uriScheme, uiKind, kiloCodeWrapperProperties)}
					onClick={() => {
						if (uiKind === "Web" && onManualConfigClick) {
							onManualConfigClick()
						}
					}}>
					{t("kilocode:welcome.ctaButton")}
				</ButtonLink>

				<ButtonLink href="https://matterai.so">{t("kilocode:welcome.exploreMatterAI")}</ButtonLink>

				{/* {!!onManualConfigClick && (
					<ButtonSecondary onClick={() => onManualConfigClick && onManualConfigClick()}>
						{t("kilocode:welcome.manualModeButton")}
					</ButtonSecondary>
				)} */}
			</div>
		</div>
	)
}

export default KiloCodeAuth
