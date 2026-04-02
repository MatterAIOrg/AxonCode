import { HTMLAttributes } from "react"
import { useAppTranslation } from "@/i18n/TranslationContext"

import type { Language } from "@roo-code/types"

import { LANGUAGES } from "@roo/language"

import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@src/components/ui"

import { SetCachedStateField } from "./types"
import { SettingsCard, SettingsRow } from "./ui/SettingsCard"
import { cn } from "@/lib/utils"

type LanguageSettingsProps = HTMLAttributes<HTMLDivElement> & {
	language: string
	setCachedStateField: SetCachedStateField<"language">
}

// forked_change start: sort languages
function getSortedLanguages() {
	return Object.entries(LANGUAGES).toSorted((a, b) => a[0].localeCompare(b[0]))
}
// forked_change end

export const LanguageSettings = ({ language, setCachedStateField, className, ...props }: LanguageSettingsProps) => {
	const { t } = useAppTranslation()

	return (
		<div className={cn("flex flex-col gap-2", className)} {...props}>
			<SettingsCard>
				<SettingsRow title="Language" description="Choose your preferred language for the interface.">
					<Select
						value={language}
						onValueChange={(value) => setCachedStateField("language", value as Language)}>
						<SelectTrigger className="w-[180px]">
							<SelectValue placeholder={t("settings:common.select")} />
						</SelectTrigger>
						<SelectContent>
							<SelectGroup>
								{/* kilocode_change: sort languages */}
								{getSortedLanguages().map(([code, name]) => (
									<SelectItem key={code} value={code}>
										{name}
										<span className="text-muted-foreground">({code})</span>
									</SelectItem>
								))}
							</SelectGroup>
						</SelectContent>
					</Select>
				</SettingsRow>
			</SettingsCard>
		</div>
	)
}
