import { appendToBlockTool } from "./appendToBlockTool";
import { createBlockTool } from "./createBlockTool";
import { createBlocksBatchTool } from "./createBlocksBatchTool";
import { createBlocksFromMarkdownTool } from "./createBlocksFromMarkdownTool";
import { deleteBlockTool } from "./deleteBlockTool";
import { getBlockTool } from "./getBlockTool";
import { getMarkdownTemplateTool } from "./getMarkdownTemplateTool";
import { getPageBlocksTool } from "./getPageBlocksTool";
import { insertBlockBelowCurrentTool } from "./insertBlockBelowCurrentTool";
import { insertBlockBelowTool } from "./insertBlockBelowTool";
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
];
