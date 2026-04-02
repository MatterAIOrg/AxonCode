import { useAppTranslation } from "@/i18n/TranslationContext"
import { SettingsRow, SettingsSwitch } from "./ui/SettingsCard"

interface ExperimentalFeatureProps {
	enabled: boolean
	onChange: (value: boolean) => void
	// Additional property to identify the experiment
	experimentKey?: string
}

export const ExperimentalFeature = ({ enabled, onChange, experimentKey }: ExperimentalFeatureProps) => {
	const { t } = useAppTranslation()

	// Generate translation keys based on experiment key
	const nameKey = experimentKey ? `settings:experimental.${experimentKey}.name` : ""
	const descriptionKey = experimentKey ? `settings:experimental.${experimentKey}.description` : ""

	return (
		<SettingsRow title={t(nameKey)} description={t(descriptionKey)}>
			<SettingsSwitch checked={enabled} onChange={onChange} />
		</SettingsRow>
	)
}
