import React from "react"
import { VSCodeButtonLink } from "@/components/common/VSCodeButtonLink"
import { useExtensionState } from "@/context/ExtensionStateContext"
import { useAppTranslation } from "@/i18n/TranslationContext"
import { getKiloCodeBackendSignUpUrl } from "../helpers"
import Logo from "./Logo"

interface KiloCodeAuthProps {
	onManualConfigClick?: () => void
	className?: string
}

const KiloCodeAuth: React.FC<KiloCodeAuthProps> = ({ onManualConfigClick, className = "" }) => {
	const { uriScheme, uiKind, kiloCodeWrapperProperties } = useExtensionState()

	const { t } = useAppTranslation()

	return (
		<div
			className={`flex flex-col items-center justify-center ${className}`}
			style={{
				padding: "24px 20px",
				width: "100%",
			}}>
			{/* Logo Section */}
			<div style={{ marginBottom: "24px" }}>
				<Logo width={64} height={64} />
			</div>

			{/* Hero Title - matches matterai.so "ENGINEERING SUPER INTELLIGENCE" style */}
			<h1
				style={{
					margin: 0,
					padding: 0,
					fontSize: "28px",
					fontWeight: 700,
					letterSpacing: "-0.02em",
					lineHeight: 1.1,
					color: "var(--color-matterai-heading, #ffffff)",
					textAlign: "center",
					marginBottom: "8px",
				}}>
				{t("kilocode:welcome.greeting")}
			</h1>

			{/* Tagline - secondary heading style */}
			<h2
				style={{
					margin: 0,
					padding: 0,
					fontSize: "16px",
					fontWeight: 500,
					color: "var(--color-matterai-subheading, #a3a3a3)",
					textAlign: "center",
					marginBottom: "20px",
				}}>
				{t("kilocode:welcome.tagline")}
			</h2>

			{/* Description text - muted style */}
			<p
				style={{
					margin: 0,
					fontSize: "13px",
					lineHeight: 1.6,
					color: "var(--color-matterai-text-secondary, #737373)",
					textAlign: "center",
					marginBottom: "6px",
					maxWidth: "320px",
				}}>
				{t("kilocode:welcome.introText1")}
			</p>
			<p
				style={{
					margin: 0,
					fontSize: "13px",
					lineHeight: 1.6,
					color: "var(--color-matterai-text-secondary, #737373)",
					textAlign: "center",
					marginBottom: "28px",
					maxWidth: "320px",
				}}>
				{t("kilocode:welcome.introText2")}
			</p>

			{/* CTA Buttons - styled like matterai.so buttons */}
			<div
				style={{
					display: "flex",
					flexDirection: "column",
					gap: "12px",
					width: "100%",
					maxWidth: "280px",
				}}>
				{/* Primary CTA - matches "Download Orbital" button style */}
				<VSCodeButtonLink
					appearance="primary"
					href={getKiloCodeBackendSignUpUrl(uriScheme, uiKind, kiloCodeWrapperProperties)}
					onClick={() => {
						if (uiKind === "Web" && onManualConfigClick) {
							onManualConfigClick()
						}
					}}
					style={{
						width: "100%",
					}}>
					{t("kilocode:welcome.ctaButton")}
				</VSCodeButtonLink>

				{/* Secondary CTA - matches "Setup Code Reviews" button style */}
				<VSCodeButtonLink
					appearance="secondary"
					href="https://matterai.so"
					style={{
						width: "100%",
					}}>
					{t("kilocode:welcome.exploreMatterAI")}
				</VSCodeButtonLink>
			</div>
		</div>
	)
}

export default KiloCodeAuth
