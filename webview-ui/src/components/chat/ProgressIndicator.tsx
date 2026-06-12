import { cn } from "@/lib/utils"

export const MatterProgressIndicator = ({ className }: { className?: string }) => {
	return (
		<div className={cn("matter-progress-terminal", className)}>
			<div className="terminal-content">
				{[0, 1, 2].map((index) => (
					<div key={index} className="matter-progress-dot" style={{ animationDelay: `${index * 80}ms` }} />
				))}
			</div>
		</div>
	)
}

// Default loading spinner — alias of MatterProgressIndicator so every
// consumer renders the same pulsing-dots indicator as the running task.
export const ProgressIndicator = MatterProgressIndicator
