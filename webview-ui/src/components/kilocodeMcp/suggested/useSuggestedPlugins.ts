import { useQuery } from "@tanstack/react-query"
import axios from "axios"
import { MarketplaceItem } from "@roo-code/types"
import { SuggestedPlugin, transformToMarketplaceItem } from "./types"
import { useExtensionState } from "@/context/ExtensionStateContext"

const SUGGESTED_PLUGINS_URL = "https://api.matterai.so/axoncode/plugins"

interface SuggestedPluginsResponse {
	success: boolean
	data: SuggestedPlugin[]
}

async function fetchSuggestedPlugins(token?: string): Promise<MarketplaceItem[]> {
	try {
		const headers: Record<string, string> = {}
		if (token) {
			headers["Authorization"] = `Bearer ${token}`
		}
		const response = await axios.get<SuggestedPluginsResponse>(SUGGESTED_PLUGINS_URL, { headers })
		const plugins = response.data?.data || []
		// Transform API response to MarketplaceItem format
		return plugins.map(transformToMarketplaceItem)
	} catch (error) {
		console.error("Error fetching suggested plugins:", error)
		return []
	}
}

export const useSuggestedPlugins = () => {
	const { apiConfiguration } = useExtensionState()
	const token = apiConfiguration?.kilocodeToken

	return useQuery<MarketplaceItem[]>({
		queryKey: ["suggested-plugins", token],
		queryFn: () => fetchSuggestedPlugins(token),
		staleTime: 5 * 60 * 1000, // 5 minutes
		refetchOnWindowFocus: false,
	})
}
