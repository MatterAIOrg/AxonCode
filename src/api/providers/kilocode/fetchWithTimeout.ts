import * as undici from "undici"

export const HeadersTimeoutError = undici.errors.HeadersTimeoutError

export function fetchWithTimeout(timeoutMs: number, headers?: Record<string, string>): typeof fetch {
	const agent = new undici.EnvHttpProxyAgent({
		headersTimeout: timeoutMs,
		bodyTimeout: timeoutMs,
		// kilocode_change: Happy Eyeballs (RFC 8305) — race IPv4/IPv6 on connect so
		// a broken address-family path falls back to the other family instead of
		// hanging. undici has no Happy Eyeballs by default, unlike curl.
		connect: { autoSelectFamily: true, autoSelectFamilyAttemptTimeout: 250 },
	})
	return (input, init) => {
		const requestInit: undici.RequestInit = {
			...(init as undici.RequestInit),
			dispatcher: agent,
		}

		if (headers) {
			requestInit.headers = {
				...(init?.headers || {}),
				...headers,
			}
		}

		return undici.fetch(input as undici.RequestInfo, requestInit) as unknown as Promise<Response>
	}
}
