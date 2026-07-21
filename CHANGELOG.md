# Changelog

## [v6.6.0] - 2026-07-21

### Added

- **Axon Eido 3 context-window variants.** `axon-eido-3-code-pro` and `axon-eido-3-code-mini` are now exposed as separate 200K and 400K context options (`-200k` / `-400k` suffixes). Both variants share the same upstream model; the extension resolves the selected variant to its API model ID via `getKilocodeApiModelId`. The default model is now `axon-eido-3-code-mini-200k`.
- **400K context gated to Pro Plus and Ultra.** The 400K variants are only available on Pro Plus and Ultra plans. The model selector disables them with an upgrade tooltip for lower tiers, the KiloCode settings panel filters them out and auto-falls back to the matching 200K variant, and the CLI `/model` command rejects selection with a clear error message.
- **`SelectDropdown` group headings.** New `DropdownOptionType.GROUP` renders non-selectable section headings (e.g. "Context: 200k") inside the dropdown, with automatic hiding when the group has no visible items.
- **`SelectDropdown` custom value rendering.** New `renderValue` prop lets callers customize how the selected option is displayed in the trigger (used by the model selector to dim the context qualifier).
- **Sticky search bar in `SelectDropdown`.** The search input stays pinned at the top of the dropdown while options scroll.
- **New icons in `utils/customIcons.tsx`.** `BulbIcon`, `PlusIcon`, and `ArrowUp02Icon` added to support the refreshed model selector and chat composer.

### Changed

- **Model selector refresh.** Axon models are now grouped by context window with a `BulbIcon` indicator, the selected option is highlighted, and the trigger uses a compact rounded style matching the command-approval selector. Tooltips fall back to the model's description when no curated tooltip is defined.
- **Chat composer refresh.** The attachment button moved to the left of the model selector with a `PlusIcon`, the send button uses an `ArrowUp02Icon`, and the textarea padding was unified across edit and compose modes.
- **Follow-up question card.** Restyled with a rounded-xl border, subtle shadow, and improved typography (15px / leading-6). The suggestion list now uses bordered cards with a focusable copy-to-input button.
- **Shared chat horizontal padding.** New `CHAT_CONTENT_HORIZONTAL_PADDING` constant (`px-3.5`) in `webview-ui/src/components/chat/chatLayout.ts` is used by `ChatRow`, `ChatTextArea`, `ChatView`, `ExplorationGroupRow`, `BrowserSessionRow`, `QueuedMessages`, and the sticky user message so the chat column stays aligned.
- **Markdown list spacing.** `MarkdownBlock` list/ordered/unordered line-height bumped from `1.35em` to `1.7em` for better readability.
- **Task header title opacity.** `KiloTaskHeader` task title opacity raised from 70% to 100%.
- **Logout copy.** Logout notification changed from "Logged out from Roo Code Cloud" to "Logged Out from Orbital".

### Fixed

- **`WebAuthService.logout` state transition.** Logout now explicitly calls `transitionToLoggedOut()` after clearing persisted credentials, so the in-memory state, session token, and user info are cleared even when `SecretStorage.onDidChange` does not fire. The auth-state-changed event is emitted with the previous state.

---

## [v6.4.9] - 2026-07-21

### Fixed

- **Accept-all edit telemetry.** Accepting all pending edits from the IDE review bar now reports accepted line counts to the task metadata endpoint, matching the chat and per-edit accept actions.
- **Review-bar change navigation.** The up and down buttons now move between individual edit locations in the active file, while the left and right buttons continue to navigate between edited files.

### Added

- **`/create-skill` built-in command.** Users can describe a repository-specific workflow in plain language and have Orbital create or update a reusable skill under `.orb/skills/<skill-name>/`, including any supporting scripts, references, or assets within that skill directory.

---

## [v6.4.7] - 2026-06-30

### Added

