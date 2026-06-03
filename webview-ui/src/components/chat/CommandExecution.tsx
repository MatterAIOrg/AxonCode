import { ChevronDown, ChevronUp, CornerDownLeft, OctagonX } from "lucide-react"
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useEvent } from "react-use"

import { CommandExecutionStatus, commandExecutionStatusSchema } from "@roo-code/types"

import { ExtensionMessage } from "@roo/ExtensionMessage"
import { safeJsonParse } from "@roo/safeJsonParse"

import { COMMAND_OUTPUT_STRING } from "@roo/combineCommandSequences"

import { Button, StandardTooltip } from "@src/components/ui"
import { ImageAttachment } from "@src/components/common/Thumbnails"
import { useExtensionState } from "@src/context/ExtensionStateContext"
import { cn } from "@src/lib/utils"
import { vscode } from "@src/utils/vscode"
import { t } from "i18next"
import { extractPatternsFromCommand } from "../../utils/command-parser"
import { parseCommand } from "../../utils/command-validation"
import CodeBlock from "../kilocode/common/CodeBlock" // kilocode_change
import { CommandPatternSelector } from "./CommandPatternSelector"
import { VSCodeButton } from "@vscode/webview-ui-toolkit/react"

interface CommandPattern {
	pattern: string
	description?: string
}

interface CommandExecutionProps {
	executionId: string
	text?: string
	icon?: JSX.Element | null
	title?: JSX.Element | null
	// Button props for command ask
	onPrimaryButtonClick?: (text?: string, images?: ImageAttachment[]) => void
	onSecondaryButtonClick?: (text?: string, images?: ImageAttachment[]) => void
	onRunEverythingClick?: () => void
	enableButtons?: boolean
	primaryButtonText?: string
	secondaryButtonText?: string
}

type ApprovalOption = "yes" | "yes_always" | "no_feedback"

interface ApprovalOptionDef {
	key: ApprovalOption
	label: string
	shortLabel: string
}

const APPROVAL_OPTIONS: ApprovalOptionDef[] = [
	{ key: "yes", label: "Yes", shortLabel: "Yes" },
	{ key: "yes_always", label: "Yes, and don't ask again for this command", shortLabel: "Yes, don't ask again" },
	{ key: "no_feedback", label: "No, and tell Orbital the next step", shortLabel: "No, with feedback" },
]

