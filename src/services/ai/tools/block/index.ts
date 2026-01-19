import { getBlockTool } from './getBlockTool';
import { updateBlockTool } from './updateBlockTool';
import { createBlockTool } from './createBlockTool';
import { deleteBlockTool } from './deleteBlockTool';
import { queryBlocksTool } from './queryBlocksTool';

export {
  getBlockTool,
  updateBlockTool,
  createBlockTool,
  deleteBlockTool,
  queryBlocksTool,
};

export const blockTools = [
  getBlockTool,
  updateBlockTool,
  createBlockTool,
  deleteBlockTool,
  queryBlocksTool,
];
