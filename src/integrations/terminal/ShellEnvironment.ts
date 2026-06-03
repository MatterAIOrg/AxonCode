import { execFileSync } from "child_process"
import { getShell } from "../../utils/shell"

let cachedEnv: Record<string, string> | null = null
let capturedShell: string | null = null

export type ShellLogger = (message: string) => void

let logger: ShellLogger = console.log

/** Sets the logger used for ShellEnvironment diagnostic messages. */
export function setShellLogger(newLogger: ShellLogger): void {
	logger = newLogger
}

/**
 * Captures the user's full login shell environment by running their configured
 * shell with the -l (login) flag and parsing the output of `env`.
 *
 * Uses execFileSync (not execSync) to pass the shell path and arguments as an
 * array, preventing command injection via metacharacters in the shell path.
 *
 * This is necessary because VS Code extensions launched from the macOS
 * Dock/Finder inherit launchd's restricted PATH (/usr/bin:/bin) rather than
 * the user's full shell PATH (which includes Homebrew, nvm, cargo, etc.).
 *
 * ClaudeCode uses the same pattern via ShellSnapshot.ts — running the user's
 * interactive config and capturing the resulting environment.
 */
export function captureShellEnvironment(): Record<string, string> {
	if (cachedEnv) {
		return cachedEnv
	}

	const shell = getShell()
	capturedShell = shell

	// On Windows, process.env inherits system PATH correctly from the
	// installer/Start Menu launch path. No login-shell roundtrip needed.
	if (process.platform === "win32") {
		cachedEnv = { ...process.env } as Record<string, string>
		return cachedEnv
	}

	try {
		// Run the user's shell as a login shell (-l) with the env command
		// using execFileSync for defense against shell metacharacters in
		// the shell path. stderr is piped so shell startup messages (motd,
		// etc.) don't mix with the env output on stdout.
		const output = execFileSync(shell, ["-l", "-c", "env"], {
			encoding: "utf8",
			timeout: 5000,
			env: process.env as Record<string, string>,
			stdio: ["ignore", "pipe", "pipe"],
		})

		const env: Record<string, string> = {}
		for (const line of output.split("\n")) {
			const eqIdx = line.indexOf("=")
			if (eqIdx > 0) {
				const key = line.slice(0, eqIdx)
				const value = line.slice(eqIdx + 1)
				// Prefer the login-shell value; only keep process.env value
				// when the login shell produces an empty string for a key
				// that already exists in process.env.
				if (value) {
					env[key] = value
				} else if (key in process.env) {
					env[key] = process.env[key]!
				} else {
					env[key] = value
				}
			}
		}

		cachedEnv = env
		logger(
			`[ShellEnvironment] Captured ${Object.keys(env).length} env vars from ${shell} -l (PATH=${env.PATH?.slice(0, 80)}...)`,
		)
		return env
	} catch (error) {
		logger(
			`[ShellEnvironment] Failed to capture shell environment: ${error instanceof Error ? error.message : String(error)}`,
		)
		cachedEnv = { ...process.env } as Record<string, string>
		return cachedEnv
	}
}

/** Returns the cached environment, capturing on first call. */
export function getShellEnvironment(): Record<string, string> {
	return cachedEnv ?? captureShellEnvironment()
}

/**
 * Returns the detected user shell binary (e.g. /bin/zsh).
 * Falls back to getShell() if capture hasn't run yet.
 */
export function getCapturedShell(): string {
	if (!capturedShell) {
		captureShellEnvironment()
	}
	return capturedShell ?? getShell()
}

/** Invalidate cached environment (e.g. on PATH changes at runtime). */
export function invalidateShellEnvironment(): void {
	cachedEnv = null
	capturedShell = null
}
