import { createTodoTool } from "./createTodoTool";
import { queryTodosTool } from "./queryTodosTool";
import { updateTodoTool } from "./updateTodoTool";

export { createTodoTool, queryTodosTool, updateTodoTool };

export const todoTools = [createTodoTool, queryTodosTool, updateTodoTool];
