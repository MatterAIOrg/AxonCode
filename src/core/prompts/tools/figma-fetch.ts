import { ToolArgs } from "./types"

export function getFigmaFetchDescription(args: ToolArgs): string {
	return `## figma_fetch
Description: Fetch design data from a Figma URL. Returns the complete node tree (layout, styles, text content, nested children, components) and rendered image URLs for the file or a specific frame. Use this whenever the user shares a Figma link and wants design context, code generation from a design, or analysis of a Figma frame.

Parameters:
- url: (required) The full Figma URL, e.g. https://www.figma.com/design/<key>/<title>?node-id=1-2

Usage:
<figma_fetch>
<url>https://www.figma.com/design/ABC123/My-File?node-id=1-2</url>
</figma_fetch>

Results include:
- File name, key, last modified, thumbnail URL
- Complete node tree with all nested children, text content, styles, and layout properties
- Rendered image URLs for the requested nodes

Notes:
- Requires a valid MatterAI token for authentication
- The org must have a Figma access token configured in Connectors
- Request timeout is 60 seconds`
}
