import { z } from 'zod';
import { invoke } from '@tauri-apps/api/core';
import type { Tool, ToolResult } from '../types';

export const createBlockTool: Tool = {
  name: 'create_block',
  description: 'Create a new block in the document. Use this whenever the user asks to "write", "add", "insert", or "create" content. Do not just output text in chat; use this tool to actually write to the document.',
  category: 'block',
  requiresApproval: true,

  parameters: z.object({
    parentUuid: z.string().uuid().describe('UUID of the parent block. If creating at page level or "current page", use the page\'s root or ask for clarification context.'),
    content: z.string().describe('Content for the new block'),
  }),

  async execute(params, context): Promise<ToolResult> {
    try {
      // 1. Get parent block to find page_id
      // Note: If parentUuid is actually a pageId (which shouldn't happen based on types but AI might try),
      // we need to handle that. But for now assuming block UUID.
      
      const parentBlock = await invoke<any>('get_block', {
        workspacePath: context.workspacePath,
        request: {
          block_id: params.parentUuid
        }
      });

      if (!parentBlock) {
        return {
          success: false,
          error: `Parent block with UUID ${params.parentUuid} not found`,
        };
      }

      const pageId = parentBlock.block.page_id;

      // 2. Create the block
      const newBlock = await invoke<any>('create_block', {
        workspacePath: context.workspacePath,
        request: {
          page_id: pageId,
          parent_id: params.parentUuid,
          content: params.content,
        }
      });

      return {
        success: true,
        data: { uuid: newBlock.id, content: params.content },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create block',
      };
    }
  },
};