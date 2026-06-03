// npx vitest run integrations/terminal/__tests__/ShellEnvironment.spec.ts

import { execFileSync } from "child_process"

vi.mock("../../../utils/shell", () => ({
	getShell: vi.fn().mockReturnValue("/bin/zsh"),
}))

vi.mock("child_process", () => ({
	execFileSync: vi.fn(),
}))

import {
	captureShellEnvironment,
	getShellEnvironment,
	getCapturedShell,
	invalidateShellEnvironment,
	setShellLogger,
	type ShellLogger,
} from "../ShellEnvironment"
import { getShell } from "../../../utils/shell"

describe("ShellEnvironment", () => {
	let mockLogger: ReturnType<typeof vi.fn>

	beforeEach(() => {
		vi.clearAllMocks()
		invalidateShellEnvironment()
		mockLogger = vi.fn()
		setShellLogger(mockLogger as unknown as ShellLogger)
		// Reset process.platform to darwin for consistent testing
		Object.defineProperty(process, "platform", { value: "darwin", configurable: true })
	})

	describe("captureShellEnvironment", () => {
		it("should capture login shell environment on macOS", () => {
			const mockEnvOutput = "PATH=/opt/homebrew/bin:/usr/bin:/bin\nHOME=/Users/test\nUSER=test\n"
			vi.mocked(execFileSync).mockReturnValue(mockEnvOutput)

			const result = captureShellEnvironment()

			expect(execFileSync).toHaveBeenCalledWith("/bin/zsh", ["-l", "-c", "env"], {
				encoding: "utf8",
				timeout: 5000,
				env: process.env as Record<string, string>,
				stdio: ["ignore", "pipe", "pipe"],
			})

			expect(result.PATH).toBe("/opt/homebrew/bin:/usr/bin:/bin")
			expect(result.HOME).toBe("/Users/test")
			expect(result.USER).toBe("test")
			expect(mockLogger).toHaveBeenCalledWith(expect.stringContaining("[ShellEnvironment] Captured 3 env vars"))
		})

		it("should skip login shell capture on Windows and use process.env", () => {
			Object.defineProperty(process, "platform", { value: "win32", configurable: true })

			const result = captureShellEnvironment()

			expect(execFileSync).not.toHaveBeenCalled()
			expect(result).toEqual(process.env)
		})

		it("should fall back to process.env when execFileSync fails", () => {
			vi.mocked(execFileSync).mockImplementation(() => {
				throw new Error("Shell not found")
			})

			const result = captureShellEnvironment()

			expect(result).toEqual(process.env)
			expect(mockLogger).toHaveBeenCalledWith(
				expect.stringContaining("[ShellEnvironment] Failed to capture shell environment: Shell not found"),
			)
		})

		it("should prefer login-shell values over empty process.env values for existing keys", () => {
			// Simulate login shell producing empty PATH
			const mockEnvOutput = "PATH=\nHOME=/Users/test\nUSER=test_user\n"
			vi.mocked(execFileSync).mockReturnValue(mockEnvOutput)

			// Pre-condition: PATH exists in process.env
			const originalPath = process.env.PATH
			process.env.PATH = "/usr/bin:/bin"
			process.env.HOME = ""

			const result = captureShellEnvironment()

			// Empty login-shell value for existing key: keep process.env value
			expect(result.PATH).toBe("/usr/bin:/bin")
			// Non-empty login-shell value overwrites
			expect(result.HOME).toBe("/Users/test")

			// Restore
			process.env.PATH = originalPath
		})

		it("should cache the result and return cached on subsequent calls", () => {
			const mockEnvOutput = "PATH=/custom/bin\n"
			vi.mocked(execFileSync).mockReturnValue(mockEnvOutput)

			const result1 = captureShellEnvironment()
			const result2 = captureShellEnvironment()

			expect(result1).toBe(result2)
			expect(execFileSync).toHaveBeenCalledTimes(1)
		})

		it("should use getShell() to determine the shell binary", () => {
			;(getShell as any).mockReturnValue("/bin/bash")
			vi.mocked(execFileSync).mockReturnValue("PATH=/usr/bin\n")

			captureShellEnvironment()

			expect(execFileSync).toHaveBeenCalledWith("/bin/bash", ["-l", "-c", "env"], expect.anything())
		})
	})

	describe("getShellEnvironment", () => {
		it("should capture on first call and return cached on second", () => {
			const mockEnvOutput = "HOME=/test\n"
			vi.mocked(execFileSync).mockReturnValue(mockEnvOutput)

			const env1 = getShellEnvironment()
			const env2 = getShellEnvironment()

			expect(env1).toBeDefined()
			expect(env2).toBe(env1)
			expect(execFileSync).toHaveBeenCalledTimes(1)
		})
	})

	describe("getCapturedShell", () => {
		it("should capture shell on first call", () => {
			vi.mocked(execFileSync).mockReturnValue("PATH=/usr/bin\n")

			const shell = getCapturedShell()

			expect(shell).toBe("/bin/zsh")
		})

		it("should return cached shell on subsequent calls", () => {
			vi.mocked(execFileSync).mockReturnValue("PATH=/usr/bin\n")

			getCapturedShell()
			const shell = getCapturedShell()

			expect(shell).toBe("/bin/zsh")
		})

		it("should fall back to getShell() when no capture has run", () => {
			;(getShell as any).mockReturnValue("/bin/sh")

			// Invalidate to clear cache, then call without capture
			invalidateShellEnvironment()

			const shell = getCapturedShell()

			expect(shell).toBe("/bin/sh")
		})
	})

	describe("invalidateShellEnvironment", () => {
		it("should clear cached environment and shell", () => {
			vi.mocked(execFileSync).mockReturnValue("PATH=/usr/bin\n")
			captureShellEnvironment()

			invalidateShellEnvironment()
			vi.mocked(execFileSync).mockReturnValue("PATH=/new/path\n")

			const result = captureShellEnvironment()

			expect(result.PATH).toBe("/new/path")
			expect(execFileSync).toHaveBeenCalledTimes(2)
		})
	})

	describe("setShellLogger", () => {
		it("should use the custom logger for diagnostic messages", () => {
			const customLogger = vi.fn()
			setShellLogger(customLogger as unknown as ShellLogger)
			vi.mocked(execFileSync).mockReturnValue("PATH=/bin\n")

			captureShellEnvironment()

			expect(customLogger).toHaveBeenCalledWith(expect.stringContaining("[ShellEnvironment]"))
		})

		it("should use the custom logger for error messages", () => {
			const customLogger = vi.fn()
			setShellLogger(customLogger as unknown as ShellLogger)
			vi.mocked(execFileSync).mockImplementation(() => {
				throw new Error("Boom")
			})

			captureShellEnvironment()

			expect(customLogger).toHaveBeenCalledWith(expect.stringContaining("[ShellEnvironment] Failed"))
		})
	})
})
