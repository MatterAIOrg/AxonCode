// kilocode_change: this file was pulled in from Cline and adjusted with our changes

export const newTaskToolResponse = (userInput: string) =>
	`<explicit_instructions type="new_task">
The user has explicitly asked you to help them create a new task with preloaded context, which you will create. In this message the user has potentially added instructions or context which you should consider, if given, when creating the new task.
Irrespective of whether additional information or instructions are given, you are only allowed to respond to this message by calling the new_task tool.

To refresh your memory, the tool definition for new_task and an example for calling the tool is described below:

## new_task tool definition:

Description: Request to create a new task with preloaded context. The user will be presented with a preview of the context and can choose to create a new task or keep chatting in the current conversation. The user may choose to start a new task at any point.
Parameters:
- mode: (required) The slug of the mode to start the new task in (e.g., "code", "ask", "architect").
- message: (required) The initial user message or instructions for this new task.
- context: (required) The context to preload the new task with. This should include:
  * Comprehensively explain what has been accomplished in the current task - mention specific file names that are relevant
  * The specific next steps or focus for the new task - mention specific file names that are relevant
  * Any critical information needed to continue the work
  * Clear indication of how this new task relates to the overall workflow
  * This should be akin to a long handoff file, enough for a totally new developer to be able to pick up where you left off and know exactly what to do next and which files to look at.
Usage:
<new_task>
<mode>your-mode-slug-here</mode>
<message>Your initial instructions here</message>
<context>context to preload new task with</context>
</new_task>

## Tool use example:

<new_task>
<mode>your-mode-slug-here</mode>
<message>Implement a new feature for the application.</message>
<context>
Authentication System Implementation:
- We've implemented the basic user model with email/password
- Password hashing is working with bcrypt
- Login endpoint is functional with proper validation
- JWT token generation is implemented

Next Steps:
- Implement refresh token functionality
- Add token validation middleware
- Create password reset flow
- Implement role-based access control
</context>
</new_task>

Within the context of the parent task, the user provided the following input when they indicated that they wanted to create a new task.
<user_input>
${userInput}
</user_input>

</explicit_instructions>\n
`

export const newRuleToolResponse = (userInput: string) =>
	`<explicit_instructions type="new_rule">
The user has explicitly asked you to help them create a new Orbital rule file inside the .orbital/rules top-level directory based on the conversation up to this point in time. The user may have provided instructions or additional information for you to consider when creating the new Orbital rule.
When creating a new Orbital rule file, you should NOT overwrite or alter an existing Orbital rule file. To create the Orbital rule file you MUST use the new_rule tool. The new_rule tool can be used in any of the modes.
The new_rule tool is defined below:
Description:
Your task is to create a new Orbital rule file which includes guidelines on how to approach developing code in tandem with the user, which is project specific. This includes but is not limited to: desired conversational style, favorite project dependencies, coding styles, naming conventions, architectural choices, ui/ux preferences, etc.
The Orbital rule file must be formatted as markdown and be a '.md' file. The name of the file you generate must be as succinct as possible and be encompassing the main overarching concept of the rules you added to the file (e.g., 'memory-bank.md' or 'project-overview.md'). Please also explicitly ask the user to review the newly created rule.
Parameters:
- Path: (required) The path of the file to write to (relative to the current working directory). This will be the Orbital rule file you create, and it must be placed inside the .orbital/rules top-level directory (create this if it doesn't exist). The filename created CANNOT be "default-clineignore.md". For filenames, use hyphens ("-") instead of underscores ("_") to separate words.
- Content: (required) The content to write to the file. ALWAYS provide the COMPLETE intended content of the file, without any truncation or omissions. You MUST include ALL parts of the file, even if they haven't been modified. The content for the Orbital rule file MUST be created according to the following instructions:
  1. Format the Orbital rule file to have distinct guideline sections, each with their own markdown heading, starting with "## Brief overview". Under each of these headings, include bullet points fully fleshing out the details, with examples and/or trigger cases ONLY when applicable.
  2. These guidelines can be specific to the task(s) or project worked on thus far, or cover more high-level concepts. Guidelines can include coding conventions, general design patterns, preferred tech stack including favorite libraries and language, communication style with Kilo (verbose vs concise), prompting strategies, naming conventions, testing strategies, comment verbosity, time spent on architecting prior to development, and other preferences.
  3. When creating guidelines, you should not invent preferences or make assumptions based on what you think a typical user might want. These should be specific to the conversation you had with the user. Your guidelines / rules should not be overly verbose.
  4. Your guidelines should NOT be a recollection of the conversation up to this point in time, meaning you should NOT be including arbitrary details of the conversation.
Usage:
<new_rule>
<path>.orbital/rules/{file name}.md</path>
<content>Orbital rule file content here</content>
</new_rule>
Example:
<new_rule>
<path>.orbital/rules/project-preferences.md</path>
<content>
## Brief overview
  [Brief description of the rules, including if this set of guidelines is project-specific or global]
## Communication style
  - [Description, rule, preference, instruction]
  - [...]
## Development workflow
  - [Description, rule, preference, instruction]
  - [...]
## Coding best practices
  - [Description, rule, preference, instruction]
  - [...]
## Project context
  - [Description, rule, preference, instruction]
  - [...]
## Other guidelines
  - [Description, rule, preference, instruction]
  - [...]
</content>
<line_count>30</line_count>
</new_rule>
The user provided the following input when they indicated that they wanted to create a new Orbital rule file.
<user_input>
${userInput}
</user_input>
</explicit_instructions>\n
`

