/**
 * Best-effort repair layer for malformed tool-call JSON arguments.
 *
 * Models — especially smaller OSS ones — emit almost-JSON tool-call
 * arguments: unquoted values, dropped quotes, internal markup tags, Python
 * literals, comments, trailing commas, or truncated bodies. Rejecting the
 * call burns a full round trip, and weaker models repeat the exact same
 * mistake on retry, dead-looping.
 *
 * `parseToolCallArguments` is the single entry point used by every
 * tool-call ingestion path (live streaming, stream finalization, MCP
 * argument validation):
 *
 *   1. Strict parse first. Valid payloads are returned verbatim with
 *      `repaired: false` — zero overhead, zero risk of corrupting good
 *      input. The one exception: a leaked placeholder tag inside a key
 *      (e.g. `{"</longcat_arg_key>path": "src"}`) parses as valid JSON but
 *      names an unknown parameter, so tags are stripped from keys only —
 *      tags inside string values may be legitimate content and survive.
 *      Everything below only runs on input that already failed.
 *   2. A single left-to-right repair scan rewrites the source into
 *      parseable JSON: placeholder tags in structural positions are
 *      skipped (tags inside quoted strings are preserved), unquoted
 *      keys/values quoted, single quotes converted, Python literals
 *      mapped, comments removed, trailing commas dropped, and lost key
 *      quotes recovered.
 *   3. With `repairTruncated` (stream finalization only), dangling strings
 *      are closed, a trailing comma dropped, `null` appended after a
 *      dangling colon, and open braces/brackets closed innermost-first.
 *
 * If the repaired source still fails to parse, `null` is returned — the
 * caller then surfaces the corrective error with the raw arguments.
 */

export interface ToolCallArgumentsParse {
	args: unknown
	repaired: boolean
}

export interface ParseToolCallArgumentsOptions {
	/**
	 * Repair truncated input (dangling strings, unclosed containers, missing
	 * values) by closing what is open. Only enable once the stream has
	 * ended — during streaming an incomplete buffer must stay unparseable
	 * so the parser keeps accumulating deltas.
	 */
	repairTruncated?: boolean
}

/** Placeholder tags some models leak into tool-call JSON (e.g. `<longcat_arg_value>`). */
const PLACEHOLDER_TAG = /<\/?[A-Za-z_][A-Za-z0-9_.\-]*>/g

/** Bare tokens that stay unquoted when repaired: strict JSON numbers and literals. */
const STRICT_JSON_NUMBER = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?$/

const JSON_LITERALS: Record<string, string> = {
	true: "true",
	false: "false",
	null: "null",
	True: "true",
	False: "false",
	None: "null",
}

/** Bare keys must look like identifiers — this is what rejects prose. */
const BARE_KEY = /^[A-Za-z_$][A-Za-z0-9_$.\-]*$/

const REPAIR_NOTE_MAX_ARGS_LENGTH = 2000

export function parseToolCallArguments(
	raw: string,
	options?: ParseToolCallArgumentsOptions,
): ToolCallArgumentsParse | null {
	const trimmed = raw.trim()
	if (!trimmed) {
		return null
	}

	// 1. Strict parse first — the ONLY path valid JSON ever takes, so
	//    well-formed arguments are never mutated.
	try {
		const args = JSON.parse(raw)
		const cleaned = stripTagsFromKeys(args)
		return { args: cleaned.value, repaired: cleaned.changed }
	} catch {
		// Fall through to the repair pass.
	}

	// 2. Repair pass.
	const repairedSource = repairJsonSource(trimmed, options?.repairTruncated ?? false)
	if (repairedSource === null) {
		return null
	}

	try {
		let args: unknown = JSON.parse(repairedSource)
		// A single-object array is an object the model wrapped by mistake.
		if (Array.isArray(args) && args.length === 1 && typeof args[0] === "object" && args[0] !== null) {
			args = args[0]
		}
		return { args, repaired: true }
	} catch {
		return null
	}
}

