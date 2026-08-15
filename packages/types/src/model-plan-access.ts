const EXTENDED_CONTEXT_PLANS = new Set(["proplus", "ultra"])
const PRO_MODEL_PLANS = new Set(["pro", "proplus", "ultra"])

const normalizePlan = (plan?: string): string => plan?.toLowerCase().replace(/[^a-z0-9]/g, "") ?? ""

export const canUse400kContext = (plan?: string): boolean => EXTENDED_CONTEXT_PLANS.has(normalizePlan(plan))

export const canUsePaidPlan = (plan?: string): boolean => PRO_MODEL_PLANS.has(normalizePlan(plan))

export const canUseEido3Pro = canUsePaidPlan

export const is400kAxonModel = (modelId: string): boolean =>
	(modelId.startsWith("axon-auto-") ||
		modelId.startsWith("axon-eido-3-code-pro-") ||
		modelId.startsWith("axon-eido-3-flash-") ||
		modelId.startsWith("axon-eido-3.2-") ||
		modelId.startsWith("axon-lumen-4-code-")) &&
	modelId.endsWith("-400k")

export const isEido3ProModel = (modelId: string): boolean =>
	modelId.startsWith("axon-eido-3-code-pro-") || modelId.startsWith("axon-eido-3.2-code-pro-")

export const isEido32Model = (modelId: string): boolean =>
	modelId.startsWith("axon-eido-3.2-") && !modelId.includes("flash") && !modelId.includes("code-pro")

export const isPaidPlanAxonModel = (modelId: string): boolean => isEido3ProModel(modelId) || isEido32Model(modelId)

export const get232kAxonFallback = (modelId: string): string => {
	if (modelId === "axon-eido-3-flash-400k") return "axon-eido-3-flash"
	if (modelId === "axon-eido-3.2-flash-400k") return "axon-eido-3.2-flash"
	return modelId.replace(/-400k$/, "-232k")
}

export const get400kAxonVariant = (modelId: string): string => {
	if (modelId.endsWith("-400k")) return modelId
	if (modelId === "axon-eido-3-flash") return "axon-eido-3-flash-400k"
	if (modelId === "axon-eido-3.2-flash") return "axon-eido-3.2-flash-400k"
	if (modelId.endsWith("-232k")) return modelId.replace(/-232k$/, "-400k")
	return `${modelId}-400k`
}

// Lumen models are only available on Pro Plus and Ultra plans
export const canUseLumenModels = canUse400kContext

export const isLumenAxonModel = (modelId: string): boolean => modelId.startsWith("axon-lumen-4-code-")

// Paid models (Eido Pro, Eido 3.2) require a Pro plan or higher; 400k context and Lumen models require Pro Plus or Ultra
export const isPlanRestrictedAxonModel = (modelId: string): boolean =>
	isPaidPlanAxonModel(modelId) || is400kAxonModel(modelId) || isLumenAxonModel(modelId)

// Checks whether the current plan can access a given Axon model
export const canAccessAxonModel = (modelId: string, plan?: string): boolean => {
	if (isLumenAxonModel(modelId) || is400kAxonModel(modelId)) return canUse400kContext(plan)
	if (isPaidPlanAxonModel(modelId)) return canUsePaidPlan(plan)
	return true
}

// Returns the closest accessible fallback for a plan-restricted model
export const getAxonPlanFallback = (modelId: string, plan?: string): string => {
	if (isLumenAxonModel(modelId)) return canUsePaidPlan(plan) ? "axon-eido-3.2-code-pro-232k" : "axon-auto-232k"
	if (isPaidPlanAxonModel(modelId)) {
		if (is400kAxonModel(modelId) && canUsePaidPlan(plan)) return get232kAxonFallback(modelId)
		return "axon-auto-232k"
	}
	return get232kAxonFallback(modelId)
}
