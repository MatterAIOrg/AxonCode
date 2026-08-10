const EXTENDED_CONTEXT_PLANS = new Set(["proplus", "ultra"])
const PRO_MODEL_PLANS = new Set(["pro", "proplus", "ultra"])

const normalizePlan = (plan?: string): string => plan?.toLowerCase().replace(/[^a-z0-9]/g, "") ?? ""

export const canUse400kContext = (plan?: string): boolean => EXTENDED_CONTEXT_PLANS.has(normalizePlan(plan))

export const canUseEido3Pro = (plan?: string): boolean => PRO_MODEL_PLANS.has(normalizePlan(plan))

export const is400kAxonModel = (modelId: string): boolean =>
	(modelId.startsWith("axon-auto-") ||
		modelId.startsWith("axon-eido-3-code-") ||
		modelId.startsWith("axon-eido-3-flash-") ||
		modelId.startsWith("axon-lumen-4-code-")) &&
	modelId.endsWith("-400k")

export const isEido3ProModel = (modelId: string): boolean => modelId.startsWith("axon-eido-3-code-pro-")

export const get200kAxonFallback = (modelId: string): string =>
	modelId === "axon-eido-3-flash-400k" ? "axon-eido-3-flash" : modelId.replace(/-400k$/, "-200k")

// Lumen models are only available on Pro Plus and Ultra plans
export const canUseLumenModels = canUse400kContext

export const isLumenAxonModel = (modelId: string): boolean => modelId.startsWith("axon-lumen-4-code-")

// Eido 3 Pro requires a Pro plan or higher; 400k context and Lumen models require Pro Plus or Ultra
export const isPlanRestrictedAxonModel = (modelId: string): boolean =>
	isEido3ProModel(modelId) || is400kAxonModel(modelId) || isLumenAxonModel(modelId)

// Checks whether the current plan can access a given Axon model
export const canAccessAxonModel = (modelId: string, plan?: string): boolean => {
	if (isLumenAxonModel(modelId) || is400kAxonModel(modelId)) return canUse400kContext(plan)
	if (isEido3ProModel(modelId)) return canUseEido3Pro(plan)
	return true
}

// Returns the closest accessible fallback for a plan-restricted model
export const getAxonPlanFallback = (modelId: string, plan?: string): string => {
	if (isLumenAxonModel(modelId)) return canUseEido3Pro(plan) ? "axon-eido-3-code-pro-200k" : "axon-auto-200k"
	if (isEido3ProModel(modelId)) {
		if (is400kAxonModel(modelId) && canUseEido3Pro(plan)) return get200kAxonFallback(modelId)
		return "axon-auto-200k"
	}
	return get200kAxonFallback(modelId)
}