/**
 * Human-readable note appended to a tool result when its arguments were
 * auto-repaired, so the model sees what actually executed instead of its
 * broken original — this is what stops it from repeating the mistake.
 */
export function formatArgumentRepairNote(executedArguments: string): string {
	const bounded =
		executedArguments.length > REPAIR_NOTE_MAX_ARGS_LENGTH
			? `${executedArguments.slice(0, REPAIR_NOTE_MAX_ARGS_LENGTH)}...(truncated)`
			: executedArguments
	return `The arguments were malformed JSON and were auto-repaired before execution. Executed arguments: ${bounded}`
}

/**
 * Strips placeholder tags from object keys of a strictly-parsed payload.
 * Keys are structural (parameter names), so a tag inside a key is always a
 * leaked artifact; tags inside string values may be legitimate content and
 * are never touched. A member whose key is only a tag is dropped — the
 * parameter name was elided entirely.
 */
function stripTagsFromKeys(value: unknown): { value: unknown; changed: boolean } {
	if (Array.isArray(value)) {
		let changed = false
		const items = value.map((item) => {
			const result = stripTagsFromKeys(item)
			changed = changed || result.changed
			return result.value
		})
		return { value: changed ? items : value, changed }
	}
	if (typeof value === "object" && value !== null) {
		let changed = false
		const output: Record<string, unknown> = {}
		for (const [key, item] of Object.entries(value)) {
			const nested = stripTagsFromKeys(item)
			const cleanedKey = key.replace(PLACEHOLDER_TAG, "")
			changed = changed || nested.changed || cleanedKey !== key
			if (cleanedKey) {
				output[cleanedKey] = nested.value
			}
		}
		return { value: changed ? output : value, changed }
	}
	return { value, changed: false }
}

function repairJsonSource(source: string, repairTruncated: boolean): string | null {
	const trimmed = source.trim()
	if (!trimmed) {
		return null
	}

	// Braceless bodies (e.g. `path: "src"`) are wrapped in {}. Only attempted
	// when repairing a finalized buffer: during streaming there is no way to
	// know the body is complete.
	if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) {
		if (!repairTruncated) {
			return null
		}
		return scanJson(`{${trimmed}}`, repairTruncated)
	}

	return scanJson(trimmed, repairTruncated)
}

type Container = "{" | "["
type ScanState = "expect-key" | "expect-value" | "expect-comma-or-close"

type KeyToken =
	| { kind: "key-with-colon"; text: string; nextIndex: number }
	| { kind: "key"; text: string; nextIndex: number }
	| { kind: "dropped"; nextIndex: number }