- **Official plugins marketplace.** The former Skills Marketplace now installs each `claude-plugins-official` entry as a complete bundle under `.orb/plugins/<plugin>/`. Installed plugin skills and slash commands use `plugin:capability` names, bundled MCP servers are registered with namespaced IDs, and the UI reports the bundle inventory after installation.
- **Shared `.orb/` convention with OrbCode CLI.** `AGENTS.md` is now loaded from the repo-level `.orb/` directory (alongside the project root and legacy `.orbital/`), so the Orbital IDE extension and the OrbCode CLI read the same project memory. Machine and settings locations are unchanged.
- **Linked-repositories service.** A new `src/services/links` module is the single source of truth for the linked-repo feature, sharing `.orb/links.json` and the produced environment context between the IDE extension and the CLI.
- **`/link` built-in command.** A new slash command for managing Linked Repositories: reads the current list, drives add/remove via `ask_followup_question`, and writes `.orb/links.json` with verbatim user input. Resolution and validation of the folder path happens at read time so links written by either tool stay portable.

### Changed

- **`/init` reworked for cold-start.** Replaces the verbose `.roo/rules-*` per-mode layout with a single, concise `.orb/AGENTS.md` (project structure, architecture, business-logic mapping, code patterns/conventions) capped at ~150 lines so it stays cheap to include in every future prompt. Existing AI assistant rules (CLAUDE.md, Cursor, Copilot) are still folded in. Refines an existing `AGENTS.md` rather than overwriting it.
- **Built-in commands spec.** The expected command list is now `commit`, `migrate`, `init`, `link`; `init` is asserted to target `.orb/AGENTS.md` with the new concise structure, and `link` is asserted to manage `.orb/links.json` via `ask_followup_question`.

---

## [v6.4.6] - 2026-06-25

### Added

- **Tiered usage support in `OutOfCreditsBanner`.** New `selectResetIso()` helper picks the correct reset time: when a tier is exhausted it surfaces the latest reset among exhausted windows; otherwise it falls back to the soonest upcoming reset, then to the legacy `creditsResetDate`. Banner label shortened from "Pro models limits reset at" to "Limits reset at".
- **OrbCode CLI marketing card.** A third rotating marketing card in the welcome view pointing users at the CLI, joining the existing two on the 10-second rotation (`(prev + 1) % 3`).
- **New custom icons in `utils/customIcons.tsx`.** `Folder01Icon`, `Folder02Icon`, `ArrowDown01Icon`, `AddCircleHalfDotIcon` and others added to support the refreshed MCP and history views.

### Changed

- **Axon Code → Orbital rebrand in copy.** `troubleMessage` string in `chat.json` and the consecutive-mistake-limit description in `settings.json` now read "Orbital" where they previously read "Axon Code".
- **Axon marketing copy.** Welcome-view subtitle changed from "Frontier LLMs, fraction of the cost. Save 70% inference cost." to "Cut agent inference costs by 60% using Frontier Axon models".
- **History UI refresh (`TaskItem`).** Visual and layout rework of the history list (90 insertions / 52 deletions).
- **MCP UI refresh (`McpView`).** Major rework of the MCP view with a new icon set and updated i18n strings (283 insertions / 228 deletions across `McpView.tsx`, `mcp.json`, and `customIcons.tsx`).
- **Login UI refresh (`KiloCodeAuth`, `ProfileView`, `WelcomeView`).** Consolidated the auth and welcome flows with refreshed i18n strings.
- **Chat agent UI refresh.** Visual updates to `ChatRow`, `ExplorationGroupRow`, and `ReasoningBlock` (63 insertions / 61 deletions).
- **Button UI refresh.** Updated button styles in `index.css` for consistency across surfaces (17 insertions / 5 deletions).

### Fixed

- **Stream idle timeout bumped to 180s.** `STREAM_IDLE_TIMEOUT_MS` raised from 60s to 180s to reduce false-positive timeouts during long-running streaming responses, especially with slower or more verbose model outputs.

---

## [v6.4.4] - 2026-06-23

### Added

- **Stream idle timeout**: 60s idle window on model stream consumption. If no chunk arrives within the window (network drop, socket close, server stall), a descriptive error is thrown so the catch block can persist the failure and surface a `streaming_failed` row to the UI
- **Stream disconnection UI surfacing**: New `streaming_failed` `ErrorRow` variant with a localized explanation of the likely cause for transport-level errors (ECONNRESET, socket hang up, fetch failed, ETIMEDOUT, ENOTFOUND, etc.), and a retry button matching the existing `Provider error:` behavior
- **`chat:apiRequest.streamDisconnected` i18n key**

### Fixed

