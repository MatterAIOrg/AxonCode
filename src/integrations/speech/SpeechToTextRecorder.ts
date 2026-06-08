import { spawn, ChildProcessWithoutNullStreams } from "child_process"
import { constants as fsConstants } from "fs"
import { access } from "fs/promises"
import axios from "axios"

/**
 * Extension-host microphone capture for speech-to-text.
 *
 * Webview `getUserMedia` is blocked by the webview's Permissions Policy
 * (the content iframe is not granted `microphone`), so capture must happen
 * in the Node extension host instead — the same approach Claude Code's VS Code
 * extension uses (a bundled native addon, with a `rec`/`arecord` CLI fallback
 * that streams raw S16LE/16kHz/mono PCM).
 *
 * Here we use ffmpeg to produce that identical raw PCM stream, slice it into
 * fixed-duration chunks, wrap each chunk in a minimal WAV header, and POST it
 * to the speech-to-text API. Each returned transcript is handed back so the
 * webview can append it to the chat box incrementally while recording.
 */

const STT_URL = "https://api.matterai.so/axoncode/speech-to-text"

const SAMPLE_RATE = 16000
const CHANNELS = 1
const BYTES_PER_SAMPLE = 2 // S16LE
const CHUNK_SECONDS = 0.5
const CHUNK_BYTES = SAMPLE_RATE * CHANNELS * BYTES_PER_SAMPLE * CHUNK_SECONDS
// Skip empty tail fragments that aren't worth a round-trip (~0.1s).
const MIN_CHUNK_BYTES = Math.floor(SAMPLE_RATE * CHANNELS * BYTES_PER_SAMPLE * 0.1)

// Whisper hallucinates stock phrases ("Thank you.", "Obrigado.", "Vamos lá.")
// when handed silence or near-silent audio. Gate chunks by RMS energy (0..32768
// for S16) so we never send silence to the API. Typical room noise sits well
// below ~300 RMS; speech is several thousand.
const SILENCE_RMS_THRESHOLD = 350

/** True when a raw S16LE PCM chunk is essentially silent. */
function isSilent(pcm: Buffer): boolean {
	const sampleCount = Math.floor(pcm.length / BYTES_PER_SAMPLE)
	if (sampleCount === 0) {
		return true
	}
	let sumSquares = 0
	for (let i = 0; i + 1 < pcm.length; i += 2) {
		const sample = pcm.readInt16LE(i)
		sumSquares += sample * sample
	}
	const rms = Math.sqrt(sumSquares / sampleCount)
	return rms < SILENCE_RMS_THRESHOLD
}

export type TranscriptHandler = (text: string) => void
export type RecorderErrorHandler = (message: string) => void

/** ffmpeg input args for capturing the default microphone, per platform. */
function ffmpegInputArgs(): string[] | undefined {
	switch (process.platform) {
		case "darwin":
			return ["-f", "avfoundation", "-i", ":default"]
		case "linux":
			// Prefer PulseAudio/PipeWire; most desktop Linux has the `default` source.
			return ["-f", "pulse", "-i", "default"]
		case "win32":
			return ["-f", "dshow", "-i", "audio=default"]
		default:
			return undefined
	}
}

/** Resolve an ffmpeg binary, tolerating a PATH that omits Homebrew etc. */
async function resolveFfmpeg(): Promise<string> {
	const candidates =
		process.platform === "win32"
			? ["ffmpeg.exe", "ffmpeg"]
			: ["/opt/homebrew/bin/ffmpeg", "/usr/local/bin/ffmpeg", "/usr/bin/ffmpeg", "/bin/ffmpeg"]

	for (const candidate of candidates) {
		try {
			await access(candidate, fsConstants.X_OK)
			return candidate
		} catch {
			// try next
		}
	}
	// Last resort: rely on PATH. If it's not there, spawn emits an 'error' event.
	return process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg"
}

/** Wrap raw S16LE/16kHz/mono PCM in a 44-byte WAV header. */
function pcmToWav(pcm: Buffer): Buffer {
	const header = Buffer.alloc(44)
	const byteRate = SAMPLE_RATE * CHANNELS * BYTES_PER_SAMPLE
	const blockAlign = CHANNELS * BYTES_PER_SAMPLE

	header.write("RIFF", 0)
	header.writeUInt32LE(36 + pcm.length, 4)
	header.write("WAVE", 8)
	header.write("fmt ", 12)
	header.writeUInt32LE(16, 16) // PCM fmt chunk size
	header.writeUInt16LE(1, 20) // audioFormat = PCM
	header.writeUInt16LE(CHANNELS, 22)
	header.writeUInt32LE(SAMPLE_RATE, 24)
	header.writeUInt32LE(byteRate, 28)
	header.writeUInt16LE(blockAlign, 32)
	header.writeUInt16LE(BYTES_PER_SAMPLE * 8, 34)
	header.write("data", 36)
	header.writeUInt32LE(pcm.length, 40)

	return Buffer.concat([header, pcm])
}

