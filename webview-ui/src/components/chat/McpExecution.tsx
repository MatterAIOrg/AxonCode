import { VSCodeButton } from "@vscode/webview-ui-toolkit/react"
import { ChevronDown, ChevronRight } from "lucide-react"
import { memo, useCallback, useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { useEvent } from "react-use"

import { McpExecutionStatus, mcpExecutionStatusSchema } from "@roo-code/types"
import { Button } from "@src/components/ui"
import { cn } from "@src/lib/utils"
import { vscode } from "@src/utils/vscode"
import { ClineAskUseMcpServer, ExtensionMessage } from "../../../../src/shared/ExtensionMessage"
import { safeJsonParse } from "../../../../src/shared/safeJsonParse"
import CodeBlock from "../kilocode/common/CodeBlock" // kilocode_change

interface McpExecutionProps {
	executionId: string
	text?: string
	serverName?: string
	toolName?: string
	isArguments?: boolean
	server?: {
		tools?: Array<{
			name: string
			description?: string
			alwaysAllow?: boolean
		}>
		source?: "global" | "project"
	}
	useMcpServer?: ClineAskUseMcpServer
	alwaysAllowMcp?: boolean
	initiallyExpanded?: boolean // kilocode_change: For Storybook stories only
}

export const McpExecution = ({
	executionId,
	text,
	serverName: initialServerName,
	toolName: initialToolName,
	isArguments = false,
	server,
	useMcpServer,
	alwaysAllowMcp = false,
	initiallyExpanded = false, // kilocode_change
}: McpExecutionProps) => {
	const { t } = useTranslation("mcp")

	// State for tracking MCP response status
	const [status, setStatus] = useState<McpExecutionStatus | null>(null)
	const [responseText, setResponseText] = useState(text || "")
	const [argumentsText, setArgumentsText] = useState(text || "")
	const [serverName, setServerName] = useState(initialServerName)
	const [toolName, setToolName] = useState(initialToolName)

	// kilocode_change: Main collapse state for the entire MCP execution content
	const [isResponseExpanded, setIsResponseExpanded] = useState(initiallyExpanded)

	// Try to parse JSON and return both the result and formatted text
	const tryParseJson = useCallback((text: string): { isJson: boolean; formatted: string } => {
		if (!text) return { isJson: false, formatted: "" }

		try {
			const parsed = JSON.parse(text)
			return {
				isJson: true,
				formatted: JSON.stringify(parsed, null, 2),
			}
		} catch {
			return {
				isJson: false,
				formatted: text,
			}
		}
	}, [])

	// kilocode_change: Only parse response data when main content is expanded AND complete to avoid parsing partial JSON
	const responseData = useMemo(() => {
		if (!isResponseExpanded) {
			return { isJson: false, formatted: responseText }
		}
		// Only try to parse JSON if the response is complete
		if (status && status.status === "completed") {
			return tryParseJson(responseText)
		}
		// For partial responses, just return as-is without parsing
		return { isJson: false, formatted: responseText }
	}, [responseText, isResponseExpanded, tryParseJson, status])

	// Only parse arguments data when complete to avoid parsing partial JSON
	const argumentsData = useMemo(() => {
		if (!argumentsText) {
			return { isJson: false, formatted: "" }
		}

		// For arguments, we don't have a streaming status, so we check if it looks like complete JSON
		const trimmed = argumentsText.trim()

		// Basic check for complete JSON structure
		if (
			trimmed &&
			((trimmed.startsWith("{") && trimmed.endsWith("}")) || (trimmed.startsWith("[") && trimmed.endsWith("]")))
		) {
			// Try to parse, but if it fails, return as-is
			try {
				const parsed = JSON.parse(trimmed)
				return {
					isJson: true,
					formatted: JSON.stringify(parsed, null, 2),
				}
			} catch {
				// JSON structure looks complete but is invalid, return as-is
				return { isJson: false, formatted: argumentsText }
			}
		}

		// For non-JSON or incomplete data, just return as-is
		return { isJson: false, formatted: argumentsText }
	}, [argumentsText])

	const formattedResponseText = responseData.formatted
	const formattedArgumentsText = argumentsData.formatted
	const responseIsJson = responseData.isJson

	// Get tool info
	const toolInfo = useMemo(() => {
		if (!useMcpServer?.toolName || !server?.tools) return null
		return server.tools.find((t) => t.name === useMcpServer.toolName)
	}, [useMcpServer?.toolName, server?.tools])

	const isAlwaysAllowed = toolInfo?.alwaysAllow ?? false

	// Handle allowlist toggle
	const handleAllowlistTool = useCallback(() => {
		if (!useMcpServer?.serverName || !useMcpServer?.toolName) return
		vscode.postMessage({
			type: "toggleToolAlwaysAllow",
			serverName: useMcpServer.serverName,
			source: server?.source || "global",
			toolName: useMcpServer.toolName,
			alwaysAllow: !isAlwaysAllowed,
		})
	}, [useMcpServer?.serverName, useMcpServer?.toolName, server?.source, isAlwaysAllowed])

	// Parse arguments for display
	const parsedArgs = useMemo(() => {
		if (!formattedArgumentsText) return null
		try {
			return JSON.parse(formattedArgumentsText)
		} catch {
			return null
		}
	}, [formattedArgumentsText])

	const onToggleResponseExpand = useCallback(() => {
		setIsResponseExpanded(!isResponseExpanded)
	}, [isResponseExpanded])

	// Listen for MCP execution status messages
	const onMessage = useCallback(
		(event: MessageEvent) => {
			const message: ExtensionMessage = event.data

			if (message.type === "mcpExecutionStatus") {
				try {
					const result = mcpExecutionStatusSchema.safeParse(safeJsonParse(message.text || "{}", {}))

					if (result.success) {
						const data = result.data

						// Use executionId from useMcpServer if available, otherwise fall back to prop
						const effectiveExecutionId = useMcpServer?.executionId || executionId

						// Only update if this message is for our response
						if (data.executionId === effectiveExecutionId) {
							setStatus(data)

							if (data.status === "output" && data.response) {
								setResponseText((prev) => prev + data.response)
							} else if (data.status === "completed" && data.response) {
								setResponseText(data.response)
							}
						}
					}
				} catch (e) {
					console.error("Failed to parse MCP execution status", e)
				}
			}
		},
		[executionId, useMcpServer?.executionId],
	)

	useEvent("message", onMessage)

	// Initialize with text if provided and parse command/response sections
	useEffect(() => {
		// Handle arguments text - don't parse JSON here as it might be incomplete
		if (text) {
			setArgumentsText(text)
		}

		// Handle response text
		if (useMcpServer?.response) {
			setResponseText(useMcpServer.response)
		}

		if (initialServerName && initialServerName !== serverName) {
			setServerName(initialServerName)
		}

		if (initialToolName && initialToolName !== toolName) {
			setToolName(initialToolName)
		}
	}, [text, useMcpServer, initialServerName, initialToolName, serverName, toolName, isArguments])

	// For use_mcp_tool, render a flat card layout matching the design
	if (useMcpServer?.type === "use_mcp_tool") {
		return (
			<>
				{/* Title: Run {ToolName} in {ServerName} */}
				<div className="flex items-center gap-2 mb-1.5">
					<span className="text-vscode-foreground">
						Run {useMcpServer.toolName} in {useMcpServer.serverName}
					</span>
				</div>

				{/* Parameters display - dark inner box */}
				<div className="bg-vscode-input-background py-1.5 px-2 rounded-md flex flex-col gap-1">
					{parsedArgs && Object.keys(parsedArgs).length > 0 ? (
						Object.entries(parsedArgs).map(([key, value]) => (
							<div key={key} className="flex items-baseline gap-1">
								<span className="text-vscode-descriptionForeground text-sm shrink-0">{key}</span>
								<span className="text-vscode-foreground text-sm font-medium break-all">
									{typeof value === "string" ? value : JSON.stringify(value)}
								</span>
							</div>
						))
					) : (
						<span className="text-vscode-descriptionForeground text-sm">No arguments</span>
					)}
				</div>

				{/* Action bar - only show when pending (no status yet and no previous response) */}
				{!status && !useMcpServer?.response && (
					<div className="flex items-center justify-end mt-1">
						<div className="flex items-center gap-2">
							<span
								className="text-vscode-descriptionForeground hover:text-vscode-foreground text-sm cursor-pointer"
								onClick={() =>
									vscode.postMessage({ type: "askResponse", askResponse: "noButtonClicked" })
								}>
								Skip
							</span>
							{alwaysAllowMcp && !isAlwaysAllowed && (
								<VSCodeButton appearance="secondary" onClick={handleAllowlistTool}>
									{t("tool.allowlistTool")}
								</VSCodeButton>
							)}
							<VSCodeButton
								appearance="primary"
								onClick={() =>
									vscode.postMessage({ type: "askResponse", askResponse: "yesButtonClicked" })
								}>
								Run
							</VSCodeButton>
						</div>
					</div>
				)}

				{/* Status indicator - show after execution starts */}
				{status && (
					<div className="flex items-center gap-2 mt-2 text-xs font-mono">
						<div
							className={cn("rounded-full size-1.5", {
								"bg-lime-400": status.status === "started" || status.status === "completed",
								"bg-red-400": status.status === "error",
							})}
						/>
						<span
							className={cn({
								"text-vscode-foreground": status.status === "started" || status.status === "completed",
								"text-vscode-errorForeground": status.status === "error",
							})}>
							{status.status === "started"
								? t("execution.running")
								: status.status === "completed"
									? t("execution.completed")
									: t("execution.error")}
						</span>
						{status.status === "error" && "error" in status && status.error && (
							<span className="text-vscode-errorForeground">({status.error})</span>
						)}
					</div>
				)}

				{/* Response section */}
				<ResponseContainer
					isExpanded={true}
					response={formattedResponseText}
					isJson={responseIsJson}
					hasArguments={true}
					isPartial={status ? status.status !== "completed" : false}
				/>
			</>
		)
	}

	// For non-use_mcp_tool cases, keep the original collapsible layout
	return (
		<>
			<div
				className="flex flex-row items-center justify-between gap-2 mb-1 cursor-pointer select-none"
				onClick={onToggleResponseExpand}>
				<div className="flex flex-row items-center gap-1 flex-wrap">
					<div className="flex items-center gap-1 flex-wrap">
						{serverName && <span className="font-bold text-vscode-foreground">{serverName}</span>}
					</div>
				</div>
				<div className="flex flex-row items-center justify-between gap-2 px-1">
					<div className="flex flex-row items-center gap-1">
						{status && (
							<div className="flex flex-row items-center gap-2 font-mono text-xs">
								<div
									className={cn("rounded-full size-1.5", {
										"bg-lime-400": status.status === "started" || status.status === "completed",
										"bg-red-400": status.status === "error",
									})}
								/>
								<div
									className={cn("whitespace-nowrap", {
										"text-vscode-foreground":
											status.status === "started" || status.status === "completed",
										"text-vscode-errorForeground": status.status === "error",
									})}>
									{status.status === "started"
										? t("execution.running")
										: status.status === "completed"
											? t("execution.completed")
											: t("execution.error")}
								</div>
								{status.status === "error" && "error" in status && status.error && (
									<div className="whitespace-nowrap">({status.error})</div>
								)}
							</div>
						)}
					</div>
					<Button
						variant="ghost"
						size="icon"
						onClick={(e) => {
							e.stopPropagation()
							onToggleResponseExpand()
						}}>
						{!isResponseExpanded ? <ChevronRight className="size-4" /> : <ChevronDown className="size-4" />}
					</Button>
				</div>
			</div>

			<div className={cn("w-full", !isResponseExpanded && "hidden")}>
				{/* Arguments section */}
				{(isArguments || useMcpServer?.arguments || argumentsText) && (
					<div>
						<CodeBlock source={formattedArgumentsText} language="json" />
					</div>
				)}

				{/* Response section */}
				<ResponseContainer
					isExpanded={isResponseExpanded}
					response={formattedResponseText}
					isJson={responseIsJson}
					hasArguments={!!(isArguments || useMcpServer?.arguments || argumentsText)}
					isPartial={status ? status.status !== "completed" : false}
				/>
			</div>
		</>
	)
}

McpExecution.displayName = "McpExecution"

const ResponseContainerInternal = ({
	isExpanded,
	response,
	// isJson,
	// hasArguments,
	// isPartial = false,
}: {
	isExpanded: boolean
	response: string
	isJson: boolean
	hasArguments?: boolean
	isPartial?: boolean
}) => {
	// Only render content when expanded to prevent performance issues with large responses
	if (!isExpanded || response.length === 0) {
		return (
			<div
				className={cn("overflow-hidden", {
					"max-h-0": !isExpanded,
				})}
			/>
		)
	}
}

const ResponseContainer = memo(ResponseContainerInternal)