- **Ripgrep binary resolution on modern VS Code / Orbital hosts**: `@vscode/ripgrep-universal` nests the binary in a per-platform subfolder (`bin/{os}-{arch}/rg`) that the previous lookup chain did not check, causing `getBinPath` to return undefined and file searches to silently fail. Adds the universal package to the lookup chain with both `node_modules` and `node_modules.asar.unpacked` paths
- **Unified message queue**: Replaced the local `manualMessageQueue` with the shared `messageQueueService` as the single source of truth. Queued messages now stay visible in the UI until they are actually dispatched; `isWaitingForAskResponse` is set before dequeue so a follow-up message resolves the ask rather than being re-routed into the queue

### Changed

- **About footer actions**: Export, import, and reset buttons now sit in a flex container with `gap-1.5` so the icon and label share a single evenly spaced row. Removed ad-hoc `pb-0.5` icon padding
- **Footer support copy**: Removed the dead Discord link; the message now ends at the Reddit mention

---

## [v6.2.3] - 2026-05-21

### Fixed

- **Chat title display**: Handle JSON-wrapped title strings from server, now supports plain string, JSON object, and stringified JSON responses, with normalized-title fallback at every consumer layer to clean already-persisted malformed titles

### Changed

- Updated matterai models, llm router spec tests, exploration group row, out of credits banner, pretty model name, and openrouter provider hooks

---

## [v6.2.0] - 2026-05-21

### Added

- **Tool call result pairing safety net**: New `backfillMissingToolResults` function in OpenAI format transform that backfills placeholder tool messages for unanswered parallel tool calls, preventing provider rejections when tool_call/tool_result pairs are mismatched
- **Tool call result pairing module**: Pure functions (`reconcileAssistantToolUses`, `toolUseIdsRequiringResults`, `allToolResultsCollected`) to keep assistant tool_calls and tool_results paired 1:1, with comprehensive unit test coverage
- **Task.ts reconciliation**: Gating API requests until every tool_call in the assistant message has its matching tool_result collected, preventing partial result sets from being sent to providers

### Changed

- **AssistantMessageParser performance**: Avoided O(n²) string slicing in the streaming hot loop by deferring content updates to end-of-chunk; added 20KB max extract length threshold for large accumulated arguments during streaming
- **presentAssistantMessage optimization**: Replaced deep clone with shallow copy for streaming content blocks to reduce overhead during large file streaming
- **FileWriteTool partial display**: Truncated large file content during streaming preview (5KB limit) to prevent IPC bottlenecks and UI freezing
- **Model list cleanup**: Removed deprecated `axon-code-2-pro` and `axon-code-2-pro-high` model entries from provider configurations

### Fixed

- ReasoningBlock arrow icon rotation styling
- OutOfCreditsBanner border-radius styling consistency

---

## [v6.0.0] - 2026-04-10

### Highlights

This major release introduces the **Agent Manager**, a powerful new feature for managing multiple AI agents across workspaces with a dedicated sidebar and file viewer panel.

### Added

#### Agent Manager

- **Agent Manager Sidebar**: New collapsible sidebar for managing multiple agent tasks across workspaces
    - Workspace-based task organization with expandable folders
    - Quick access to recent tasks with compact timestamps
    - "New Agent" button for starting fresh conversations
- **Agent File Viewer**: Resizable file viewer panel for reviewing diffs and file changes
    - Drag-to-resize functionality with min/max width constraints
    - Automatic viewport-aware sizing
    - Pull request-style diff view integration
- **Agent Toggle**: Toggle button to show/hide the agent manager sidebar with smooth animations

#### Exploration Groups

- **Elapsed Time Display**: Exploration groups now show elapsed time during and after exploration
    - Live timer updates during active exploration (e.g., "Exploring for 1m30s")
    - Summary with total time on completion (e.g., "Explored 5 files, 2 searches for 45s")
    - Auto-collapse when exploration completes

#### Model Selection

- **Axon Model Tooltips**: Hover tooltips in ModelSelector showing details for Axon models
- **Enhanced Model Provider Hook**: New `useOpenRouterModelProviders` hook for better model management

#### Image Handling

- **ImageAttachment Interface**: Refactored image handling to use a unified `ImageAttachment` interface
- **Improved Thumbnails**: Enhanced thumbnail component with better image preview support

#### UI Components

