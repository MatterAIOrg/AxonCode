/**
 * Tests for code review skip patterns
 */
import { describe, it, expect } from "vitest"

// Import the skip patterns and shouldSkipFile function
// Note: These are defined in webviewMessageHandler.ts, so we need to test them indirectly
// or extract them to a separate module for better testability

describe("Code Review Skip Patterns", () => {
	// For now, we'll test the patterns directly
	// In a real implementation, these should be exported from a separate module

	const skipPatterns = [
		// Package managers
		/package-lock\.json$/,
		/\.env$/,
		/\.vscodeignore$/,
		/Makefile$/,
		/\.md$/,
		/\.mdx$/,
		/\.json$/,
		/yarn\.lock$/,
		/pnpm-lock\.yaml$/,
		/Podfile\.lock$/,
		/Gemfile\.lock$/,
		/composer\.lock$/,
		/cargo\.lock$/,
		/poetry\.lock$/,
		/Pipfile\.lock$/,
		/project\.assets\.json$/,
		/packages\.lock\.json$/,
		/npm-shrinkwrap\.json$/,
		/bun\.lockb$/,

		/\.firebaserc$/,
		/firebase\.json$/,
		/\.prettierrc\.json$/,
		/\.npmrc$/,
		/config-overrides\.js$/,
		/jsconfig\.json$/,
		/robots\.txt$/,

		// Build directories
		/\/dist\//,
		/\/build\//,
		/\/\.next\//,
		/\/node_modules\//,
		/\/out\//,
		/\/\.gradle\//,
		/\/\.dart_tool\//,
		/\/\.pub-cache\//,
		/\/\.pub\//,
		/\/\.nuxt\//,
		/\/\.output\//,
		/\/target\//,
		/\/bin\//,
		/\/obj\//,
		/\/\.venv\//,
		/\/venv\//,
		/\/env\//,
		/\/__pycache__\//,
		/\/\.pytest_cache\//,
		/\/\.tox\//,
		/\/\.eggs\//,
		/\/\.bundle\//,
		/\/vendor\//,

		// Minified files
		/\.min\.js$/,
		/\.min\.css$/,
		/\.bundle\.js$/,
		/\.bundle\.css$/,

		// iOS/Xcode
		/\.pbxproj$/,
		/\.xcworkspacedata$/,
		/\.xcscheme$/,
		/\.xcuserstate$/,
		/\.plist$/,
		/\.nib$/,
		/\.storyboardc$/,

		// Android
		/\.apk$/,
		/\.aab$/,
		/R\.java$/,
		/BuildConfig\.java$/,
		/\.iml$/,
		/\.aar$/,
		/\.dex$/,

		// Flutter
		/\.g\.dart$/,
		/\.freezed\.dart$/,
		/flutter_export_environment\.sh$/,
		/Flutter\.podspec$/,

		// Generated files
		/\/generated\//,
		/\/\.generated\//,
		/\/\.gen\//,
		/\/auto-generated\//,
		/\.designer\./,
		/\.Designer\./,

		// Config and metadata files
		/\.DS_Store$/,
		/Thumbs\.db$/,
		/desktop\.ini$/,
		/\/\.idea\//,
		/\/\.vscode\//,
		/\/\.vs\//,
		/\.project$/,
		/\.classpath$/,
		/\/\.settings\//,
		/\.editorconfig$/,
		/\.gitattributes$/,
		/\/\.gitignore\//,
		/\/\.vercel\//,
		/\/netlify\//,

		// Compiled binaries
		/\.so$/,
		/\.dylib$/,
		/\.dll$/,
		/\.class$/,
		/\.pyc$/,
		/\.pyo$/,
		/\.o$/,
		/\.obj$/,
		/\.a$/,
		/\.lib$/,
		/\.exe$/,
		/\.pdb$/,
		/\.ilk$/,
		/\.map$/,
		/\.jar$/,
		/\.war$/,
		/\.ear$/,

		/prometheus\.yml$/,
		/grafana\.yml$/,
		/grafana-dashboard\.yml$/,

		// Filter all files with .cursor in their path
		/\/\.cursor\//,
		/\/\.github\//,

		// Go files
		/\.pb\.go$/,
		/\.pb\.gw\.go$/,
		/\.gen\.go$/,
		/mock_.+\.go$/,
		/_string\.go$/,
		/go\.sum$/,
		/go\.mod$/,
		/\.go\.orig$/,

		// API specs
		/swagger\.json$/,
		/swagger\.yaml$/,
		/swagger\.yml$/,
		/openapi\.json$/,
		/openapi\.yaml$/,
		/openapi\.yml$/,

		// Properties and config files
		/buildconfig\.properties$/,
		/application\.properties$/,
		/application\.yml$/,
		/application-.*\.properties$/,
		/application-.*\.yml$/,
		/\.config$/,
		/\.conf$/,
		/\.ini$/,
		/\.toml$/,
		/\.png$/,
		/\.jpg$/,
		/\.jpeg$/,
		/\.gif$/,
		/\.bmp$/,
		/\.webp$/,
		/\.svg$/,
		/\.ico$/,
		/\.tiff$/,
		/\.tif$/,
		/\.mp4$/,
		/\.mp3$/,
		/\.wav$/,
		/\.ogg$/,
		/\.mov$/,
		/\.avi$/,
		/\.wmv$/,
		/\.flv$/,
		/\.mkv$/,
		/\.pdf$/,
		/\.zip$/,
		/\.tar$/,
		/\.gz$/,
		/\.rar$/,
		/\.7z$/,
		/\.exe$/,
		/\.dll$/,
		/\.bin$/,
		/\.so$/,
		/\.dylib$/,
		/\.jar$/,
		/\.wasm$/,
		/\.psd$/,
		/\.ai$/,
		/\.eps$/,
		/\.ttf$/,
		/\.woff$/,
		/\.woff2$/,
		/\.eot$/,
		/\.otf$/,
		/\.apk$/,
		/\.ipa$/,
		/\.dmg$/,
		/\.iso$/,
		/\.csv$/,

		// Data files, datasets, and dumps
		/\.tsv$/,
		/\.psv$/,
		/\.xlsx$/,
		/\.xls$/,
		/\.xlsm$/,
		/\.xlsb$/,
		/\.ods$/,
		/\.sql$/,
		/\.dump$/,
		/\.dmp$/,
		/\.sqlite$/,
		/\.sqlite3$/,
		/\.db$/,
		/\.db3$/,
		/\.psql$/,
		/\.pgsql$/,
		/\.parquet$/,
		/\.avro$/,
		/\.feather$/,
		/\.orc$/,
		/\.rds$/,
		/\.rdata$/,

		// Log and temporary artifacts
		/\.log(\.[\w.-]+)?$/,
		/\.tmp$/,
		/\.temp$/,
		/\.bak$/,
		/\.backup$/,
		/\.swp$/,
		/\.swo$/,
		/\.swn$/,
		/\.orig$/,
		/\.rej$/,
		/\.diff$/,
		/\.patch$/,

		// Archive and binary blobs
		/\.tgz$/,
		/\.bz2$/,
		/\.xz$/,
		/\.lz4$/,

		// Coverage, cache, and artifact directories
		/\/coverage\//,
		/\/reports?\//,
		/\/artifacts?\//,
		/\/test-output\//,
		/\/build-output\//,
		/\/build-artifacts\//,
		/\/\.nyc_output\//,
		/\/\.cache\//,
		/\/\.sass-cache\//,
		/\/logs\//,
		/\/log\//,
		/\/tmp\//,
		/\/temp\//,
	]

	function shouldSkipFile(filePath: string): boolean {
		const normalizedPath = filePath.replace(/\\/g, "/")
		for (const pattern of skipPatterns) {
			if (pattern.test(normalizedPath)) {
				return true
			}
		}
		return false
	}

	describe("Package manager files", () => {
		it("should skip package-lock.json", () => {
			expect(shouldSkipFile("package-lock.json")).toBe(true)
		})

		it("should skip yarn.lock", () => {
			expect(shouldSkipFile("yarn.lock")).toBe(true)
		})

		it("should skip pnpm-lock.yaml", () => {
			expect(shouldSkipFile("pnpm-lock.yaml")).toBe(true)
		})

		it("should skip .env files", () => {
			expect(shouldSkipFile(".env")).toBe(true)
			expect(shouldSkipFile(".env.local")).toBe(true)
			expect(shouldSkipFile(".env.production")).toBe(true)
		})
	})

	describe("Build directories", () => {
		it("should skip files in dist directory", () => {
			expect(shouldSkipFile("dist/index.js")).toBe(true)
			expect(shouldSkipFile("src/dist/file.js")).toBe(true)
		})

		it("should skip files in build directory", () => {
			expect(shouldSkipFile("build/index.js")).toBe(true)
			expect(shouldSkipFile("src/build/file.js")).toBe(true)
		})

		it("should skip files in node_modules", () => {
			expect(shouldSkipFile("node_modules/react/index.js")).toBe(true)
			expect(shouldSkipFile("src/node_modules/package/index.js")).toBe(true)
		})

		it("should skip files in .next directory", () => {
			expect(shouldSkipFile(".next/static/chunks/main.js")).toBe(true)
		})
	})

	describe("Markdown and documentation", () => {
		it("should skip .md files", () => {
			expect(shouldSkipFile("README.md")).toBe(true)
			expect(shouldSkipFile("docs/api.md")).toBe(true)
		})

		it("should skip .mdx files", () => {
			expect(shouldSkipFile("blog/post.mdx")).toBe(true)
		})
	})

	describe("Config files", () => {
		it("should skip .vscode directory", () => {
			expect(shouldSkipFile(".vscode/settings.json")).toBe(true)
		})

		it("should skip .idea directory", () => {
			expect(shouldSkipFile(".idea/workspace.xml")).toBe(true)
		})

		it("should skip .DS_Store", () => {
			expect(shouldSkipFile(".DS_Store")).toBe(true)
		})
	})

	describe("Minified files", () => {
		it("should skip .min.js files", () => {
			expect(shouldSkipFile("bundle.min.js")).toBe(true)
		})

		it("should skip .min.css files", () => {
			expect(shouldSkipFile("styles.min.css")).toBe(true)
		})
	})

	describe("Binary and media files", () => {
		it("should skip image files", () => {
			expect(shouldSkipFile("image.png")).toBe(true)
			expect(shouldSkipFile("photo.jpg")).toBe(true)
			expect(shouldSkipFile("icon.svg")).toBe(true)
		})

		it("should skip video files", () => {
			expect(shouldSkipFile("video.mp4")).toBe(true)
			expect(shouldSkipFile("movie.mov")).toBe(true)
		})

		it("should skip audio files", () => {
			expect(shouldSkipFile("audio.mp3")).toBe(true)
			expect(shouldSkipFile("sound.wav")).toBe(true)
		})

		it("should skip PDF files", () => {
			expect(shouldSkipFile("document.pdf")).toBe(true)
		})

		it("should skip archive files", () => {
			expect(shouldSkipFile("archive.zip")).toBe(true)
			expect(shouldSkipFile("backup.tar.gz")).toBe(true)
		})
	})

	describe("Go files", () => {
		it("should skip generated Go files", () => {
			expect(shouldSkipFile("api.pb.go")).toBe(true)
			expect(shouldSkipFile("api.pb.gw.go")).toBe(true)
			expect(shouldSkipFile("mock_api.gen.go")).toBe(true)
		})

		it("should skip go.sum and go.mod", () => {
			expect(shouldSkipFile("go.sum")).toBe(true)
			expect(shouldSkipFile("go.mod")).toBe(true)
		})
	})

	describe("API specs", () => {
		it("should skip OpenAPI specs", () => {
			expect(shouldSkipFile("openapi.json")).toBe(true)
			expect(shouldSkipFile("openapi.yaml")).toBe(true)
			expect(shouldSkipFile("swagger.json")).toBe(true)
		})
	})

	describe("Source code files should NOT be skipped", () => {
		it("should not skip TypeScript files", () => {
			expect(shouldSkipFile("src/index.ts")).toBe(false)
			expect(shouldSkipFile("component.tsx")).toBe(false)
		})

		it("should not skip JavaScript files", () => {
			expect(shouldSkipFile("src/index.js")).toBe(false)
			expect(shouldSkipFile("component.jsx")).toBe(false)
		})

		it("should not skip Python files", () => {
			expect(shouldSkipFile("main.py")).toBe(false)
			expect(shouldSkipFile("utils/helper.py")).toBe(false)
		})

		it("should not skip Go files (non-generated)", () => {
			expect(shouldSkipFile("main.go")).toBe(false)
			expect(shouldSkipFile("api/handler.go")).toBe(false)
		})

		it("should not skip Java files", () => {
			expect(shouldSkipFile("Main.java")).toBe(false)
			expect(shouldSkipFile("com/example/Service.java")).toBe(false)
		})

		it("should not skip Rust files", () => {
			expect(shouldSkipFile("main.rs")).toBe(false)
			expect(shouldSkipFile("lib/module.rs")).toBe(false)
		})

		it("should not skip C/C++ files", () => {
			expect(shouldSkipFile("main.c")).toBe(false)
			expect(shouldSkipFile("header.h")).toBe(false)
			expect(shouldSkipFile("lib.cpp")).toBe(false)
		})

		it("should not skip HTML/CSS files (non-minified)", () => {
			expect(shouldSkipFile("index.html")).toBe(false)
			expect(shouldSkipFile("styles.css")).toBe(false)
		})
	})

	describe("Path normalization", () => {
		it("should handle Windows paths", () => {
			expect(shouldSkipFile("dist\\index.js")).toBe(true)
			expect(shouldSkipFile("node_modules\\react\\index.js")).toBe(true)
		})

		it("should handle Unix paths", () => {
			expect(shouldSkipFile("dist/index.js")).toBe(true)
			expect(shouldSkipFile("node_modules/react/index.js")).toBe(true)
		})
	})
})
