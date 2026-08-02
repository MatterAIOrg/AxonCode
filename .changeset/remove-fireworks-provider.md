---
"kilo-code": minor
---

Remove the Fireworks AI provider

- Removed the `FireworksHandler` from `src/api/providers`, the `fireworks` entry from the third-party model fetcher, the `fireworks` provider schema (`fireworksSchema`, `fireworksModels`, `fireworksDefaultModelId`) from `@roo-code/types`, and the `Fireworks` settings UI component.
- Removed Fireworks from `MODELS_BY_PROVIDER`, `modelIdKeysByProvider`, `PROVIDER_CONFIGS`, `thirdPartyProviderRequiresApiKey`, `ProfileValidator`, `taskMetadata`, `webviewMessageHandler`, `ClineProvider`, `Task`, `useProviderModels`, `useSelectedModel`, and the `OpenAI` provider's Fireworks detection branch in `src/api/providers/openai.ts`.
- Removed the Fireworks section from the `ThirdPartyProviders` settings panel and the Fireworks `HardcodedModelRecord` for `fireworks:accounts/fireworks/routers/kimi-k2p5-turbo`.
- Removed Fireworks entries from the CLI: `cli/src/constants/providers/{settings,models,validation,labels}.ts`, `cli/src/types/messages.ts`, `cli/src/config/schema.json`, `cli/docs/PROVIDER_CONFIGURATION.md`, and `cli/src/constants/providers/__tests__/models.test.ts`.
- Removed the Fireworks provider docs page and sidebar entry from `apps/kilocode-docs`.
- Removed `fireworksApiKey` and `getFireworksApiKey` i18n strings from all 22 webview locales (ar, ca, cs, de, en, es, fr, hi, id, it, ja, ko, nl, pl, pt-BR, ru, th, tr, uk, vi, zh-CN, zh-TW).
- Removed the unused `fireworks-ic.png` icon.