- **Custom Icons Utility**: New custom SVG icons including `Folder01Icon`, `Folder02Icon`, `ArrowDown01Icon`, `AddCircleHalfDotIcon`
- **Copy Button Update**: Updated copy icon styling

### Changed

- **Streamlined Chat UI**: Cleaner, more focused chat interface with improved visual hierarchy
- **Better Diff View**: Enhanced diff view for the edit tool with improved readability
- **Maximize States**: Fixed maximize state handling for better window management
- **ChatRow Component**: Enhanced with agent manager mode support and improved rendering
- **ChatTextArea**: Refined for better user interaction
- **ReasoningBlock**: Minor styling improvements

### Fixed

- Maximize state persistence issues
- Various UI inconsistencies across components

### Breaking Changes

- Minimum VS Code version requirement updated

---

## [v5.7.6] - 2026-04-05

### Added

- Native tool call helpers for kilocode provider
- Enhanced assistant message parsing with improved tool handling
- LSP tool integration for better code navigation
- File write tool with improved content handling
- Multi-file search replace strategy for complex edit operations
- New tool type definitions in packages/types
- Git branch display in bottom API config showing current repository branch
- GitBranchIcon custom SVG icon for branch visualization
- New message types for git branch request/response (fetchGitBranchRequest, gitBranchResponse)

### Changed

- **Major Tool Architecture Refactoring**: Consolidated multiple file editing tools into a unified, simplified tool system
    - Merged `edit_file`, `insert_content`, `search_and_replace`, `write_to_file`, `apply_diff` tools into streamlined `file_write` tool
    - Consolidated plan file tools (`list_plan_files`, `read_plan_file`, `plan_file_edit`) into core task management
    - Removed redundant native tool prompt definitions
    - Simplified `getAllowedJSONToolsForMode` with cleaner tool selection logic
- Refactored system prompts for better tool organization and maintainability
- Updated assistant message parsing with new `parseAssistantMessageV2` implementation
- Enhanced diff strategies with improved multi-search-replace functionality
- Updated task handling with improved checkpoint service integration
- Enhanced webview message handler for better task coordination
- Improved ChatRow, ChatView, and CommandExecution UI components
- Updated i18n translations for en locale
- Refactored BottomApiConfig component with improved layout and branch display
- Enhanced ProgressIndicator component styling
- Updated index.css with improved styling utilities

### Fixed

- Shadow checkpoint service stability improvements
- Assistant message presentation edge cases
- Browser action tool compatibility
- Webview message type definitions
- File write tool: proper workspace path detection for partial display during streaming
- File write tool: ensure tool result is always pushed on user rejection
- GitHubDiffView: dynamic margin calculation for proper diff alignment
- ToolUseBlock: improved component structure and styling
- Git utilities: properly distinguish between current branch and default branch
    - Added `currentBranch` field to `GitRepositoryInfo` interface
    - Fixed webviewMessageHandler to use `currentBranch` instead of `defaultBranch`
    - Updated tests to reflect the correct field name

### Removed

- Deprecated individual file editing tools (editFileTool, insertContentTool, searchAndReplaceTool, writeToFileTool, applyDiffTool, multiApplyDiffTool)
- Deprecated plan file tools (listPlanFilesTool, readPlanFileTool, planFileEditTool)
- Redundant tool prompt files (edit-file.ts, insert-content.ts, search-and-replace.ts, write-to-file.ts)
- Native tool prompt definitions (apply_diff.ts, edit_file.ts, insert_content.ts, list_plan_files.ts, plan_file_edit.ts, read_plan_file.ts, search_and_replace.ts, write_to_file.ts)
- Associated test files for removed tools
- FastApplyChatDisplay component (functionality consolidated)

---

## [v5.7.3] - 2026-04-02

### Added

- OAuth authentication support for MCP servers
- LSP tool for code definition navigation
- file_write tool implementation

### Changed

- Modernized settings panel UI with new card-based design
- Reduced VSCodeButton size by 5% across all variants for better visual consistency

### Fixed

- Allow changing 3p models for existing tasks and fixed model display names

---

## [v5.7.2] - 2026-03-29

### Added

- Third-party provider support with Fireworks, Ollama, and OpenCode integrations

---

## [v5.7.1] - 2026-03-28

### Changed

- Minor release updates and stability improvements

---

