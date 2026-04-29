/**
 * Represents a native tool call from OpenAI-compatible APIs
 */
export interface NativeToolCall {
	index?: number // OpenAI uses index to track across streaming deltas
	id?: string // Only present in first delta
	type?: string
	function?: {
		name: string
		arguments: string // JSON string (may be partial during streaming)
	}
	// forked_change: Track if this is an MCP tool and which server
	isMcpTool?: boolean
	mcpServerName?: string
}

/**
 * Unwrap top-level double JSON encoding of tool-call arguments.
 *
 * Some models stringify the entire `arguments` object an extra time, so after
 * the first `JSON.parse` we end up with a string that itself contains JSON.
 * This helper detects that case and parses it again (repeatedly, in case the
 * model wrapped it more than once).
 *
 * IMPORTANT: We deliberately do NOT recurse into string values inside an
 * already-parsed object/array. Tool parameters such as `file_write.content`,
 * `apply_diff.diff`, etc. legitimately contain text that may look like JSON
 * (e.g. writing a `package.json` or `tsconfig.json`). Re-decoding those
 * strings would mutate them into objects and break tools that expect a
 * string — silently dropping the call.
 *
 * @param obj - Either a parsed tool-call arguments object/array, or a raw
 *   string that may itself be a JSON-encoded object/array (the double-encoded
 *   case).
 * @returns The unwrapped value. Object/array inputs are returned unchanged.
 */
export function parseDoubleEncodedParams(obj: any): any {
	if (obj === null || obj === undefined) {
		return obj
	}

	// Only unwrap when the input itself is a string that looks like a JSON
	// object/array. This is the genuine double-encoding case.
	if (typeof obj === "string") {
		const trimmed = obj.trim()
		if ((trimmed.startsWith("{") && trimmed.endsWith("}")) || (trimmed.startsWith("[") && trimmed.endsWith("]"))) {
			try {
				const parsed = JSON.parse(obj)
				// If the parse produced yet another string, the model wrapped
				// it more than twice — recurse to peel another layer. Otherwise
				// (object/array/primitive) return as-is so we don't mangle
				// nested string values.
				if (typeof parsed === "string") {
					return parseDoubleEncodedParams(parsed)
				}
				return parsed
			} catch {
				// Not valid JSON, return the original string as-is.
				return obj
			}
		}
		return obj
	}

	// Object / array / primitive — already in its intended shape. Returning
	// as-is preserves any string property values that happen to look like JSON.
	return obj
}
