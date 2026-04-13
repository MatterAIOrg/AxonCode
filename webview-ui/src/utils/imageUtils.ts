import { ImageAttachment } from "@src/components/common/Thumbnails"

/**
 * Utility function to append new images to existing images array
 * while respecting the maximum image limit
 *
 * @param currentImages - The current array of images
 * @param newImages - The new images to append
 * @param maxImages - The maximum number of images allowed
 * @returns The updated images array
 */
export function appendImages(
	currentImages: ImageAttachment[],
	newImages: ImageAttachment[] | undefined,
	maxImages: number,
): ImageAttachment[] {
	const imagesToAdd = newImages ?? []
	if (imagesToAdd.length === 0) {
		return currentImages
	}

	return [...currentImages, ...imagesToAdd].slice(0, maxImages)
}

/**
 * Convert legacy string[] or ImageAttachment[] to ImageAttachment[]
 */
export function normalizeImages(images: string[] | ImageAttachment[] | undefined): ImageAttachment[] {
	if (!images) return []
	return images.map((img, index) => {
		if (typeof img === "string") {
			return { dataUrl: img, name: `image_${index + 1}` }
		}
		return img
	})
}