function scanJson(source: string, repairTruncated: boolean): string | null {
	let out = ""
	let index = 0
	const stack: Container[] = []
	let state: ScanState = "expect-value"
	// How we entered expect-value: after a colon (a missing value gets null),
	// after a comma, or right after an opening bracket.
	let valueOrigin: "colon" | "comma" | "open" = "open"

	const top = (): Container | undefined => stack[stack.length - 1]

	while (index < source.length) {
		// The top-level container closed and something else follows — trailing
		// junk. Keep the repaired value and stop.
		if (stack.length === 0 && state === "expect-comma-or-close") {
			break
		}

		const char = source[index]

		// Whitespace and comments between tokens.
		if (isWhitespace(char)) {
			index++
			continue
		}
		if (char === "/" && source[index + 1] === "/") {
			index = skipLineComment(source, index)
			continue
		}
		if (char === "/" && source[index + 1] === "*") {
			index = skipBlockComment(source, index)
			continue
		}

		// Placeholder tags (e.g. `<longcat_arg_value>`) in structural
		// positions are dropped. Tags inside quoted strings are preserved by
		// the string readers, so markup in string values survives.
		if (isTagStart(source, index)) {
			index = skipTag(source, index)
			continue
		}

		// A token where a comma or closer was expected means the model dropped
		// the comma. Insert one and reprocess the same character.
		if (state === "expect-comma-or-close" && char !== "," && char !== "}" && char !== "]") {
			out += ","
			state = top() === "{" ? "expect-key" : "expect-value"
			valueOrigin = "comma"
			continue
		}

		if (char === "{") {
			if (state === "expect-value") {
				out += "{"
				stack.push("{")
				state = "expect-key"
			}
			// A stray opener elsewhere is dropped.
			index++
			continue
		}

		if (char === "[") {
			if (state === "expect-value") {
				out += "["
				stack.push("[")
				state = "expect-value"
				valueOrigin = "open"
			}
			index++
			continue
		}

		if (char === "}" || char === "]") {
			if (stack.length === 0) {
				// Unmatched top-level closer — drop.
				index++
				continue
			}
			if (state === "expect-value" && valueOrigin === "colon") {
				// `"key": }` — the value is missing; null keeps the key so the
				// tool's default applies.
				out += "null"
			}
			out += top() === "{" ? "}" : "]"
			stack.pop()
			index++
			state = "expect-comma-or-close"
			continue
		}

		if (char === ",") {
			if (state === "expect-value") {
				if (valueOrigin === "colon") {
					// `"key": ,` — missing value before the separator.
					out += "null"
					state = "expect-comma-or-close"
				} else {
					// Stray comma right after an opener or another comma.
					index++
					continue
				}
			} else if (state === "expect-key") {
				// Stray comma where a key belongs — drop.
				index++
				continue
			}
			// Trailing comma before a closer (or end of input) is dropped.
			const peek = peekSignificant(source, index + 1)
			if (peek >= source.length || source[peek] === "}" || source[peek] === "]") {
				index++
				continue
			}
			out += ","
			index++
			state = top() === "{" ? "expect-key" : "expect-value"
			valueOrigin = "comma"
			continue
		}

		// A colon reaching the loop is always stray — legitimate colons are
		// consumed by key processing, and colons inside bare values (URLs)
		// never terminate a token.
		if (char === ":") {
			index++
			continue
		}

		if (state === "expect-key") {
			const keyToken = readKeyToken(source, index)
			if (keyToken === null) {
				return null
			}
			if (keyToken.kind === "dropped") {
				index = keyToken.nextIndex
				continue
			}
			if (keyToken.kind === "key-with-colon") {
				out += keyToken.text
				index = keyToken.nextIndex
				state = "expect-value"
				valueOrigin = "colon"
				continue
			}
			// The colon must follow, else the key is dangling.
			const colonIndex = peekSignificant(source, keyToken.nextIndex)
			if (colonIndex < source.length && source[colonIndex] === ":") {
				out += `${keyToken.text}:`
				index = colonIndex + 1
				state = "expect-value"
				valueOrigin = "colon"
				continue
			}
			if (colonIndex >= source.length || source[colonIndex] === "}" || source[colonIndex] === "]") {
				// Dangling key without a colon — drop it; the closer (or end
				// of input) is handled by the loop.
				index = keyToken.nextIndex
				continue
			}
			// A key followed by anything other than a colon is unrepairable.
			return null
		}

		// state === "expect-value"
		if (char === '"') {
			const stringValue = readDoubleQuotedString(source, index, repairTruncated)
			if (stringValue === null) {
				return null
			}
			out += stringValue.text
			index = stringValue.nextIndex
			state = "expect-comma-or-close"
			continue
		}

		if (char === "'") {
			const stringValue = readSingleQuotedString(source, index, repairTruncated)
			if (stringValue === null) {
				return null
			}
			out += stringValue.text
			index = stringValue.nextIndex
			state = "expect-comma-or-close"
			continue
		}

		// Bare token value. Colons and slashes do NOT terminate values, so
		// URLs and glob patterns survive intact.
		let end = index
		while (end < source.length && !isBareTokenTerminator(source[end])) {
			end++
		}
		const token = source.slice(index, end)
		if (!token) {
			index++
			continue
		}
		out += classifyBareToken(token)
		index = end
		state = "expect-comma-or-close"
	}

	// End of input.
	if (!repairTruncated) {
		// Incomplete unless the top-level container closed cleanly.
		if (stack.length === 0 && state === "expect-comma-or-close") {
			return out
		}
		return null
	}

	// Truncation repair: append the missing value, drop a trailing comma
	// left by a dropped dangling key, and close open containers
	// innermost-first.
	if (state === "expect-value" && valueOrigin === "colon") {
		out += "null"
	}
	out = out.replace(/,$/, "")
	while (stack.length > 0) {
		out += stack.pop() === "{" ? "}" : "]"
	}
	return out
}