export class SpeechToTextRecorder {
	private proc?: ChildProcessWithoutNullStreams
	private buffer: Buffer = Buffer.alloc(0)
	private stopped = false
	// Serialize transcription so chunks are appended in capture order.
	private chain: Promise<void> = Promise.resolve()

	constructor(
		private readonly token: string,
		private readonly onTranscript: TranscriptHandler,
		private readonly onError: RecorderErrorHandler,
		private readonly language?: string,
	) {}

	async start(): Promise<void> {
		const input = ffmpegInputArgs()
		if (!input) {
			this.onError("Audio recording is not supported on this platform.")
			return
		}

		const ffmpeg = await resolveFfmpeg()
		const args = [
			"-hide_banner",
			"-loglevel",
			"error",
			...input,
			"-ac",
			String(CHANNELS),
			"-ar",
			String(SAMPLE_RATE),
			"-f",
			"s16le",
			"pipe:1",
		]

		const proc = spawn(ffmpeg, args, {
			stdio: ["pipe", "pipe", "pipe"],
			env: {
				...process.env,
				// Make sure Homebrew/usr-local tools are reachable when the host
				// PATH is minimal (e.g. launched from the macOS Dock).
				PATH: `${process.env.PATH ?? ""}:/opt/homebrew/bin:/usr/local/bin:/usr/bin`,
			},
		}) as ChildProcessWithoutNullStreams
		this.proc = proc

		let stderr = ""
		proc.stderr.on("data", (d: Buffer) => {
			stderr += d.toString()
		})

		proc.stdout.on("data", (data: Buffer) => {
			this.buffer = Buffer.concat([this.buffer, data])
			while (this.buffer.length >= CHUNK_BYTES) {
				const chunk = this.buffer.subarray(0, CHUNK_BYTES)
				this.buffer = this.buffer.subarray(CHUNK_BYTES)
				this.enqueue(Buffer.from(chunk))
			}
		})

		proc.on("error", (err) => {
			this.onError(
				`Could not start the recorder (ffmpeg). Make sure ffmpeg is installed. (${err.message})`,
			)
		})

		proc.on("exit", (code) => {
			if (!this.stopped && code && code !== 0) {
				this.onError(`Recorder stopped unexpectedly. ${stderr.trim().slice(0, 200)}`)
			}
		})
	}

	private enqueue(pcm: Buffer): void {
		this.chain = this.chain.then(() => this.transcribe(pcm)).catch(() => {})
	}

	private async transcribe(pcm: Buffer): Promise<void> {
		if (pcm.length < MIN_CHUNK_BYTES) {
			return
		}

		// Don't send silence — Whisper invents filler phrases for it.
		if (isSilent(pcm)) {
			return
		}

		try {
			const audio = pcmToWav(pcm).toString("base64")
			const body: Record<string, unknown> = { audio }
			if (this.language) {
				body.language = this.language
			}

			const response = await axios.post(STT_URL, body, {
				headers: {
					Authorization: `Bearer ${this.token}`,
					"Content-Type": "application/json",
				},
				timeout: 60000,
				responseType: "text",
			})

			const text = typeof response.data === "string" ? response.data.trim() : ""
			if (text) {
				this.onTranscript(text)
			}
		} catch (error: any) {
			this.onError(error?.response?.data?.message || error?.message || "Failed to transcribe audio.")
		}
	}

	async stop(): Promise<void> {
		this.stopped = true
		const proc = this.proc
		this.proc = undefined

		if (proc && proc.exitCode === null) {
			// Ask ffmpeg to flush and exit gracefully ('q' on stdin), else kill.
			try {
				proc.stdin.write("q")
			} catch {
				// ignore
			}
			await new Promise<void>((resolve) => {
				const timer = setTimeout(() => {
					try {
						proc.kill("SIGKILL")
					} catch {
						// ignore
					}
					resolve()
				}, 2000)
				proc.once("exit", () => {
					clearTimeout(timer)
					resolve()
				})
			})
		}

		// Flush whatever remains as the final chunk.
		if (this.buffer.length >= MIN_CHUNK_BYTES) {
			this.enqueue(this.buffer)
		}
		this.buffer = Buffer.alloc(0)

		// Wait for all queued transcriptions to finish.
		await this.chain
	}
}
