import { render } from "ink"
import React, { useEffect, useState } from "react"
import { Box, Text, useInput, useApp } from "ink"
import { Logo } from "../ui/components/Logo"
import { performBrowserAuth, isBrowserAuthAvailable } from "./browserAuth"
import { useTheme } from "../state/hooks/useTheme"

interface AuthWizardProps {
	onComplete: (success: boolean) => void
}

const AuthWizardComponent: React.FC<AuthWizardProps> = ({ onComplete }) => {
	const { exit } = useApp()
	const theme = useTheme()
	const [step, setStep] = useState<"welcome" | "ready" | "authenticating" | "success" | "error">("welcome")
	const [errorMessage, setErrorMessage] = useState<string>("")

	useEffect(() => {
		if (step === "welcome") {
			const timer = setTimeout(() => {
				setStep("ready")
			}, 1000)
			return () => clearTimeout(timer)
		}
		return undefined
	}, [step])

	useInput((input, key) => {
		if (step === "ready" && key.return) {
			handleAuth()
		} else if (step === "success" && key.return) {
			onComplete(true)
			exit()
		} else if (step === "error" && key.return) {
			onComplete(false)
			exit()
		}
	})

	const handleAuth = async () => {
		setStep("authenticating")
		try {
			await performBrowserAuth("axon-code-cli")
			setStep("success")
		} catch (error) {
			setErrorMessage(error instanceof Error ? error.message : String(error))
			setStep("error")
		}
	}

	if (step === "welcome") {
		return (
			<Box flexDirection="column" alignItems="center" justifyContent="center" height={20}>
				<Logo />
				<Box marginTop={1}>
					<Text color={theme.brand.primary} bold>
						Axon Code CLI
					</Text>
				</Box>
				<Box marginTop={1}>
					<Text color={theme.ui.text.secondary}>Loading authentication...</Text>
				</Box>
			</Box>
		)
	}

	if (step === "ready") {
		return (
			<Box flexDirection="column">
				<Box marginBottom={1}>
					<Logo />
				</Box>
				<Box marginBottom={1}>
					<Text bold color={theme.brand.primary}>
						Welcome to Axon Code CLI
					</Text>
				</Box>
				<Box marginBottom={1}>
					<Text color={theme.ui.text.primary}>
						Axon Code is an AI-powered coding assistant that helps you write,
					</Text>
				</Box>
				<Box marginBottom={1}>
					<Text color={theme.ui.text.primary}>debug, and understand code through natural conversation.</Text>
				</Box>
				<Box marginBottom={1}>
					<Text color={theme.ui.text.primary}>To get started, let's authenticate your account.</Text>
				</Box>
				<Box marginBottom={1}>
					<Text color={theme.ui.text.secondary}>🌐 We'll open your browser to complete authentication.</Text>
				</Box>
				<Box marginBottom={1}>
					<Text color={theme.ui.text.secondary}>This is a secure way to connect your Axon Code account.</Text>
				</Box>
				<Box marginTop={1}>
					<Text color={theme.ui.text.primary}>
						<Text dimColor>Press Enter to open the browser for authentication...</Text>
					</Text>
				</Box>
			</Box>
		)
	}

	if (step === "authenticating") {
		return (
			<Box flexDirection="column">
				<Box marginBottom={1}>
					<Logo />
				</Box>
				<Box marginBottom={1}>
					<Text bold color={theme.brand.primary}>
						Authenticating...
					</Text>
				</Box>
				<Box>
					<Text color={theme.ui.text.secondary}>Please complete authentication in your browser</Text>
				</Box>
			</Box>
		)
	}

	if (step === "success") {
		return (
			<Box flexDirection="column">
				<Box marginBottom={1}>
					<Logo />
				</Box>
				<Box marginBottom={1}>
					<Text bold color="green">
						✓ Authentication completed successfully!
					</Text>
				</Box>
				<Box marginBottom={1}>
					<Text color={theme.ui.text.primary}>
						You can now use the Axon Code CLI with your authenticated account.
					</Text>
				</Box>
				<Box>
					<Text color={theme.ui.text.secondary}>
						<Text dimColor>Press Enter to continue...</Text>
					</Text>
				</Box>
			</Box>
		)
	}

	if (step === "error") {
		return (
			<Box flexDirection="column">
				<Box marginBottom={1}>
					<Logo />
				</Box>
				<Box marginBottom={1}>
					<Text bold color="red">
						✗ Authentication failed
					</Text>
				</Box>
				<Box marginBottom={1}>
					<Text color={theme.ui.text.primary}>{errorMessage}</Text>
				</Box>
				<Box>
					<Text color={theme.ui.text.secondary}>
						<Text dimColor>Press Enter to exit...</Text>
					</Text>
				</Box>
			</Box>
		)
	}

	return null
}

export default async function authWizard(): Promise<void> {
	return new Promise((resolve, reject) => {
		const app = render(
			<AuthWizardComponent
				onComplete={(success: boolean) => {
					if (success) {
						resolve()
					} else {
						reject(new Error("Authentication failed"))
					}
				}}
			/>,
		)

		// Handle cleanup
		app.waitUntilExit().catch((error: Error) => {
			reject(error)
		})
	})
}
