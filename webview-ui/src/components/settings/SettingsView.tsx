import {
	AlertTriangle,
	Blocks,
	CheckCheck,
	CircleUserRound,
	Database,
	// GitPullRequest,
	// Info, // kilocode_change: hidden for now
	Languages,
	LucideIcon,
	Plug,
	Server,
	Wrench,
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

import { Tab, TabContent, TabList, TabTrigger } from "../common/Tab"
import { SetCachedStateField } from "./types"
// import ApiConfigManager from "./ApiConfigManager"
import deepEqual from "fast-deep-equal" // kilocode_change
// import McpView from "../kilocodeMcp/McpView" // kilocode_change: hidden for now
// import { About } from "./About" // kilocode_change: hidden for now
import ApiOptions from "./ApiOptions"
import { AutoApproveSettings } from "./AutoApproveSettings"
// import { BrowserSettings } from "./BrowserSettings"
// import { CheckpointSettings } from "./CheckpointSettings"
import { CodeIndexSettings } from "./CodeIndexSettings"
// import { CodeReviewSettings as CodeReviewSettingsComponent } from "./CodeReviewSettings"
// import { ContextManagementSettings } from "./ContextManagementSettings"
// import { DisplaySettings } from "./DisplaySettings" // kilocode_change
import { VSCodeButton } from "@vscode/webview-ui-toolkit/react"
import { About } from "./About"
import { LanguageSettings } from "./LanguageSettings"
// import { NotificationSettings } from "./NotificationSettings"
import { SlashCommandsSettings } from "./SlashCommandsSettings"
// import { TerminalSettings } from "./TerminalSettings"
import McpView from "../mcp/McpView"
import { SkillsMarketplaceView } from "../skills/SkillsMarketplaceView"
import { ThirdPartyProviders } from "./ThirdPartyProviders"
import { UISettings } from "./UISettings"

export const settingsTabsContainer =
	"flex flex-1 min-h-0 overflow-hidden [&.narrow_.tab-label]:hidden bg-vscode-editor-background"
export const settingsTabList = "min-h-0 flex-1 flex flex-col overflow-y-auto overflow-x-hidden"
export const settingsTabTrigger =
	"whitespace-nowrap overflow-hidden min-w-0 h-10 px-3 mb-1 mx-4 box-border flex items-center border border-transparent rounded-lg text-vscode-foreground opacity-80 hover:bg-vscode-list-hoverBackground hover:opacity-100 data-[compact=true]:w-10 data-[compact=true]:px-0 data-[compact=true]:mx-auto data-[compact=true]:justify-center cursor-pointer text-sm transition-colors"
export const settingsTabTriggerActive =
	"opacity-100 bg-vscode-list-inactiveSelectionBackground text-vscode-list-inactiveSelectionForeground hover:bg-vscode-list-inactiveSelectionBackground font-semibold cursor-default"

export interface SettingsViewRef {
	checkUnsaveChanges: (then: () => void) => void
}
const sectionNames = [
	"providers",
	"thirdPartyProviders",
	"autoApprove",
	"slashCommands",
	// "browser",
	// "checkpoints",
	// "display", // kilocode_change
	// "notifications",
	// "contextManagement",
	// "terminal",
	"prompts",
	"ui",
	"experimental",
	"language",
	"mcp",
	"plugins",
	"codeIndex", // kilocode_change
	// "codeReview", // kilocode_change
	"developerTools", // kilocode_change: renamed from about
] as const

type SectionName = (typeof sectionNames)[number] // kilocode_change

const normalizeSectionName = (section?: string): SectionName | undefined => {
	const normalized = section === "about" ? "developerTools" : section
	return sectionNames.includes(normalized as SectionName) ? (normalized as SectionName) : undefined
}

type SettingsViewProps = {
	onDone: () => void
	targetSection?: string
	standalone?: boolean
}

const SettingsView = forwardRef<SettingsViewRef, SettingsViewProps>((props, ref) => {
	const { onDone, targetSection, standalone = false } = props
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
	const [activeTab, setActiveTab] = useState<SectionName>(normalizeSectionName(targetSection) ?? "providers")
	const getSectionLabel = useCallback(
		(section: SectionName) => {
			if (section === "mcp") return t("mcp:title")
			if (section === "plugins") return t("marketplace:skillsMarketplace.title")
			return t(`settings:sections.${section}`)
		},
		[t],
	)

	const scrollPositions = useRef<Record<SectionName, number>>(
		Object.fromEntries(sectionNames.map((s) => [s, 0])) as Record<SectionName, number>,
	)
	const contentRef = useRef<HTMLDivElement | null>(null)

	const prevApiConfigName = useRef(currentApiConfigName)
	const confirmDialogHandler = useRef<() => void>()

	const [cachedState, setCachedState] = useState(() => extensionState)

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
				setIsCompactMode(entry.contentRect.width < 700)
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
			{ id: "plugins", icon: Blocks },

			// { id: "codeReview", icon: GitPullRequest },
			{ id: "autoApprove", icon: CheckCheck },
			// { id: "slashCommands", icon: SquareSlash }, // kilocode_change: needs work to be re-introduced
			// { id: "browser", icon: SquareMousePointer },
			// { id: "checkpoints", icon: MapPinCheck },
			// { id: "display", icon: Monitor }, // kilocode_change
			// { id: "notifications", icon: Bell },
			// { id: "contextManagement", icon: Database },
			// { id: "terminal", icon: SquareTerminal },
			// { id: "prompts", icon: MessageSquare },
			// { id: "ui", icon: Glasses }, // kilocode_change: we have our own display section
			// { id: "experimental", icon: FlaskConical },
			{ id: "language", icon: Languages },
			{ id: "mcp", icon: Server },
			{ id: "codeIndex", icon: Database }, // kilocode_change
			{ id: "thirdPartyProviders", icon: Plug },

			{ id: "developerTools", icon: Wrench }, // kilocode_change: renamed from about with wrench icon
		],
		[], // kilocode_change
	)
	// Update target section logic to set active tab
	useEffect(() => {
		const normalizedSection = normalizeSectionName(targetSection)
		if (normalizedSection) {
			setActiveTab(normalizedSection)
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
		<Tab
			className="flex flex-col h-full bg-vscode-editor-background [&_[role=combobox]]:rounded-md [&_input]:rounded-md"
			data-testid="settings-view"
			data-standalone={standalone}>
			<div ref={containerRef} className={cn(settingsTabsContainer, isCompactMode && "narrow")}>
				<div
					className={cn(
						"w-[264px] data-[compact=true]:w-[72px] flex-shrink-0 flex flex-col border-r border-vscode-widget-border bg-vscode-editor-background",
					)}
					data-compact={isCompactMode}>
					<div className="h-20 px-6 flex items-center">
						<img
							src={`${(window as any).ICONS_BASE_URI || ""}/matterai-ic.svg`}
							alt="Mattercode"
							className="w-7 h-7 object-contain"
						/>
					</div>

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
									<div className={cn("flex items-center gap-3", isCompactMode && "justify-center")}>
										<Icon className="w-[18px] h-[18px] shrink-0" strokeWidth={1.8} />
										<span className="tab-label">{getSectionLabel(id)}</span>
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
												<p className="m-0">{getSectionLabel(id)}</p>
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
				</div>

				<TabContent ref={contentRef} className="p-0 min-w-0 flex-1 overflow-auto bg-vscode-editor-background">
					<div className="max-w-[1080px] mx-auto px-8 py-12 lg:px-14 content-wrapper">
						<div className="mb-10 flex items-start justify-between gap-6">
							<div>
								<h1 className="text-[30px] leading-tight font-semibold tracking-[-0.02em] text-vscode-foreground m-0">
									{getSectionLabel(activeTab)}
								</h1>
								<p className="mt-2 mb-0 text-sm text-vscode-descriptionForeground">
									Configure how Mattercode works for you.
								</p>
							</div>
							<div className="flex items-center gap-2 shrink-0">
								{!["mcp", "plugins"].includes(activeTab) && (
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
								)}
								{!standalone && (
									<StandardTooltip content={t("settings:header.doneButtonTooltip")}>
										<Button variant="secondary" onClick={() => checkUnsaveChanges(onDone)}>
											{t("settings:common.done")}
										</Button>
									</StandardTooltip>
								)}
							</div>
						</div>

						{/* Providers Section */}
						{activeTab === "providers" && (
							<div className="flex flex-col gap-3">
								<div className="p-5 bg-vscode-editorWidget-background border border-vscode-widget-border rounded-2xl">
									<ApiOptions
										uriScheme={uriScheme}
										apiConfiguration={apiConfiguration}
										setApiConfigurationField={setApiConfigurationField}
										errorMessage={errorMessage}
										setErrorMessage={setErrorMessage}
										currentApiConfigName={currentApiConfigName}
									/>
								</div>
							</div>
						)}

						{/* Third Party Providers Section */}
						{activeTab === "thirdPartyProviders" && (
							<div className="flex flex-col gap-3">
								<ThirdPartyProviders
									apiConfiguration={apiConfiguration}
									setApiConfigurationField={setApiConfigurationField}
								/>
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
						{/* {activeTab === "browser" && (
							<BrowserSettings
								browserToolEnabled={browserToolEnabled}
								browserViewportSize={browserViewportSize}
								screenshotQuality={screenshotQuality}
								remoteBrowserHost={remoteBrowserHost}
								remoteBrowserEnabled={remoteBrowserEnabled}
								setCachedStateField={setCachedStateField}
							/>
						)} */}

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
						{/* {activeTab === "notifications" && (
							<NotificationSettings
								ttsEnabled={ttsEnabled}
								ttsSpeed={ttsSpeed}
								soundEnabled={soundEnabled}
								soundVolume={soundVolume}
								systemNotificationsEnabled={systemNotificationsEnabled}
								areSettingsCommitted={!isChangeDetected}
								setCachedStateField={setCachedStateField}
							/>
						)} */}

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
						{/* {activeTab === "terminal" && (
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
						)} */}

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

						{/* MCP Servers */}
						{activeTab === "mcp" && <McpView onDone={() => undefined} hideHeader embedded />}

						{/* Plugins Marketplace */}
						{activeTab === "plugins" && <SkillsMarketplaceView embedded />}

						{/* Code Index Section */}
						{activeTab === "codeIndex" && <CodeIndexSettings />}

						{/* Code Review Section */}
						{/* {activeTab === "codeReview" && (
							<CodeReviewSettingsComponent
								codeReviewSettings={codeReviewSettings || {}}
								setCachedStateField={setCachedStateField}
							/>
						)} */}

						{/* Developer Tools Section */}
						{activeTab === "developerTools" && (
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