function readKeyToken(source: string, start: number): KeyToken | null {
	const char = source[start]

	if (char === '"') {
		const close = findUnescaped(source, start + 1, '"')
		const contentEnd = close === -1 ? source.length : close
		const content = source.slice(start + 1, contentEnd)

		// A properly closed key followed by a colon is a legitimate key, even
		// when the key itself contains a colon (e.g. "Content-Type").
		if (close !== -1) {
			const after = peekSignificant(source, close + 1)
			if (after < source.length && source[after] === ":") {
				const key = content.replace(PLACEHOLDER_TAG, "")
				if (!key) {
					return null
				}
				return { kind: "key", text: JSON.stringify(key), nextIndex: close + 1 }
			}
		}

		// The string swallowed structure (lost closing quote) or never closed.
		// Recover the key from the head, splitting at the first colon, comma,
		// or whitespace outside placeholder tags.
		const split = findSplitOutsideTags(content)
		if (split) {
			const key = content.slice(0, split.index).trim().replace(PLACEHOLDER_TAG, "")
			if (!key) {
				return null
			}
			const splitIndex = start + 1 + split.index
			if (split.char === ",") {
				// The member never got a value — drop the key and let the
				// scanner reprocess the comma.
				return { kind: "dropped", nextIndex: splitIndex }
			}
			return {
				kind: "key-with-colon",
				text: `${JSON.stringify(key)}:`,
				nextIndex: skipWhitespace(source, split.char === ":" ? splitIndex + 1 : splitIndex),
			}
		}

		// No split character: a closed string is a plain key; a dangling one
		// never completed.
		if (close !== -1) {
			const key = content.replace(PLACEHOLDER_TAG, "")
			if (!key) {
				return null
			}
			return { kind: "key", text: JSON.stringify(key), nextIndex: close + 1 }
		}
		return { kind: "dropped", nextIndex: source.length }
	}

	if (char === "'") {
		const close = findUnescaped(source, start + 1, "'")
		if (close === -1) {
			return null
		}
		const key = source.slice(start + 1, close).replace(PLACEHOLDER_TAG, "")
		if (!key) {
			return null
		}
		return { kind: "key", text: JSON.stringify(key), nextIndex: close + 1 }
	}

	// Bare key.
	let end = start
	while (end < source.length && !isKeyTerminator(source[end])) {
		end++
	}
	const token = source.slice(start, end)
	if (!token || !BARE_KEY.test(token)) {
		// Prose or a number where a key belongs — unrepairable.
		return null
	}
	return { kind: "key", text: JSON.stringify(token), nextIndex: end }
}

function readDoubleQuotedString(
	source: string,
	start: number,
	repairTruncated: boolean,
): { text: string; nextIndex: number } | null {
	const close = findUnescaped(source, start + 1, '"')
	if (close === -1) {
		if (!repairTruncated) {
			// Still streaming — the string has not closed yet.
			return null
		}
		// Close the dangling string. Content is emitted verbatim so intended
		// JSON escapes survive.
		return { text: `"${source.slice(start + 1)}"`, nextIndex: source.length }
	}
	return { text: source.slice(start, close + 1), nextIndex: close + 1 }
}

