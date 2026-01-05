// kilocode_change - AI Code Review Service (Async Pattern)
import { getKiloUrlFromToken } from "@roo-code/types"
import axios from "axios"
import { CodeReviewResultsPayload } from "../../../shared/WebviewMessage"

export interface CodeReviewRequest {
	git_diff: string
	git_owner: string
	git_repo: string
	git_branch: string
	git_user: string
}

export interface CodeReviewStartResponse {
	requestId: string
	status: "pending"
	message: string
}

export interface CodeReviewStatusResponse {
	status: "pending" | "processing" | "completed" | "failed"
	result?: any
	error?: string
	createdAt: string
	updatedAt: string
}

export class CodeReviewService {
	private readonly POLLING_INTERVAL = 2000 // 2 seconds
	private readonly MAX_POLLING_DURATION = 5 * 60 * 1000 // 5 minutes
	private readonly REQUEST_TIMEOUT = 30 * 1000 // 30 seconds

	constructor(
		private kilocodeToken: string,
		private enterpriseHost?: string,
		private enterpriseApiKey?: string,
	) {}

	async requestCodeReview(request: CodeReviewRequest): Promise<CodeReviewResultsPayload> {
		return this.requestCodeReviewWithRetry(request, 3) // Max 3 retries for initial request
	}

	private async requestCodeReviewWithRetry(
		request: CodeReviewRequest,
		maxRetries: number,
	): Promise<CodeReviewResultsPayload> {
		const headers: Record<string, string> = {
			Authorization: `Bearer ${this.kilocodeToken}`,
			"Content-Type": "application/json",
		}

		try {
			// Step 1: Start the async code review
			const startResponse = await this.startCodeReview(request, headers)

			// Step 2: Poll for results
			const result = await this.pollForResults(startResponse.requestId, headers)
			return result
		} catch (error) {
			// Check if this is a retryable error (timeout, network, 524, etc.)
			const isRetryable = this.isRetryableError(error)

			if (isRetryable && maxRetries > 0) {
				// Exponential backoff: 1s, 2s, 4s
				const delay = Math.pow(2, 3 - maxRetries) * 1000

				await new Promise((resolve) => setTimeout(resolve, delay))
				return this.requestCodeReviewWithRetry(request, maxRetries - 1)
			}

			throw new Error(`Code review failed: ${this.getErrorMessage(error)}`)
		}
	}

	private async startCodeReview(
		request: CodeReviewRequest,
		headers: Record<string, string>,
	): Promise<CodeReviewStartResponse> {
		let url: string

		if (this.enterpriseHost && this.enterpriseApiKey) {
			// Use enterprise host and API key
			url = `${this.enterpriseHost.replace(/\/$/, "")}/codereview`
			headers["Authorization"] = `Bearer ${this.enterpriseApiKey}`
		} else {
			// Use default MatterAI service
			url = getKiloUrlFromToken("https://api.matterai.so/codereview", this.kilocodeToken)
		}

		const response = await axios.post<CodeReviewStartResponse>(url, request, {
			headers,
			timeout: this.REQUEST_TIMEOUT,
		})

		return response.data
	}

	private async pollForResults(
		requestId: string,
		headers: Record<string, string>,
	): Promise<CodeReviewResultsPayload> {
		const startTime = Date.now()
		let attempt = 0

		while (Date.now() - startTime < this.MAX_POLLING_DURATION) {
			attempt++

			try {
				const statusResponse = await this.getCodeReviewStatus(requestId, headers)

				switch (statusResponse.status) {
					case "pending":
						break

					case "processing":
						break

					case "completed":
						return this.extractResults(statusResponse.result)

					case "failed":
						throw new Error(`Code review failed: ${statusResponse.error || "Unknown error"}`)

					default:
						throw new Error(`Unknown status: ${statusResponse.status}`)
				}

				// Wait before next poll
				await new Promise((resolve) => setTimeout(resolve, this.POLLING_INTERVAL))
			} catch (error) {
				// If it's the final polling attempt, throw the error
				if (Date.now() - startTime >= this.MAX_POLLING_DURATION) {
					throw new Error(
						`Code review polling timed out after ${this.MAX_POLLING_DURATION / 1000} seconds: ${this.getErrorMessage(error)}`,
					)
				}

				// For network errors during polling, wait a bit longer before retry
				if (this.isRetryableError(error)) {
					await new Promise((resolve) => setTimeout(resolve, 3000))
				} else {
					// For non-retryable errors, don't retry
					throw error
				}
			}
		}

		throw new Error(`Code review polling timed out after ${this.MAX_POLLING_DURATION / 1000} seconds`)
	}

	private async getCodeReviewStatus(
		requestId: string,
		headers: Record<string, string>,
	): Promise<CodeReviewStatusResponse> {
		let url: string

		if (this.enterpriseHost && this.enterpriseApiKey) {
			// Use enterprise host and API key
			url = `${this.enterpriseHost.replace(/\/$/, "")}/codereview/${requestId}`
		} else {
			// Use default MatterAI service
			url = getKiloUrlFromToken(`https://api.matterai.so/codereview/${requestId}`, this.kilocodeToken)
		}

		const response = await axios.get<CodeReviewStatusResponse>(url, {
			headers,
			timeout: this.REQUEST_TIMEOUT,
		})

		return response.data
	}

	private extractResults(result: any): CodeReviewResultsPayload {
		// Handle the new async response format
		if (result?.codeChangeGeneration) {
			return {
				reviewBody: result.codeChangeGeneration.reviewBody,
				reviewComments: result.codeChangeGeneration.reviewComments || [],
			}
		}

		// Fallback if structure matches CodeReviewResultsPayload directly
		return {
			reviewBody: result?.reviewBody || "",
			reviewComments: result?.reviewComments || [],
		}
	}

	private isRetryableError(error: any): boolean {
		// Check for timeout errors
		if (axios.isAxiosError(error)) {
			// ECONNABORTED = timeout
			if (error.code === "ECONNABORTED") {
				return true
			}

			// 524 = Cloudflare timeout
			if (error.response?.status === 524) {
				return true
			}

			// Network errors
			if (error.code === "ENOTFOUND" || error.code === "ECONNREFUSED" || error.code === "ETIMEDOUT") {
				return true
			}
		}

		// Check for timeout in error message
		const errorMessage = error instanceof Error ? error.message : String(error)
		if (errorMessage.includes("timeout") || errorMessage.includes("524")) {
			return true
		}

		return false
	}

	private getErrorMessage(error: any): string {
		if (axios.isAxiosError(error)) {
			if (error.response?.status === 524) {
				return "Cloudflare timeout (524) - backend took too long to respond"
			}
			if (error.code === "ECONNABORTED") {
				return "Request timeout"
			}
			if (error.response?.status) {
				return `HTTP ${error.response.status}: ${error.response.statusText || "Unknown error"}`
			}
			if (error.code) {
				return `Network error: ${error.code}`
			}
		}

		return error instanceof Error ? error.message : String(error)
	}
}
