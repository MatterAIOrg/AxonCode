import { ClipboardCopy } from "lucide-react"
import { useCallback, useEffect, useState } from "react"

import { StandardTooltip } from "@/components/ui"

import { SuggestionItem } from "@roo-code/types"
import { useExtensionState } from "@src/context/ExtensionStateContext"
import { useAppTranslation } from "@src/i18n/TranslationContext"

const DEFAULT_FOLLOWUP_TIMEOUT_MS = 60000
const COUNTDOWN_INTERVAL_MS = 1000

interface FollowUpSuggestProps {
	suggestions?: SuggestionItem[]
	onSuggestionClick?: (suggestion: SuggestionItem, event?: React.MouseEvent) => void
	ts: number
	onCancelAutoApproval?: () => void
	isAnswered?: boolean
}

export const FollowUpSuggest = ({
	suggestions = [],
	onSuggestionClick,
	ts = 1,
	onCancelAutoApproval,
	isAnswered = false,
}: FollowUpSuggestProps) => {
	const { autoApprovalEnabled, alwaysAllowFollowupQuestions, followupAutoApproveTimeoutMs } = useExtensionState()
	const [countdown, setCountdown] = useState<number | null>(null)
	const [suggestionSelected, setSuggestionSelected] = useState(false)
	const { t } = useAppTranslation()

	// Start countdown timer when auto-approval is enabled for follow-up questions
	useEffect(() => {
		// Only start countdown if auto-approval is enabled for follow-up questions and no suggestion has been selected
		// Also stop countdown if the question has been answered
		if (
			autoApprovalEnabled &&
			alwaysAllowFollowupQuestions &&
			suggestions.length > 0 &&
			!suggestionSelected &&
			!isAnswered
		) {
			// Start with the configured timeout in seconds
			const timeoutMs =
				typeof followupAutoApproveTimeoutMs === "number" && !isNaN(followupAutoApproveTimeoutMs)
					? followupAutoApproveTimeoutMs
					: DEFAULT_FOLLOWUP_TIMEOUT_MS

			// Convert milliseconds to seconds for the countdown
			setCountdown(Math.floor(timeoutMs / 1000))

			// Update countdown every second
			const intervalId = setInterval(() => {
				setCountdown((prevCountdown) => {
					if (prevCountdown === null || prevCountdown <= 1) {
						clearInterval(intervalId)
						return null
					}
					return prevCountdown - 1
				})
			}, COUNTDOWN_INTERVAL_MS)

			// Clean up interval on unmount and notify parent component
			return () => {
				clearInterval(intervalId)
				// Notify parent component that this component is unmounting
				// so it can clear any related timeouts
				onCancelAutoApproval?.()
			}
		} else {
			setCountdown(null)
		}
	}, [
		autoApprovalEnabled,
		alwaysAllowFollowupQuestions,
		suggestions,
		followupAutoApproveTimeoutMs,
		suggestionSelected,
		onCancelAutoApproval,
		isAnswered,
	])
	const handleSuggestionClick = useCallback(
		(suggestion: SuggestionItem, event: React.MouseEvent) => {
			// Mark a suggestion as selected if it's not a shift-click (which just copies to input)
			if (!event.shiftKey) {
				setSuggestionSelected(true)
				// Also notify parent component to cancel auto-approval timeout
				// This prevents race conditions between visual countdown and actual timeout
				onCancelAutoApproval?.()
			}

			// Pass the suggestion object to the parent component
			// The parent component will handle mode switching if needed
			onSuggestionClick?.(suggestion, event)
		},
		[onSuggestionClick, onCancelAutoApproval],
	)

	// Don't render if there are no suggestions or no click handler.
	if (!suggestions?.length || !onSuggestionClick) {
		return null
	}

	return (
		<div className="flex flex-col gap-1 mt-2">
			{suggestions.map((suggestion, index) => {
				const isFirstSuggestion = index === 0

				return (
					<div
						key={`${suggestion.answer}-${ts}`}
						className="flex items-center gap-2 p-2 rounded-lg hover:bg-vscode-list-hoverBackground group cursor-pointer transition-colors group"
						onClick={(event) => handleSuggestionClick(suggestion, event)}>
						<div className="flex-shrink-0 w-6 h-6 bg-vscode-button-background/20 group-hover:bg-vscode-button-background/40 rounded flex items-center justify-center text-xs text-vscode-badge-foreground font-medium">
							{index + 1}
						</div>
						<div className="flex-1 text-md text-vscode-foreground/70 group-hover:text-vscode-foreground whitespace-normal break-words">
							{suggestion.answer}
							{isFirstSuggestion && countdown !== null && !suggestionSelected && !isAnswered && (
								<span
									className="ml-2 px-1.5 py-0.5 text-xs rounded-full bg-vscode-badge-background text-vscode-badge-foreground"
									title={t("chat:followUpSuggest.autoSelectCountdown", { count: countdown })}>
									{t("chat:followUpSuggest.countdownDisplay", { count: countdown })}
								</span>
							)}
						</div>
						<StandardTooltip content={t("chat:followUpSuggest.copyToInput")}>
							<div
								className="flex-shrink-0 cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity"
								onClick={(e) => {
									e.stopPropagation()
									setSuggestionSelected(true)
									onCancelAutoApproval?.()
									onSuggestionClick?.(suggestion, { ...e, shiftKey: true })
								}}>
								<ClipboardCopy className="w-4 text-vscode-descriptionForeground" />
							</div>
						</StandardTooltip>
					</div>
				)
			})}
		</div>
	)
}