function readSingleQuotedString(
	source: string,
	start: number,
	repairTruncated: boolean,
): { text: string; nextIndex: number } | null {
	const close = findUnescaped(source, start + 1, "'")
	if (close === -1) {
		if (!repairTruncated) {
			return null
		}
		return { text: JSON.stringify(unescapeSingleQuoted(source.slice(start + 1))), nextIndex: source.length }
	}
	return { text: JSON.stringify(unescapeSingleQuoted(source.slice(start + 1, close))), nextIndex: close + 1 }
}

function classifyBareToken(token: string): string {
	const literal = JSON_LITERALS[token]
	if (literal) {
		return literal
	}
	if (STRICT_JSON_NUMBER.test(token)) {
		return token
	}
	return JSON.stringify(token)
}

function unescapeSingleQuoted(content: string): string {
	return content.replace(/\\(['\\])/g, "$1")
}

function isWhitespace(char: string): boolean {
	return char === " " || char === "\t" || char === "\n" || char === "\r"
}

function skipWhitespace(source: string, start: number): number {
	let index = start
	while (index < source.length && isWhitespace(source[index])) {
		index++
	}
	return index
}

function findUnescaped(source: string, start: number, quote: string): number {
	for (let index = start; index < source.length; index++) {
		if (source[index] === "\\") {
			index++
			continue
		}
		if (source[index] === quote) {
			return index
		}
	}
	return -1
}

function skipLineComment(source: string, start: number): number {
	let index = start + 2
	while (index < source.length && source[index] !== "\n") {
		index++
	}
	return index
}

function skipBlockComment(source: string, start: number): number {
	const end = source.indexOf("*/", start + 2)
	return end === -1 ? source.length : end + 2
}

function peekSignificant(source: string, start: number): number {
	let index = start
	while (index < source.length) {
		const char = source[index]
		if (isWhitespace(char)) {
			index++
			continue
		}
		if (char === "/" && source[index + 1] === "/") {
			index = skipLineComment(source, index)
			continue
		}
		if (char === "/" && source[index + 1] === "*") {
			index = skipBlockComment(source, index)
			continue
		}
		if (isTagStart(source, index)) {
			index = skipTag(source, index)
			continue
		}
		return index
	}
	return index
}

/** True when the character at `index` opens a placeholder tag such as `<tag>` or `</tag>`. */
function isTagStart(source: string, index: number): boolean {
	if (source[index] !== "<") {
		return false
	}
	const next = source[index + 1]
	if (next !== undefined && /[A-Za-z_]/.test(next)) {
		return true
	}
	return next === "/" && /[A-Za-z_]/.test(source[index + 2] ?? "")
}

function skipTag(source: string, start: number): number {
	const close = source.indexOf(">", start + 1)
	return close === -1 ? source.length : close + 1
}

/**
 * Find the first colon, comma, or whitespace in `content` that is not inside
 * a placeholder tag, so index math stays valid against the original source.
 */
function findSplitOutsideTags(content: string): { index: number; char: string } | null {
	let index = 0
	while (index < content.length) {
		const char = content[index]
		if (char === ":" || char === "," || isWhitespace(char)) {
			return { index, char }
		}
		if (char === "<") {
			const tagMatch = /^<\/?[A-Za-z_][A-Za-z0-9_.\-]*>/.exec(content.slice(index))
			if (tagMatch) {
				index += tagMatch[0].length
				continue
			}
		}
		index++
	}
	return null
}

function isBareTokenTerminator(char: string): boolean {
	return isWhitespace(char) || char === "," || char === "}" || char === "]" || char === '"' || char === "'"
}

function isKeyTerminator(char: string): boolean {
	return isBareTokenTerminator(char) || char === ":"
}
