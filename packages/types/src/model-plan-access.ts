const EXTENDED_CONTEXT_PLANS = new Set(["proplus", "ultra"])

const normalizePlan = (plan?: string): string => plan?.toLowerCase().replace(/[^a-z0-9]/g, "") ?? ""

export const canUse400kContext = (plan?: string): boolean => EXTENDED_CONTEXT_PLANS.has(normalizePlan(plan))

export const is400kAxonModel = (modelId: string): boolean =>
	(modelId.startsWith("axon-eido-3-code-") || modelId.startsWith("axon-lumen-4-code-")) && modelId.endsWith("-400k")

export const get200kAxonFallback = (modelId: string): string => modelId.replace(/-400k$/, "-200k")

// Lumen models are only available on Pro Plus and Ultra plans
export const canUseLumenModels = canUse400kContext

export const isLumenAxonModel = (modelId: string): boolean => modelId.startsWith("axon-lumen-4-code-")

export const isPlanRestrictedAxonModel = (modelId: string): boolean =>
	is400kAxonModel(modelId) || isLumenAxonModel(modelId)

export const getAxonPlanFallback = (modelId: string): string =>
	isLumenAxonModel(modelId) ? "axon-eido-3-code-pro-200k" : get200kAxonFallback(modelId)
