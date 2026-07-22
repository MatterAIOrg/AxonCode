---
---

import useDocusaurusContext from '@docusaurus/useDocusaurusContext';

import { DISCORD_URL } from '@site/src/constants.ts'

# Frequently Asked Questions

This page answers some common questions about Orbital.

## General

### What is Orbital?

Orbital is an open-source AI agent extension for Visual Studio Code. It helps you write code more efficiently by generating code, automating tasks, and providing suggestions.

### How does Orbital work?

Orbital uses large language models (LLMs) to understand your requests and translate them into actions. It can:

- Read and write files in your project.
- Execute commands in your VS Code terminal.
- Perform web browsing (if enabled).
- Use external tools via the Model Context Protocol (MCP).

You interact with Orbital through a chat interface, where you provide instructions and review/approve its proposed actions.

### What can Orbital do?

Orbital can help with a variety of coding tasks, including:

- Generating code from natural language descriptions.
- Refactoring existing code.
- Fixing bugs.
- Writing documentation.
- Explaining code.
- Answering questions about your codebase.
- Automating repetitive tasks.
- Creating new files and projects.

### Is Orbital free to use?

The Orbital extension itself is free and open-source. In order for Orbital to be useful, you need an AI model to respond to your queries. Models are hosted by providers and most charge for access.

There are some models available for free. The set of free models if constantly changing based on provider pricing decisions.

You can also use Orbital with a [local model](advanced-usage/local-models) or "Bring Your Own API Key" for [another model provider](getting-started/connecting-api-provider) (like [Anthropic](providers/anthropic), [OpenAI](providers/openai), [OpenRouter](providers/openrouter), [Requesty](providers/requesty), etc.).

### How do I pay for model usage via Orbital?

If you choose to pay for models via Orbital, you do so by buying Kilo Credits. You can [buy Kilo Credits](basic-usage/adding-credits) securely via Stripe with a credit card. We do not charge a markup on Kilo Credits. $1 you give us is $1 in Kilo Credits.

Model usage is metered by the providers in terms of different kinds of tokens. When you use a model, we debit your Kilo credits by the amount the provider charges us -- with no markup.

You can use any models you like as long as you have credits in your account. When you run out of credits, you can add more. It's that simple!

If you're looking to earn some credits, you could join our <a href={DISCORD_URL} target='_blank'>Discord</a> where we sometimes have promotional offers!

### What are the risks of using Orbital?

Orbital is a powerful tool, and it's important to use it responsibly. Here are some things to keep in mind:

- **Orbital can make mistakes.** Always review Orbital's proposed changes carefully before approving them.
- **Orbital can execute commands.** Be very cautious about allowing Orbital to run commands, especially if you're using auto-approval.
- **Orbital can access the internet.** If you're using a provider that supports web browsing, be aware that Orbital could potentially access sensitive information.

## Setup & Installation

### How do I install Orbital?

See the [Installation Guide](/getting-started/installing) for detailed instructions.

### Which API providers are supported?

Orbital supports a wide range of API providers, including:

- [Anthropic (Claude)](/providers/kilocode)
- [Anthropic (Claude)](/providers/anthropic)
- [OpenAI](/providers/openai)
- [OpenRouter](/providers/openrouter)
- [Google Gemini](/providers/gemini)
- [Glama](/providers/glama)
- [AWS Bedrock](/providers/bedrock)
- [GCP Vertex AI](/providers/vertex)
- [Ollama](/providers/ollama)
- [LM Studio](/providers/lmstudio)
- [DeepSeek](/providers/deepseek)
- [Mistral](/providers/mistral)
- [Unbound](/providers/unbound)
- [Requesty](/providers/requesty)
- [VS Code Language Model API](/providers/vscode-lm)

### How do I get an API key?

Each API provider has its own process for obtaining an API key. See the [Setting Up Your First AI Provider](/getting-started/connecting-api-provider) for links to the relevant documentation for each provider.

### Can I use Orbital with local models?

Yes, Orbital supports running models locally using [Ollama](/providers/ollama) and [LM Studio](/providers/lmstudio). See [Using Local Models](/advanced-usage/local-models) for instructions.

## Usage

### How do I start a new task?

