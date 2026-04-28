import { OpenAI } from "openai/client"
import askFollowupQuestion from "./ask_followup_question"
import attemptCompletion from "./attempt_completion"
import checkPastChatMemories from "./check_past_chat_memories"
import executeCommand from "./execute_command"
import listCodeDefinitionNames from "./list_code_definition_names"
import listFiles from "./list_files"
import lsp from "./lsp"
import { read_file_single } from "./read_file"
import searchFiles from "./search_files"
import fileEdit from "./file_edit"
import multiFileEdit from "./multi_file_edit"
import fileWrite from "./file_write"
import updateTodoList from "./update_todo_list"
import codebaseSearch from "./codebase_search"
import useSkill from "./use_skill"
import webFetch from "./web_fetch"
import webSearch from "./web_search"

export const nativeTools = [
	fileEdit,
	multiFileEdit,
	fileWrite,
	askFollowupQuestion,
	attemptCompletion,
	checkPastChatMemories,
	codebaseSearch,
	executeCommand,
	listCodeDefinitionNames,
	listFiles,
	lsp,
	read_file_single,
	searchFiles,
	updateTodoList,
	useSkill,
	webFetch,
	webSearch,
] satisfies OpenAI.Chat.ChatCompletionTool[]