export const CommandExecution = memo(
	({
		executionId,
		text,
		icon,
		title,
		onPrimaryButtonClick,
		onSecondaryButtonClick,
		onRunEverythingClick,
		enableButtons,
		primaryButtonText,
		secondaryButtonText,
	}: CommandExecutionProps) => {
		const {
			terminalShellIntegrationDisabled = true, // kilocode_change: default
			allowedCommands = [],
			deniedCommands = [],
			setAllowedCommands,
			setDeniedCommands,
		} = useExtensionState()

		const {
			message: customMessage,
			command,
			output: parsedOutput,
		} = useMemo(() => parseCommandAndOutput(text), [text])

		// Approval mode state
		const [selectedOption, setSelectedOption] = useState<ApprovalOption>("yes")
		const [feedbackText, setFeedbackText] = useState("")
		const [isExpanded, setIsExpanded] = useState(terminalShellIntegrationDisabled)
		const [streamingOutput, setStreamingOutput] = useState("")
		const [status, setStatus] = useState<CommandExecutionStatus | null>(null)
		const [elapsedSeconds, setElapsedSeconds] = useState<number>(0)
		const [completedSeconds, setCompletedSeconds] = useState<number | null>(null)
		const startTimeRef = useRef<number | null>(null)

		const isApprovalMode = !!onPrimaryButtonClick && !!onSecondaryButtonClick && !!enableButtons && !status

		// The command's output can either come from the text associated with the
		// task message (this is the case for completed commands) or from the
		// streaming output (this is the case for running commands).
		const output = streamingOutput || parsedOutput

		// Extract command patterns from the actual command that was executed
		const commandPatterns = useMemo<CommandPattern[]>(() => {
			const allCommands = parseCommand(command)
			const allPatterns = new Set<string>()

			allCommands.forEach((cmd) => {
				if (cmd.trim()) {
					allPatterns.add(cmd.trim())
				}
			})

			allCommands.forEach((cmd) => {
				const patterns = extractPatternsFromCommand(cmd)
				patterns.forEach((pattern) => allPatterns.add(pattern))
			})

			return Array.from(allPatterns).map((pattern) => ({
				pattern,
			}))
		}, [command])

		// Handle pattern changes
		const handleAllowPatternChange = (pattern: string) => {
			const isAllowed = allowedCommands.includes(pattern)
			const newAllowed = isAllowed ? allowedCommands.filter((p) => p !== pattern) : [...allowedCommands, pattern]
			const newDenied = deniedCommands.filter((p) => p !== pattern)

			setAllowedCommands(newAllowed)
			setDeniedCommands(newDenied)
			vscode.postMessage({ type: "allowedCommands", commands: newAllowed })
			vscode.postMessage({ type: "deniedCommands", commands: newDenied })
		}

		const handleDenyPatternChange = (pattern: string) => {
			const isDenied = deniedCommands.includes(pattern)
			const newDenied = isDenied ? deniedCommands.filter((p) => p !== pattern) : [...deniedCommands, pattern]
			const newAllowed = allowedCommands.filter((p) => p !== pattern)

			setAllowedCommands(newAllowed)
			setDeniedCommands(newDenied)
			vscode.postMessage({ type: "allowedCommands", commands: newAllowed })
			vscode.postMessage({ type: "deniedCommands", commands: newDenied })
		}

		const onMessage = useCallback(
			(event: MessageEvent) => {
				const message: ExtensionMessage = event.data

				if (message.type === "commandExecutionStatus") {
					const result = commandExecutionStatusSchema.safeParse(safeJsonParse(message.text, {}))

					if (result.success) {
						const data = result.data

						if (data.executionId !== executionId) {
							return
						}

						switch (data.status) {
							case "started":
								startTimeRef.current = data.startTime ?? null
								setStatus(data)
								break
							case "output":
								setStreamingOutput(data.output)
								break
							case "fallback":
								setIsExpanded(true)
								break
							default:
								setStatus(data)
								break
						}
					}
				}
			},
			[executionId],
		)

		useEvent("message", onMessage)

		// Timer effect for showing "Running for X seconds"
		useEffect(() => {
			if (status?.status === "started" && startTimeRef.current) {
				const startTime = startTimeRef.current

				const interval = setInterval(() => {
					const elapsed = Math.floor((Date.now() - startTime) / 1000)
					setElapsedSeconds(elapsed)
				}, 1000)

				setElapsedSeconds(Math.floor((Date.now() - startTime) / 1000))

				return () => clearInterval(interval)
			}
		}, [status])

		// Calculate final duration when command completes
		useEffect(() => {
			if (status?.status === "exited" && startTimeRef.current) {
				const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000)
				setCompletedSeconds(elapsed)
			}
		}, [status])

		// Handle Submit button click based on selected option
		const handleSubmit = useCallback(() => {
			if (!onPrimaryButtonClick || !onSecondaryButtonClick) return

			switch (selectedOption) {
				case "yes":
					onPrimaryButtonClick()
					break
				case "yes_always":
					// Add the command pattern to allowedCommands before approving
					if (command && command.trim()) {
						const pattern = command.trim()
						if (!allowedCommands.includes(pattern)) {
							const newAllowed = [...allowedCommands, pattern]
							setAllowedCommands(newAllowed)
							vscode.postMessage({ type: "allowedCommands", commands: newAllowed })
						}
					}
					onPrimaryButtonClick()
					break
				case "no_feedback":
					onSecondaryButtonClick(feedbackText || undefined)
					break
			}
		}, [
			selectedOption,
			onPrimaryButtonClick,
			onSecondaryButtonClick,
			command,
			allowedCommands,
			setAllowedCommands,
			feedbackText,
		])

		// Handle Skip button click
		const handleSkip = useCallback(() => {
			if (onSecondaryButtonClick) {
				onSecondaryButtonClick()
			}
		}, [onSecondaryButtonClick])

		// Keyboard navigation for approval options
		useEffect(() => {
			if (!isApprovalMode) return

			const handleKeyDown = (e: KeyboardEvent) => {
				const currentIndex = APPROVAL_OPTIONS.findIndex((o) => o.key === selectedOption)

				switch (e.key) {
					case "ArrowUp":
						e.preventDefault()
						if (currentIndex > 0) {
							setSelectedOption(APPROVAL_OPTIONS[currentIndex - 1].key)
						}
						break
					case "ArrowDown":
						e.preventDefault()
						if (currentIndex < APPROVAL_OPTIONS.length - 1) {
							setSelectedOption(APPROVAL_OPTIONS[currentIndex + 1].key)
						}
						break
					case "Enter":
						e.preventDefault()
						handleSubmit()
						break
					case "Escape":
						e.preventDefault()
						handleSkip()
						break
				}
			}

			window.addEventListener("keydown", handleKeyDown)
			return () => window.removeEventListener("keydown", handleKeyDown)
		}, [isApprovalMode, selectedOption, handleSubmit, handleSkip])

		// Render approval mode UI
		if (isApprovalMode) {
			return (
				<div className="bg-vscode-editor-background border border-vscode-border rounded-2xl overflow-hidden mb-1">
					{/* Header: custom message */}
					{customMessage && (
						<div className="px-3">
							<p className="text-sm font-bold text-vscode-foreground leading-relaxed">{customMessage}</p>
						</div>
					)}

					{/* Code block with command */}
					<div className="px-2 pb-2">
						<div className="bg-[var(--vscode-input-background)] border border-[var(--vscode-input-border)] rounded-lg overflow-hidden">
							<div className="relative">
								<div className="px-2 py-2 pr-10">
									<code className="text-xs font-mono text-vscode-foreground whitespace-pre-wrap break-all">
										{command}
									</code>
								</div>
								{/* Expand button */}
								<button
									className="absolute bottom-1 right-1 p-1 rounded-md hover:bg-[var(--vscode-toolbar-hoverBackground)] text-vscode-foreground opacity-50 hover:opacity-100 transition-opacity"
									onClick={() => setIsExpanded(!isExpanded)}
									title={isExpanded ? "Collapse" : "Expand"}>
									{isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
								</button>
							</div>
						</div>
					</div>

					{/* Numbered options */}
					<div className="px-2 pb-3">
						<div className="space-y-1">
							{APPROVAL_OPTIONS.map((option, idx) => {
								const isSelected = selectedOption === option.key
								return (
									<button
										key={option.key}
										className={cn(
											"w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left text-sm transition-colors",
											isSelected
												? "bg-[var(--vscode-input-background)] text-[var(--vscode-list-activeSelectionForeground)]"
												: "hover:bg-[var(--vscode-list-hoverBackground)] text-vscode-foreground",
										)}
										onClick={() => {
											setSelectedOption(option.key)
											if (option.key === "no_feedback") {
												setFeedbackText("")
											}
										}}>
										{/* Option number */}
										<span className="shrink-0 text-xs font-medium text-[var(--vscode-descriptionForeground)]">
											{idx + 1}.
										</span>
										{/* Option label */}
										<span className="flex-1">{option.label}</span>
									</button>
								)
							})}

							{/* Feedback text area when "No with feedback" is selected */}
							{selectedOption === "no_feedback" && (
								<div className="mt-2">
									<input
										type="text"
										className="w-full bg-[var(--vscode-input-background)] border border-[var(--vscode-input-border)] rounded-lg px-3 py-2 text-xs text-vscode-foreground placeholder:text-vscode-descriptionForeground focus:outline-none focus:border-[var(--vscode-focusBorder)]"
										placeholder="your message..."
										value={feedbackText}
										onChange={(e) => setFeedbackText(e.target.value)}
										onClick={(e) => e.stopPropagation()}
									/>
								</div>
							)}
						</div>
					</div>

					{/* Footer: Skip + Submit */}
					<div className="px-4 pb-3 flex items-center justify-between">
						<button
							className="text-xs text-[var(--vscode-descriptionForeground)] hover:text-vscode-foreground transition-colors px-2 py-1 rounded hover:bg-[var(--vscode-toolbar-hoverBackground)]"
							onClick={handleSkip}>
							Skip
						</button>
						<button
							className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-medium bg-[var(--vscode-button-background)] text-[var(--vscode-button-foreground)] hover:bg-[var(--vscode-button-hoverBackground)] transition-colors"
							onClick={handleSubmit}>
							Submit
							<CornerDownLeft size={12} />
						</button>
					</div>
				</div>
			)
		}

		// Non-approval mode: existing running/completed UI
		return (
			<>
				<div className="flex flex-row items-center justify-between gap-2 mb-1">
					<div className="flex flex-row items-center gap-2">
						{/* Status display: running, completed, or initial */}
						{status?.status === "started" ? (
							<div className="flex flex-row items-center gap-2">
								<div className="rounded-full size-2 bg-green-500 animate-pulse" />
								<span className="font-medium">Running Command for {elapsedSeconds}s</span>
								{status.pid && (
									<span className="font-mono text-xs opacity-70">(PID: {status.pid})</span>
								)}
							</div>
						) : status?.status === "exited" ? (
							<div className="flex flex-row items-center gap-2">
								<span className="font-medium">Command</span>
								{completedSeconds !== null && (
									<span className="font-mono text-xs opacity-70 pt-0.5">
										Ran for {completedSeconds}s
									</span>
								)}
								<StandardTooltip
									content={t("chat.commandExecution.exitStatus", { exitStatus: status.exitCode })}>
									<div
										className={cn(
											"rounded-full size-2 mt-0.5",
											status.exitCode === 0 ? "bg-green-600" : "bg-red-600",
										)}
									/>
								</StandardTooltip>
							</div>
						) : (
							<>
								{icon}
								{title}
							</>
						)}
					</div>
					<div className="flex flex-row items-center justify-between gap-2 px-1">
						<div className="flex flex-row items-center gap-1">
							{/* Abort button when running */}
							{status?.status === "started" && (
								<StandardTooltip content={t("chat:commandExecution.abort")}>
									<Button
										variant="ghost"
										size="icon"
										onClick={() =>
											vscode.postMessage({
												type: "terminalOperation",
												terminalOperation: "abort",
											})
										}>
										<OctagonX className="size-4" />
									</Button>
								</StandardTooltip>
							)}

							{output.length > 0 && (
								<Button variant="ghost" size="icon" onClick={() => setIsExpanded(!isExpanded)}>
									<ChevronDown
										className={cn(
											"size-4 transition-transform duration-300",
											isExpanded && "rotate-180",
										)}
									/>
								</Button>
							)}
						</div>
					</div>
				</div>

				<div className="bg-vscode-editor-background border border-vscode-border rounded-2xl mt-2 overflow-hidden flex flex-col mb-1">
					<div className="p-2 overflow-y-auto max-h-[calc(100vh/2.5)]">
						<CodeBlock source={command} language="shell" />
						<OutputContainer isExpanded={isExpanded} output={output} />
					</div>
					{command && command.trim() && (
						<CommandPatternSelector
							patterns={commandPatterns}
							allowedCommands={allowedCommands}
							deniedCommands={deniedCommands}
							onAllowPatternChange={handleAllowPatternChange}
							onDenyPatternChange={handleDenyPatternChange}
						/>
					)}
				</div>
				{onPrimaryButtonClick && onSecondaryButtonClick && enableButtons && !isApprovalMode && (
					<div className="flex flex-row items-center justify-between gap-2 mt-2">
						{onRunEverythingClick && (
							<StandardTooltip content={t("chat:runEverything.tooltip")}>
								<VSCodeButton
									appearance="secondary"
									disabled={!enableButtons}
									onClick={() => onRunEverythingClick()}>
									{t("chat:runEverything.title")}
								</VSCodeButton>
							</StandardTooltip>
						)}
						<div className="flex flex-row items-center gap-2 ml-auto">
							<StandardTooltip content={primaryButtonText || t("chat:runCommand.tooltip")}>
								<VSCodeButton
									appearance="primary"
									disabled={!enableButtons}
									onClick={() => onPrimaryButtonClick && onPrimaryButtonClick()}>
									{primaryButtonText || t("chat:runCommand.title")}
								</VSCodeButton>
							</StandardTooltip>
							<StandardTooltip content={secondaryButtonText || t("chat:reject.tooltip")}>
								<VSCodeButton
									appearance="secondary"
									disabled={!enableButtons}
									onClick={() => onSecondaryButtonClick && onSecondaryButtonClick()}>
									{secondaryButtonText || t("chat:reject.title")}
								</VSCodeButton>
							</StandardTooltip>
						</div>
					</div>
				)}
			</>
		)
	},
)

