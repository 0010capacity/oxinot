import { useMemo, memo, useRef } from "react";
import { Virtuoso, type VirtuosoHandle } from "react-virtuoso";
import { BlockComponent } from "./BlockComponent";
import type { BlockData } from "../stores/blockStore";

interface VirtualBlockListProps {
  blockIds: string[];
  blockOrder: string[];
  blocksById: Record<string, BlockData>;
  childrenMap: Record<string, string[]>;
  editorFontSize: number;
  editorLineHeight: number;
  onEmptyState?: () => React.ReactNode;
}

/**
 * Virtual block list that renders only visible blocks in the viewport.
 *
 * Uses React Virtuoso for efficient rendering of large document trees.
 * Dramatically improves performance for documents with 500+ blocks.
 *
 * @example
 * <VirtualBlockList
 *   blockIds={blockOrder}
 *   blockOrder={blockOrder}
 *   blocksById={blocksById}
 *   childrenMap={childrenMap}
 *   editorFontSize={14}
 *   editorLineHeight={1.5}
 * />
 */
export const VirtualBlockList = memo(function VirtualBlockList({
  blockIds,
  blockOrder,
  blocksById,
  childrenMap,
  editorFontSize,
  editorLineHeight,
  onEmptyState,
}: VirtualBlockListProps) {
  const virtuosoRef = useRef<VirtuosoHandle>(null);

  // Memoize styles to avoid re-rendering
  const blockListStyle = useMemo(
    () => ({
      fontSize: `${editorFontSize}px`,
      lineHeight: editorLineHeight,
    }),
    [editorFontSize, editorLineHeight]
  );

  // Calculate depth for each block based on parent hierarchy
  const blockDepthMap = useMemo(() => {
    const depthMap: Record<string, number> = {};
    const calculateDepth = (blockId: string): number => {
      if (depthMap[blockId] !== undefined) {
        return depthMap[blockId];
      }
      const block = blocksById[blockId];
      if (!block || !block.parentId) {
        depthMap[blockId] = 0;
        return 0;
      }
      const parentDepth = calculateDepth(block.parentId);
      depthMap[blockId] = parentDepth + 1;
      return parentDepth + 1;
    };
    for (const blockId of blockOrder) {
      calculateDepth(blockId);
    }
    return depthMap;
  }, [blocksById, blockOrder]);

  // Early return for empty state
  if (blockIds.length === 0) {
    return onEmptyState?.() ?? null;
  }

  return (
    <Virtuoso
      ref={virtuosoRef}
      style={{
        height: "100%",
        width: "100%",
      }}
      data={blockIds}
      itemContent={(_, blockId) => (
        <div style={blockListStyle}>
          <BlockComponent
            blockId={blockId}
            depth={blockDepthMap[blockId] ?? 0}
          />
        </div>
      )}
      overscan={5}
      increaseViewportBy={{
        top: 100,
        bottom: 100,
      }}
    />
  );
});
