/**
 * Tests for the /usage command
 */

import { describe, it, expect, vi, beforeEach } from "vitest"
import { usageCommand, costCommand } from "../cost.js"
import type { CommandContext } from "../core/types.js"

describe("/usage command", () => {
	let mockContext: CommandContext
	let addMessageMock: ReturnType<typeof vi.fn>

	beforeEach(() => {
		addMessageMock = vi.fn()

		mockContext = {
			input: "/usage",
			args: [],
			options: {},
			sendMessage: vi.fn().mockResolvedValue(undefined),
			addMessage: addMessageMock,
			clearMessages: vi.fn(),
			replaceMessages: vi.fn(),
			setMessageCutoffTimestamp: vi.fn(),
			clearTask: vi.fn().mockResolvedValue(undefined),
			setMode: vi.fn(),
			exit: vi.fn(),
			setCommittingParallelMode: vi.fn(),
			isParallelMode: false,
			extensionService: null,
			routerModels: null,
			currentProvider: {
				id: "test-provider",
				provider: "kilocode",
				kilocodeToken: "test-token",
			},
			kilocodeDefaultModel: "test-model",
			updateProviderModel: vi.fn().mockResolvedValue(undefined),
			refreshRouterModels: vi.fn().mockResolvedValue(undefined),
			updateProvider: vi.fn().mockResolvedValue(undefined),
			profileData: null,
			balanceData: null,
			profileLoading: false,
			balanceLoading: false,
			currentTask: null,
		}
	})

	describe("Command metadata", () => {
		it("should have correct name and aliases", () => {
			expect(usageCommand.name).toBe("usage")
			expect(usageCommand.aliases).toEqual(["cost", "limits"])
			expect(costCommand).toBe(usageCommand)
		})

		it("should have correct description", () => {
			expect(usageCommand.description).toBe("View current task token usage and plan details")
		})

		it("should have correct category", () => {
			expect(usageCommand.category).toBe("settings")
		})

		it("should have correct usage and examples", () => {
			expect(usageCommand.usage).toBe("/usage")
			expect(usageCommand.examples).toContain("/usage")
			expect(usageCommand.examples).toContain("/cost")
		})
	})

	describe("Task token usage and plan details output", () => {
		it("should print plan details when no active task", async () => {
			mockContext.profileData = {
				plan: "pro",
				usagePercentage: 25,
				creditsResetDate: "2026-09-01T00:00:00Z",
			}
			mockContext.balanceData = {
				balance: 15.5,
			}
			mockContext.currentTask = null

			await usageCommand.handler(mockContext)

			expect(addMessageMock).toHaveBeenCalledTimes(1)
			const content = addMessageMock.mock.calls[0][0].content
			expect(content).not.toContain("Current Task Token Usage")
			expect(content).toContain("Plan Details:")
			expect(content).toContain("PRO")
			expect(content).toContain("25.0%")
			expect(content).toContain("$15.50")
		})

		it("should print both task token usage and plan details when task is active", async () => {
			mockContext.currentTask = {
				id: "task-123",
				ts: Date.now(),
				task: "Test task",
				tokensIn: 5432,
				tokensOut: 1234,
				cacheReads: 200,
				cacheWrites: 100,
				totalCost: 0.0567,
				size: 1000,
			}
			mockContext.profileData = {
				plan: "ultra",
				remainingReviews: 10,
				tieredUsage: {
					plan: "ultra",
					monthlyLimit: 1000,
					weekly: {
						used: 125,
						limit: 1000,
						remaining: 875,
						percentage: 12.5,
						resetsAt: "2026-08-20T00:00:00Z",
						windowStart: "2026-08-13T00:00:00Z",
					},
					monthly: {
						used: 300,
						limit: 1000,
						remaining: 700,
						percentage: 30.0,
						resetsAt: "2026-09-01T00:00:00Z",
						windowStart: "2026-08-01T00:00:00Z",
					},
				},
			}
			mockContext.balanceData = {
				balance: 50.0,
			}

			await usageCommand.handler(mockContext)

			expect(addMessageMock).toHaveBeenCalledTimes(1)
			const content = addMessageMock.mock.calls[0][0].content
			expect(content).toContain("Current Task Token Usage:")
			expect(content).toContain("Tokens In: **5,432**")
			expect(content).toContain("Tokens Out: **1,234**")
			expect(content).toContain("Cache Reads: **200**")
			expect(content).toContain("Cache Writes: **100**")
			expect(content).toContain("Total Cost: **$0.0567**")
			expect(content).toContain("Plan Details:")
			expect(content).toContain("ULTRA")
			expect(content).toContain("Weekly")
			expect(content).toContain("Monthly")
			expect(content).toContain("Code Reviews: **10 remaining**")
			expect(content).toContain("Balance: **$50.00**")
		})

		it("should print task token usage even if provider is not Kilocode, and state plan requirements", async () => {
			mockContext.currentProvider = {
				id: "test-provider",
				provider: "anthropic",
			}
			mockContext.currentTask = {
				id: "task-123",
				ts: Date.now(),
				task: "Test task",
				tokensIn: 1000,
				tokensOut: 500,
				totalCost: 0.01,
				size: 500,
			}

			await usageCommand.handler(mockContext)

			expect(addMessageMock).toHaveBeenCalledTimes(1)
			const content = addMessageMock.mock.calls[0][0].content
			expect(content).toContain("Current Task Token Usage:")
			expect(content).toContain("Tokens In: **1,000**")
			expect(content).toContain("Tokens Out: **500**")
			expect(content).toContain("Plan Details:")
			expect(content).toContain("Plan details require Kilocode provider")
		})
	})
})
