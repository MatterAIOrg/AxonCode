// kilocode_change - new file
// npx vitest run src/api/providers/__tests__/inferenceFailover.spec.ts

vitest.mock("vscode", () => ({
	env: { appName: "Visual Studio Code" },
	version: "1.100.0",
}))

const { fetchMock } = vitest.hoisted(() => ({ fetchMock: vitest.fn() }))

// happyEyeballsFetch delegates to undici.fetch, so mocking undici lets us drive
// the circuit breaker (success vs connection failure) and inspect the host.
vitest.mock("undici", () => ({
	Agent: class {},
	fetch: fetchMock,
}))

vitest.mock("openai")
vitest.mock("../fetchers/modelCache", () => ({ getModels: vitest.fn() }))
vitest.mock("../fetchers/modelEndpointCache", () => ({ getModelEndpoints: vitest.fn() }))

import { inferenceFailoverFetch, __setInferenceCircuitBreaker } from "../openrouter"

const API2 = "https://api2.matterai.so/v1/web/chat/completions"
const API = "https://api.matterai.so/v1/web/chat/completions"

function makeResponse(status = 200): Response {
	return { status, ok: status >= 200 && status < 300 } as unknown as Response
}

function connectionFailure(): TypeError {
	// undici/Node fetch rejects with a TypeError for network-level errors.
	return new TypeError("fetch failed")
}

/** fetchMock that rejects for the api2 host and resolves for everything else. */
function rejectApi2ResolveApi() {
	fetchMock.mockImplementation((url: string) => {
		if (new URL(url).hostname === "api2.matterai.so") {
			return Promise.reject(connectionFailure())
		}
		return Promise.resolve(makeResponse())
	})
}

function lastCallUrl(): string {
	return String(fetchMock.mock.calls.at(-1)?.[0])
}

describe("inferenceFailoverFetch circuit breaker", () => {
	beforeEach(() => {
		fetchMock.mockReset()
		__setInferenceCircuitBreaker(false)
	})

	it("hits api2 when the breaker is closed and api2 is up", async () => {
		fetchMock.mockResolvedValue(makeResponse())
		const res = await inferenceFailoverFetch(API2, {})
		expect(lastCallUrl()).toBe(API2)
		expect((res as any).status).toBe(200)
	})

	it("fails over to api on a connection failure and trips the breaker", async () => {
		rejectApi2ResolveApi()
		const res = await inferenceFailoverFetch(API2, {})
		// first attempt hits api2 (rejected), then fails over to api
		expect(fetchMock.mock.calls[0][0]).toBe(API2)
		expect(lastCallUrl()).toBe(API)
		expect((res as any).status).toBe(200)

		// breaker now open → next call skips api2 and goes straight to api
		fetchMock.mockClear()
		fetchMock.mockResolvedValue(makeResponse())
		await inferenceFailoverFetch(API2, {})
		expect(lastCallUrl()).toBe(API)
	})

	it("skips api2 and goes straight to api while the breaker is in cooldown", async () => {
		__setInferenceCircuitBreaker(true, Date.now())
		fetchMock.mockResolvedValue(makeResponse())
		await inferenceFailoverFetch(API2, {})
		expect(lastCallUrl()).toBe(API)
		expect(fetchMock).toHaveBeenCalledTimes(1)
	})

	it("closes the breaker after a successful half-open probe", async () => {
		// opened 6 minutes ago → cooldown (5m) elapsed → half-open probe of api2
		__setInferenceCircuitBreaker(true, Date.now() - 6 * 60 * 1000)
		fetchMock.mockResolvedValue(makeResponse())
		await inferenceFailoverFetch(API2, {})
		expect(lastCallUrl()).toBe(API2)

		// breaker closed → next call goes back to api2
		fetchMock.mockClear()
		fetchMock.mockResolvedValue(makeResponse())
		await inferenceFailoverFetch(API2, {})
		expect(lastCallUrl()).toBe(API2)
	})

	it("reopens the breaker when a half-open probe fails", async () => {
		__setInferenceCircuitBreaker(true, Date.now() - 6 * 60 * 1000)
		rejectApi2ResolveApi()
		const res = await inferenceFailoverFetch(API2, {})
		expect(fetchMock.mock.calls[0][0]).toBe(API2)
		expect(lastCallUrl()).toBe(API)
		expect((res as any).status).toBe(200)

		// breaker reopened → next call within cooldown goes to api
		fetchMock.mockClear()
		fetchMock.mockResolvedValue(makeResponse())
		await inferenceFailoverFetch(API2, {})
		expect(lastCallUrl()).toBe(API)
	})

	it("does not trip on an HTTP error response from a live server", async () => {
		fetchMock.mockResolvedValue(makeResponse(500))
		const res = await inferenceFailoverFetch(API2, {})
		expect(lastCallUrl()).toBe(API2)
		expect((res as any).status).toBe(500)
		expect(fetchMock).toHaveBeenCalledTimes(1)

		// breaker still closed → next call still goes to api2
		fetchMock.mockClear()
		fetchMock.mockResolvedValue(makeResponse())
		await inferenceFailoverFetch(API2, {})
		expect(lastCallUrl()).toBe(API2)
	})

	it("leaves a non-primary host untouched", async () => {
		fetchMock.mockResolvedValue(makeResponse())
		const custom = "https://openrouter.ai/api/v1/chat/completions"
		await inferenceFailoverFetch(custom, {})
		expect(lastCallUrl()).toBe(custom)
	})

	it("does not fail over when the fallback host itself fails", async () => {
		// targeting api directly → a connection failure must rethrow, not loop
		fetchMock.mockRejectedValue(connectionFailure())
		await expect(inferenceFailoverFetch(API, {})).rejects.toThrow("fetch failed")
		expect(fetchMock).toHaveBeenCalledTimes(1)
		expect(lastCallUrl()).toBe(API)
	})
})
