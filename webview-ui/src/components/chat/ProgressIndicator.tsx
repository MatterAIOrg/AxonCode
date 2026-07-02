import { useEffect, useState } from "react"

import { cn } from "@/lib/utils"

// Braille-dot spinner frames — the same rotating-dots animation used by the
// Orbcode CLI "Working" indicator. Each frame is a 2×4 dot grid that cycles
// every 80ms to produce a smooth clockwise rotation.
const SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"]

export const MatterProgressIndicator = ({ className }: { className?: string }) => {
	const [frame, setFrame] = useState(0)

	useEffect(() => {
		const timer = setInterval(() => {
			setFrame((f) => (f + 1) % SPINNER_FRAMES.length)
		}, 80)
		return () => clearInterval(timer)
	}, [])

	return (
		<span className={cn("matter-progress-spinner", className)} aria-label="Working" role="status">
			{SPINNER_FRAMES[frame]}
		</span>
	)
}

// Default loading spinner — alias of MatterProgressIndicator so every
// consumer renders the same rotating-dots indicator as the running task.
export const ProgressIndicator = MatterProgressIndicator
