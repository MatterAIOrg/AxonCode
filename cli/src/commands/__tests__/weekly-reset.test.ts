import { EventEmitter } from "events"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { CommandContext } from "../core/types.js"
import { weeklyResetCommand } from "../weekly-reset.js"

describe("/weekly-reset command", () => {
	let service: EventEmitter
	let context: CommandContext
	let addMessage: ReturnType<typeof vi.fn>

	afterEach(() => {
		vi.useRealTimers()
	})

	beforeEach(() => {
		service = new EventEmitter()
		addMessage = vi.fn()
		context = {
			currentProvider: {
				id: "test-provider",
				provider: "kilocode",
				kilocodeToken: "test-token",
			},
			extensionService: service as any,
			sendMessage: vi.fn(async () => {
				queueMicrotask(() =>
					service.emit("message", {
						type: "resetWeeklyUsageResponse",
						payload: { success: true, data: {} },
					}),
				)
			}),
			addMessage,
		} as unknown as CommandContext
	})

	it("registers the expected command name and alias", () => {
		expect(weeklyResetCommand.name).toBe("weekly-reset")
		expect(weeklyResetCommand.aliases).toContain("reset-weekly")
	})

	it("sends the reset request and reports success", async () => {
		await weeklyResetCommand.handler(context)

		expect(context.sendMessage).toHaveBeenCalledWith({ type: "resetWeeklyUsageRequest" })
		expect(addMessage).toHaveBeenCalledWith(
			expect.objectContaining({ type: "system", content: expect.stringContaining("Weekly usage reset") }),
		)
	})

	it("shows the backend error", async () => {
		context.sendMessage = vi.fn(async () => {
			queueMicrotask(() =>
				service.emit("message", {
					type: "resetWeeklyUsageResponse",
					payload: { success: false, error: "Weekly reset already used" },
				}),
			)
		})

		await weeklyResetCommand.handler(context)

		expect(addMessage).toHaveBeenCalledWith(
			expect.objectContaining({ type: "error", content: "Weekly reset already used" }),
		)
	})

	it("reports a friendly error instead of throwing on timeout", async () => {
		vi.useFakeTimers()
		// Never emit a response so waitForReset times out.
		context.sendMessage = vi.fn(async () => {})

		const handlerPromise = weeklyResetCommand.handler(context)
		await vi.advanceTimersByTimeAsync(10_000)
		await handlerPromise

		expect(addMessage).toHaveBeenCalledWith(
			expect.objectContaining({ type: "error", content: "Timed out waiting for the weekly reset." }),
		)
	})
})
