import { ToolArgs } from "./types"

export function getCheckPastChatMemoriesDescription(args: ToolArgs): string {
	return `## check_past_chat_memories
Description: Search through previous chat completion results to find relevant context from past tasks. Use this when you need to recall what was implemented or fixed in previous chats. This tool performs a regex search across stored memories from completed tasks.

Parameters:
- regex: (required) Regular expression pattern to search memory contents. Uses JavaScript regex syntax.
- workspace: (optional) Filter by workspace directory. If not provided, defaults to current workspace (${args.cwd}).

Usage:
<check_past_chat_memories>
<regex>Your regex pattern here</regex>
<workspace>workspace path (optional)</workspace>
</check_past_chat_memories>

Example: Searching for memories about authentication
<check_past_chat_memories>
<regex>authentication|auth|login|token</regex>
</check_past_chat_memories>

Example: Searching for memories about a specific feature
<check_past_chat_memories>
<regex>user.*profile|profile.*update</regex>
</check_past_chat_memories>

The tool returns matching memories with:
- Task title or ID
- Date of completion
- Mode used
- Content of the completion result

Use this tool when you encounter a task that seems related to previous work, or when you need to understand what has been implemented before.`
}
