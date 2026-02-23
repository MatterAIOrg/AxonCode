import { X_KILOCODE_VERSION } from "../../shared/kilocode/headers"
import { Package } from "../../shared/package"
import { getAppUrl } from "@roo-code/types"

export const DEFAULT_HEADERS = {
	"HTTP-Referer": getAppUrl(),
	"X-Title": "Orbital",
	[X_KILOCODE_VERSION]: Package.version,
	"User-Agent": `Axon-Code/${Package.version}`,
}
