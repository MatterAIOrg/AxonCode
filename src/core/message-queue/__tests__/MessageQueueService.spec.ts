import { MessageQueueService } from "../MessageQueueService"
import { isCompletionQueueBoundary, isTaskIdleForQueuedMessages } from "../queueLifecycle"

describe("MessageQueueService", () => {
	it("snapshots and restores pending messages without changing their identity", () => {
		const source = new MessageQueueService()
		const queuedMessage = source.addMessage("keep me queued", ["data:image/png;base64,abc"])
		expect(queuedMessage).toBeDefined()

		const snapshot = source.snapshot()
		source.dispose()

		const restored = new MessageQueueService()
		const stateChanged = vi.fn()
		restored.on("stateChanged", stateChanged)
		restored.restoreMessages(snapshot)

		expect(restored.messages).toEqual(snapshot)
		expect(restored.messages[0]).not.toBe(snapshot[0])
		expect(restored.messages[0].images).not.toBe(snapshot[0].images)
		expect(restored.messages[0]).toMatchObject({
			id: queuedMessage?.id,
			timestamp: queuedMessage?.timestamp,
			text: "keep me queued",
		})
		expect(stateChanged).toHaveBeenCalledTimes(1)
	})

	it("does not duplicate a message when the same snapshot is restored twice", () => {
		const source = new MessageQueueService()
		source.addMessage("only once")

		const restored = new MessageQueueService()
		const snapshot = source.snapshot()
		restored.restoreMessages(snapshot)
		restored.restoreMessages(snapshot)

		expect(restored.messages).toHaveLength(1)
	})

	it.each(["tool", "command", "followup", "api_req_failed"] as const)(
		"does not treat a %s ask as a queued-message dispatch boundary",
		(askType) => {
			expect(isCompletionQueueBoundary(askType, false)).toBe(false)
		},
	)

	it("treats only the completed attempt-completion ask as an early dispatch boundary", () => {
		expect(isCompletionQueueBoundary("completion_result", true)).toBe(false)
		expect(isCompletionQueueBoundary("completion_result", false)).toBe(true)
		expect(isCompletionQueueBoundary("completion_result")).toBe(true)
	})

	it.each([
		{ taskRequestCount: 1, isStreaming: false, isWaitingForAskResponse: false },
		{ taskRequestCount: 0, isStreaming: true, isWaitingForAskResponse: false },
		{ taskRequestCount: 0, isStreaming: false, isWaitingForAskResponse: true },
	])("keeps messages queued while agent work is active: %o", (state) => {
		expect(isTaskIdleForQueuedMessages(state)).toBe(false)
	})

	it("allows dispatch after a content-only turn becomes fully idle", () => {
		expect(
			isTaskIdleForQueuedMessages({
				taskRequestCount: 0,
				isStreaming: false,
				isWaitingForAskResponse: false,
			}),
		).toBe(true)
	})
})
