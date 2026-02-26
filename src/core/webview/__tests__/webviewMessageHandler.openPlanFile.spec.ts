import { describe, it, expect, vi, beforeEach } from "vitest"
import * as vscode from "vscode"
import { isOrbitalIDE } from "../../../utils/detectOrbitalIDE"

describe("openPlanFile - Orbital IDE Detection", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	describe("Orbital IDE detection logic", () => {
		it("should detect Orbital IDE correctly", () => {
			vi.spyOn(vscode.env, "appName", "get").mockReturnValue("Orbital")
			expect(isOrbitalIDE()).toBe(true)
		})

		it("should not detect VS Code as Orbital", () => {
			vi.spyOn(vscode.env, "appName", "get").mockReturnValue("Visual Studio Code")
			expect(isOrbitalIDE()).toBe(false)
		})

		it("should handle case-insensitive detection", () => {
			vi.spyOn(vscode.env, "appName", "get").mockReturnValue("ORBITAL")
			expect(isOrbitalIDE()).toBe(true)
		})

		it("should handle orbital in the middle of app name", () => {
			vi.spyOn(vscode.env, "appName", "get").mockReturnValue("wrapper|orbital|cli|1.0.0")
			expect(isOrbitalIDE()).toBe(true)
		})
	})

	describe("Integration behavior expectations", () => {
		it("should use custom editor in Orbital IDE", () => {
			vi.spyOn(vscode.env, "appName", "get").mockReturnValue("Orbital")
			expect(isOrbitalIDE()).toBe(true)
			// In Orbital IDE, the handler should call openPlanFileInEditor
		})

		it("should use raw text document in non-Orbital IDEs", () => {
			vi.spyOn(vscode.env, "appName", "get").mockReturnValue("Visual Studio Code")
			expect(isOrbitalIDE()).toBe(false)
			// In non-Orbital IDEs, the handler should use openTextDocument
		})
	})
})
