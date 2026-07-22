import axios from "axios"
import * as vscode from "vscode"

import { Package } from "../../shared/package"

const OPEN_VSX_HOST = "open-vsx.org"
export const PENDING_ORBITAL_UPDATE_KEY = "orbital.pendingExtensionUpdate"

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

interface PendingOrbitalUpdate {
	targetVersion: string
	recoveryReloadAttempted: boolean
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

function normalizeVersion(version: string): string {
	return version.startsWith("v") ? version.slice(1) : version
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

export async function installOrbitalExtensionUpdate(
	context: vscode.ExtensionContext,
	targetVersion: string,
): Promise<void> {
	if (!isOrbitalIde()) {
		throw new Error("Extension updates are only supported in Orbital")
	}
	if (!parseVersion(targetVersion)) {
		throw new Error(`Invalid Orbital extension version: ${targetVersion}`)
	}

	const extensionId = `${Package.publisher}.${Package.name}`
	const normalizedTargetVersion = normalizeVersion(targetVersion)
	await context.globalState.update(PENDING_ORBITAL_UPDATE_KEY, {
		targetVersion: normalizedTargetVersion,
		recoveryReloadAttempted: false,
	} satisfies PendingOrbitalUpdate)

	try {
		// Pin the version discovered through Open VSX. An unversioned install can
		// resolve against stale gallery metadata and report success without
		// installing the release shown in the banner.
		await vscode.commands.executeCommand(
			"workbench.extensions.installExtension",
			`${extensionId}@${normalizedTargetVersion}`,
		)
	} catch (error) {
		await context.globalState.update(PENDING_ORBITAL_UPDATE_KEY, undefined)
		throw error
	}
}

/**
 * Completes a self-update when installing this extension interrupted the
 * original install-and-reload continuation. Returns true when activation
 * should stop because a recovery reload was requested.
 */
export async function recoverPendingOrbitalExtensionUpdate(context: vscode.ExtensionContext): Promise<boolean> {
	const pending = context.globalState.get<PendingOrbitalUpdate>(PENDING_ORBITAL_UPDATE_KEY)
	if (!pending || !isOrbitalIde()) {
		return false
	}

	if (!isNewerVersion(pending.targetVersion, Package.version)) {
		await context.globalState.update(PENDING_ORBITAL_UPDATE_KEY, undefined)
		return false
	}

	if (pending.recoveryReloadAttempted) {
		// Never enter a reload loop if the target could not be activated.
		await context.globalState.update(PENDING_ORBITAL_UPDATE_KEY, undefined)
		return false
	}

	await context.globalState.update(PENDING_ORBITAL_UPDATE_KEY, {
		...pending,
		recoveryReloadAttempted: true,
	} satisfies PendingOrbitalUpdate)
	try {
		await vscode.commands.executeCommand("workbench.action.reloadWindow")
		return true
	} catch {
		// Keep normal activation usable if the host refuses the recovery reload.
		await context.globalState.update(PENDING_ORBITAL_UPDATE_KEY, undefined)
		return false
	}
}
