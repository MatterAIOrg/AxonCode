import React, { createContext, useContext, useState, useCallback, ReactNode, useEffect } from "react"
import { vscode } from "../../utils/vscode"

export interface FileViewerState {
	filePath: string
	diff?: string
	content?: string
	line?: number
	isOutsideWorkspace?: boolean
	isProtected?: boolean
}

export interface PendingDiffFile {
	relPath: string
	absolutePath: string
	diff: string
	firstLineNumber?: number
	status?: string
	stat: {
		additions: number
		deletions: number
	}
}

const isPendingDiffFile = (file: unknown): file is PendingDiffFile => {
	if (!file || typeof file !== "object") return false

	const candidate = file as Partial<PendingDiffFile>
	return (
		typeof candidate.relPath === "string" &&
		typeof candidate.absolutePath === "string" &&
		typeof candidate.diff === "string"
	)
}

interface AgentFileViewerContextValue {
	fileViewerState: FileViewerState | null
	pendingDiffFiles: PendingDiffFile[]
	openFileInViewer: (state: FileViewerState) => void
	closeFileViewer: () => void
	openDiffReview: () => void
	refreshPendingDiffFiles: () => void
}

const AgentFileViewerContext = createContext<AgentFileViewerContextValue | undefined>(undefined)

interface AgentFileViewerProviderProps {
	children: ReactNode
}

export const AgentFileViewerProvider: React.FC<AgentFileViewerProviderProps> = ({ children }) => {
	const [fileViewerState, setFileViewerState] = useState<FileViewerState | null>(null)
	const [pendingDiffFiles, setPendingDiffFiles] = useState<PendingDiffFile[]>([])

	const refreshPendingDiffFiles = useCallback(() => {
		vscode.postMessage({
			type: "getPendingFileEdits",
		})
	}, [])

	useEffect(() => {
		const handleMessage = (event: MessageEvent) => {
			const message = event.data
			if (message?.type !== "pendingFileEdits") return

			const files = Array.isArray(message?.payload?.files) ? message.payload.files : []
			const pendingFiles = files.filter(isPendingDiffFile)
			setPendingDiffFiles(pendingFiles)
			if (pendingFiles.length > 0) {
				setFileViewerState((previousState) => (previousState?.diff ? null : previousState))
			}
		}

		window.addEventListener("message", handleMessage)
		refreshPendingDiffFiles()

		const pollInterval = window.setInterval(() => {
			refreshPendingDiffFiles()
		}, 2000)

		return () => {
			window.removeEventListener("message", handleMessage)
			window.clearInterval(pollInterval)
		}
	}, [refreshPendingDiffFiles])

	const openFileInViewer = useCallback((state: FileViewerState) => {
		setFileViewerState(state)
	}, [])

	const closeFileViewer = useCallback(() => {
		setFileViewerState(null)
	}, [])

	const openDiffReview = useCallback(() => {
		setFileViewerState(null)
		refreshPendingDiffFiles()
		window.setTimeout(refreshPendingDiffFiles, 250)
		window.setTimeout(refreshPendingDiffFiles, 1000)
	}, [refreshPendingDiffFiles])

	return (
		<AgentFileViewerContext.Provider
			value={{
				fileViewerState,
				pendingDiffFiles,
				openFileInViewer,
				closeFileViewer,
				openDiffReview,
				refreshPendingDiffFiles,
			}}>
			{children}
		</AgentFileViewerContext.Provider>
	)
}

export const useAgentFileViewer = (): AgentFileViewerContextValue => {
	const context = useContext(AgentFileViewerContext)
	if (!context) {
		throw new Error("useAgentFileViewer must be used within an AgentFileViewerProvider")
	}
	return context
}

export const useOptionalAgentFileViewer = (): AgentFileViewerContextValue | null => {
	return useContext(AgentFileViewerContext) ?? null
}
