import { Task } from "../task/Task"

const SIZE_LIMIT_AS_CONTEXT_WINDOW_FRACTION = 0.8

async function allowVeryLargeReads(task: Task) {
	return (await task.providerRef.deref()?.getState())?.allowVeryLargeReads ?? false
}

async function getTokenEstimate(task: Task, outputText: string) {
	return await task.api.countTokens([{ type: "text", text: outputText }])
}

function getTokenLimit(task: Task) {
	return SIZE_LIMIT_AS_CONTEXT_WINDOW_FRACTION * task.api.getModel().info.contextWindow
}

export async function summarizeSuccessfulMcpOutputWhenTooLong(task: Task, outputText: string) {
	if (await allowVeryLargeReads(task)) {
		return outputText
	}
	const tokenLimit = getTokenLimit(task)
	const tokenEstimate = await getTokenEstimate(task, outputText)
	if (tokenEstimate < tokenLimit) {
		return outputText
	}
	return (
		`The MCP tool executed successfully, but the output is unavailable, ` +
		`because it is too long (${tokenEstimate} estimated tokens, limit is ${tokenLimit} tokens). ` +
		`If you need the output, find an alternative way to get it in manageable chunks.`
	)
}

export async function blockFileReadWhenTooLarge(task: Task, relPath: string, content: string) {
	if (await allowVeryLargeReads(task)) {
		return undefined
	}
	const tokenLimit = getTokenLimit(task)
	const tokenEstimate = await getTokenEstimate(task, content)
	if (tokenEstimate < tokenLimit) {
		return undefined
	}
	const errorMsg =
		`File content exceeds token limit (${tokenEstimate} estimated tokens, limit is ${tokenLimit} tokens).` +
		` Please use offset and limit to read smaller sections.`
	return {
		status: "blocked" as const,
		error: errorMsg,
		xmlContent: `--- ${relPath} ---\n[error] ${errorMsg}`,
	}
}

type FileEntry = {
	path?: string
	offset?: number
	limit?: number
}

export function parseNativeFiles(
	nativeFiles: { file_path?: string; path?: string; offset?: number; limit?: number; line_ranges?: string[] }[],
) {
	const fileEntries = new Array<FileEntry>()
	for (const file of nativeFiles) {
		// Support both file_path (new) and path (legacy)
		const filePath = file.file_path || file.path
		if (!filePath) continue

		const fileEntry: FileEntry = {
			path: filePath,
			offset: file.offset ?? 1,
			limit: file.limit, // undefined means read complete file
		}

		// Legacy support: convert line_ranges to offset+limit if provided
		// Note: Only the first range is used since the new format only supports single offset+limit per file
		if (file.line_ranges && Array.isArray(file.line_ranges) && file.line_ranges.length > 0) {
			const range = file.line_ranges[0]
			const match = String(range).match(/(\d+)-(\d+)/)
			if (match) {
				const [, start, end] = match.map(Number)
				if (!isNaN(start) && !isNaN(end)) {
					fileEntry.offset = start
					fileEntry.limit = end - start + 1
				}
			}
		}

		fileEntries.push(fileEntry)
	}
	return fileEntries
}

export function getNativeReadFileToolDescription(blockName: string, files: FileEntry[]) {
	const paths = files.map((file) => file.path)
	if (paths.length === 0) {
		return `[${blockName} with no valid paths]`
	} else if (paths.length === 1) {
		return `[${blockName} '${paths[0]}']`
	} else if (paths.length <= 3) {
		const pathList = paths.map((p) => `'${p}'`).join(", ")
		return `[${blockName} ${pathList}]`
	} else {
		return `[${blockName} ${paths.length} files]`
	}
}