## [v5.7.0] - 2026-03-20

### Changed

- Major release with enhanced provider integrations

---

## [v5.6.5] - 2026-03-14

### Changed

- Updated git repository URL across all localization files
- Minor stability improvements

---

## [v5.6.4] - 2026-03-13

### Changed

- Name cleanup and branding consistency updates
- Improved CSS styling for better UI consistency

---

## [v5.6.3] - 2026-03-12

### Changed

- Improved reasoning flow with enhanced time tracking
- Better reasoning block display and interaction

---

## [v5.6.2] - 2026-03-10

### Added

- Fade-up and shimmer animations for ChatRow, ChatView, and ReasoningBlock components
- Enhanced visual feedback with smooth animation effects

### Changed

- UI cleanups across chat components
- Improved chat message rendering and layout

---

## [v5.6.1] - 2026-03-08

### Changed

- Monthly usage percentage display update in settings
- Enhanced usage tracking UI in BottomApiConfig component

---

## [v5.6.0] - 2026-03-08

### Added

- Split high think models for better model organization
- Enhanced OpenRouter model providers hook

### Changed

- Tool cleanups and optimizations
- Improved model selection handling

---

## [v5.5.7] - 2026-03-06

### Added

- Web fetch and web search tools for enhanced information retrieval
- Model state per task - each task now maintains its own model selection state independently

### Changed

- Cleaned up chat theme for improved visual consistency
- Enhanced webview message handling for better task management

### Fixed

- Fixed @ mentions when editing messages

---

## [v5.5.6] - 2026-03-05

### Changed

- Enhanced task state management with improved model selection handling
- Updated webview message handler for better task coordination

---

## [v5.5.4] - 2026-03-02

### Added

- Better follow up question UI for improved user interaction

### Changed

- Enhanced queue and sending prevention for better chat UX
- Improved file list with scrollable container and max height

### Fixed

- Fixed activity bar icon display
- Fixed authentication navigation issues

---

## [v5.5.3] - 2026-02-26

### Added

- Plan file tools (readPlanFile, listPlanFiles) for better plan management
- Image input modality support for enhanced interactions
- Plan memory manager for improved plan tracking

### Changed

- Enhanced UI improvements across multiple components
- Updated PostHog telemetry integration
- Improved folder mention chip UI

### Fixed

- Limited background task height for better layout management

---

## [v5.5.2] - 2026-02-26

### Added

- Background tasks support for multi-chats - now you can run multiple chat tasks simultaneously without blocking each other
- Single file accept metrics - track detailed metrics when accepting individual file edits
- Model state per task - each task now maintains its own model selection state independently
- Bottom anchor for changes and navigation - improved UI with anchored navigation controls
- Todo IDE plan view - enhanced plan viewing experience in the IDE

### Changed

- Chat performance improvements - optimized rendering and message handling for smoother chat experience
- UI updates across multiple components for better consistency and user experience
- Enhanced file edit review controller with improved functionality
- Updated task metadata handling for better state management

### Fixed

- Fixed plan implementation issues for better plan execution
- Fixed chat new lines and paste cursor positioning for improved text input experience
- Fixed mention chip alignment for better visual consistency
- Auto reject tools and send new message - improved tool rejection workflow

---

## [v5.4.1] - 2026-02-13

### Added

- Sticky user messages for better chat navigation
- Pro model info display in settings
- Custom icons utility for improved UI components

### Changed

- Updated profile page with usage data
- Streamlined model names and auto model selection
- Improved codebase indexing tool UI
- Enhanced task history list
- Updated notifications integration
- UI updates for code reviews

### Fixed

- Fixed file path bug in code reviews

---

## [v5.4.0] - 2026-02-12

### Added

- Open plan in editor functionality for better plan management
- Better fuzzy search for improved file context matching

### Changed

- Cleaner chat interface with improved UI
- Better diff view for edit tool
- Edit tool improvements with context search enhancements
- Minor UI update to task header

---

## [v5.3.4] - 2026-02-03

### Fixed

- Fixed multi-window authentication synchronization
- Fixed beta model access for axon-code-2-pro

---

## [v5.3.3] - 2026-02-02

### Fixed

- Fixed beta model access for axon-code-2-pro

---

## [v5.3.2] - 2026-02-02

### Added

