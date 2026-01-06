// kilocode_change: new file
import { memo, useRef, useState } from "react"

import type { ClineMessage } from "@roo-code/types"

import { useSelectedModel } from "@/components/ui/hooks/useSelectedModel"
import { useExtensionState } from "@src/context/ExtensionStateContext"
import { cn } from "@src/lib/utils"

import Thumbnails from "../common/Thumbnails"
import { ReadOnlyChatText } from "../chat/ReadOnlyChatText"

import { TodoListDisplay } from "../chat/TodoListDisplay"

export interface TaskHeaderProps {
	task: ClineMessage
	tokensIn: number
	tokensOut: number
	cacheWrites?: number
	cacheReads?: number
	totalCost: number
	contextTokens: number
	// buttonsDisabled: boolean
	handleCondenseContext: (taskId: string) => void
	onClose: () => void
	groupedMessages: (ClineMessage | ClineMessage[])[]
	onMessageClick?: (index: number) => void
	isTaskActive?: boolean
	todos?: any[]
}

const KiloTaskHeader = ({
	task,
	// tokensIn,
	// tokensOut,
	// cacheWrites,
	// cacheReads,
	// totalCost,
	// contextTokens,
	// buttonsDisabled,
	// handleCondenseContext,
	// onClose,
	// groupedMessages,
	// onMessageClick,
	// isTaskActive = false,
	todos,
}: TaskHeaderProps) => {
	// const { t } = useTranslation()
	// const { showTaskTimeline } = useExtensionState()
	const { apiConfiguration } = useExtensionState()
	const { info: model } = useSelectedModel(apiConfiguration)
	const [isTaskExpanded, setIsTaskExpanded] = useState(false)

	const textContainerRef = useRef<HTMLDivElement>(null)
	const textRef = useRef<HTMLDivElement>(null)
	const contextWindow = model?.contextWindow || 1

	// const { width: windowWidth } = useWindowSize()

	// const condenseButton = (
	// 	<StandardTooltip content={t("chat:task.condenseContext")}>
	// 		<button
	// 			disabled={buttonsDisabled}
	// 			onClick={() => currentTaskItem && handleCondenseContext(currentTaskItem.id)}
	// 			className="shrink-0 min-h-[20px] min-w-[20px] p-[2px] cursor-pointer disabled:cursor-not-allowed opacity-85 hover:opacity-100 bg-transparent border-none rounded-md">
	// 			<FoldVertical size={16} />
	// 		</button>
	// 	</StandardTooltip>
	// )

	// const hasTodos = todos && Array.isArray(todos) && todos.length > 0

	return (
		<div className="px-3">
			<div
				className={cn(
					"p-2.5 flex flex-col relative z-1 border",
					"rounded-lg",
					"border border-[var(--color-matterai-border)] outline-none",
				)}
				style={{
					boxShadow:
						"0 4px 6px -1px rgba(0, 0, 0, 80%), 0 2px 4px -1px rgba(0, 0, 0, 0.06), 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)",
					backgroundColor: "var(--vscode-editor-background)",
					position: "relative",
					zIndex: 1,
				}}>
				<div className="flex justify-between items-center gap-2">
					<div
						className="flex items-center cursor-pointer -ml-0.5 select-none grow min-w-0"
						onClick={() => setIsTaskExpanded(!isTaskExpanded)}>
						<div className="flex items-center shrink-0">
							<span className={`codicon codicon-chevron-${isTaskExpanded ? "down" : "right"}`}></span>
						</div>
						<div className="ml-1.5 grow min-w-0">
							{/* <span className="font-bold">
								{t("chat:task.title")}
								{!isTaskExpanded && ":"}
							</span> */}
							{!isTaskExpanded && (
								<div
									style={{
										marginLeft: 4,
										display: "-webkit-box",
										WebkitLineClamp: 2,
										WebkitBoxOrient: "vertical",
										overflow: "hidden",
										textOverflow: "ellipsis",
									}}>
									<ReadOnlyChatText value={task.text || ""} />
								</div>
							)}
						</div>
					</div>
					{/* <StandardTooltip content={t("chat:task.closeAndStart")}>
						<Button variant="ghost" size="icon" onClick={onClose} className="shrink-0 w-5 h-5">
							<span className="codicon codicon-close" />
						</Button>
					</StandardTooltip> */}
				</div>
				{/* Collapsed state: Track context and cost if we have any */}
				{!isTaskExpanded && contextWindow > 0 && (
					<div className={`w-full flex flex-col gap-1 h-auto`}>
						{/* {showTaskTimeline && (
							<TaskTimeline
								groupedMessages={groupedMessages}
								onMessageClick={onMessageClick}
								isTaskActive={isTaskActive}
							/>
						)} */}

						{/* <div className="flex flex-row items-center gap-1">
							<ContextWindowProgress
								contextWindow={contextWindow}
								contextTokens={contextTokens || 0}
								maxTokens={
									model
										? getModelMaxOutputTokens({ modelId, model, settings: apiConfiguration })
										: undefined
								}
							/>
							{condenseButton}
							<ShareButton item={currentTaskItem} disabled={buttonsDisabled} />
							{!!totalCost && <span>${totalCost.toFixed(2)}</span>}
						</div> */}
					</div>
				)}
				{/* Expanded state: Show task text and images */}
				{isTaskExpanded && (
					<>
						<div
							ref={textContainerRef}
							className="-mt-0.5 text-vscode-font-size overflow-y-auto break-words break-anywhere relative">
							<div
								ref={textRef}
								className="overflow-auto max-h-80 whitespace-pre-wrap break-words break-anywhere"
								style={{
									display: "-webkit-box",
									WebkitLineClamp: "unset",
									WebkitBoxOrient: "vertical",
								}}>
								<ReadOnlyChatText value={task.text || ""} />
							</div>
						</div>
						{task.images && task.images.length > 0 && <Thumbnails images={task.images} />}

						{/* {showTaskTimeline && (
							<TaskTimeline
								groupedMessages={groupedMessages}
								onMessageClick={onMessageClick}
								isTaskActive={isTaskActive}
							/>
						)} */}

						{/* <div className="flex flex-col gap-1">
							{isTaskExpanded && contextWindow > 0 && (
								<div
									className={`w-full flex ${windowWidth < 400 ? "flex-col" : "flex-row"} gap-1 h-auto`}>
									<div className="flex items-center gap-1 flex-shrink-0">
										<span className="font-bold" data-testid="context-window-label">
											{t("chat:task.contextWindow")}
										</span>
									</div>
									<ContextWindowProgress
										contextWindow={contextWindow}
										contextTokens={contextTokens || 0}
										maxTokens={
											model
												? getModelMaxOutputTokens({
													modelId,
													model,
													settings: apiConfiguration,
												})
												: undefined
										}
									/>
									{condenseButton}
								</div>
							)}
							<div className="flex justify-between items-center h-[20px]">
								<div className="flex items-center gap-1 flex-wrap">
									<span className="font-bold">{t("chat:task.tokens")}</span>
									{typeof tokensIn === "number" && tokensIn > 0 && (
										<span className="flex items-center gap-0.5">
											<i className="codicon codicon-arrow-up text-xs font-bold" />
											{formatLargeNumber(tokensIn)}
										</span>
									)}
									{typeof tokensOut === "number" && tokensOut > 0 && (
										<span className="flex items-center gap-0.5">
											<i className="codicon codicon-arrow-down text-xs font-bold" />
											{formatLargeNumber(tokensOut)}
										</span>
									)}
								</div>
								{!totalCost && <TaskActions item={currentTaskItem} buttonsDisabled={buttonsDisabled} />}
							</div>

							{((typeof cacheReads === "number" && cacheReads > 0) ||
								(typeof cacheWrites === "number" && cacheWrites > 0)) && (
									<div className="flex items-center gap-1 flex-wrap h-[20px]">
										<span className="font-bold">{t("chat:task.cache")}</span>
										{typeof cacheWrites === "number" && cacheWrites > 0 && (
											<span className="flex items-center gap-0.5">
												<CloudUpload size={16} />
												{formatLargeNumber(cacheWrites)}
											</span>
										)}
										{typeof cacheReads === "number" && cacheReads > 0 && (
											<span className="flex items-center gap-0.5">
												<CloudDownload size={16} />
												{formatLargeNumber(cacheReads)}
											</span>
										)}
									</div>
								)}

							{!!totalCost && (
								<div className="flex justify-between items-center h-[20px]">
									<div className="flex items-center gap-1">
										<span className="font-bold">{t("chat:task.apiCost")}</span>
										<span>${totalCost?.toFixed(2)}</span>
									</div>
									<TaskActions item={currentTaskItem} buttonsDisabled={buttonsDisabled} />
								</div>
							)}
						</div> */}
					</>
				)}
			</div>
			<TodoListDisplay todos={todos ?? (task as any)?.tool?.todos ?? []} />
		</div>
	)
}

export default memo(KiloTaskHeader)
