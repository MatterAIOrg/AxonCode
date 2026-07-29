import React from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { describe, expect, it, vi } from "vitest"

import { ExtensionStateContextProvider } from "@src/context/ExtensionStateContext"
import { render } from "@/utils/test-utils"

import { ChatRowContent } from "../ChatRow"

vi.mock("react-i18next", () => ({
	useTranslation: () => ({ t: (key: string) => key }),
	Trans: ({ i18nKey }: { i18nKey: string }) => <>{i18nKey}</>,
	initReactI18next: {
		type: "3rdParty",
		init: () => {},
	},
}))

vi.mock("@vscode/webview-ui-toolkit/react", () => ({
	VSCodeBadge: ({ children, ...props }: { children: React.ReactNode }) => <span {...props}>{children}</span>,
}))

const renderFileOperation = (tool: Record<string, unknown>, partial: boolean) =>
	render(
		<ExtensionStateContextProvider>
			<QueryClientProvider client={new QueryClient()}>
				<ChatRowContent
					message={{
						type: "ask",
						ask: "tool",
						ts: 1,
						text: JSON.stringify(tool),
						partial,
					}}
					isExpanded={false}
					isLast={false}
					isStreaming={partial}
					onToggleExpand={vi.fn()}
				/>
			</QueryClientProvider>
		</ExtensionStateContextProvider>,
	)

describe.each([
	{
		name: "file edit",
		tool: {
			tool: "fileEdit",
			path: "src/edited.ts",
			diff: "@@ -1 +1 @@\n-before\n+after",
		},
		fileName: "edited.ts",
	},
	{
		name: "file creation",
		tool: {
			tool: "newFileCreated",
			path: "src/created.ts",
			content: "export const created = true",
		},
		fileName: "created.ts",
	},
])("ChatRow animated $name", ({ tool, fileName }) => {
	it("centers the file metadata while the progress indicator is visible", () => {
		const { getByRole, getByText } = renderFileOperation(tool, true)

		expect(getByRole("status", { name: "Working" })).toHaveClass("relative", "top-px", "mr-1")

		const fileNameElement = getByText(fileName)
		const operationRow = fileNameElement.closest(".animate-fade-up")
		expect(operationRow).toHaveClass("items-center")
		expect(operationRow).not.toHaveClass("items-start")
		expect(fileNameElement.parentElement).toHaveClass("relative", "-top-px")
		expect(fileNameElement.parentElement).not.toHaveClass("-mt-[1px]")
		expect(getByText("+1").parentElement?.parentElement).toBe(fileNameElement.parentElement)
	})

	it("preserves the settled row alignment after the animation", () => {
		const { getByText, queryByRole } = renderFileOperation(tool, false)

		expect(queryByRole("status", { name: "Working" })).not.toBeInTheDocument()

		const fileNameElement = getByText(fileName)
		const operationRow = fileNameElement.closest(".animate-fade-up")
		expect(operationRow).toHaveClass("items-start")
		expect(fileNameElement.parentElement).toHaveClass("-mt-[1px]")
	})
})

describe("ChatRow search files", () => {
	it("shows the file pattern so parallel searches are distinguishable", () => {
		const { getByText } = renderFileOperation(
			{
				tool: "searchFiles",
				path: "src",
				regex: "eido",
				filePattern: "*.ts",
				content: "",
			},
			false,
		)

		const filePattern = getByText("*.ts")
		expect(filePattern.tagName).toBe("CODE")
		expect(filePattern.parentElement).toHaveTextContent("chat:directoryOperations.wantsToSearch·*.ts")
	})
})

describe("ChatRow long file names", () => {
	const longFileName =
		"rate-limiting-and-backpressure-token-bucket-vs-leaky-bucket-distributed-rate-limiters-with-redis.md"

	it("truncates a created file name while keeping its diff stats visible", () => {
		const { getByText } = renderFileOperation(
			{
				tool: "newFileCreated",
				path: `docs/${longFileName}`,
				content: "first line\nsecond line",
			},
			false,
		)

		const fileName = getByText(longFileName)
		expect(fileName).toHaveClass("min-w-0", "flex-1", "truncate")
		expect(fileName.parentElement).toHaveClass("flex-1", "min-w-0")
		expect(getByText("+2").parentElement).toHaveClass("shrink-0")
		expect(fileName.closest(".animate-fade-up")).toHaveClass("min-w-0")
	})

	it("truncates a read file name within the available row width", () => {
		const { getByLabelText } = renderFileOperation(
			{
				tool: "readFile",
				path: `docs/${longFileName}`,
				offset: 1,
				limit: 200,
			},
			false,
		)

		const fileName = getByLabelText(`docs/${longFileName}`)
		expect(fileName).toHaveClass("min-w-0", "truncate")
		expect(fileName.parentElement).toHaveClass("w-full", "min-w-0")
		expect(fileName.parentElement?.parentElement?.parentElement).toHaveClass("flex-1", "min-w-0")
	})
})
