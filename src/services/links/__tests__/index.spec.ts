import fs from "fs/promises"
import os from "os"
import path from "path"

import { resolveLinkTarget, loadLinks, renderLinkedReposSection, resolveProjectDir } from "../index"

describe("links service", () => {
	describe("resolveLinkTarget", () => {
		it("passes through absolute paths", () => {
			expect(resolveLinkTarget("/Users/foo/bar")).toBe("/Users/foo/bar")
		})

		it("expands ~ to the home directory", () => {
			expect(resolveLinkTarget("~/projects/x")).toBe(path.join(os.homedir(), "projects/x"))
		})

		it("resolves relative paths against cwd", () => {
			expect(resolveLinkTarget("../sibling")).toBe(path.resolve("../sibling"))
		})

		it("trims whitespace and returns undefined for empty input", () => {
			expect(resolveLinkTarget("  /Users/foo/spaced ")).toBe("/Users/foo/spaced")
			expect(resolveLinkTarget("   ")).toBeUndefined()
		})
	})

	describe("loadLinks + renderLinkedReposSection", () => {
		let base: string
		let linked: string

		beforeEach(async () => {
			base = await fs.mkdtemp(path.join(os.tmpdir(), "orb-main-"))
			linked = await fs.mkdtemp(path.join(os.tmpdir(), "orb-linked-"))
		})

		afterEach(async () => {
			await fs.rm(base, { recursive: true, force: true })
			await fs.rm(linked, { recursive: true, force: true })
		})

		it("returns [] when there is no links file", async () => {
			expect(await loadLinks(base)).toEqual([])
			expect(await renderLinkedReposSection(base)).toBe("")
		})

		it("resolves entries that carry only `input` (extension-written) and pulls the linked AGENTS.md", async () => {
			await fs.mkdir(path.join(linked, ".orb"), { recursive: true })
			await fs.writeFile(path.join(linked, ".orb", "AGENTS.md"), "# Linked\nUses the .orb folder.")

			await fs.mkdir(resolveProjectDir(base), { recursive: true })
			await fs.writeFile(
				path.join(resolveProjectDir(base), "links.json"),
				JSON.stringify({ links: [{ input: linked }] }),
			)

			const links = await loadLinks(base)
			expect(links).toHaveLength(1)
			expect(links[0].input).toBe(linked)

			const section = await renderLinkedReposSection(base)
			expect(section).toContain("## Linked Repositories")
			expect(section).toContain(linked)
			expect(section).toContain("Uses the .orb folder.")
		})

		it("flags links whose path no longer exists", async () => {
			await fs.mkdir(resolveProjectDir(base), { recursive: true })
			await fs.writeFile(
				path.join(resolveProjectDir(base), "links.json"),
				JSON.stringify({ links: [{ input: "/no/such/dir/orb-xyz" }] }),
			)
			const section = await renderLinkedReposSection(base)
			expect(section).toContain("(path not found)")
		})
	})
})