- Beta models gating for axon-code-2-pro with backend API integration
- Custom icons utility for improved UI components

### Changed

- Set temperature to 0.2 for OpenRouter provider
- Enhanced file edit tool with improved functionality
- Updated kilocode models configuration
- Cleaned up chat text area component
- Updated and optimized test files
- UI improvements across chat components

---

## [v5.3.1] - 2026-01-30

### Added

- Retry button for 5xx streaming failures

### Fixed

- Fixed use_skill tool being included in system prompt when no skills are available

---

## [v5.3.0] - 2026-01-29

### Added

- New skill tool functionality for enhanced code assistance
- Skill parser and type definitions for skill management
- Comprehensive test coverage for skill tool components
- Enhanced code index orchestrator with skill integration
- State manager for skill tool operations

### Changed

- Updated tool type definitions to support skill tools
- Enhanced assistant message presentation with skill support
- Improved code index manager with skill-related functionality
- Updated dependencies in package.json

---

## [v5.2.9] - 2026-01-27

### Changed

- Minor update to system prompt for long running command tool

---

## [v5.2.8] - 2026-01-27

### Fixed

- Minor patch in line diff counter logic

---

## [v5.2.7] - 2026-01-27

### Changed

- Minor update to system prompt for long running command tool

---

## [v5.2.6] - 2026-01-21

### Changed

- Minor update to system prompt for long running command tool

---

## [v5.2.5] - 2026-01-21

### Added

- Multi-line chip rendering for improved mention display

### Changed

- Clean up profile page
- Enhanced chat rendering utilities

### Fixed

- Fixed plan hover popup display

---

## [v5.2.4] - 2026-01-19

### Fixed

- Fixed SourceControlPanel.tsx - addressed review comments
- Fixed chat text UI issues

---

## [v5.2.3] - 2026-01-16

### Fixed

- Fixed chat text UI with improved component structure

---

## [v5.2.2] - 2026-01-16

### Added

- Model selector moved to improved location

### Changed

- UI improvements and IDE theme fixes
- Enhanced ChatTextArea component
- Updated translations for all supported languages
- Improved select-dropdown and popover components

---

## [v5.2.1] - 2026-01-15

### Added

- Updated translations and added memories locale files for internationalization support

### Fixed

- Fixed issue where messages were being queued after rejecting exec_cmd tool

### Changed

- Code cleanup and improvements

---

## [v5.2.0] - 2026-01-14

### Added

- New Auto-Generated memories for past chats: Axon Code can now generate and reference memories in chats when building or updating codebase to ensure any previously used context can be quickly remembered.

### Changed

- Removed marketplace
- Minor fixes to stream tool calling in cases where tools got stuck

## [v5.1.0] - 2026-01-12

### Added

- Line counter tracking for file edit reviews (lines added, updated, deleted)
- Server integration to report line change statistics
- Automatic language detection from edited files for analytics
- `MatterProgressIndicator` component with animated loading dots
- "View Diff" button in file edit review to view pending changes in VS Code editor
- Elapsed time tracking for reasoning blocks (shows "Thinking for Xs" during streaming)
- "Thought" translation key for completed reasoning blocks

### Changed

- Enhanced file edit review accept all functionality with detailed metrics
- Improved webview message handling for file edit operations
- Updated "API Request..." label to "Generating..." for better UX
- Fixed sendingDisabled behavior when canceling tasks or aborting commands
- Enhanced reasoning block UI with time display and collapse functionality

### Fixed

- Removed debug console.log statement from kilo config loading
- Fixed unused parameter warning in ReasoningBlock component

---

## [v5.0.3] - 2026-01-11

### Added

- Context window usage tracking
- Show credits usage on hover
- Fetch and show chat title

### Changed

- UX improvements for chat
- Headers for repo

### Fixed

- Notify LLM if files have been changed by the user post its own edits
- On exec tool reject, do nothing

---

## [v5.0.2] - 2026-01-09

### Changed

- Minor improvements to file read tool
- Settings UI Cleanup

---

## [v5.0.1] - 2026-01-09

### Changed

- Minor improvements to file edit and code reviews
- File changes list does not dissapear on task abortion

---

## [v5.0.0] - 2026-01-05

### Added

