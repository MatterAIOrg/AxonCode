import React, { HTMLAttributes } from "react"
import { cn } from "@/lib/utils"

export const SettingsCard = ({ className, ...props }: HTMLAttributes<HTMLDivElement>) => (
	<div
		className={cn(
			"bg-vscode-editorWidget-background border border-vscode-widget-border rounded-lg overflow-hidden flex flex-col mb-6 bg-opacity-40",
			className,
		)}
		{...props}
	/>
)

type SettingsRowProps = Omit<HTMLAttributes<HTMLDivElement>, "title"> & {
	title: React.ReactNode
	description?: React.ReactNode
	children?: React.ReactNode
}

export const SettingsRow = ({ title, description, children, className, ...props }: SettingsRowProps) => (
	<div
		className={cn(
			"flex items-center justify-between py-3.5 px-4 border-b border-vscode-widget-border last:border-b-0 gap-4",
			className,
		)}
		{...props}>
		<div className="flex flex-col gap-1 min-w-0 flex-1">
			<span className="text-sm font-medium text-vscode-foreground">{title}</span>
			{description && (
				<span className="text-xs text-vscode-descriptionForeground leading-relaxed">{description}</span>
			)}
		</div>
		{children && <div className="flex shrink-0 items-center">{children}</div>}
	</div>
)

export const SettingsSwitch = ({ checked, onChange }: { checked: boolean; onChange: (checked: boolean) => void }) => (
	<button
		type="button"
		role="switch"
		aria-checked={checked}
		onClick={() => onChange(!checked)}
		className={cn(
			"relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-vscode-focusBorder focus-visible:ring-offset-2 focus-visible:ring-offset-vscode-editor-background",
			checked ? "bg-[#347d39]" : "bg-vscode-scrollbarSlider-background", // using a typical green for ON state
		)}>
		<span
			className={cn(
				"pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-lg ring-0 transition-transform",
				checked ? "translate-x-4" : "translate-x-0",
			)}
		/>
	</button>
)