export const commitCommandResponse = (userInput: string) =>
	`<explicit_instructions type="commit">
The user has explicitly asked you to check pending changes and generate detailed commit messages. You MUST now help them with this.

<task>
Please check all the pending changes in the git repository and generate detailed commit messages. If needed, you can split into multiple commits also.

Instructions:
1. First, check all pending changes using git status and git diff
2. Group related changes together logically (e.g., a feature implementation, a bug fix, refactoring, etc.)
3. For each logical group, generate a detailed, conventional commit message following the format:
   type(scope): short description
   
   Detailed explanation of what changed and why
4. Create separate commits for each logical group using git add and git commit
5. For GitHub repositories only, attribute the commit author as: matterai-app[bot]

To detect if the repository is hosted on GitHub, check the remote URL using:
  git remote get-url origin
  
If the remote URL contains "github.com", use the author flag:
  git commit --author="matterai-app[bot] <matterai-app[bot]@users.noreply.github.com>"

Before committing, present the commit messages to the user for review and ask them to confirm before executing.
</task>

<user_input>
${userInput}
</user_input>

</explicit_instructions>

`

export const reportBugToolResponse = (userInput: string) =>
	`<explicit_instructions type="report_bug">
The user has explicitly asked you to help them submit a bug to the Kilocode github page (you MUST now help them with this irrespective of what your conversation up to this point in time was). To do so you will use the report_bug tool which is defined below. However, you must first ensure that you have collected all required information to fill in all the parameters for the tool call.
You should converse with the user until you are able to gather all the required details. When conversing with the user, make sure you ask for/reference all required information/fields.
Only then should you use the report_bug tool call.
The report_bug tool can be used in either of the PLAN or ACT modes.
The report_bug tool call is defined below:
Description:
Your task is to fill in all of the required fields for an issue/bug report on github. You should attempt to get the user to be as verbose as possible with their description of the bug/issue they encountered.
Parameters:
- title: (required) Concise title for the bug report.
- description: (required) Detailed description of the bug. Please include what happened, what you expected to happen, and steps to reproduce, if applicable.
Usage:
<report_bug>
<title>Title of the issue</title>
<description>Detailed description of the issue, including steps to reproduce if relevant.</description>
</report_bug>
When you call the report_bug tool, the issue will be created at @https://github.com/MatterAIOrg/Orbital-Extension/issues
The user provided the following input when they indicated that they wanted to submit a bug report.
<user_input>
${userInput}
</user_input>
</explicit_instructions>\n`

export const condenseToolResponse = (userInput: string) =>
	`<explicit_instructions type="condense">
The user has explicitly asked you to create a detailed summary of the conversation so far, which will be used to compact the current context window while retaining key information. The user may have provided instructions or additional information for you to consider when summarizing the conversation.
Irrespective of whether additional information or instructions are given, you are only allowed to respond to this message by calling the condense tool.

The condense tool is defined below:

Description:
Your task is to create a detailed summary of the conversation so far, paying close attention to the user's explicit requests and your previous actions. This summary should be thorough in capturing technical details, code patterns, and architectural decisions that would be essential for continuing with the conversation and supporting any continuing tasks.
The user will be presented with a preview of your generated summary and can choose to use it to compact their context window or keep chatting in the current conversation.
Users may refer to this tool as 'compact' as well. You should consider these to be equivalent to 'condense' when used in a similar context.

Parameters:
- message: (required) The detailed summary of the conversation with maximum information density. This should include:
  1. ORIGINAL GOAL: Quote the user's original task or request verbatim.
  2. PROGRESS: What has been accomplished so far. Current state of the work.
  3. DECISIONS: Architectural choices, naming conventions, coding patterns adopted, and WHY.
  4. FILES: For each file read, modified, or created — full path, why it matters, changes, key code.
  5. FAILED APPROACHES: What was tried and did not work. Why. What should NOT be attempted again.
  6. KNOWLEDGE STATE: Confirmed facts vs assumptions vs unresolved questions.
  7. ENVIRONMENT: Relevant workspace settings, API providers, active modes, tool versions, constraints.
  8. NEXT STEPS: Immediate next action with VERBATIM quote of most recent task instruction. All pending tasks with status.

Usage:
<condense>
<message>Your detailed summary</message>
</condense>

Example:
<condense>
<message>
1. ORIGINAL GOAL:
  [Verbatim quote of user's original request]

2. PROGRESS:
  [Description of what has been accomplished]

3. DECISIONS:
  - [Decision 1 and reasoning]
  - [Decision 2 and reasoning]
  - [...]

4. FILES:
  - [File Name 1]
    - Path: [...]
    - Why it matters: [...]
    - Changes: [...]
    - Key code: [function signatures, type definitions, etc.]
  - [File Name 2]
    - [...]
  - [...]

5. FAILED APPROACHES:
  - [Approach 1] — Failed because [...]
  - [...]

6. KNOWLEDGE STATE:
  - Confirmed: [...]
  - Assumed: [...]
  - Unknown: [...]

7. ENVIRONMENT:
  - [Setting 1]
  - [Setting 2]
  - [...]

8. NEXT STEPS:
  - [Immediate next action with VERBATIM quote of most recent task instruction]
  - [Pending task 1 with status]
  - [Pending task 2 with status]
  - [...]
</message>
</condense>

<user_input>
${userInput}
</user_input>

</explicit_instructions>\n
`
