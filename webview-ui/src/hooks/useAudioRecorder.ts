import { useCallback, useEffect, useState } from "react"
import { vscode } from "@/utils/vscode"

type RecorderState = "idle" | "recording"

interface UseAudioRecorderReturn {
	recorderState: RecorderState
	startRecording: () => void
	stopRecording: () => void
	error: string | null
	clearError: () => void
}

/**
 * Speech-to-text recorder.
 *
 * Capture does NOT happen here: the webview content frame is denied the
 * `microphone` permission by VS Code's webview Permissions Policy, so
 * `getUserMedia` always fails ("microphone is not allowed in this document").
 * Instead the actual microphone capture runs in the extension host (Node),
 * which streams transcripts back via `speechToTextResponse` messages as
 * recording proceeds. This hook only drives start/stop and appends each
 * transcript chunk as it arrives.
 */
export function useAudioRecorder(onTranscriptionReady: (text: string) => void): UseAudioRecorderReturn {
	const [recorderState, setRecorderState] = useState<RecorderState>("idle")
	const [error, setError] = useState<string | null>(null)

	const clearError = useCallback(() => setError(null), [])

	// Receive incremental transcripts (and errors) from the extension host.
	useEffect(() => {
		const handleMessage = (event: MessageEvent) => {
			const message = event.data
			if (message?.type !== "speechToTextResponse") {
				return
			}

			if (message.payload?.success) {
				if (message.text) {
					onTranscriptionReady(message.text)
				}
			} else {
				setError(message.payload?.error || "Transcription failed")
				setRecorderState("idle")
			}
		}

		window.addEventListener("message", handleMessage)
		return () => window.removeEventListener("message", handleMessage)
	}, [onTranscriptionReady])

	const startRecording = useCallback(() => {
		clearError()
		setRecorderState("recording")
		vscode.postMessage({ type: "startSpeechRecording" })
	}, [clearError])

	const stopRecording = useCallback(() => {
		setRecorderState("idle")
		vscode.postMessage({ type: "stopSpeechRecording" })
	}, [])

	// Stop recording if the component unmounts mid-session.
	useEffect(() => {
		return () => {
			vscode.postMessage({ type: "stopSpeechRecording" })
		}
	}, [])

	return {
		recorderState,
		startRecording,
		stopRecording,
		error,
		clearError,
	}
}