CommandExecution.displayName = "CommandExecution"

const OutputContainerInternal = ({ isExpanded, output }: { isExpanded: boolean; output: string }) => (
	<div
		className={cn("overflow-hidden", {
			"max-h-0": !isExpanded,
			"mt-1 pt-1 border-t border-border/25": isExpanded,
		})}>
		{output.length > 0 && <CodeBlock source={output} language="log" />}
	</div>
)

const OutputContainer = memo(OutputContainerInternal)

const parseCommandAndOutput = (text: string | undefined) => {
	if (!text) {
		return { message: "", command: "", output: "" }
	}

	let message = ""
	let remaining = text

	// Check for message prefix: "MESSAGE:...\n---\ncommand"
	const messageSeparator = "\n---\n"
	if (remaining.startsWith("MESSAGE:")) {
		const separatorIdx = remaining.indexOf(messageSeparator)
		if (separatorIdx !== -1) {
			message = remaining.slice(8, separatorIdx) // after "MESSAGE:"
			remaining = remaining.slice(separatorIdx + messageSeparator.length)
		}
	}

	// Parse command and output
	const outputIdx = remaining.indexOf(COMMAND_OUTPUT_STRING)

	if (outputIdx === -1) {
		return { message, command: remaining, output: "" }
	}

	return {
		message,
		command: remaining.slice(0, outputIdx),
		output: remaining.slice(outputIdx + COMMAND_OUTPUT_STRING.length),
	}
}
