#!/usr/bin/env node

/**
 * Fix package.json to remove VS Code dependencies that don't work in JetBrains
 */

const fs = require("fs")
const path = require("path")

function fixPackageJson(packageJsonPath) {
	try {
		if (!fs.existsSync(packageJsonPath)) {
			console.error(`❌ package.json not found at: ${packageJsonPath}`)
			return false
		}

		const content = fs.readFileSync(packageJsonPath, "utf8")
		const packageJson = JSON.parse(content)

		let modified = false

		// Remove extensionDependencies if it exists and contains vscode.git
		if (packageJson.extensionDependencies && Array.isArray(packageJson.extensionDependencies)) {
			const originalLength = packageJson.extensionDependencies.length
			packageJson.extensionDependencies = packageJson.extensionDependencies.filter((dep) => dep !== "vscode.git")

			if (packageJson.extensionDependencies.length !== originalLength) {
				modified = true
				console.log("✅ Removed vscode.git from extensionDependencies")
			}

			// Remove the entire extensionDependencies array if it's now empty
			if (packageJson.extensionDependencies.length === 0) {
				delete packageJson.extensionDependencies
				modified = true
				console.log("✅ Removed empty extensionDependencies array")
			}
		}

		if (modified) {
			fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2))
			console.log(`✅ Fixed package.json at: ${packageJsonPath}`)
			return true
		} else {
			console.log(`ℹ️  No changes needed for: ${packageJsonPath}`)
			return true
		}
	} catch (error) {
		console.error(`❌ Error fixing package.json: ${error.message}`)
		return false
	}
}

// Main execution
const args = process.argv.slice(2)
if (args.length === 0) {
	console.log("Usage: node fix-package-json.js <path-to-package-json>")
	process.exit(1)
}

const packageJsonPath = path.resolve(args[0])
const success = fixPackageJson(packageJsonPath)
process.exit(success ? 0 : 1)
