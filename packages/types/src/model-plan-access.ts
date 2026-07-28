const EXTENDED_CONTEXT_PLANS = new Set(["proplus", "ultra"])

const normalizePlan = (plan?: string): string => plan?.toLowerCase().replace(/[^a-z0-9]/g, "") ?? ""

export const canUse400kContext = (plan?: string): boolean => EXTENDED_CONTEXT_PLANS.has(normalizePlan(plan))

export const is400kAxonModel = (modelId: string): boolean =>
	(modelId.startsWith("axon-eido-3-code-") || modelId.startsWith("axon-lumos-4-code-")) && modelId.endsWith("-400k")

export const get200kAxonFallback = (modelId: string): string => modelId.replace(/-400k$/, "-200k")
