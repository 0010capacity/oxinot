import { getBlockTool } from './getBlockTool';
import { updateBlockTool } from './updateBlockTool';
import { createBlockTool } from './createBlockTool';
import { deleteBlockTool } from './deleteBlockTool';
import { queryBlocksTool } from './queryBlocksTool';
import { getPageBlocksTool } from './getPageBlocksTool';

export {
  getBlockTool,
  updateBlockTool,
  createBlockTool,
  deleteBlockTool,
  queryBlocksTool,
  getPageBlocksTool,
};

export const blockTools = [
  getBlockTool,
  updateBlockTool,
  createBlockTool,
  deleteBlockTool,
  queryBlocksTool,
  getPageBlocksTool,
];