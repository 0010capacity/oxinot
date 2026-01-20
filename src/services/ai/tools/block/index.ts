import { getBlockTool } from "./getBlockTool";
import { updateBlockTool } from "./updateBlockTool";
import { createBlockTool } from "./createBlockTool";
import { deleteBlockTool } from "./deleteBlockTool";
import { queryBlocksTool } from "./queryBlocksTool";
import { getPageBlocksTool } from "./getPageBlocksTool";
import { insertBlockBelowCurrentTool } from "./insertBlockBelowCurrentTool";
import { insertBlockBelowTool } from "./insertBlockBelowTool";
import { appendToBlockTool } from "./appendToBlockTool";

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
];
