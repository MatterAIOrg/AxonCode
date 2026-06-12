import { CheckCircle2, Circle, Loader2 } from "lucide-react"
import { useState } from "react"

interface TodoItem {
	id?: string
	content: string
	status?: "completed" | "in_progress" | string
}

/**
 * Pinned todo list panel. Rendered once above the chat input and updated in
 * place as the update_todo_list tool runs, instead of posting a new list into
 * the chat for every update. Expands upward like AcceptRejectButtons.
 */
export function PinnedTodoList({ todos }: { todos: TodoItem[] }) {
	const [isExpanded, setIsExpanded] = useState(false)

	if (!Array.isArray(todos) || todos.length === 0) return null

	const totalCount = todos.length
	const completedCount = todos.filter((todo) => todo.status === "completed").length
	const inProgressTodo = todos.find((todo) => todo.status === "in_progress")
	const allCompleted = completedCount === totalCount

	const renderStatusIcon = (status: string | undefined) => {
		const iconProps = {
			size: 12,
			style: {
				flexShrink: 0,
				marginTop: 3,
			} as React.CSSProperties,
		}

		if (status === "completed") {
			return <CheckCircle2 {...iconProps} color="var(--vscode-descriptionForeground)" />
		}

		if (status === "in_progress") {
			return <Loader2 {...iconProps} color="var(--vscode-foreground)" className="animate-spin" />
		}

		return <Circle {...iconProps} color="var(--vscode-foreground)" />
	}

	return (
		<div className="flex flex-col w-full border border-vscode-editorWidget-border rounded-lg overflow-hidden bg-vscode-editor-background">
			{/* Todo list - only show when expanded, sits above the header bar */}
			{isExpanded && (
				<div className="overflow-y-auto max-h-64 px-2.5 py-2 border-b border-vscode-editorWidget-border">
					<ul style={{ margin: 0, paddingLeft: 0, listStyle: "none" }}>
						{todos.map((todo, idx) => (
							<li
								key={todo.id || `${idx}-${todo.content}`}
								className="flex items-start gap-1.5"
								style={{
									marginBottom: idx < todos.length - 1 ? 6 : 0,
									minHeight: 18,
									lineHeight: "1.4",
								}}>
								{renderStatusIcon(todo.status)}
								<span
									style={{
										fontSize: 12,
										fontWeight: todo.status === "in_progress" ? 500 : 300,
										color:
											todo.status === "completed"
												? "var(--vscode-descriptionForeground)"
												: "var(--vscode-foreground)",
										opacity: todo.status === "completed" ? 0.8 : 1,
										wordBreak: "break-word",
									}}>
									{todo.content}
								</span>
							</li>
						))}
					</ul>
				</div>
			)}

			{/* Header bar with collapse/expand toggle and progress */}
			<div
				className="flex items-center gap-1.5 px-2 py-1 cursor-pointer select-none bg-vscode-editorWidget-background"
				onClick={() => setIsExpanded(!isExpanded)}>
				<span className={`text-sm codicon codicon-chevron-${isExpanded ? "up" : "down"}`} />
				<span className="text-xs text-vscode-foreground opacity-80 flex-shrink-0">
					{completedCount}/{totalCount} tasks
				</span>
				{!isExpanded && (
					<span className="text-xs truncate min-w-0" style={{ color: "var(--vscode-descriptionForeground)" }}>
						{allCompleted ? "All tasks completed" : inProgressTodo?.content}
					</span>
				)}
			</div>
		</div>
	)
}
