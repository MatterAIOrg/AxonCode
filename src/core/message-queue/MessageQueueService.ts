import { EventEmitter } from "events"

import { v4 as uuidv4 } from "uuid"

import { PasteChipSerialized, QueuedMessage } from "@roo-code/types"

export interface MessageQueueState {
	messages: QueuedMessage[]
	isProcessing: boolean
	isPaused: boolean
}

export interface QueueEvents {
	stateChanged: [messages: QueuedMessage[]]
}

export class MessageQueueService extends EventEmitter<QueueEvents> {
	private _messages: QueuedMessage[]

	constructor() {
		super()

		this._messages = []
	}

	private findMessage(id: string) {
		const index = this._messages.findIndex((msg) => msg.id === id)

		if (index === -1) {
			return { index, message: undefined }
		}

		return { index, message: this._messages[index] }
	}

	public addMessage(text: string, images?: string[], pasteChips?: PasteChipSerialized[]): QueuedMessage | undefined {
		if (!text && !images?.length) {
			return undefined
		}

		const message: QueuedMessage = {
			timestamp: Date.now(),
			id: uuidv4(),
			text,
			images,
			pasteChips: pasteChips && pasteChips.length > 0 ? pasteChips : undefined,
		}

		this._messages.push(message)
		this.emit("stateChanged", this._messages)

		return message
	}

	public removeMessage(id: string): boolean {
		const { index, message } = this.findMessage(id)

		if (!message) {
			return false
		}

		this._messages.splice(index, 1)
		this.emit("stateChanged", this._messages)
		return true
	}

	public updateMessage(id: string, text: string, images?: string[], pasteChips?: PasteChipSerialized[]): boolean {
		const { message } = this.findMessage(id)

		if (!message) {
			return false
		}

		message.timestamp = Date.now()
		message.text = text
		message.images = images
		message.pasteChips = pasteChips && pasteChips.length > 0 ? pasteChips : undefined
		this.emit("stateChanged", this._messages)
		return true
	}

	public getAndRemoveMessage(id: string): QueuedMessage | undefined {
		const { index, message } = this.findMessage(id)

		if (!message) {
			return undefined
		}

		this._messages.splice(index, 1)
		this.emit("stateChanged", this._messages)
		return message
	}

	public dequeueMessage(): QueuedMessage | undefined {
		const message = this._messages.shift()
		this.emit("stateChanged", this._messages)
		return message
	}

	/**
	 * Return a detached copy suitable for carrying pending messages across a
	 * same-task rehydration. Queue ids and timestamps are preserved so the UI
	 * continues to treat them as the same queued items.
	 */
	public snapshot(): QueuedMessage[] {
		return this._messages.map((message) => ({
			...message,
			images: message.images ? [...message.images] : undefined,
		}))
	}

	public restoreMessages(messages: readonly QueuedMessage[]): void {
		if (messages.length === 0) {
			return
		}

		const existingIds = new Set(this._messages.map((message) => message.id))
		const restoredMessages: QueuedMessage[] = []

		for (const message of messages) {
			if (existingIds.has(message.id)) {
				continue
			}

			existingIds.add(message.id)
			restoredMessages.push({
				...message,
				images: message.images ? [...message.images] : undefined,
			})
		}

		if (restoredMessages.length === 0) {
			return
		}

		this._messages.push(...restoredMessages)
		this.emit("stateChanged", this._messages)
	}

	public get messages(): QueuedMessage[] {
		return this._messages
	}

	public isEmpty(): boolean {
		return this._messages.length === 0
	}

	public dispose(): void {
		this._messages = []
		this.removeAllListeners()
	}
}