- Harness context agents and file edits are revamped to reduce error rates! Tools updates, read file, edit file, search and list.
- Enterprise Code Review support for self-deployed platform
- Improvments in AI code review system

### Changed

- Major UI improvments
- Improved auth flow + review only mode

---

## [v4.210.0] - 2026-01-02

### Added

#### AI Code Reviews

- 1-click AI code reviews for all your agentic and manual changes
- Get all the review comments, suggestions and 1-click Apply all

![Demo](https://github.com/MatterAIOrg/public-assets/blob/a5bf692ecb15f62a8148b5bf998917b6566991ea/axon-ide-code-reviews.gif)

### Changed

- Improved ripgrep with file extension normalising
- UI improvments

---

## [v4.206.0] - 2025-12-29

### Added

- Enhanced file edit tool with substring replacer for inline edit file tool calls
- Improved task handling with better file edit integration
- Enhanced ripgrep service for better file search capabilities

### Changed

- Updated file edit tool implementation for more robust inline editing
- Improved task processing with enhanced file edit capabilities
- Enhanced package version management

---

## [v4.205.0] - 2025-12-26

### Added

- New chat renderer utility for improved message rendering
- Retry button functionality for API streaming failures
- Enhanced checkpoint handling system

### Changed

- Migrated KiloTaskHeader and TaskItem components to use ReadOnlyChatText
- Refactored ChatTextArea component with code cleanup
- Improved ChatRow component with better checkpoint integration

### Fixed

- Fixed duplicate code removal in ChatTextArea
- Resolved race condition with isUserInput flag
- Fixed previous commands still showing run/reject buttons
- Improved UI consistency and functionality

---

## [v4.204.1] - 2025-12-20

### Added

- CLI authentication wizard with browser-based OAuth flow
- Browser authentication utilities for secure token management
- Welcome message utilities for CLI user onboarding

### Changed

- Refactored AcceptRejectButtons component for improved multi-edit handling
- Enhanced ChatTextArea with better cancel button functionality
- Updated ChatView component for improved message queue management
- Improved Logo component with better styling and responsiveness
- Enhanced AuthWizard with comprehensive authentication flow
- Updated CLI package configuration and validation

### Fixed

- Fixed code paths return value issue in AuthWizard
- Improved cancel button UI and functionality
- Enhanced CLI authentication initialization process

---

## [v4.204.0] - 2025-12-20

### Added

- Support for axon-code-2-preview model in OpenRouter provider
- Enhanced file edit review controller with better diff handling
- Improved UI refactors across multiple components

### Changed

- Refactored kilocode-models configuration for better model management
- Updated useOpenRouterModelProviders hook for enhanced provider integration
- Enhanced FileEditReviewController for improved file edit reviews
- Improved QueuedMessages component for better message handling
- Updated CSS styling for consistent UI appearance
- Enhanced slash commands utilities for better command processing

### Fixed

- Cleaned up AI code reviews card for better user experience
- Fixed various UI inconsistencies across components
- Improved error handling in webview message handler

---

## [v4.203.0] - 2025-12-19

### Added

- Enhanced chat text area with improved mention chip functionality
- New mention chip demo component for better user interaction

### Changed

- Refactored ChatTextArea component for better performance and maintainability
- Updated ChatRow component with streamlined UI elements
- Improved CodeAccordian component for enhanced code display
- Enhanced useOpenRouterModelProviders hook for better model management
- Updated prettyModelName utility for improved model name formatting
- Refined KiloTaskHeader component with better task management
- Improved GhostServiceSettings component for enhanced configuration

### Fixed

- Better handling of chat text area interactions
- Improved mention chip display and functionality
- Enhanced UI cleanup and consistency across components

---

## [v4.202.0] - 2025-12-18

### Added

- Enhanced UI components with improved user experience
- Better error handling and display components
- Improved model provider integration

### Changed

- Streamlined ChatRow component with enhanced functionality
- Updated ErrorRow component for better error display
- Refined AcceptRejectButtons component for improved user interaction
- Enhanced CodeAccordian component for better code presentation
- Improved ToolUseBlock component for better tool usage display
- Updated ModelSelector component for enhanced model selection
- Enhanced select-dropdown component for better user experience
- Improved prettyModelName utility for better model name handling

### Fixed

- Better handling of fill-diff viewer edge cases
- Enhanced UI consistency and visual improvements
- Better error handling in various components

---

## [v4.201.0] - 2025-12-16

### Added

- Enhanced file edit review functionality with improved user experience
- Better webview message handling for file edit operations

### Changed

- Improved file edit review interface with refined accept/reject buttons
- Updated ChatTextArea component for better user interaction
- Enhanced OpenRouter provider integration
- Streamlined UI components for improved consistency
- Updated translations for ar, ca, cs, de, es, fr, hi, id, it, ja, ko, nl, pl, pt-BR, ru, th, tr, uk, vi, zh-CN and zh-TW

### Fixed

- Better handling of file edit review edge cases
- Improved localization support for chat components

---

## [v4.200.0] - 2025-12-15

### Added

- New file edit review system with accept/reject functionality
- Enhanced monthly quota management within chat interface
- Improved mentions cleanup and handling
- New AcceptRejectButtons component for better user interaction

### Changed

- Updated UI components across dialogs, dropdowns, popovers, and selects
- Enhanced chat interface with improved user experience
- Refined chat row component for better readability
- Updated tool use block styling for improved visual consistency
- Streamlined chat message layout and interactions

### Fixed

- Better handling of file edit operations
- Improved quota tracking and display
- Enhanced error handling in chat interface

---

## [v4.123.1] - 2025-12-07

### Changed

- Refined chat UI components with improved styling and consistency
- Updated todo list display with better iconography using CheckCircle components
- Enhanced timestamp display with improved font sizing
- Streamlined chat message layout by removing unnecessary borders
- Improved color scheme consistency across UI components
- Updated font weights and sizes for better visual hierarchy

### Fixed

- Better handling of todo list status indicators
- Improved color variable references for consistent theming

---

## [v4.123.0] - 2025-12-03

### Added

- Enhanced chat interface with improved user experience
- Cleaner message display and layout optimization

### Changed

- Refined chat row component for better readability
- Updated tool use block styling for improved visual consistency
- Enhanced internationalization support for chat components

### Fixed

- Improved message formatting and spacing
- Better handling of long messages in chat interface

---

## [v4.122.0] - 2025-12-03

### Added

- Enhanced credit management system with improved warnings
- Better error handling for insufficient credit scenarios
- Comprehensive test coverage for error utilities

### Changed

- Updated credit warning messages to be more user-friendly
- Improved low credit warning UI components
- Enhanced error messaging for better user guidance

### Fixed

- Better handling of credit limit scenarios
- Improved error message display and formatting

---

## [v4.121.0] - 2025-11-30

### Added

- Refined codebase search functionality with improved accuracy
- Enhanced search result filtering and scoring
- Better integration with codebase indexing system

### Changed

- Optimized search result limits (reduced from 200 to 5 max results)
- Improved search score thresholds (minimum score: 0.5)
- Enhanced model provider integration
- Streamlined codebase search UI components

### Fixed

- Better handling of search result pagination
- Improved search result display formatting
- Enhanced model selection interface

---

## [v4.120.0] - 2025-11-27

### Added

- Complete codebase indexing system with backend integration
- Vector store migration to backend services
- Enhanced embedding endpoint functionality
- Improved package cleanup and optimization

### Changed

- Migrated vector store operations to backend for better performance
- Refactored codebase indexing architecture for scalability
- Enhanced UI components for better user experience
- Improved model provider configurations

### Fixed

- Resolved embedding endpoint connectivity issues
- Fixed codebase indexing performance bottlenecks
- Enhanced error handling in vector store operations

---

## [v4.119.0] - 2025-11-20

### Added

- Hardcoded model IDs for improved Axon integration
- Enhanced tool optimization for better performance
- Credit usage display per model for better cost tracking
- Improved model selection interface

### Changed

- Optimized API calls to reduce latency
- Enhanced model provider architecture
- Improved credit management and display
- Streamlined tool execution pipeline

### Fixed

- Better handling of model selection edge cases
- Improved credit tracking accuracy
- Enhanced error handling in model provider operations

---

## [v4.118.0] - 2025-11-13

### Added

- Initial release with core functionality
- Basic chat interface and model integration
- Foundational codebase indexing capabilities

### Features

- AI-powered code assistance
- Multi-model support through OpenRouter
- Basic autocomplete and code suggestions
- Initial marketplace integration

---
