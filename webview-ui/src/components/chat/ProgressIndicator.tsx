import { VSCodeProgressRing } from "@vscode/webview-ui-toolkit/react"

export const ProgressIndicator = () => (
	<div
		style={{
			width: "16px",
			height: "16px",
			display: "flex",
			alignItems: "center",
			justifyContent: "center",
		}}>
		<div style={{ transform: "scale(0.55)", transformOrigin: "center" }}>
			<VSCodeProgressRing />
		</div>
	</div>
)

export const MatterProgressIndicator = () => {
	return (
		<div className="matter-progress-terminal">
			<div className="terminal-content">
				{[0, 1, 2].map((index) => (
					<div key={index} className="matter-progress-dot" style={{ animationDelay: `${index * 80}ms` }} />
				))}
			</div>
		</div>
	)
}
