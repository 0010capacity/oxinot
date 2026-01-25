import { appendToBlockTool } from "./appendToBlockTool";
import { createBlockTool } from "./createBlockTool";
import { createBlocksFromMarkdownTool } from "./createBlocksFromMarkdownTool";
import { deleteBlockTool } from "./deleteBlockTool";
import { getBlockTool } from "./getBlockTool";
import { getPageBlocksTool } from "./getPageBlocksTool";
import { insertBlockBelowCurrentTool } from "./insertBlockBelowCurrentTool";
import { insertBlockBelowTool } from "./insertBlockBelowTool";
import { queryBlocksTool } from "./queryBlocksTool";
import { updateBlockTool } from "./updateBlockTool";

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
];
