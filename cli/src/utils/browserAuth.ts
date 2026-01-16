import { createServer, IncomingMessage, ServerResponse } from "http"
import { spawn } from "node:child_process"
import { randomBytes } from "node:crypto"
import { URL } from "node:url"
import { loadConfig, saveConfig, CLIConfig } from "../config"
import { logs } from "../services/logs"

interface AuthCallbackData {
	token: string
	error?: string
}

/**
 * Generates a random state parameter for CSRF protection
 */
function generateState(): string {
	return randomBytes(32).toString("hex")
}

/**
 * Starts a local HTTP server to receive the authentication callback
 * @param port - Port to listen on
 * @param state - Expected state parameter for validation
 * @returns Promise that resolves with the token or rejects on error/timeout
 */
function createCallbackServer(port: number, state: string): Promise<AuthCallbackData> {
	return new Promise((resolve, reject) => {
		const server = createServer((req: IncomingMessage, res: ServerResponse) => {
			const url = new URL(req.url || "", `http://localhost:${port}`)
			const queryParams = url.searchParams

			// Check for error
			const error = queryParams.get("error")
			if (error) {
				res.writeHead(400, { "Content-Type": "text/html" })
				res.end(`
					<html>
						<body>
							<h1>Authentication Failed</h1>
							<p>Error: ${error}</p>
							<p>You can close this window and try again.</p>
						</body>
					</html>
				`)
				server.close()
				reject(new Error(`Authentication failed: ${error}`))
				return
			}

			// Check state parameter
			const receivedState = queryParams.get("state")
			if (receivedState !== state) {
				res.writeHead(400, { "Content-Type": "text/html" })
				res.end(`
					<html>
						<body>
							<h1>Authentication Failed</h1>
							<p>Invalid state parameter. Possible CSRF attack.</p>
							<p>You can close this window and try again.</p>
						</body>
					</html>
				`)
				server.close()
				reject(new Error("Invalid state parameter"))
				return
			}

			// Extract token
			const token = queryParams.get("token")
			if (!token) {
				res.writeHead(400, { "Content-Type": "text/html" })
				res.end(`
					<html>
						<body>
							<h1>Authentication Failed</h1>
							<p>No token received from authentication server.</p>
							<p>You can close this window and try again.</p>
						</body>
					</html>
				`)
				server.close()
				reject(new Error("No token received"))
				return
			}

			// Success - send a nice page to the user
			res.writeHead(200, { "Content-Type": "text/html" })
			res.end(`
				<html>
					<head>
						<title>Authentication Successful</title>
						<style>
							body { font-family: Arial, sans-serif; text-align: center; padding: 50px; background-color: black;}
							h1 { color: #c4fdff; }
							p { font-size: 18px; color: white; }
						</style>
					</head>
					<body>
						<h1>Axon Code Authentication Successful</h1>
						<p>You can now close this window and return to the CLI.</p>
					</body>
				</html>
			`)

			server.close()
			resolve({ token })
		})

		server.listen(port, () => {
			logs.debug(`Callback server listening on port ${port}`, "BrowserAuth")
		})

		// Timeout after 5 minutes
		setTimeout(
			() => {
				server.close()
				reject(new Error("Authentication timeout - please try again"))
			},
			5 * 60 * 1000,
		)
	})
}

/**
 * Opens the authentication URL in the user's browser
 * @param source - Source identifier for tracking
 * @param state - CSRF protection state parameter
 * @param port - Port where the callback server is listening
 */
function openAuthUrl(source: string, state: string, port: number): void {
	const callbackUrl = encodeURIComponent(`http://localhost:${port}/callback`)
	const authUrl = `http://localhost:3000/authentication/sign-in?loginType=extension&source=${encodeURIComponent(
		source,
	)}&callback=${callbackUrl}&clistate=${state}`

	logs.debug(`Opening authentication URL: ${authUrl}`, "BrowserAuth")

	// Use the appropriate command to open the URL based on the platform
	const platform = process.platform
	let command: string
	let args: string[]

	switch (platform) {
		case "darwin": // macOS
			command = "open"
			args = [authUrl]
			break
		case "win32": // Windows
			command = "start"
			args = [authUrl]
			break
		default: // Linux and others
			command = "xdg-open"
			args = [authUrl]
			break
	}

	try {
		spawn(command, args, { detached: true, stdio: "ignore" })
	} catch (error) {
		logs.error("Failed to open browser", "BrowserAuth", { error, command, args })
		console.log(`Please open this URL in your browser: ${authUrl}`)
	}
}

/**
 * Performs browser-based authentication for the CLI
 * @param source - Source identifier for tracking (e.g., "axon-code-cli")
 * @returns Promise that resolves when authentication is complete
 */
export async function performBrowserAuth(source: string = "axon-code-cli"): Promise<void> {
	console.log("🔐 Starting browser-based authentication...")
	console.log("A browser window will open shortly.")
	console.log("")

	const state = generateState()
	const port = 9745 // Random port that's unlikely to be in use

	try {
		// Start the callback server
		const callbackPromise = createCallbackServer(port, state)

		// Open the authentication URL
		openAuthUrl(source, state, port)

		console.log(`If your browser doesn't open automatically, please wait...`)
		console.log("")

		// Wait for the callback
		const { token } = await callbackPromise

		console.log("✓ Token received successfully!")
		console.log("")

		// Load current config
		const { config } = await loadConfig()

		// Update config with the new token
		const updatedConfig: CLIConfig = {
			...config,
			providers: [
				{
					id: "default",
					provider: "kilocode",
					kilocodeToken: token,
					kilocodeModel: "axon-code-2",
				},
			],
		}

		// Save the updated config
		await saveConfig(updatedConfig)

		console.log("✓ Configuration saved successfully!")
		console.log("")
		console.log("You can now use the Axon Code CLI with your authenticated account.")
	} catch (error) {
		logs.error("Browser authentication failed", "BrowserAuth", { error })
		throw error
	}
}

/**
 * Checks if browser-based authentication is available
 * @returns true if the system supports opening browsers
 */
export function isBrowserAuthAvailable(): boolean {
	const platform = process.platform
	return platform === "darwin" || platform === "win32" || platform === "linux"
}
