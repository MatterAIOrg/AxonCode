import { myersDiff } from "../../services/continuedev/core/diff/myers"

export function computeDifferenceLineNumbers(originalContent: string, newContent: string): number[] {
	const lines: number[] = []
	const maximumLine = Math.max(0, newContent.split("\n").length - 1)
	let newLine = 0
	let changeStart: number | undefined

	const finishChange = () => {
		if (changeStart === undefined) {
			return
		}

		lines.push(Math.min(changeStart, maximumLine))
		changeStart = undefined
	}

	for (const diffLine of myersDiff(originalContent, newContent)) {
		if (diffLine.type === "same") {
			finishChange()
			newLine++
			continue
		}

		changeStart ??= newLine
		if (diffLine.type === "new") {
			newLine++
		}
	}

	finishChange()
	return lines
}

export function findAdjacentChangeLine(
	lines: readonly number[],
	currentLine: number,
	direction: 1 | -1,
): number | undefined {
	if (lines.length === 0) {
		return undefined
	}

	if (direction === 1) {
		return lines.find((line) => line > currentLine) ?? lines[0]
	}

	return [...lines].reverse().find((line) => line < currentLine) ?? lines[lines.length - 1]
}
