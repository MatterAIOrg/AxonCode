import { ToolArgs } from "./types"

export function getWebSearchDescription(args: ToolArgs): string {
	return `## web_search
Description: Search the web for information using a query. Returns a list of relevant results with URLs, titles, publish dates, and excerpts. Use this when you need to find specific information on the web.

Parameters:
- query: (required) The search query to find information on the web. Queries MUST be in English (translate if needed).

Usage:
<web_search>
<query>how to use React hooks</query>
</web_search>

Results include:
- URL of the page
- Title of the page
- Publish date (if available)
- Excerpts with relevant content in markdown format

Notes:
- Requires a valid Kilocode token for authentication
- Rate limits may apply
`
}
