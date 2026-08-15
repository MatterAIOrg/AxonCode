// Unit tests for the shared chat-render helpers. These tests focus on the
// markdown list rendering path because that is the only surface changed in
// this PR — the rest of valueToHtml is exercised through ChatTextArea's
// existing tests in components/chat/__tests__.

import { describe, expect, it } from "vitest"

import { containsListSyntax, valueToHtml } from "../chat-render"

// A mention map with no entries is the simplest valid input — passing it
// proves that mentioning logic doesn't crash when empty.
const NO_MENTIONS: Map<string, string> = new Map()

describe("containsListSyntax", () => {
	it("returns false for empty input", () => {
		expect(containsListSyntax("")).toBe(false)
	})

	it("returns false for prose without list markers", () => {
		expect(containsListSyntax("hello world")).toBe(false)
		expect(containsListSyntax("first line\nsecond line")).toBe(false)
	})

	it("returns true for an unordered-list line", () => {
		expect(containsListSyntax("- item one")).toBe(true)
		expect(containsListSyntax("* item two")).toBe(true)
		expect(containsListSyntax("+ item three")).toBe(true)
	})

	it("returns true for an ordered-list line", () => {
		expect(containsListSyntax("1. item")).toBe(true)
		expect(containsListSyntax("42) item")).toBe(true)
	})

	it("requires whitespace between marker and text", () => {
		// Without the space, this is just a paragraph that happens to start
		// with "-". Markdown, and this parser, treat it as plain text.
		expect(containsListSyntax("-nope")).toBe(false)
		expect(containsListSyntax("1.notalist")).toBe(false)
	})

	it("handles indented list lines", () => {
		expect(containsListSyntax("  - nested")).toBe(true)
		expect(containsListSyntax("\t1. tabbed")).toBe(true)
	})

	it("detects list syntax even when other lines are plain prose", () => {
		const value = "intro paragraph\n- actual item\nmore prose"
		expect(containsListSyntax(value)).toBe(true)
	})
})

describe("valueToHtml — list rendering", () => {
	it("renders a single unordered list item with data-list-marker", () => {
		const html = valueToHtml("- buy milk", "", NO_MENTIONS)
		expect(html).toContain('<ul class="chat-list">')
		expect(html).toContain('<li data-list-marker="-">buy milk</li>')
		expect(html).toContain("</ul>")
	})

	it("renders a single ordered list item using an <ol>", () => {
		const html = valueToHtml("1. buy milk", "", NO_MENTIONS)
		expect(html).toContain('<ol class="chat-list">')
		expect(html).toContain('<li data-list-marker="1.">buy milk</li>')
		expect(html).toContain("</ol>")
	})

	it("renders an ordered list with the parenthesised marker style", () => {
		const html = valueToHtml("1) buy milk", "", NO_MENTIONS)
		expect(html).toContain('<li data-list-marker="1)">buy milk</li>')
	})

	it("renders multiple sibling list items inside one container", () => {
		const html = valueToHtml("- one\n- two\n- three", "", NO_MENTIONS)
		expect(html).toContain('<li data-list-marker="-">one</li>')
		expect(html).toContain('<li data-list-marker="-">two</li>')
		expect(html).toContain('<li data-list-marker="-">three</li>')
		// Make sure we didn't accidentally emit two <ul>s
		expect(html.match(/<ul/g)?.length).toBe(1)
	})

	it("renders nested lists as nested <ul> elements inside an <li>", () => {
		const html = valueToHtml("- outer\n  - inner", "", NO_MENTIONS)
		expect(html).toContain('<li data-list-marker="-">outer')
		expect(html).toContain("<ul")
		expect(html).toContain('<li data-list-marker="-">inner</li>')
	})

	it("splits into two sibling lists when the root type changes", () => {
		const html = valueToHtml("- bullet\n1. number", "", NO_MENTIONS)
		expect(html).toContain('<ul class="chat-list">')
		expect(html).toContain('<ol class="chat-list">')
		expect(html.match(/<ul/g)?.length).toBe(1)
		expect(html.match(/<ol/g)?.length).toBe(1)
	})

	it("keeps mixed prose and lists as separate blocks joined by a <br>", () => {
		const html = valueToHtml("intro\n- item", "", NO_MENTIONS)
		expect(html.startsWith("intro")).toBe(true)
		expect(html).toContain('<br data-plain-break="true">')
		expect(html).toContain('<li data-list-marker="-">item</li>')
	})

	it("does not emit any markup for plain prose without list syntax", () => {
		const html = valueToHtml("just a sentence\nwith two lines", "", NO_MENTIONS)
		expect(html).not.toContain("<ul")
		expect(html).not.toContain("<ol")
		expect(html).toBe('just a sentence<br data-plain-break="true">with two lines')
	})

	it("round-trips list text inside the marker+content shape", () => {
		// The toPlainText helper in ChatTextArea.tsx reconstructs "- item one"
		// from the rendered <li data-list-marker="-">item one</li>. Keeping the
		// marker and content in lock-step preserves that round-trip.
		const html = valueToHtml("- item one", "", NO_MENTIONS)
		expect(html).toBe('<ul class="chat-list"><li data-list-marker="-">item one</li></ul>')
	})

	it("embeds mention chips inside list items", () => {
		const mentions = new Map<string, string>([["foo", "/abs/foo.ts"]])
		const html = valueToHtml("- check @foo", "", mentions)
		expect(html).toContain('<ul class="chat-list">')
		expect(html).toContain('<li data-list-marker="-">check ')
		expect(html).toContain("data-mention-value=")
	})

	it("keeps text after a mention chip inside the same list item", () => {
		// Regression: typing after a mention chip inside a list item used to
		// break the list because toPlainText injected a phantom "\n" between
		// the chip and the trailing text, corrupting the round-tripped plain
		// text and the caret math. The chip and the trailing text must stay
		// contiguous inside the same <li>.
		const mentions = new Map<string, string>([["foo", "/abs/foo.ts"]])
		const html = valueToHtml("- @foo and more", "", mentions)
		expect(html).toContain('<ul class="chat-list">')
		expect(html).toContain('<li data-list-marker="-">')
		expect(html).toContain("data-mention-value=")
		// The trailing text must remain inside the same <li>, not split out.
		expect(html).toContain("and more</li>")
		// And there must be no phantom newline between the chip and the text.
		expect(html).not.toMatch(/data-mention-value="[^"]*"\s*\\n/)
	})

	it("falls back to an empty-line <br> when the input is empty", () => {
		expect(valueToHtml("", "", NO_MENTIONS)).toBe('<br data-plain-break="true">')
	})

	it("escapes HTML-special characters inside list content", () => {
		const html = valueToHtml("- <script>alert(1)</script>", "", NO_MENTIONS)
		expect(html).not.toContain("<script>")
		expect(html).toContain("&lt;script&gt;")
	})
})
