// kilocode_change - AI Code Review Service
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

export class CodeReviewService {
	constructor(private kilocodeToken: string) {}

	async requestCodeReview(request: CodeReviewRequest): Promise<CodeReviewResultsPayload> {
		try {
			const headers: Record<string, string> = {
				Authorization: `Bearer ${this.kilocodeToken}`,
				"Content-Type": "application/json",
			}

			const url = getKiloUrlFromToken("https://api.matterai.so/codereview", this.kilocodeToken)

			const response = await axios.post<any>(url, request, { headers })

			const data = response.data
			if (data.codeChangeGeneration) {
				return {
					reviewBody: data.codeChangeGeneration.reviewBody,
					reviewComments: data.codeChangeGeneration.reviewComments || [],
				}
			}

			// Fallback if structure matches CodeReviewResultsPayload directly (legacy or future proof)
			return {
				reviewBody: data.reviewBody || "",
				reviewComments: data.reviewComments || [],
			}
		} catch (error) {
			console.error("Code review request failed:", error)
			throw new Error(`Code review failed: ${error instanceof Error ? error.message : "Unknown error"}`)
		}
	}
}
