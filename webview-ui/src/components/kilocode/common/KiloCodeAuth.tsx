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

	const features = [
		{ icon: "codicon-rocket", label: t("kilocode:welcome.features.build") },
		{ icon: "codicon-bug", label: t("kilocode:welcome.features.debug") },
		{ icon: "codicon-shield", label: t("kilocode:welcome.features.review") },
	]

	return (
		<div className={`flex w-full flex-col items-center px-5 py-6 text-center ${className}`}>
			{/* Eyebrow badge */}
			<span className="mb-6 inline-flex items-center gap-1.5 rounded-full border border-vscode-panel-border bg-vscode-textCodeBlock-background px-3 py-1 text-[10px] font-mono uppercase tracking-[0.15em] text-vscode-descriptionForeground">
				<span
					className="codicon codicon-sparkle text-[11px]!"
					style={{ color: "var(--vscode-textLink-foreground)" }}
				/>
				{t("kilocode:welcome.badge")}
			</span>

			{/* Logo with subtle theme-colored glow */}
			<div className="relative mb-5 flex items-center justify-center">
				<div
					aria-hidden
					className="pointer-events-none absolute size-24 rounded-full opacity-25 blur-2xl"
					style={{ background: "var(--vscode-focusBorder)" }}
				/>
				<Logo width={56} height={56} />
			</div>

			{/* Headline + brand */}
			<h1 className="m-0 text-2xl font-bold leading-tight tracking-tight text-vscode-foreground">
				{t("kilocode:welcome.greeting")}
			</h1>
			<p className="mb-5 mt-1.5 text-sm text-vscode-descriptionForeground">{t("kilocode:welcome.brand")}</p>

			{/* Intro */}
			<p className="m-0 mb-6 max-w-[320px] text-[13px] leading-relaxed text-vscode-descriptionForeground">
				{t("kilocode:welcome.intro")}
			</p>

			{/* Feature list */}
			<div className="mb-6 flex w-full max-w-[300px] flex-col gap-2 text-left">
				{features.map((feature) => (
					<div
						key={feature.icon}
						className="flex items-center gap-3 rounded-lg border border-vscode-panel-border bg-vscode-editor-background px-3 py-2.5">
						<span
							className="flex size-7 shrink-0 items-center justify-center rounded-md bg-vscode-textCodeBlock-background"
							style={{ color: "var(--vscode-textLink-foreground)" }}>
							<span className={`codicon ${feature.icon} text-sm!`} />
						</span>
						<span className="text-[13px] text-vscode-foreground">{feature.label}</span>
					</div>
				))}
			</div>

			{/* CTA Buttons */}
			<div className="flex w-full max-w-[300px] flex-col gap-2.5">
				<VSCodeButtonLink
					appearance="primary"
					href={getKiloCodeBackendSignUpUrl(uriScheme, uiKind, kiloCodeWrapperProperties)}
					onClick={() => {
						if (uiKind === "Web" && onManualConfigClick) {
							onManualConfigClick()
						}
					}}
					style={{ width: "100%" }}>
					{t("kilocode:welcome.ctaButton")}
				</VSCodeButtonLink>

				<VSCodeButtonLink appearance="secondary" href="https://matterai.so" style={{ width: "100%" }}>
					{t("kilocode:welcome.exploreMatterAI")}
				</VSCodeButtonLink>
			</div>

			{/* Credits note */}
			<p className="mt-4 text-xs text-vscode-descriptionForeground/70">{t("kilocode:welcome.creditsNote")}</p>

			{/* Manual API key option */}
			{onManualConfigClick && (
				<button
					type="button"
					onClick={onManualConfigClick}
					className="mt-3 cursor-pointer border-none bg-transparent text-xs text-vscode-descriptionForeground underline-offset-2 transition-colors hover:text-vscode-foreground hover:underline">
					{t("kilocode:welcome.manualModeButton")}
				</button>
			)}
		</div>
	)
}

export default KiloCodeAuth
