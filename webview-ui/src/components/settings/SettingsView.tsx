import {
	AlertTriangle,
	Bell, // kilocode_change
	CheckCheck,
	CircleUserRound,
	GitPullRequest,
	Info,
	// Info, // kilocode_change: hidden for now
	Languages,
	LucideIcon,
	// Server, // kilocode_change: hidden for now
	SquareMousePointer,
	SquareTerminal,
	Webhook,
} from "lucide-react"
import React, {
	forwardRef,
	memo,
	useCallback,
	useEffect,
	useImperativeHandle,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
} from "react"

// kilocode_change
import { ensureBodyPointerEventsRestored } from "@/utils/fixPointerEvents"

import type { ProviderSettings, TelemetrySetting } from "@roo-code/types"

import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	Button,
	StandardTooltip,
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@src/components/ui"
import { ExtensionStateContextType, useExtensionState } from "@src/context/ExtensionStateContext"
import { useAppTranslation } from "@src/i18n/TranslationContext"
import { cn } from "@src/lib/utils"
import { vscode } from "@src/utils/vscode"

import { Tab, TabContent, TabHeader, TabList, TabTrigger } from "../common/Tab"
import { SectionHeader } from "./SectionHeader"
import { SetCachedStateField } from "./types"
// import ApiConfigManager from "./ApiConfigManager"
import deepEqual from "fast-deep-equal" // kilocode_change
// import McpView from "../kilocodeMcp/McpView" // kilocode_change: hidden for now
// import { About } from "./About" // kilocode_change: hidden for now
import ApiOptions from "./ApiOptions"
import { AutoApproveSettings } from "./AutoApproveSettings"
import { BrowserSettings } from "./BrowserSettings"
// import { CheckpointSettings } from "./CheckpointSettings"
import { CodeReviewSettings as CodeReviewSettingsComponent } from "./CodeReviewSettings"
// import { ContextManagementSettings } from "./ContextManagementSettings"
// import { DisplaySettings } from "./DisplaySettings" // kilocode_change
import { VSCodeButton } from "@vscode/webview-ui-toolkit/react"
import { LanguageSettings } from "./LanguageSettings"
import { NotificationSettings } from "./NotificationSettings"
import { Section } from "./Section"
import { SlashCommandsSettings } from "./SlashCommandsSettings"
import { TerminalSettings } from "./TerminalSettings"
import { UISettings } from "./UISettings"
import { About } from "./About"

export const settingsTabsContainer =
	"flex flex-1 overflow-hidden [&.narrow_.tab-label]:hidden bg-vscode-editor-background"
export const settingsTabList = "flex-shrink-0 flex flex-col overflow-y-auto overflow-x-hidden flex-1"
export const settingsTabTrigger =
	"whitespace-nowrap overflow-hidden min-w-0 h-9 px-3 mb-1 mx-2 box-border flex items-center border border-transparent rounded-md text-vscode-foreground opacity-70 hover:bg-vscode-list-hoverBackground data-[compact=true]:w-10 data-[compact=true]:px-0 data-[compact=true]:mx-auto data-[compact=true]:justify-center cursor-pointer" // kilocode_change add cursor-pointer
export const settingsTabTriggerActive =
	"opacity-100 bg-[var(--vscode-button-background)] text-[var(--vscode-button-foreground)] hover:bg-[var(--vscode-button-background)] font-medium cursor-default" // kilocode_change add hover:bg-* and cursor-default

export interface SettingsViewRef {
	checkUnsaveChanges: (then: () => void) => void
}
const sectionNames = [
	"providers",
	"autoApprove",
	"slashCommands",
	"browser",
	// "checkpoints",
	// "display", // kilocode_change
	"notifications",
	// "contextManagement",
	"terminal",
	"prompts",
	"ui",
	"experimental",
	"language",
	// "mcp", // kilocode_change: hidden for now
	"codeReview", // kilocode_change
	"about", // kilocode_change: hidden for now
] as const

type SectionName = (typeof sectionNames)[number] // kilocode_change

type SettingsViewProps = {
	onDone: () => void
	targetSection?: string
}

