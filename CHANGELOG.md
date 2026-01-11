# Changelog

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
