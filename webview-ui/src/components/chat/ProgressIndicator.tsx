import { VSCodeProgressRing } from "@vscode/webview-ui-toolkit/react"
import { useEffect, useState } from "react"

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
	const [activeIndex, setActiveIndex] = useState(0)

	useEffect(() => {
		const interval = setInterval(() => {
			setActiveIndex((prev) => (prev + 1) % 3)
		}, 200)

		return () => clearInterval(interval)
	}, [])

	return (
		<div
			style={{
				display: "flex",
				alignItems: "center",
				gap: "3px",
			}}>
			{[0, 1, 2].map((index) => (
				<div
					key={index}
					style={{
						width: "6px",
						height: "6px",
						backgroundColor: index === activeIndex ? "#c4fdff" : "rgba(196, 253, 255, 0.5)",
						cursor: "pointer",
						transition: "background-color 0.3s ease",
					}}
				/>
			))}
		</div>
	)
}
