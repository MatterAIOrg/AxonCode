import { CheckCircle2, Circle, Loader2 } from "lucide-react"

export function TodoListDisplay({ todos }: { todos: any[] }) {
	if (!Array.isArray(todos) || todos.length === 0) return null

	const totalCount = todos.length
	const completedCount = todos.filter((todo: any) => todo.status === "completed").length

	const renderStatusIcon = (status: string | undefined) => {
		const iconProps = {
			size: 14,
			style: {
				flexShrink: 0,
				marginTop: 2,
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
		<div
			style={{
				margin: "0px 0px 0px 8px",
				padding: "10px 12px",
				width: "96%",
				borderRadius: 6,
				background: "var(--vscode-editor-background, transparent)",
				border: "1px solid var(--color-matterai-border)",
			}}>
			<div
				style={{
					color: "var(--vscode-descriptionForeground)",
					fontSize: 12,
					marginBottom: 10,
				}}>
				{completedCount} out of {totalCount} tasks completed
			</div>
			<ul style={{ margin: 0, paddingLeft: 0, listStyle: "none" }}>
				{todos.map((todo: any, idx: number) => (
					<li
						key={todo.id || todo.content}
						style={{
							display: "flex",
							alignItems: "flex-start",
							gap: 8,
							marginBottom: idx < todos.length - 1 ? 8 : 0,
							minHeight: 20,
							lineHeight: "1.4",
						}}>
						<span
							style={{
								color: "var(--vscode-descriptionForeground)",
								fontSize: 12,
								minWidth: 16,
								flexShrink: 0,
								marginTop: 2,
							}}>
							{idx + 1}
						</span>
						{renderStatusIcon(todo.status)}
						<span
							style={{
								fontSize: 12,
								color:
									todo.status === "completed"
										? "var(--vscode-descriptionForeground)"
										: "var(--vscode-foreground)",
								textDecoration: todo.status === "completed" ? "line-through" : "none",
								opacity: todo.status === "completed" ? 0.7 : 0.9,
								wordBreak: "break-word",
							}}>
							{todo.content}
						</span>
					</li>
				))}
			</ul>
		</div>
	)
}
