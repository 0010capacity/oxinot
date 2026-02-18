import { appendToBlockTool } from "./appendToBlockTool";
import { createBlockTool } from "./createBlockTool";
import { createBlocksBatchTool } from "./createBlocksBatchTool";
import { createBlocksFromMarkdownTool } from "./createBlocksFromMarkdownTool";
import { deleteBlockTool } from "./deleteBlockTool";
import { getBlockTool } from "./getBlockTool";
import { getMarkdownTemplateTool } from "./getMarkdownTemplateTool";
import { getPageBlocksTool } from "./getPageBlocksTool";
import { indentBlockTool } from "./indentBlockTool";
import { insertBlockBelowCurrentTool } from "./insertBlockBelowCurrentTool";
import { insertBlockBelowTool } from "./insertBlockBelowTool";
import { mergeBlocksTool } from "./mergeBlocksTool";
import { moveBlockTool } from "./moveBlockTool";
import { outdentBlockTool } from "./outdentBlockTool";
import { queryBlocksTool } from "./queryBlocksTool";
import { updateBlockTool } from "./updateBlockTool";
import { validateMarkdownStructureTool } from "./validateMarkdownStructureTool";

export {
  getBlockTool,
  updateBlockTool,
  createBlockTool,
  deleteBlockTool,
  queryBlocksTool,
  getPageBlocksTool,
  insertBlockBelowCurrentTool,
  insertBlockBelowTool,
  appendToBlockTool,
  createBlocksFromMarkdownTool,
  createBlocksBatchTool,
  validateMarkdownStructureTool,
  getMarkdownTemplateTool,
  indentBlockTool,
  outdentBlockTool,
  moveBlockTool,
  mergeBlocksTool,
};

export const blockTools = [
  getBlockTool,
  updateBlockTool,
  createBlockTool,
  deleteBlockTool,
  queryBlocksTool,
  getPageBlocksTool,
  insertBlockBelowCurrentTool,
  insertBlockBelowTool,
  appendToBlockTool,
  createBlocksFromMarkdownTool,
  createBlocksBatchTool,
  validateMarkdownStructureTool,
  getMarkdownTemplateTool,
  indentBlockTool,
  outdentBlockTool,
  moveBlockTool,
  mergeBlocksTool,
];
