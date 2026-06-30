---
"kilo-code": minor
---

Sync the `.orb/` convention and `/init` + `/link` commands with the OrbCode CLI

- **`.orb/` is the shared, repo-level agent folder.** `AGENTS.md` is now loaded from `.orb/` (alongside the project root and legacy `.orbital/`), so the IDE extension and the OrbCode CLI read the same project memory. Machine/settings locations are unchanged.
- **`/init` reworked for cold-start.** It now writes a concise `.orb/AGENTS.md` covering project structure, architecture, business-logic mapping, and code patterns/conventions instead of the previous `.roo/rules-*` layout.
- **New `/link` command.** Link other repos on your machine by entering a folder path (absolute, `~/path`, or relative to the project). Links persist in the shared `.orb/links.json` and are injected into the agent's environment details — including each linked repo's `AGENTS.md`, pulled in ahead of time — so a change here is checked for impact on, or propagated to, the linked repos.
