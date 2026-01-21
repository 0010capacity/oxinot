import { describe, it, expect, vi, beforeEach } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import { getBlockTool, updateBlockTool, createBlockTool, deleteBlockTool, queryBlocksTool } from '../';

// Mock Tauri invoke
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

describe('Block Tools', () => {
  const mockContext = { workspacePath: '/test' };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('get_block', () => {
    it('should get block successfully', async () => {
      const mockBlock = { uuid: 'test-uuid', content: 'test content' };
      vi.mocked(invoke).mockResolvedValue(mockBlock);

      const result = await getBlockTool.execute({ uuid: 'test-uuid' }, mockContext);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockBlock);
      expect(invoke).toHaveBeenCalledWith('get_block', {
        workspacePath: '/test',
        request: { block_id: 'test-uuid' }
      });
    });

    it('should handle block not found', async () => {
      vi.mocked(invoke).mockResolvedValue(null);

      const result = await getBlockTool.execute({ uuid: 'nonexistent' }, mockContext);

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });
  });

  describe('update_block', () => {
    it('should update block content', async () => {
      vi.mocked(invoke).mockResolvedValue(undefined);

      const result = await updateBlockTool.execute({
        uuid: 'test-uuid',
        content: 'new content',
      }, mockContext);

      expect(result.success).toBe(true);
      expect(invoke).toHaveBeenCalledWith('update_block', {
        workspacePath: '/test',
        request: {
          id: 'test-uuid',
          content: 'new content',
        }
      });
    });
  });

  describe('create_block', () => {
    it('should create block successfully', async () => {
      // Mock get_block for parent
      vi.mocked(invoke).mockResolvedValueOnce({ block: { page_id: 'page-1' } });
      // Mock create_block
      vi.mocked(invoke).mockResolvedValueOnce({ id: 'new-uuid', content: 'new block' });

      const result = await createBlockTool.execute({
        parentUuid: 'parent-uuid',
        content: 'new block',
      }, mockContext);

      expect(result.success).toBe(true);
      expect(invoke).toHaveBeenCalledTimes(2);
      expect(invoke).toHaveBeenNthCalledWith(1, 'get_block', {
        workspacePath: '/test',
        request: { block_id: 'parent-uuid' }
      });
      expect(invoke).toHaveBeenNthCalledWith(2, 'create_block', {
        workspacePath: '/test',
        request: {
          page_id: 'page-1',
          parent_id: 'parent-uuid',
          content: 'new block',
        }
      });
    });
  });

  describe('delete_block', () => {
    it('should delete block successfully', async () => {
      vi.mocked(invoke).mockResolvedValue(['deleted-uuid']);

      const result = await deleteBlockTool.execute({ uuid: 'deleted-uuid' }, mockContext);

      expect(result.success).toBe(true);
      expect(invoke).toHaveBeenCalledWith('delete_block', {
        workspacePath: '/test',
        blockId: 'deleted-uuid'
      });
    });
  });

  describe('query_blocks', () => {
    it('should query blocks successfully', async () => {
      const mockBlocks = [{ id: '1', content: 'result' }];
      vi.mocked(invoke).mockResolvedValue(mockBlocks);

      const result = await queryBlocksTool.execute({ query: 'test', limit: 10 }, mockContext);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockBlocks);
      expect(invoke).toHaveBeenCalledWith('search_blocks', {
        workspacePath: '/test',
        request: {
          query: 'test',
          limit: 10
        }
      });
    });
  });
});
