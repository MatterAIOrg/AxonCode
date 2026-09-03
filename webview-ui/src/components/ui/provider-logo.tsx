import { cn } from "@src/lib/utils"

/**
 * Provider logo rendered on a white circular background. Catalog icons are
 * transparent SVGs (some monochrome), so they need the white backing to stay
 * visible on dark VS Code themes.
 */
export const ProviderLogo = ({ src, className }: { src?: string | null; className?: string }) => {
	if (!src) {
		return null
	}

	return (
		<span className={cn("flex shrink-0 items-center justify-center rounded-full bg-white", className)}>
			<img src={src} alt="" className="size-[75%] object-contain" loading="lazy" />
		</span>
	)
}
