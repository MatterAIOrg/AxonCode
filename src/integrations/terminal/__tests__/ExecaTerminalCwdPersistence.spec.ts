// npx vitest run integrations/terminal/__tests__/ExecaTerminalCwdPersistence.spec.ts
//
// Real-shell integration test (no execa mock) verifying that working-directory
// changes (`cd`) persist across commands in the execa terminal, and that
// GIT_EDITOR is set so git can never hang on an interactive editor.

import { mkdtempSync, mkdirSync, realpathSync, rmSync } from "fs"
import os from "os"
import path from "path"

import { ExecaTerminal } from "../ExecaTerminal"
import type { RooTerminalCallbacks } from "../types"

// Drives a single command through the real ExecaTerminal and resolves with
// the combined output once the command completes.
function runCommand(terminal: ExecaTerminal, command: string): Promise<string> {
	return new Promise<string>((resolve, reject) => {
		let output = ""
		const callbacks: RooTerminalCallbacks = {
			onLine: () => {},
			onCompleted: (out) => {
				output = out ?? ""
			},
			onShellExecutionStarted: () => {},
			onShellExecutionComplete: () => {},
		}
		const process = terminal.runCommand(command, callbacks)
		process.then(() => resolve(output)).catch(reject)
	})
}

describe.skipIf(process.platform === "win32")("ExecaTerminal cwd persistence", () => {
	let baseDir: string
	let subDir: string

	beforeEach(() => {
		// realpathSync to match `pwd -P`, which resolves symlinks (e.g. /tmp -> /private/tmp on macOS).
		baseDir = realpathSync(mkdtempSync(path.join(os.tmpdir(), "mc-cwd-")))
		subDir = path.join(baseDir, "subdir")
		mkdirSync(subDir)
	})

	afterEach(() => {
		rmSync(baseDir, { recursive: true, force: true })
	})

	it("carries a `cd` from one command into the next", async () => {
		const terminal = new ExecaTerminal(1, baseDir)

		const pwd1 = await runCommand(terminal, "pwd")
		expect(pwd1.trim()).toBe(baseDir)

		// Change directory in its own command — the classic case that used to be lost.
		await runCommand(terminal, "cd subdir && echo moved")

		expect(terminal.getCurrentWorkingDirectory()).toBe(subDir)

		// A fresh command now runs from the new directory.
		const pwd2 = await runCommand(terminal, "pwd")
		expect(pwd2.trim()).toBe(subDir)
	})

	it("preserves a failing command's exit code while still capturing cwd", async () => {
		const terminal = new ExecaTerminal(2, baseDir)
		let exitCode: number | undefined

		await new Promise<void>((resolve, reject) => {
			const callbacks: RooTerminalCallbacks = {
				onLine: () => {},
				onCompleted: () => {},
				onShellExecutionStarted: () => {},
				onShellExecutionComplete: (details) => {
					exitCode = details.exitCode
				},
			}
			// `cd` succeeds, then the command fails (exit 1) without exiting the
			// shell itself — so the appended `pwd` trailer still runs.
			terminal
				.runCommand("cd subdir && false", callbacks)
				.then(() => resolve())
				.catch(reject)
		})

		// The real exit code survives the appended trailer (not masked by `pwd`'s 0)...
		expect(exitCode).toBe(1)
		// ...and the cwd is still captured for the next command.
		expect(terminal.getCurrentWorkingDirectory()).toBe(subDir)
	})

	it("exposes GIT_EDITOR=true to spawned commands so git can't hang on an editor", async () => {
		const terminal = new ExecaTerminal(3, baseDir)
		const out = await runCommand(terminal, "echo $GIT_EDITOR")
		expect(out.trim()).toBe("true")
	})
})
