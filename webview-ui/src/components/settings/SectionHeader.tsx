import { HTMLAttributes } from "react"

import { cn } from "@/lib/utils"

type SectionHeaderProps = HTMLAttributes<HTMLDivElement> & {
	children: React.ReactNode
	description?: string
}

export const SectionHeader = ({ description, children, className, ...props }: SectionHeaderProps) => {
	if (!description) {
		return null
	}
	return (
		<div className={cn("mb-0", className)} {...props}>
			<p className="text-vscode-descriptionForeground text-sm m-0">{description}</p>
		</div>
	)
}
