import React, { useState, useRef, useLayoutEffect, memo } from "react"
import { useWindowSize } from "react-use"
import { vscode } from "@src/utils/vscode"

export interface ImageAttachment {
	dataUrl: string
	name: string
}

interface ThumbnailsProps {
	images: string[] | ImageAttachment[]
	style?: React.CSSProperties
	setImages?: React.Dispatch<React.SetStateAction<string[]>> | React.Dispatch<React.SetStateAction<ImageAttachment[]>>
	onHeightChange?: (height: number) => void
	// When true, render only the chips (no wrapper) so they can live inside a
	// shared flex container alongside document attachment chips. kilocode_change
	inline?: boolean
}

// Helper to truncate filename to max 10 chars
const truncateFilename = (name: string, maxLength: number = 10): string => {
	if (name.length <= maxLength) return name
	const lastDotIndex = name.lastIndexOf(".")
	if (lastDotIndex <= 0) {
		return name.slice(0, Math.max(0, maxLength - 3)) + "..."
	}
	const extension = name.slice(lastDotIndex)
	const baseName = name.slice(0, lastDotIndex)
	const truncatedBase = baseName.slice(0, Math.max(0, maxLength - extension.length - 3)) + "..."
	return truncatedBase + extension
}

// Helper to convert legacy string[] or ImageAttachment[] to ImageAttachment[]
export const normalizeImages = (images: string[] | ImageAttachment[] | undefined): ImageAttachment[] => {
	if (!images) return []
	return images.map((img, index) => {
		if (typeof img === "string") {
			return { dataUrl: img, name: `image_${index + 1}` }
		}
		return img
	})
}

const Thumbnails = ({ images, style, setImages, onHeightChange, inline = false }: ThumbnailsProps) => {
	const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)
	const containerRef = useRef<HTMLDivElement>(null)
	const { width } = useWindowSize()

	const normalizedImages = normalizeImages(images)

	useLayoutEffect(() => {
		if (containerRef.current) {
			let height = containerRef.current.clientHeight
			// some browsers return 0 for clientHeight
			if (!height) {
				height = containerRef.current.getBoundingClientRect().height
			}
			onHeightChange?.(height)
		}
		setHoveredIndex(null)
	}, [images, width, onHeightChange])

	const handleDelete = (index: number) => {
		if (!setImages) return
		// @ts-expect-error - TypeScript struggles with the union type
		setImages((prevImages: string[] | ImageAttachment[]) => prevImages.filter((_, i) => i !== index))
	}

	const isDeletable = setImages !== undefined

	const handleImageClick = (image: ImageAttachment) => {
		vscode.postMessage({ type: "openImage", text: image.dataUrl })
	}

	const chips = normalizedImages.map((image, index) => (
		<div
			key={index}
			style={{ position: "relative" }}
			onMouseEnter={() => setHoveredIndex(index)}
			onMouseLeave={() => setHoveredIndex(null)}>
			{/* Pill container */}
			<div
				style={{
					display: "flex",
					alignItems: "center",
					backgroundColor: "var(--vscode-badge-background)",
					borderRadius: 16,
					padding: "2px 10px 2px 2px",
					gap: 6,
					cursor: "pointer",
					transition: "background-color 0.15s",
				}}
				onClick={() => handleImageClick(image)}
				onMouseEnter={(e) => {
					e.currentTarget.style.backgroundColor = "var(--vscode-list-hoverBackground)"
				}}
				onMouseLeave={(e) => {
					e.currentTarget.style.backgroundColor = "var(--vscode-badge-background)"
				}}>
				{/* Circular image */}
				<img
					src={image.dataUrl}
					alt={`Thumbnail ${index + 1}`}
					style={{
						width: 24,
						height: 24,
						objectFit: "cover",
						borderRadius: "50%",
						flexShrink: 0,
					}}
				/>
				{/* Filename */}
				<span
					style={{
						fontSize: 11,
						color: "var(--vscode-badge-foreground)",
						whiteSpace: "nowrap",
						overflow: "hidden",
						textOverflow: "ellipsis",
						maxWidth: 100,
						fontFamily: "var(--vscode-font-family)",
					}}>
					{truncateFilename(image.name)}
				</span>
			</div>
			{/* Delete button */}
			{isDeletable && hoveredIndex === index && (
				<div
					onClick={(e) => {
						e.stopPropagation()
						handleDelete(index)
					}}
					style={{
						position: "absolute",
						top: -5,
						right: -5,
						width: 18,
						height: 18,
						borderRadius: "50%",
						backgroundColor: "var(--vscode-badge-background)",
						display: "flex",
						justifyContent: "center",
						alignItems: "center",
						cursor: "pointer",
						zIndex: 10,
					}}>
					<span
						className="codicon codicon-close"
						style={{
							color: "var(--vscode-foreground)",
							fontSize: 12,
							fontWeight: "bold",
						}}></span>
				</div>
			)}
		</div>
	))

	// kilocode_change: when inline, render chips without a wrapper so they flow
	// inside a shared flex container alongside document attachment chips.
	if (inline) {
		return <>{chips}</>
	}

	return (
		<div
			ref={containerRef}
			className="thumbnails-container"
			style={{
				display: "flex",
				flexWrap: "wrap",
				gap: 8,
				rowGap: 6,
				...style,
			}}>
			{chips}
		</div>
	)
}

export default memo(Thumbnails)
