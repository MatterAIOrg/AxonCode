import React, { useState, useEffect } from "react"
import { Plus, Globe, Folder, Settings, SquareSlash } from "lucide-react"
import { Trans } from "react-i18next"

import type { Command } from "@roo/ExtensionMessage"

import { useAppTranslation } from "@/i18n/TranslationContext"
import { useExtensionState } from "@/context/ExtensionStateContext"
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	Button,
} from "@/components/ui"
import { vscode } from "@/utils/vscode"
import { buildDocLink } from "@/utils/docLinks"

import { SettingsCard } from "./ui/SettingsCard"
import { SlashCommandItem } from "../chat/SlashCommandItem"

export const SlashCommandsSettings: React.FC = () => {
	const { t } = useAppTranslation()
	const { commands, cwd } = useExtensionState()
	const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
	const [commandToDelete, setCommandToDelete] = useState<Command | null>(null)
	const [globalNewName, setGlobalNewName] = useState("")
	const [workspaceNewName, setWorkspaceNewName] = useState("")

	// Check if we're in a workspace/project
	const hasWorkspace = Boolean(cwd)

	// Request commands when component mounts
	useEffect(() => {
		handleRefresh()
	}, [])

	const handleRefresh = () => {
		vscode.postMessage({ type: "requestCommands" })
	}

	const handleDeleteClick = (command: Command) => {
		setCommandToDelete(command)
		setDeleteDialogOpen(true)
	}

	const handleDeleteConfirm = () => {
		if (commandToDelete) {
			vscode.postMessage({
				type: "deleteCommand",
				text: commandToDelete.name,
				values: { source: commandToDelete.source },
			})
			setDeleteDialogOpen(false)
			setCommandToDelete(null)
			// Refresh the commands list after deletion
			setTimeout(handleRefresh, 100)
		}
	}

	const handleDeleteCancel = () => {
		setDeleteDialogOpen(false)
		setCommandToDelete(null)
	}

	const handleCreateCommand = (source: "global" | "project", name: string) => {
		if (!name.trim()) return

		// Append .md if not already present
		const fileName = name.trim().endsWith(".md") ? name.trim() : `${name.trim()}.md`

		vscode.postMessage({
			type: "createCommand",
			text: fileName,
			values: { source },
		})

		// Clear the input and refresh
		if (source === "global") {
			setGlobalNewName("")
		} else {
			setWorkspaceNewName("")
		}
		setTimeout(handleRefresh, 500)
	}

	const handleCommandClick = (command: Command) => {
		// For now, we'll just show the command name - editing functionality can be added later
		// This could be enhanced to open the command file in the editor
		console.log(`Command clicked: ${command.name} (${command.source})`)
	}

	// Group commands by source
	const builtInCommands = commands?.filter((cmd) => cmd.source === "built-in") || []
	const globalCommands = commands?.filter((cmd) => cmd.source === "global") || []
	const projectCommands = commands?.filter((cmd) => cmd.source === "project") || []

	return (
		<>
			<div className="flex flex-col gap-4">
				<div>
					<h3 className="text-sm font-medium text-vscode-foreground flex items-center gap-2 m-0 px-1 py-2">
						<SquareSlash className="w-4" />
						<span>{t("settings:sections.slashCommands")}</span>
					</h3>
					<div className="text-vscode-descriptionForeground text-xs px-1">
						<Trans
							i18nKey="settings:slashCommands.description"
							components={{
								DocsLink: (
									<a
										href={buildDocLink("features/slash-commands", "slash_commands_settings")}
										target="_blank"
										rel="noopener noreferrer"
										className="text-vscode-textLink-foreground hover:underline">
										Docs
									</a>
								),
							}}
						/>
					</div>
				</div>

				{/* Global Commands Section */}
				<div>
					<SettingsCard>
						<div className="flex flex-col">
							<div className="px-4 py-3 flex items-center gap-2 border-b border-vscode-panel-border bg-vscode-settings-focusedRowBackground font-medium text-sm">
								<Globe className="w-4 h-4" />
								{t("chat:slashCommands.globalCommands")}
							</div>
							<div className="flex flex-col">
								{globalCommands.map((command) => (
									<SlashCommandItem
										key={`global-${command.name}`}
										command={command}
										onDelete={handleDeleteClick}
										onClick={handleCommandClick}
									/>
								))}
								{/* New global command input */}
								<div className="px-4 py-2 flex items-center gap-2 hover:bg-vscode-list-hoverBackground border-t border-vscode-panel-border">
									<input
										type="text"
										value={globalNewName}
										onChange={(e) => setGlobalNewName(e.target.value)}
										placeholder={t("chat:slashCommands.newGlobalCommandPlaceholder")}
										className="flex-1 bg-vscode-input-background text-vscode-input-foreground placeholder-vscode-input-placeholderForeground border border-vscode-input-border rounded px-2 py-1 text-sm focus:outline-none focus:border-vscode-focusBorder"
										onKeyDown={(e) => {
											if (e.key === "Enter") {
												handleCreateCommand("global", globalNewName)
											}
										}}
									/>
									<Button
										variant="ghost"
										size="icon"
										onClick={() => handleCreateCommand("global", globalNewName)}
										disabled={!globalNewName.trim()}
										className="size-6 flex items-center justify-center opacity-60 hover:opacity-100">
										<Plus className="w-4 h-4" />
									</Button>
								</div>
							</div>
						</div>
					</SettingsCard>
				</div>

				{/* Workspace Commands Section - Only show if in a workspace */}
				{hasWorkspace && (
					<div>
						<SettingsCard>
							<div className="flex flex-col">
								<div className="px-4 py-3 flex items-center gap-2 border-b border-vscode-panel-border bg-vscode-settings-focusedRowBackground font-medium text-sm">
									<Folder className="w-4 h-4" />
									{t("chat:slashCommands.workspaceCommands")}
								</div>
								<div className="flex flex-col">
									{projectCommands.map((command) => (
										<SlashCommandItem
											key={`project-${command.name}`}
											command={command}
											onDelete={handleDeleteClick}
											onClick={handleCommandClick}
										/>
									))}
									{/* New workspace command input */}
									<div className="px-4 py-2 flex items-center gap-2 hover:bg-vscode-list-hoverBackground border-t border-vscode-panel-border">
										<input
											type="text"
											value={workspaceNewName}
											onChange={(e) => setWorkspaceNewName(e.target.value)}
											placeholder={t("chat:slashCommands.newWorkspaceCommandPlaceholder")}
											className="flex-1 bg-vscode-input-background text-vscode-input-foreground placeholder-vscode-input-placeholderForeground border border-vscode-input-border rounded px-2 py-1 text-sm focus:outline-none focus:border-vscode-focusBorder"
											onKeyDown={(e) => {
												if (e.key === "Enter") {
													handleCreateCommand("project", workspaceNewName)
												}
											}}
										/>
										<Button
											variant="ghost"
											size="icon"
											onClick={() => handleCreateCommand("project", workspaceNewName)}
											disabled={!workspaceNewName.trim()}
											className="size-6 flex items-center justify-center opacity-60 hover:opacity-100">
											<Plus className="w-4 h-4" />
										</Button>
									</div>
								</div>
							</div>
						</SettingsCard>
					</div>
				)}

				{/* Built-in Commands Section */}
				{builtInCommands.length > 0 && (
					<div>
						<SettingsCard>
							<div className="flex flex-col">
								<div className="px-4 py-3 flex items-center gap-2 border-b border-vscode-panel-border bg-vscode-settings-focusedRowBackground font-medium text-sm">
									<Settings className="w-4 h-4" />
									{t("chat:slashCommands.builtInCommands")}
								</div>
								<div className="flex flex-col">
									{builtInCommands.map((command) => (
										<SlashCommandItem
											key={`built-in-${command.name}`}
											command={command}
											onDelete={handleDeleteClick}
											onClick={handleCommandClick}
										/>
									))}
								</div>
							</div>
						</SettingsCard>
					</div>
				)}
			</div>

			<AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>{t("chat:slashCommands.deleteDialog.title")}</AlertDialogTitle>
						<AlertDialogDescription>
							{t("chat:slashCommands.deleteDialog.description", { name: commandToDelete?.name })}
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter className="flex-col gap-2 items-center justify-center">
						<AlertDialogCancel onClick={handleDeleteCancel}>
							{t("chat:slashCommands.deleteDialog.cancel")}
						</AlertDialogCancel>
						<AlertDialogAction onClick={handleDeleteConfirm}>
							{t("chat:slashCommands.deleteDialog.confirm")}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</>
	)
}
