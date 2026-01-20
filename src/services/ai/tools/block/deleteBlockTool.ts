import { z } from 'zod';
import { invoke } from '@tauri-apps/api/core';
import { useBlockStore } from '../../../../stores/blockStore';
import type { Tool, ToolResult } from '../types';

export const deleteBlockTool: Tool = {
  name: 'delete_block',
  description: 'Delete a block and all its children. Use with caution as this cannot be undone.',
  category: 'block',
  requiresApproval: true, // Highly destructive

  parameters: z.object({
    uuid: z.string().uuid().describe('UUID of the block to delete'),
  }),

  async execute(params, context): Promise<ToolResult> {
    try {
      const deletedIds = await invoke<string[]>('delete_block', {
        workspacePath: context.workspacePath,
        blockId: params.uuid, // Note: argument name matches Rust command signature
      });

      // Update local store immediately
      useBlockStore.getState().updatePartialBlocks([], deletedIds);

      return {
        success: true,
        data: { uuid: params.uuid, deleted: true },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete block',
      };
    }
  },
};
