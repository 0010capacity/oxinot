import { useMemo, useEffect } from "react";
import { Virtuoso } from "react-virtuoso";
import { useBlockStore } from "../stores/blockStore";
import { useFocusedBlockId } from "../stores/viewStore";
import { BlockRow } from "./BlockRow";

interface BlockEditorProps {
  pageId: string;
}

export function BlockEditor({ pageId }: BlockEditorProps) {
  const loadPage = useBlockStore((state) => state.loadPage);
  const isLoading = useBlockStore((state) => state.isLoading);
  const error = useBlockStore((state) => state.error);
  const focusedBlockId = useFocusedBlockId();

  useEffect(() => {
    if (pageId) {
      loadPage(pageId);
    }
  }, [pageId, loadPage]);

  if (isLoading) {
    return <div style={{ padding: "16px" }}>Loading...</div>;
  }

  if (error) {
    return <div style={{ padding: "16px", color: "red" }}>Error: {error}</div>;
  }

  // When zoomed into a block, show the block itself and its children
  // When not zoomed, show all root blocks
  return <BlockList focusedBlockId={focusedBlockId} />;
}

interface BlockListProps {
  focusedBlockId: string | null;
}

function BlockList({ focusedBlockId }: BlockListProps) {
  const flattenedBlocks = useFlattenedBlocks(focusedBlockId);

  if (flattenedBlocks.length === 0) {
    return (
      <div style={{ padding: "16px", color: "#999" }}>
        No blocks yet. Click to add one.
      </div>
    );
  }

  return (
    <Virtuoso
      style={{ height: "100%" }}
      totalCount={flattenedBlocks.length}
      itemContent={(index) => {
        const { id, depth } = flattenedBlocks[index];
        return <BlockRow key={id} blockId={id} depth={depth} />;
      }}
    />
  );
}

interface FlatBlock {
  id: string;
  depth: number;
}

function useFlattenedBlocks(focusedBlockId: string | null): FlatBlock[] {
  const blocksById = useBlockStore((state) => state.blocksById);
  const childrenMap = useBlockStore((state) => state.childrenMap);

  return useMemo(() => {
    const result: FlatBlock[] = [];

    if (focusedBlockId) {
      // When zoomed in, show the focused block at depth 0
      const focusedBlock = blocksById[focusedBlockId];
      if (focusedBlock) {
        result.push({ id: focusedBlockId, depth: 0 });

        // Then show its children
        if (!focusedBlock.isCollapsed) {
          traverseChildren(focusedBlockId, 1);
        }
      }
    } else {
      // When not zoomed, show all root blocks
      traverseChildren(null, 0);
    }

    function traverseChildren(parentId: string | null, depth: number) {
      const key = parentId ?? "root";
      const childIds = childrenMap[key] ?? [];

      for (const id of childIds) {
        const block = blocksById[id];
        if (block) {
          result.push({ id, depth });

          // If not collapsed, traverse children
          if (!block.isCollapsed) {
            traverseChildren(id, depth + 1);
          }
        }
      }
    }

    return result;
  }, [blocksById, childrenMap, focusedBlockId]);
}
