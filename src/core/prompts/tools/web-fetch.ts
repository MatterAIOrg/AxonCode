import { ToolArgs } from "./types"

export function getWebFetchDescription(args: ToolArgs): string {
	return `## web_fetch
Description: Fetch content from a URL using curl. Use this when you need to scrape or retrieve content from a web page. Returns the raw HTML/text content from the URL.

Parameters:
- url: (required) The URL to fetch content from. Must be a valid HTTP or HTTPS URL.

Usage:
<web_fetch>
<url>https://example.com</url>
</web_fetch>

Notes:
- The URL must be a valid HTTP or HTTPS URL
- Some websites may block automated requests
- Large pages may be truncated for performance
- Request timeout is 30 seconds
`
}
