/**
 * /cost command - View usage limits and costs
 */

import type { Command } from "./core/types.js"
import type { AxonCodeTieredUsage, AxonCodeWindowUsage } from "../state/atoms/profile.js"

function formatRelativeTime(isoStr?: string): string {
	if (!isoStr) return "on session start"
	const now = Date.now()
	const target = new Date(isoStr).getTime()
	if (Number.isNaN(target)) return "on session start"
	const diff = target - now
	if (diff <= 0) return "now"
	const sec = Math.floor(diff / 1000)
	const min = Math.floor(sec / 60)
	const hrs = Math.floor(min / 60)
	const days = Math.floor(hrs / 24)
	if (days >= 1) return `in ${days} day${days > 1 ? "s" : ""}`
	if (hrs >= 1) return `in ${hrs}h ${min % 60}m`
	if (min >= 1) return `in ${min}m`
	return "soon"
}

function renderBar(percentage: number, width: number = 20): string {
	const filled = Math.round((Math.min(percentage, 100) / 100) * width)
	const empty = width - filled
	return "█".repeat(filled) + "░".repeat(empty)
}

function renderWindowUsage(label: string, w: AxonCodeWindowUsage): string {
	const pct = Math.max(0, Math.min(100, w.percentage || 0))
	const exhausted = (w.remaining || 0) <= 0
	const status = exhausted ? "EXHAUSTED" : `${pct.toFixed(1)}%`
	return `  ${label.padEnd(14)} ${renderBar(pct)} ${status.padEnd(10)} Resets ${formatRelativeTime(w.resetsAt)}`
}

async function showCost(context: any): Promise<void> {
	const { currentProvider, addMessage, profileData, balanceData, profileLoading, balanceLoading } = context

	if (!currentProvider || currentProvider.provider !== "kilocode") {
		addMessage({
			id: Date.now().toString(),
			type: "error",
			content: "Cost command requires Kilocode provider. Please configure Kilocode as your provider.",
			ts: Date.now(),
		})
		return
	}

	if (!currentProvider.kilocodeToken) {
		addMessage({
			id: Date.now().toString(),
			type: "error",
			content: "Not authenticated. Please configure your Kilocode token first.",
			ts: Date.now(),
		})
		return
	}

	if (profileLoading || balanceLoading) {
		addMessage({
			id: Date.now().toString(),
			type: "system",
			content: "Loading usage data...",
			ts: Date.now(),
		})
		return
	}

	if (!profileData) {
		addMessage({
			id: Date.now().toString(),
			type: "error",
			content: "No profile data available. Try again shortly.",
			ts: Date.now(),
		})
		return
	}

	const lines: string[] = ["**Usage Limits**\n"]

	if (profileData.plan) {
		lines.push(`Plan: **${profileData.plan.toUpperCase()}**`)
		lines.push("")
	}

	const tiered = profileData.tieredUsage as AxonCodeTieredUsage | undefined
	if (tiered) {
		lines.push("```")
		lines.push(`Window                 Usage                 Resets`)
		lines.push(`────────────────────────────────────────────────────`)
		lines.push(renderWindowUsage("Weekly", tiered.weekly))
		lines.push(renderWindowUsage("Monthly", tiered.monthly))
		lines.push("```")
	} else if (profileData.usagePercentage !== undefined) {
		const pct = Math.max(0, Math.min(100, profileData.usagePercentage))
		lines.push(`Monthly limit: ${renderBar(pct)} ${pct.toFixed(1)}%`)
		if (profileData.creditsResetDate) {
			lines.push(`Resets: ${new Date(profileData.creditsResetDate).toLocaleDateString()}`)
		}
	}

	if (profileData.remainingReviews !== undefined) {
		lines.push("")
		lines.push(`Code Reviews: **${profileData.remainingReviews.toFixed(0)} remaining**`)
	}

	if (balanceData?.balance !== undefined && balanceData.balance !== null) {
		lines.push("")
		lines.push(`Balance: **$${balanceData.balance.toFixed(2)}**`)
	}

	addMessage({
		id: Date.now().toString(),
		type: "system",
		content: lines.join("\n"),
		ts: Date.now(),
	})
}

export const costCommand: Command = {
	name: "cost",
	aliases: ["usage", "limits"],
	description: "View usage limits, costs, and balance",
	usage: "/cost",
	examples: ["/cost", "/usage", "/limits"],
	category: "settings",
	priority: 9,
	arguments: [],
	handler: async (context) => {
		await showCost(context)
	},
}
