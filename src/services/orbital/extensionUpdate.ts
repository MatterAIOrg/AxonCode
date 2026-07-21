import axios from "axios"
import * as vscode from "vscode"

import { Package } from "../../shared/package"

const OPEN_VSX_HOST = "open-vsx.org"

interface OpenVsxExtensionMetadata {
	namespace: string
	name: string
	version: string
}

export interface OrbitalExtensionUpdate {
	currentVersion: string
	latestVersion: string
}

interface ParsedVersion {
	major: number
	minor: number
	patch: number
	prerelease?: string
}

function parseVersion(version: string): ParsedVersion | undefined {
	const match = /^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/.exec(version)
	if (!match) {
		return undefined
	}

	return {
		major: Number(match[1]),
		minor: Number(match[2]),
		patch: Number(match[3]),
		prerelease: match[4],
	}
}

export function isNewerVersion(candidate: string, current: string): boolean {
	const candidateVersion = parseVersion(candidate)
	const currentVersion = parseVersion(current)
	if (!candidateVersion || !currentVersion) {
		return false
	}

	for (const key of ["major", "minor", "patch"] as const) {
		if (candidateVersion[key] !== currentVersion[key]) {
			return candidateVersion[key] > currentVersion[key]
		}
	}

	if (candidateVersion.prerelease === currentVersion.prerelease) {
		return false
	}
	if (!candidateVersion.prerelease) {
		return true
	}
	if (!currentVersion.prerelease) {
		return false
	}

	return candidateVersion.prerelease.localeCompare(currentVersion.prerelease, undefined, { numeric: true }) > 0
}

export function isOrbitalIde(): boolean {
	return vscode.env.appName.trim().toLowerCase() === "orbital" || vscode.env.uriScheme === "orbital"
}

export async function checkForOrbitalExtensionUpdate(): Promise<OrbitalExtensionUpdate | undefined> {
	if (!isOrbitalIde()) {
		return undefined
	}

	const namespace = Package.publisher.toLowerCase()
	const extensionName = Package.name.toLowerCase()
	const endpoint = `https://${OPEN_VSX_HOST}/api/${encodeURIComponent(namespace)}/${encodeURIComponent(extensionName)}/latest`
	const response = await axios.get<OpenVsxExtensionMetadata>(endpoint, { timeout: 15_000 })
	const metadata = response.data

	if (metadata.namespace.toLowerCase() !== namespace || metadata.name.toLowerCase() !== extensionName) {
		throw new Error("Open VSX returned metadata for a different extension")
	}
	if (!isNewerVersion(metadata.version, Package.version)) {
		return undefined
	}
	return {
		currentVersion: Package.version,
		latestVersion: metadata.version,
	}
}

export async function installOrbitalExtensionUpdate(): Promise<void> {
	if (!isOrbitalIde()) {
		throw new Error("Extension updates are only supported in Orbital")
	}

	const extensionId = `${Package.publisher}.${Package.name}`
	await vscode.commands.executeCommand("workbench.extensions.installExtension", extensionId)
}