Open the Orbital panel (<img src="/docs/img/matterai-ic.svg" width="12" />) and type your task in the chat box. Be clear and specific about what you want Orbital to do. See [The Chat Interface](/basic-usage/the-chat-interface) for best practices.

### What are modes in Orbital?

[Modes](/basic-usage/using-modes) are different personas that Orbital can adopt, each with a specific focus and set of capabilities. The built-in modes are:

- **Code:** For general-purpose coding tasks.
- **Architect:** For planning and technical leadership.
- **Ask:** For answering questions and providing information.
- **Debug:** For systematic problem diagnosis.
  You can also create [Custom Modes](/features/custom-modes).

### How do I switch between modes?

Use the dropdown menu in the chat input area to select a different mode, or use the `/` command to switch to a specific mode.

### What are tools and how do I use them?

[Tools](/basic-usage/how-tools-work) are how Orbital interacts with your system. Orbital automatically selects and uses the appropriate tools to complete your tasks. You don't need to call tools directly. You will be prompted to approve or reject each tool use.

### What are context mentions?

[Context mentions](/basic-usage/context-mentions) are a way to provide Orbital with specific information about your project, such as files, folders, or problems. Use the "@" symbol followed by the item you want to mention (e.g., `@/src/file.ts`, `@problems`).

### Can Orbital access the internet?

Yes, if you are using a provider with a model that support web browsing. Be mindful of the security implications of allowing this.

### Can Orbital run commands in my terminal?

Yes, Orbital can execute commands in your VS Code terminal. You will be prompted to approve each command before it's executed, unless you've enabled auto-approval for commands. Be extremely cautious about auto-approving commands. If you're experiencing issues with terminal commands, see the [Shell Integration Guide](/features/shell-integration) for troubleshooting.

### How do I provide feedback to Orbital?

You can provide feedback by approving or rejecting Orbital's proposed actions. You can provide additional feedback by using the feedback field.

### Can I customize Orbital's behavior?

Yes, you can customize Orbital in several ways:

- **Custom Instructions:** Provide general instructions that apply to all modes, or mode-specific instructions.
- **Custom Modes:** Create your own modes with tailored prompts and tool permissions.
- **`.clinerules` Files:** Create `.clinerules` files in your project to provide additional guidelines.
- **Settings:** Adjust various settings, such as auto-approval, diff editing, and more.

### Does Orbital have any auto approval settings?

Yes, Orbital has a few settings that when enabled will automatically approve actions. Find out more [here](/features/auto-approving-actions).

## Advanced Features

### Can I use Orbital offline?

Yes, if you use a [local model](/advanced-usage/local-models).

### What is MCP (Model Context Protocol)?

[MCP](/features/mcp/overview) is a protocol that allows Orbital to communicate with external servers, extending its capabilities with custom tools and resources.

### Can I create my own MCP servers?

Yes, you can create your own MCP servers to add custom functionality to Orbital. See the [MCP documentation](https://github.com/modelcontextprotocol) for details.
Yes, you can create your own MCP servers to add custom functionality to Orbital. See the [MCP documentation](https://github.com/modelcontextprotocol) for details.

## Troubleshooting

### Orbital isn't responding. What should I do?

- Make sure your API key is correct and hasn't expired.
- Check your internet connection.
- Check the status of your chosen API provider.
- Try restarting VS Code.
- If the problem persists, report the issue on [GitHub](https://github.com/MatterAIOrg/Orbital-Extension/issues) or [Discord](https://discord.gg/fJU5DvanU3).

### I'm seeing an error message. What does it mean?

The error message should provide some information about the problem. If you're unsure how to resolve it, seek help in the community forums.

### Orbital made changes I didn't want. How do I undo them?

Orbital uses VS Code's built-in file editing capabilities. You can use the standard "Undo" command (Ctrl/Cmd + Z) to revert changes. Also, if experimental checkpoints are enabled, Kilo can revert changes made to a file.

### How do I report a bug or suggest a feature?

Please report bugs or suggest features on the Orbital [Issues page](https://github.com/MatterAIOrg/Orbital-Extension/issues) and [Feature Requests page](https://github.com/MatterAIOrg/Orbital-Extension/discussions/categories/ideas).
