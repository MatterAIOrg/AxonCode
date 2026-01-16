import { OpenAI } from "openai/client"
import askFollowupQuestion from "./ask_followup_question"
import attemptCompletion from "./attempt_completion"
import checkPastChatMemories from "./check_past_chat_memories"
import executeCommand from "./execute_command"
import fetchInstructions from "./fetch_instructions"
import listCodeDefinitionNames from "./list_code_definition_names"
import listFiles from "./list_files"
// import newTask from "./new_task"
import { read_file_single } from "./read_file"
// import runSlashCommand from "./run_slash_command"
// import searchAndReplace from "./search_and_replace"
import searchFiles from "./search_files"
// import switchMode from "./switch_mode"
import fileEdit from "./file_edit"
import updateTodoList from "./update_todo_list"
import codebaseSearch from "./codebase_search"
import planFileEdit from "./plan_file_edit"

export const nativeTools = [
	// apply_diff_single_file,
	// apply_diff_multi_file,
	fileEdit,
	askFollowupQuestion,
	attemptCompletion,
	checkPastChatMemories,
	// browserAction,
	codebaseSearch,
	// editFile,
	executeCommand,
	fetchInstructions,
	// generateImage,
	// insertContent,
	listCodeDefinitionNames,
	listFiles,
	// newTask,
	planFileEdit,
	read_file_single,
	// runSlashCommand,
	// searchAndReplace,
	searchFiles,
	updateTodoList,
	// writeToFile,
] satisfies OpenAI.Chat.ChatCompletionTool[]
