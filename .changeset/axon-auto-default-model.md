---
"kilo-code": minor
---

Make Axon Auto the default model

- Changed `openRouterDefaultModelId` in `@roo-code/types` from `axon-eido-3-code-mini-200k` to `axon-auto-200k`, so the Orbital/KiloCode provider defaults to the Axon Auto model.
- Updated the `openRouterDefaultModelInfo` fallback description to describe Axon Auto (dynamic Flash/Mini/Pro selection).
- Updated `getAxonPlanFallback` in `model-plan-access` to fall back to `axon-auto-200k` instead of `axon-eido-3-code-mini-200k` for plan-restricted users.
- Added the `axon-eido-3-flash-400k` model variant to the KiloCode model catalog (extension and webview), gated behind the same Pro Plus/Ultra 400k plan check as the other 400k variants; `is400kAxonModel` now recognizes `axon-eido-3-flash-*` ids and the 200k fallback maps it to `axon-eido-3-flash`.
