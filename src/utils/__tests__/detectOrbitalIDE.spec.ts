import { describe, it, expect, vi, beforeEach } from "vitest"
import * as vscode from "vscode"
import { isOrbitalIDE } from "../detectOrbitalIDE"

describe("isOrbitalIDE", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	it("should return true when appName contains 'orbital'", () => {
		vi.spyOn(vscode.env, "appName", "get").mockReturnValue("Orbital")
		expect(isOrbitalIDE()).toBe(true)
	})

	it("should return true when appName contains 'Orbital' (capitalized)", () => {
		vi.spyOn(vscode.env, "appName", "get").mockReturnValue("Orbital")
		expect(isOrbitalIDE()).toBe(true)
	})

	it("should return true when appName contains 'ORBITAL' (uppercase)", () => {
		vi.spyOn(vscode.env, "appName", "get").mockReturnValue("ORBITAL")
		expect(isOrbitalIDE()).toBe(true)
	})

	it("should return false when appName is 'Visual Studio Code'", () => {
		vi.spyOn(vscode.env, "appName", "get").mockReturnValue("Visual Studio Code")
		expect(isOrbitalIDE()).toBe(false)
	})

	it("should return false when appName is 'VS Code'", () => {
		vi.spyOn(vscode.env, "appName", "get").mockReturnValue("VS Code")
		expect(isOrbitalIDE()).toBe(false)
	})

	it("should return false when appName is empty", () => {
		vi.spyOn(vscode.env, "appName", "get").mockReturnValue("")
		expect(isOrbitalIDE()).toBe(false)
	})

	it("should return false when appName is undefined", () => {
		vi.spyOn(vscode.env, "appName", "get").mockReturnValue(undefined as any)
		expect(isOrbitalIDE()).toBe(false)
	})

	it("should handle appName with 'orbital' in the middle", () => {
		vi.spyOn(vscode.env, "appName", "get").mockReturnValue("wrapper|orbital|cli|1.0.0")
		expect(isOrbitalIDE()).toBe(true)
	})
})
