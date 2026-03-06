import { memo } from "react"

import { vscode } from "@src/utils/vscode"
import { useAppTranslation } from "@src/i18n/TranslationContext"

// import { useTaskSearch } from "./useTaskSearch" // kilocode_change
import TaskItem from "./TaskItem"
import { useTaskHistory } from "@/kilocode/hooks/useTaskHistory"

const HistoryPreview = ({ taskHistoryVersion }: { taskHistoryVersion: number } /*kilocode_change*/) => {
	// forked_change start
	const { data } = useTaskHistory(
		{
			workspace: "current",
			sort: "newest",
			favoritesOnly: false,
			pageIndex: 0,
		},
		taskHistoryVersion,
	)
	const tasks = data?.historyItems ?? []
	// forked_change end
	const { t } = useAppTranslation()

	const handleViewAllHistory = () => {
		vscode.postMessage({ type: "switchTab", tab: "history" })
	}

	return (
		<div className="flex flex-col gap-1">
			{tasks.length !== 0 && (
				<>
					{tasks.slice(0, 3).map((item) => (
						<TaskItem key={item.id} item={item} variant="compact" />
					))}
					<div className="ml-3 mt-1">
						<button
							onClick={handleViewAllHistory}
							className="text-base opacity-50 text-vscode-descriptionForeground hover:text-[var(--vscode-button-background)] transition-colors cursor-pointer text-center"
							aria-label={t("history:viewAllHistory")}>
							{t("history:viewAllHistory")}
						</button>
					</div>
				</>
			)}
		</div>
	)
}

export default memo(HistoryPreview)
