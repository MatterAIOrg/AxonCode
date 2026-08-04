import * as esbuild from "esbuild"
import * as fs from "fs"
import * as path from "path"
import { fileURLToPath } from "url"
import { createRequire } from "module"
import process from "node:process"
import * as console from "node:console"

import { copyPaths, copyWasms, copyLocales, setupLocaleWatcher } from "@roo-code/build"

const fffRuntimePackages = [
	"@ff-labs/fff-node",
	"ffi-rs",
	"@ff-labs/fff-bin-darwin-arm64",
	"@ff-labs/fff-bin-darwin-x64",
	"@ff-labs/fff-bin-linux-x64-gnu",
	"@ff-labs/fff-bin-linux-arm64-gnu",
	"@ff-labs/fff-bin-linux-x64-musl",
	"@ff-labs/fff-bin-linux-arm64-musl",
	"@ff-labs/fff-bin-win32-x64",
	"@ff-labs/fff-bin-win32-arm64",
	"@yuuang/ffi-rs-darwin-arm64",
	"@yuuang/ffi-rs-darwin-x64",
	"@yuuang/ffi-rs-linux-x64-gnu",
	"@yuuang/ffi-rs-linux-arm64-gnu",
	"@yuuang/ffi-rs-linux-x64-musl",
	"@yuuang/ffi-rs-linux-arm64-musl",
	"@yuuang/ffi-rs-win32-x64-msvc",
	"@yuuang/ffi-rs-win32-arm64-msvc",
]

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

function copyFffRuntime(srcDir, distDir) {
	const fffPackageRoot = fs.realpathSync(path.join(srcDir, "node_modules", "@ff-labs", "fff-node"))
	const fffPackageJson = path.join(fffPackageRoot, "package.json")
	const fffRequire = createRequire(fffPackageJson)
	const destinationRoot = path.join(distDir, "fff", "node_modules")

	fs.rmSync(path.join(distDir, "fff"), { recursive: true, force: true })

	for (const packageName of fffRuntimePackages) {
		let packageJson
		try {
			packageJson =
				packageName === "@ff-labs/fff-node" ? fffPackageJson : fffRequire.resolve(`${packageName}/package.json`)
		} catch {
			throw new Error(
				`Missing FFF runtime package ${packageName}. Run pnpm install with the configured supportedArchitectures.`,
			)
		}

		const source = path.dirname(packageJson)
		const destination = path.join(destinationRoot, ...packageName.split("/"))
		fs.mkdirSync(path.dirname(destination), { recursive: true })
		fs.cpSync(source, destination, { recursive: true, dereference: true })
	}

	console.log(`[extension] Copied FFF runtime packages to ${path.relative(srcDir, destinationRoot)}`)
}

async function main() {
	const name = "extension"
	const production = process.argv.includes("--production")
	const watch = process.argv.includes("--watch")
	const minify = production
	const sourcemap = true // Always generate source maps for error handling

	/**
	 * @type {import('esbuild').BuildOptions}
	 */
	const buildOptions = {
		bundle: true,
		minify,
		sourcemap,
		logLevel: "silent",
		format: "cjs",
		sourcesContent: false,
		platform: "node",
	}

	const srcDir = __dirname
	const buildDir = __dirname
	const distDir = path.join(buildDir, "dist")

	if (fs.existsSync(distDir)) {
		console.log(`[${name}] Cleaning dist directory: ${distDir}`)
		fs.rmSync(distDir, { recursive: true, force: true })
	}

	/**
	 * @type {import('esbuild').Plugin[]}
	 */
	const plugins = [
		{
			name: "copyFiles",
			setup(build) {
				build.onEnd(() => {
					copyPaths(
						[
							["../README.md", "README.md"],
							["../CHANGELOG.md", "CHANGELOG.md"],
							["../LICENSE", "LICENSE"],
							["../.env", ".env", { optional: true }],
							["node_modules/vscode-material-icons/generated", "assets/vscode-material-icons"],
							["../webview-ui/audio", "webview-ui/audio"],
						],
						srcDir,
						buildDir,
					)

					// Copy vendor scripts (PDF.js, marked.js) to dist directory
					copyPaths([["assets/vendor", "assets/vendor"]], srcDir, distDir)

					// Copy walkthrough files to dist directory
					copyPaths([["walkthrough", "walkthrough"]], srcDir, distDir)

					// Copy JSDOM xhr-sync-worker.js to fix runtime resolution
					const jsdomWorkerDest = path.join(distDir, "xhr-sync-worker.js")

					try {
						const require = createRequire(import.meta.url)
						const jsdomModulePath = require.resolve("jsdom/package.json")
						const jsdomDir = path.dirname(jsdomModulePath)
						const jsdomWorkerSource = path.join(jsdomDir, "lib/jsdom/living/xhr/xhr-sync-worker.js")

						if (fs.existsSync(jsdomWorkerSource)) {
							fs.copyFileSync(jsdomWorkerSource, jsdomWorkerDest)
							console.log(`[${name}] Copied JSDOM xhr-sync-worker.js to dist from: ${jsdomWorkerSource}`)
						}
					} catch (error) {
						console.error(`[${name}] Failed to copy JSDOM xhr-sync-worker.js:`, error.message)
					}
				})
			},
		},
		{
			name: "copyFffRuntime",
			setup(build) {
				build.onEnd(() => copyFffRuntime(srcDir, distDir))
			},
		},
		{
			name: "copyWasms",
			setup(build) {
				build.onEnd(() => copyWasms(srcDir, distDir))
			},
		},
		{
			name: "copyLocales",
			setup(build) {
				build.onEnd(() => copyLocales(srcDir, distDir))
			},
		},
		{
			name: "esbuild-problem-matcher",
			setup(build) {
				build.onStart(() => console.log("[esbuild-problem-matcher#onStart]"))
				build.onEnd((result) => {
					result.errors.forEach(({ text, location }) => {
						console.error(`✘ [ERROR] ${text}`)
						if (location && location.file) {
							console.error(`    ${location.file}:${location.line}:${location.column}:`)
						}
					})

					console.log("[esbuild-problem-matcher#onEnd]")
				})
			},
		},
	]

	/**
	 * @type {import('esbuild').BuildOptions}
	 */
	const extensionConfig = {
		...buildOptions,
		plugins,
		entryPoints: ["extension.ts"],
		outfile: "dist/extension.js",
		external: ["vscode", "sqlite3"],
	}

	/**
	 * @type {import('esbuild').BuildOptions}
	 */
	const workerConfig = {
		...buildOptions,
		entryPoints: ["workers/countTokens.ts"],
		outdir: "dist/workers",
	}

	const [extensionCtx, workerCtx] = await Promise.all([
		esbuild.context(extensionConfig),
		esbuild.context(workerConfig),
	])

	if (watch) {
		await Promise.all([extensionCtx.watch(), workerCtx.watch()])
		copyLocales(srcDir, distDir)
		setupLocaleWatcher(srcDir, distDir)
	} else {
		await Promise.all([extensionCtx.rebuild(), workerCtx.rebuild()])
		await Promise.all([extensionCtx.dispose(), workerCtx.dispose()])
	}
}

main().catch((e) => {
	console.error(e)
	process.exit(1)
})