const SettingsView = forwardRef<SettingsViewRef, SettingsViewProps>(({ onDone, targetSection }, ref) => {
	const { t } = useAppTranslation()

	const extensionState = useExtensionState()
	const {
		currentApiConfigName,
		// listApiConfigMeta,
		uriScheme,
		settingsImportedAt,
	} = extensionState

	const [isDiscardDialogShow, setDiscardDialogShow] = useState(false)
	const [isChangeDetected, setChangeDetected] = useState(false)
	const [errorMessage, setErrorMessage] = useState<string | undefined>(undefined)
	const [activeTab, setActiveTab] = useState<SectionName>(
		targetSection && sectionNames.includes(targetSection as SectionName)
			? (targetSection as SectionName)
			: "providers",
	)

	const scrollPositions = useRef<Record<SectionName, number>>(
		Object.fromEntries(sectionNames.map((s) => [s, 0])) as Record<SectionName, number>,
	)
	const contentRef = useRef<HTMLDivElement | null>(null)

	const prevApiConfigName = useRef(currentApiConfigName)
	const confirmDialogHandler = useRef<() => void>()

	const [cachedState, setCachedState] = useState(() => extensionState)

	// Fetch Profile Data
	const [profileEmail, setProfileEmail] = useState<string>("loading...")
	const [profilePlan, setProfilePlan] = useState<string>("Free Plan")

	useEffect(() => {
		vscode.postMessage({ type: "fetchProfileDataRequest" })
		const handleProfileResponse = (event: MessageEvent) => {
			const message = event.data
			if (message.type === "profileDataResponse" && message.payload?.success) {
				if (message.payload.data?.email) {
					setProfileEmail(message.payload.data.email)
				}
				if (message.payload.data?.plan) {
					setProfilePlan(message.payload.data.plan)
				}
			}
		}
		window.addEventListener("message", handleProfileResponse)
		return () => window.removeEventListener("message", handleProfileResponse)
	}, [])

	// kilocode_change begin
	useEffect(() => {
		ensureBodyPointerEventsRestored()
	}, [isDiscardDialogShow])

	useEffect(() => {
		setChangeDetected(JSON.stringify(cachedState) !== JSON.stringify(extensionState))
	}, [cachedState, extensionState])
	// forked_change end

	const {
		alwaysAllowReadOnly,
		alwaysAllowReadOnlyOutsideWorkspace,
		allowedCommands,
		deniedCommands,
		allowedMaxRequests,
		allowedMaxCost,
		language,
		alwaysAllowBrowser,
		alwaysAllowExecute,
		alwaysAllowMcp,
		alwaysAllowModeSwitch,
		alwaysAllowSubtasks,
		alwaysAllowWrite,
		alwaysAllowWriteOutsideWorkspace,
		alwaysAllowWriteProtected,
		alwaysApproveResubmit,
		autoCondenseContext,
		autoCondenseContextPercent,
		browserToolEnabled,
		browserViewportSize,
		// enableCheckpoints,
		diffEnabled,
		experiments,
		morphApiKey, // kilocode_change
		fastApplyModel, // kilocode_change: Fast Apply model selection
		fuzzyMatchThreshold,
		maxOpenTabsContext,
		maxWorkspaceFiles,
		mcpEnabled,
		requestDelaySeconds,
		remoteBrowserHost,
		screenshotQuality,
		soundEnabled,
		ttsEnabled,
		ttsSpeed,
		soundVolume,
		telemetrySetting,
		terminalOutputLineLimit,
		terminalOutputCharacterLimit,
		terminalShellIntegrationTimeout,
		terminalShellIntegrationDisabled, // Added from upstream
		terminalCommandDelay,
		terminalPowershellCounter,
		terminalZshClearEolMark,
		terminalZshOhMy,
		terminalZshP10k,
		terminalZdotdir,
		writeDelayMs,
		showRooIgnoredFiles,
		remoteBrowserEnabled,
		maxReadFileLine,
		showAutoApproveMenu, // kilocode_change
		yoloMode, // kilocode_change
		showTaskTimeline, // kilocode_change
		sendMessageOnEnter, // kilocode_change
		showTimestamps, // kilocode_change
		hideCostBelowThreshold, // kilocode_change
		maxImageFileSize,
		maxTotalImageSize,
		terminalCompressProgressBar,
		// maxConcurrentFileReads,
		allowVeryLargeReads, // kilocode_change
		terminalCommandApiConfigId, // kilocode_change
		condensingApiConfigId,
		customCondensingPrompt,
		customSupportPrompts,
		profileThresholds,
		systemNotificationsEnabled, // kilocode_change
		alwaysAllowFollowupQuestions,
		alwaysAllowUpdateTodoList,
		followupAutoApproveTimeoutMs,
		includeDiagnosticMessages,
		maxDiagnosticMessages,
		includeTaskHistoryInEnhance,
		openRouterImageApiKey,
		kiloCodeImageApiKey,
		openRouterImageGenerationSelectedModel,
		reasoningBlockCollapsed,
		codeReviewSettings,
	} = cachedState

	const apiConfiguration = useMemo(() => cachedState.apiConfiguration ?? {}, [cachedState.apiConfiguration])

	useEffect(() => {
		// Update only when currentApiConfigName is changed.
		// Expected to be triggered by loadApiConfiguration/upsertApiConfiguration.
		if (prevApiConfigName.current === currentApiConfigName) {
			return
		}

		setCachedState((prevCachedState) => ({ ...prevCachedState, ...extensionState }))
		prevApiConfigName.current = currentApiConfigName
		setChangeDetected(false)
	}, [currentApiConfigName, extensionState])

	// forked_change start
	// Temporary way of making sure that the Settings view updates its local state properly when receiving
	// api keys from providers that support url callbacks. This whole Settings View needs proper with this local state thing later
	const { kilocodeToken, openRouterApiKey, glamaApiKey, requestyApiKey } = extensionState.apiConfiguration ?? {}
	useEffect(() => {
		setCachedState((prevCachedState) => ({
			...prevCachedState,
			apiConfiguration: {
				...prevCachedState.apiConfiguration,
				// Only set specific tokens/keys instead of spreading the entire
				// `prevCachedState.apiConfiguration` since it may contain unsaved changes
				kilocodeToken,
				openRouterApiKey,
				glamaApiKey,
				requestyApiKey,
			},
		}))
	}, [kilocodeToken, openRouterApiKey, glamaApiKey, requestyApiKey])

	useEffect(() => {
		// Only update if we're not already detecting changes
		// This prevents overwriting user changes that haven't been saved yet
		if (!isChangeDetected) {
			setCachedState(extensionState)
		}
	}, [extensionState, isChangeDetected])
	// forked_change end

	// Bust the cache when settings are imported.
	useEffect(() => {
		if (settingsImportedAt) {
			setCachedState((prevCachedState) => ({ ...prevCachedState, ...extensionState }))
			setChangeDetected(false)
		}
	}, [settingsImportedAt, extensionState])

	const setCachedStateField: SetCachedStateField<keyof ExtensionStateContextType> = useCallback((field, value) => {
		setCachedState((prevState) => {
			// forked_change start
			if (deepEqual(prevState[field], value)) {
				return prevState
			}
			// forked_change end

			setChangeDetected(true)
			return { ...prevState, [field]: value }
		})
	}, [])

	const setApiConfigurationField = useCallback(
		<K extends keyof ProviderSettings>(field: K, value: ProviderSettings[K], isUserAction: boolean = true) => {
			setCachedState((prevState) => {
				if (prevState.apiConfiguration?.[field] === value) {
					return prevState
				}

				const previousValue = prevState.apiConfiguration?.[field]

				// Only skip change detection for automatic initialization (not user actions)
				// This prevents the dirty state when the component initializes and auto-syncs values
				// Treat undefined, null, and empty string as uninitialized states
				const isInitialSync =
					!isUserAction &&
					(previousValue === undefined || previousValue === "" || previousValue === null) &&
					value !== undefined &&
					value !== "" &&
					value !== null

				if (!isInitialSync) {
					setChangeDetected(true)
				}
				return { ...prevState, apiConfiguration: { ...prevState.apiConfiguration, [field]: value } }
			})
		},
		[],
	)

	// const setExperimentEnabled: SetExperimentEnabled = useCallback((id: ExperimentId, enabled: boolean) => {
	// 	setCachedState((prevState) => {
	// 		if (prevState.experiments?.[id] === enabled) {
	// 			return prevState
	// 		}

	// 		setChangeDetected(true)
	// 		return { ...prevState, experiments: { ...prevState.experiments, [id]: enabled } }
	// 	})
	// }, [])

	const setTelemetrySetting = useCallback((setting: TelemetrySetting) => {
		setCachedState((prevState) => {
			if (prevState.telemetrySetting === setting) {
				return prevState
			}

			setChangeDetected(true)
			return { ...prevState, telemetrySetting: setting }
		})
	}, [])

	// const setOpenRouterImageApiKey = useCallback((apiKey: string) => {
	// 	setCachedState((prevState) => {
	// 		// Only set change detected if value actually changed
	// 		if (prevState.openRouterImageApiKey !== apiKey) {
	// 			setChangeDetected(true)
	// 		}
	// 		return { ...prevState, openRouterImageApiKey: apiKey }
	// 	})
	// }, [])

	// const setKiloCodeImageApiKey = useCallback((apiKey: string) => {
	// 	setCachedState((prevState) => {
	// 		setChangeDetected(true)
	// 		return { ...prevState, kiloCodeImageApiKey: apiKey }
	// 	})
	// }, [])

	// const setImageGenerationSelectedModel = useCallback((model: string) => {
	// 	setCachedState((prevState) => {
	// 		// Only set change detected if value actually changed
	// 		if (prevState.openRouterImageGenerationSelectedModel !== model) {
	// 			setChangeDetected(true)
	// 		}
	// 		return { ...prevState, openRouterImageGenerationSelectedModel: model }
	// 	})
	// }, [])

	// const setCustomSupportPromptsField = useCallback((prompts: Record<string, string | undefined>) => {
	// 	setCachedState((prevState) => {
	// 		const previousStr = JSON.stringify(prevState.customSupportPrompts)
	// 		const newStr = JSON.stringify(prompts)

	// 		if (previousStr === newStr) {
	// 			return prevState
	// 		}

	// 		setChangeDetected(true)
	// 		return { ...prevState, customSupportPrompts: prompts }
	// 	})
	// }, [])

	const isSettingValid = !errorMessage

	const handleSubmit = () => {
		if (isSettingValid) {
			vscode.postMessage({ type: "language", text: language })
			vscode.postMessage({ type: "alwaysAllowReadOnly", bool: alwaysAllowReadOnly })
			vscode.postMessage({
				type: "alwaysAllowReadOnlyOutsideWorkspace",
				bool: alwaysAllowReadOnlyOutsideWorkspace,
			})
			vscode.postMessage({ type: "alwaysAllowWrite", bool: alwaysAllowWrite })
			vscode.postMessage({ type: "alwaysAllowWriteOutsideWorkspace", bool: alwaysAllowWriteOutsideWorkspace })
			vscode.postMessage({ type: "alwaysAllowWriteProtected", bool: alwaysAllowWriteProtected })
			vscode.postMessage({ type: "alwaysAllowExecute", bool: alwaysAllowExecute })
			vscode.postMessage({ type: "alwaysAllowBrowser", bool: alwaysAllowBrowser })
			vscode.postMessage({ type: "alwaysAllowMcp", bool: alwaysAllowMcp })
			vscode.postMessage({ type: "allowedCommands", commands: allowedCommands ?? [] })
			vscode.postMessage({ type: "deniedCommands", commands: deniedCommands ?? [] })
			vscode.postMessage({ type: "allowedMaxRequests", value: allowedMaxRequests ?? undefined })
			vscode.postMessage({ type: "allowedMaxCost", value: allowedMaxCost ?? undefined })
			vscode.postMessage({ type: "autoCondenseContext", bool: autoCondenseContext })
			vscode.postMessage({ type: "autoCondenseContextPercent", value: autoCondenseContextPercent })
			vscode.postMessage({ type: "browserToolEnabled", bool: browserToolEnabled })
			vscode.postMessage({ type: "soundEnabled", bool: soundEnabled })
			vscode.postMessage({ type: "ttsEnabled", bool: ttsEnabled })
			vscode.postMessage({ type: "ttsSpeed", value: ttsSpeed })
			vscode.postMessage({ type: "soundVolume", value: soundVolume })
			vscode.postMessage({ type: "diffEnabled", bool: diffEnabled })
			// vscode.postMessage({ type: "enableCheckpoints", bool: enableCheckpoints })
			vscode.postMessage({ type: "browserViewportSize", text: browserViewportSize })
			vscode.postMessage({ type: "remoteBrowserHost", text: remoteBrowserHost })
			vscode.postMessage({ type: "remoteBrowserEnabled", bool: remoteBrowserEnabled })
			vscode.postMessage({ type: "fuzzyMatchThreshold", value: fuzzyMatchThreshold ?? 1.0 })
			vscode.postMessage({ type: "writeDelayMs", value: writeDelayMs })
			vscode.postMessage({ type: "screenshotQuality", value: screenshotQuality ?? 75 })
			vscode.postMessage({ type: "terminalOutputLineLimit", value: terminalOutputLineLimit ?? 500 })
			vscode.postMessage({ type: "terminalOutputCharacterLimit", value: terminalOutputCharacterLimit ?? 50000 })
			vscode.postMessage({ type: "terminalShellIntegrationTimeout", value: terminalShellIntegrationTimeout })
			vscode.postMessage({ type: "terminalShellIntegrationDisabled", bool: terminalShellIntegrationDisabled })
			vscode.postMessage({ type: "terminalCommandDelay", value: terminalCommandDelay })
			vscode.postMessage({ type: "terminalPowershellCounter", bool: terminalPowershellCounter })
			vscode.postMessage({ type: "terminalZshClearEolMark", bool: terminalZshClearEolMark })
			vscode.postMessage({ type: "terminalZshOhMy", bool: terminalZshOhMy })
			vscode.postMessage({ type: "terminalZshP10k", bool: terminalZshP10k })
			vscode.postMessage({ type: "terminalZdotdir", bool: terminalZdotdir })
			vscode.postMessage({ type: "terminalCompressProgressBar", bool: terminalCompressProgressBar })
			vscode.postMessage({ type: "terminalCommandApiConfigId", text: terminalCommandApiConfigId || "" }) // kilocode_change
			vscode.postMessage({ type: "mcpEnabled", bool: mcpEnabled })
			vscode.postMessage({ type: "alwaysApproveResubmit", bool: alwaysApproveResubmit })
			vscode.postMessage({ type: "requestDelaySeconds", value: requestDelaySeconds })
			vscode.postMessage({ type: "maxOpenTabsContext", value: maxOpenTabsContext })
			vscode.postMessage({ type: "maxWorkspaceFiles", value: maxWorkspaceFiles ?? 200 })
			vscode.postMessage({ type: "showRooIgnoredFiles", bool: showRooIgnoredFiles })
			vscode.postMessage({ type: "showAutoApproveMenu", bool: showAutoApproveMenu }) // kilocode_change
			vscode.postMessage({ type: "yoloMode", bool: yoloMode }) // kilocode_change
			vscode.postMessage({ type: "maxReadFileLine", value: maxReadFileLine ?? -1 })
			vscode.postMessage({ type: "maxImageFileSize", value: maxImageFileSize ?? 5 })
			vscode.postMessage({ type: "maxTotalImageSize", value: maxTotalImageSize ?? 20 })
			// vscode.postMessage({ type: "maxConcurrentFileReads", value: cachedState.maxConcurrentFileReads ?? 5 })
			vscode.postMessage({ type: "allowVeryLargeReads", bool: allowVeryLargeReads }) // kilocode_change
			vscode.postMessage({ type: "includeDiagnosticMessages", bool: includeDiagnosticMessages })
			vscode.postMessage({ type: "maxDiagnosticMessages", value: maxDiagnosticMessages ?? 50 })
			vscode.postMessage({ type: "currentApiConfigName", text: currentApiConfigName })
			vscode.postMessage({ type: "updateExperimental", values: experiments })
			vscode.postMessage({ type: "alwaysAllowModeSwitch", bool: alwaysAllowModeSwitch })
			vscode.postMessage({ type: "alwaysAllowSubtasks", bool: alwaysAllowSubtasks })
			vscode.postMessage({ type: "showTaskTimeline", bool: showTaskTimeline }) // kilocode_change
			vscode.postMessage({ type: "sendMessageOnEnter", bool: sendMessageOnEnter }) // kilocode_change
			vscode.postMessage({ type: "showTimestamps", bool: showTimestamps }) // kilocode_change
			vscode.postMessage({ type: "hideCostBelowThreshold", value: hideCostBelowThreshold }) // kilocode_change
			vscode.postMessage({ type: "alwaysAllowFollowupQuestions", bool: alwaysAllowFollowupQuestions })
			vscode.postMessage({ type: "alwaysAllowUpdateTodoList", bool: alwaysAllowUpdateTodoList })
			vscode.postMessage({ type: "followupAutoApproveTimeoutMs", value: followupAutoApproveTimeoutMs })
			vscode.postMessage({ type: "condensingApiConfigId", text: condensingApiConfigId || "" })
			vscode.postMessage({ type: "updateCondensingPrompt", text: customCondensingPrompt || "" })
			vscode.postMessage({ type: "updateSupportPrompt", values: customSupportPrompts || {} })
			vscode.postMessage({ type: "includeTaskHistoryInEnhance", bool: includeTaskHistoryInEnhance ?? true })
			vscode.postMessage({ type: "setReasoningBlockCollapsed", bool: reasoningBlockCollapsed ?? true })
			vscode.postMessage({ type: "upsertApiConfiguration", text: currentApiConfigName, apiConfiguration })
			vscode.postMessage({ type: "telemetrySetting", text: telemetrySetting })
			vscode.postMessage({ type: "profileThresholds", values: profileThresholds })
			vscode.postMessage({ type: "systemNotificationsEnabled", bool: systemNotificationsEnabled }) // kilocode_change
			vscode.postMessage({ type: "morphApiKey", text: morphApiKey }) // kilocode_change
			vscode.postMessage({ type: "fastApplyModel", text: fastApplyModel }) // kilocode_change: Fast Apply model selection
			vscode.postMessage({ type: "openRouterImageApiKey", text: openRouterImageApiKey })
			vscode.postMessage({ type: "kiloCodeImageApiKey", text: kiloCodeImageApiKey })
			vscode.postMessage({
				type: "openRouterImageGenerationSelectedModel",
				text: openRouterImageGenerationSelectedModel,
			})
			vscode.postMessage({ type: "codeReviewSettings", values: codeReviewSettings })
			// Update cachedState to match the current state to prevent isChangeDetected from being set back to true
			setCachedState((prevState) => ({ ...prevState, ...extensionState }))
			setChangeDetected(false)
		}
	}

	const checkUnsaveChanges = useCallback(
		(then: () => void) => {
			if (isChangeDetected) {
				confirmDialogHandler.current = then
				setDiscardDialogShow(true)
			} else {
				then()
			}
		},
		[isChangeDetected],
	)

	useImperativeHandle(ref, () => ({ checkUnsaveChanges }), [checkUnsaveChanges])

	// forked_change start
	const onConfirmDialogResult = useCallback(
		(confirm: boolean) => {
			if (confirm) {
				// Discard changes: Reset state and flag
				setCachedState(extensionState) // Revert to original state
				setChangeDetected(false) // Reset change flag
				confirmDialogHandler.current?.() // Execute the pending action (e.g., tab switch)
			}
			// If confirm is false (Cancel), do nothing, dialog closes automatically
		},
		[setCachedState, setChangeDetected, extensionState], // Depend on extensionState to get the latest original state
	)

	// From time to time there's a bug that triggers unsaved changes upon rendering the SettingsView
	// This is a (nasty) workaround to detect when this happens, and to force overwrite the unsaved changes
	const renderStart = useRef<null | number>()
	useEffect(() => {
		renderStart.current = performance.now()
	}, [])
	useEffect(() => {
		if (renderStart.current && process.env.NODE_ENV !== "test") {
			const renderEnd = performance.now()
			const renderTime = renderEnd - renderStart.current

			if (renderTime < 100 && isChangeDetected) {
				console.info("Overwriting unsaved changes in less than 100ms")
				onConfirmDialogResult(true)
			}
		}
	}, [isChangeDetected, onConfirmDialogResult])
	// forked_change end

	// Handle tab changes with unsaved changes check
	const handleTabChange = useCallback(
		(newTab: SectionName) => {
			if (contentRef.current) {
				scrollPositions.current[activeTab] = contentRef.current.scrollTop
			}
			setActiveTab(newTab)
		},
		[activeTab],
	)

	useLayoutEffect(() => {
		if (contentRef.current) {
			contentRef.current.scrollTop = scrollPositions.current[activeTab] ?? 0
		}
	}, [activeTab])

	// Store direct DOM element refs for each tab
	const tabRefs = useRef<Record<SectionName, HTMLButtonElement | null>>(
		Object.fromEntries(sectionNames.map((name) => [name, null])) as Record<SectionName, HTMLButtonElement | null>,
	)

	// Track whether we're in compact mode
	const [isCompactMode, setIsCompactMode] = useState(false)
	const containerRef = useRef<HTMLDivElement>(null)

	// Setup resize observer to detect when we should switch to compact mode
	useEffect(() => {
		if (!containerRef.current) return

		const observer = new ResizeObserver((entries) => {
			for (const entry of entries) {
				// If container width is less than 500px, switch to compact mode
				setIsCompactMode(entry.contentRect.width < 500)
			}
		})

		observer.observe(containerRef.current)

		return () => {
			observer?.disconnect()
		}
	}, [])

	const sections: { id: SectionName; icon: LucideIcon }[] = useMemo(
		() => [
			{ id: "providers", icon: CircleUserRound },
			{ id: "codeReview", icon: GitPullRequest },
			{ id: "autoApprove", icon: CheckCheck },
			// { id: "slashCommands", icon: SquareSlash }, // kilocode_change: needs work to be re-introduced
			{ id: "browser", icon: SquareMousePointer },
			// { id: "checkpoints", icon: MapPinCheck },
			// { id: "display", icon: Monitor }, // kilocode_change
			{ id: "notifications", icon: Bell },
			// { id: "contextManagement", icon: Database },
			{ id: "terminal", icon: SquareTerminal },
			// { id: "prompts", icon: MessageSquare },
			// { id: "ui", icon: Glasses }, // kilocode_change: we have our own display section
			// { id: "experimental", icon: FlaskConical },
			{ id: "language", icon: Languages },
			// { id: "mcp", icon: Server }, // kilocode_change: hidden for now
			{ id: "about", icon: Info }, // kilocode_change: hidden for now
		],
		[], // kilocode_change
	)
	// Update target section logic to set active tab
	useEffect(() => {
		if (targetSection && sectionNames.includes(targetSection as SectionName)) {
			setActiveTab(targetSection as SectionName)
		}
	}, [targetSection]) // kilocode_change

	// Function to scroll the active tab into view for vertical layout
	const scrollToActiveTab = useCallback(() => {
		const activeTabElement = tabRefs.current[activeTab]

		if (activeTabElement) {
			activeTabElement.scrollIntoView({
				behavior: "auto",
				block: "nearest",
			})
		}
	}, [activeTab])

	// Effect to scroll when the active tab changes
	useEffect(() => {
		scrollToActiveTab()
	}, [activeTab, scrollToActiveTab])

	// Effect to scroll when the webview becomes visible
	useLayoutEffect(() => {
		const handleMessage = (event: MessageEvent) => {
			const message = event.data
			if (message.type === "action" && message.action === "didBecomeVisible") {
				scrollToActiveTab()
			}
		}

		window.addEventListener("message", handleMessage)

		return () => {
			window.removeEventListener("message", handleMessage)
		}
	}, [scrollToActiveTab])

	return (
		<Tab className="flex flex-col h-full bg-vscode-editor-background">
			<TabHeader className="flex justify-between items-center gap-2 border-b border-vscode-widget-border px-4 py-3 shrink-0">
				<div className="flex items-center gap-1">
					<h3 className="text-vscode-foreground m-0 text-lg font-medium">{t("settings:header.title")}</h3>
				</div>
				<div className="flex gap-2">
					<StandardTooltip
						content={
							!isSettingValid
								? errorMessage
								: isChangeDetected
									? t("settings:header.saveButtonTooltip")
									: t("settings:header.nothingChangedTooltip")
						}>
						<VSCodeButton
							appearance={isSettingValid ? "primary" : "secondary"}
							className={!isSettingValid ? "!border-vscode-errorForeground" : ""}
							onClick={handleSubmit}
							disabled={!isChangeDetected || !isSettingValid}
							data-testid="save-button">
							{t("settings:common.save")}
						</VSCodeButton>
					</StandardTooltip>
					<StandardTooltip content={t("settings:header.doneButtonTooltip")}>
						<Button variant="secondary" onClick={() => checkUnsaveChanges(onDone)}>
							{t("settings:common.done")}
						</Button>
					</StandardTooltip>
				</div>
			</TabHeader>

			{/* Vertical tabs layout */}
			<div ref={containerRef} className={cn(settingsTabsContainer, isCompactMode && "narrow")}>
				{/* Modern Sidebar layout wrapper */}
				<div
					className={cn(
						"w-60 data-[compact=true]:w-16 flex-shrink-0 flex flex-col border-r border-vscode-widget-border bg-vscode-sideBar-background",
					)}
					data-compact={isCompactMode}>
					{/* Profile Section */}
					<div className="pt-6 pb-6 px-4 flex items-center justify-center gap-3">
						<div className="w-10 h-10 rounded-full bg-vscode-editor-inactiveSelectionBackground text-vscode-foreground flex items-center justify-center font-medium shadow-sm border border-vscode-widget-border shrink-0">
							{profileEmail ? profileEmail.charAt(0).toUpperCase() : "S"}
						</div>
						{!isCompactMode && (
							<div className="flex flex-col min-w-0 overflow-hidden flex-1">
								<span className="text-vscode-foreground font-medium truncate text-sm">
									{profileEmail}
								</span>
								<span className="text-vscode-descriptionForeground text-xs truncate">
									{profilePlan}
								</span>
							</div>
						)}
					</div>

					{/* Tab sidebar */}
					<TabList
						value={activeTab}
						onValueChange={(value) => handleTabChange(value as SectionName)}
						className={cn(settingsTabList)}
						data-compact={isCompactMode}
						data-testid="settings-tab-list">
						{sections.map(({ id, icon: Icon }) => {
							const isSelected = id === activeTab
							const onSelect = () => handleTabChange(id)

							// Base TabTrigger component definition
							// We pass isSelected manually for styling, but onSelect is handled conditionally
							const triggerComponent = (
								<TabTrigger
									ref={(element) => (tabRefs.current[id] = element)}
									value={id}
									isSelected={isSelected} // Pass manually for styling state
									className={cn(
										isSelected // Use manual isSelected for styling
											? `${settingsTabTrigger} ${settingsTabTriggerActive}`
											: settingsTabTrigger,
										"focus:ring-0", // Remove the focus ring styling
									)}
									data-testid={`tab-${id}`}
									data-compact={isCompactMode}>
									<div className={cn("flex items-center gap-2", isCompactMode && "justify-center")}>
										<Icon className="w-4 h-4" />
										<span className="tab-label">{t(`settings:sections.${id}`)}</span>
									</div>
								</TabTrigger>
							)

							if (isCompactMode) {
								// Wrap in Tooltip and manually add onClick to the trigger
								return (
									<TooltipProvider key={id} delayDuration={300}>
										<Tooltip>
											<TooltipTrigger asChild onClick={onSelect}>
												{/* Clone to avoid ref issues if triggerComponent itself had a key */}
												{React.cloneElement(triggerComponent)}
											</TooltipTrigger>
											<TooltipContent side="right" className="text-base">
												<p className="m-0">{t(`settings:sections.${id}`)}</p>
											</TooltipContent>
										</Tooltip>
									</TooltipProvider>
								)
							} else {
								// Render trigger directly; TabList will inject onSelect via cloning
								// Ensure the element passed to TabList has the key
								return React.cloneElement(triggerComponent, { key: id })
							}
						})}
					</TabList>

					<div className={cn("pb-6 mt-8 flex", isCompactMode ? "px-2 justify-center" : "px-4")}>
						<button
							className={cn(
								"flex items-center justify-center gap-2 text-red-500 hover:bg-red-500/20 rounded-md transition-colors border border-transparent hover:border-red-500/30 cursor-pointer",
								isCompactMode ? "w-10 h-10 p-0" : "w-full py-2 px-4 bg-red-500/10",
							)}
							onClick={() => {
								vscode.postMessage({ type: "rooCloudSignOut" })
							}}
							title="Log out">
							<svg
								xmlns="http://www.w3.org/2000/svg"
								width="16"
								height="16"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								strokeWidth="2"
								strokeLinecap="round"
								strokeLinejoin="round"
								className="lucide lucide-log-out">
								<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
								<polyline points="16 17 21 12 16 7" />
								<line x1="21" x2="9" y1="12" y2="12" />
							</svg>
							{!isCompactMode && <span className="font-medium">Log Out</span>}
						</button>
					</div>
				</div>

				{/* Content area */}
				<TabContent ref={contentRef} className="p-0 flex-1 overflow-auto bg-vscode-editor-background">
					<div className="max-w-4xl mx-auto p-2 content-wrapper">
						<div className="mb-1 ml-2 mt-2">
							<h2 className="text-xl font-bold text-vscode-foreground m-0 p-0">
								{t(`settings:sections.${activeTab}`)}
							</h2>
						</div>

						{/* Providers Section */}
						{activeTab === "providers" && (
							<div>
								<SectionHeader>
									<div className="flex items-center gap-2">
										<Webhook className="w-4" />
										<div>{t("settings:sections.providers")}</div>
									</div>
								</SectionHeader>

								<Section>
									{/* <ApiConfigManager
									currentApiConfigName={currentApiConfigName}
									listApiConfigMeta={listApiConfigMeta}
									onSelectConfig={(configName: string) =>
										checkUnsaveChanges(() =>
											vscode.postMessage({ type: "loadApiConfiguration", text: configName }),
										)
									}
									onDeleteConfig={(configName: string) =>
										vscode.postMessage({ type: "deleteApiConfiguration", text: configName })
									}
									onRenameConfig={(oldName: string, newName: string) => {
										vscode.postMessage({
											type: "renameApiConfiguration",
											values: { oldName, newName },
											apiConfiguration,
										})
										prevApiConfigName.current = newName
									}}
									onUpsertConfig={(configName: string) =>
										vscode.postMessage({
											type: "upsertApiConfiguration",
											text: configName,
											apiConfiguration,
										})
									}
								/> */}
									<ApiOptions
										uriScheme={uriScheme}
										apiConfiguration={apiConfiguration}
										setApiConfigurationField={setApiConfigurationField}
										errorMessage={errorMessage}
										setErrorMessage={setErrorMessage}
										currentApiConfigName={currentApiConfigName}
									/>
								</Section>
							</div>
						)}

						{/* Auto-Approve Section */}
						{activeTab === "autoApprove" && (
							<AutoApproveSettings
								showAutoApproveMenu={showAutoApproveMenu} // kilocode_change
								yoloMode={yoloMode} // kilocode_change
								alwaysAllowReadOnly={alwaysAllowReadOnly}
								alwaysAllowReadOnlyOutsideWorkspace={alwaysAllowReadOnlyOutsideWorkspace}
								alwaysAllowWrite={alwaysAllowWrite}
								alwaysAllowWriteOutsideWorkspace={alwaysAllowWriteOutsideWorkspace}
								alwaysAllowWriteProtected={alwaysAllowWriteProtected}
								alwaysAllowBrowser={alwaysAllowBrowser}
								alwaysApproveResubmit={alwaysApproveResubmit}
								requestDelaySeconds={requestDelaySeconds}
								alwaysAllowMcp={alwaysAllowMcp}
								alwaysAllowModeSwitch={alwaysAllowModeSwitch}
								alwaysAllowSubtasks={alwaysAllowSubtasks}
								alwaysAllowExecute={alwaysAllowExecute}
								alwaysAllowFollowupQuestions={alwaysAllowFollowupQuestions}
								alwaysAllowUpdateTodoList={alwaysAllowUpdateTodoList}
								// followupAutoApproveTimeoutMs={followupAutoApproveTimeoutMs}
								allowedCommands={allowedCommands}
								allowedMaxRequests={allowedMaxRequests ?? undefined}
								allowedMaxCost={allowedMaxCost ?? undefined}
								deniedCommands={deniedCommands}
								setCachedStateField={setCachedStateField}
							/>
						)}

						{/* Slash Commands Section */}
						{activeTab === "slashCommands" && <SlashCommandsSettings />}

						{/* Browser Section */}
						{activeTab === "browser" && (
							<BrowserSettings
								browserToolEnabled={browserToolEnabled}
								browserViewportSize={browserViewportSize}
								screenshotQuality={screenshotQuality}
								remoteBrowserHost={remoteBrowserHost}
								remoteBrowserEnabled={remoteBrowserEnabled}
								setCachedStateField={setCachedStateField}
							/>
						)}

						{/* Checkpoints Section */}
						{/* {activeTab === "checkpoints" && (
						<CheckpointSettings
							enableCheckpoints={enableCheckpoints}
							setCachedStateField={setCachedStateField}
						/>
					)} */}

						{/* forked_change start display section */}
						{/* {activeTab === "display" && (
						<DisplaySettings
							sendMessageOnEnter={sendMessageOnEnter}
							showTimestamps={cachedState.showTimestamps} // kilocode_change
							ghostServiceSettings={ghostServiceSettings}
							setCachedStateField={setCachedStateField}
						/>
					)} */}
						{/* forked_change end display section */}

						{/* Notifications Section */}
						{activeTab === "notifications" && (
							<NotificationSettings
								ttsEnabled={ttsEnabled}
								ttsSpeed={ttsSpeed}
								soundEnabled={soundEnabled}
								soundVolume={soundVolume}
								systemNotificationsEnabled={systemNotificationsEnabled}
								areSettingsCommitted={!isChangeDetected}
								setCachedStateField={setCachedStateField}
							/>
						)}

						{/* Context Management Section */}
						{/* {activeTab === "contextManagement" && (
						<ContextManagementSettings
							autoCondenseContext={autoCondenseContext}
							autoCondenseContextPercent={autoCondenseContextPercent}
							listApiConfigMeta={listApiConfigMeta ?? []}
							maxOpenTabsContext={maxOpenTabsContext}
							maxWorkspaceFiles={maxWorkspaceFiles ?? 200}
							showRooIgnoredFiles={showRooIgnoredFiles}
							maxReadFileLine={maxReadFileLine}
							maxImageFileSize={maxImageFileSize}
							maxTotalImageSize={maxTotalImageSize}
							maxConcurrentFileReads={maxConcurrentFileReads}
							allowVeryLargeReads={allowVeryLargeReads}
							profileThresholds={profileThresholds}
							includeDiagnosticMessages={includeDiagnosticMessages}
							maxDiagnosticMessages={maxDiagnosticMessages}
							writeDelayMs={writeDelayMs}
							setCachedStateField={setCachedStateField}
						/>
					)} */}

						{/* Terminal Section */}
						{activeTab === "terminal" && (
							<TerminalSettings
								terminalOutputLineLimit={terminalOutputLineLimit}
								terminalOutputCharacterLimit={terminalOutputCharacterLimit}
								terminalShellIntegrationTimeout={terminalShellIntegrationTimeout}
								terminalShellIntegrationDisabled={terminalShellIntegrationDisabled}
								terminalCommandDelay={terminalCommandDelay}
								terminalPowershellCounter={terminalPowershellCounter}
								terminalZshClearEolMark={terminalZshClearEolMark}
								terminalZshOhMy={terminalZshOhMy}
								terminalZshP10k={terminalZshP10k}
								terminalZdotdir={terminalZdotdir}
								terminalCompressProgressBar={terminalCompressProgressBar}
								terminalCommandApiConfigId={terminalCommandApiConfigId} // kilocode_change
								setCachedStateField={setCachedStateField}
							/>
						)}

						{/* Prompts Section */}
						{/* {activeTab === "prompts" && (
						<PromptsSettings
							customSupportPrompts={customSupportPrompts || {}}
							setCustomSupportPrompts={setCustomSupportPromptsField}
							includeTaskHistoryInEnhance={includeTaskHistoryInEnhance}
							setIncludeTaskHistoryInEnhance={(value) =>
								setCachedStateField("includeTaskHistoryInEnhance", value)
							}
						/>
					)} */}

						{/* UI Section */}
						{activeTab === "ui" && (
							<UISettings
								reasoningBlockCollapsed={reasoningBlockCollapsed ?? true}
								setCachedStateField={setCachedStateField}
							/>
						)}

						{/* Experimental Section */}
						{/* {activeTab === "experimental" && (
						<ExperimentalSettings
							setExperimentEnabled={setExperimentEnabled}
							experiments={experiments}
							// forked_change start
							setCachedStateField={setCachedStateField}
							morphApiKey={morphApiKey}
							fastApplyModel={fastApplyModel}
							// forked_change end
							apiConfiguration={apiConfiguration}
							setApiConfigurationField={setApiConfigurationField}
							openRouterImageApiKey={openRouterImageApiKey as string | undefined}
							kiloCodeImageApiKey={kiloCodeImageApiKey}
							openRouterImageGenerationSelectedModel={
								openRouterImageGenerationSelectedModel as string | undefined
							}
							setOpenRouterImageApiKey={setOpenRouterImageApiKey}
							setKiloCodeImageApiKey={setKiloCodeImageApiKey}
							setImageGenerationSelectedModel={setImageGenerationSelectedModel}
							currentProfileKilocodeToken={apiConfiguration.kilocodeToken}
						/>
					)} */}

						{/* Language Section */}
						{activeTab === "language" && (
							<LanguageSettings language={language || "en"} setCachedStateField={setCachedStateField} />
						)}

						{/* kilocode_change */}
						{/* MCP Section - hidden for now */}
						{/* {activeTab === "mcp" && <McpView />} */}

						{/* Code Review Section */}
						{activeTab === "codeReview" && (
							<CodeReviewSettingsComponent
								codeReviewSettings={
									codeReviewSettings || {
										enterpriseHost: "",
										enterpriseApiKey: "",
										reviewOnlyMode: false,
									}
								}
								setCachedStateField={setCachedStateField}
							/>
						)}

						{/* About Section - hidden for now */}
						{activeTab === "about" && (
							<About telemetrySetting={telemetrySetting} setTelemetrySetting={setTelemetrySetting} />
						)}
					</div>
				</TabContent>
			</div>

			<AlertDialog open={isDiscardDialogShow} onOpenChange={setDiscardDialogShow}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>
							<AlertTriangle className="w-5 h-5 text-yellow-500" />
							{t("settings:unsavedChangesDialog.title")}
						</AlertDialogTitle>
						<AlertDialogDescription>
							{t("settings:unsavedChangesDialog.description")}
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter className="flex-col gap-2 items-center justify-center">
						<div className="flex gap-1 flex-col">
							<AlertDialogCancel onClick={() => onConfirmDialogResult(false)}>
								{t("settings:unsavedChangesDialog.cancelButton")}
							</AlertDialogCancel>
							<AlertDialogAction onClick={() => onConfirmDialogResult(true)}>
								{t("settings:unsavedChangesDialog.discardButton")}
							</AlertDialogAction>
						</div>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</Tab>
	)
})

export default memo(SettingsView)
