import { useMemo, useEffect } from "react";
import { Virtuoso } from "react-virtuoso";
import { useBlockStore } from "../stores/blockStore";
import { BlockRow } from "./BlockRow";

interface BlockEditorProps {
  pageId: string;
}

export function BlockEditor({ pageId }: BlockEditorProps) {
  const loadPage = useBlockStore((state) => state.loadPage);
  const isLoading = useBlockStore((state) => state.isLoading);
  const error = useBlockStore((state) => state.error);

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

  return <BlockList parentId={null} />;
}

interface BlockListProps {
  parentId: string | null;
}

function BlockList({ parentId }: BlockListProps) {
  const flattenedBlocks = useFlattenedBlocks(parentId);

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

function useFlattenedBlocks(rootParentId: string | null): FlatBlock[] {
  const blocksById = useBlockStore((state) => state.blocksById);
  const childrenMap = useBlockStore((state) => state.childrenMap);

  return useMemo(() => {
    const result: FlatBlock[] = [];

    function traverse(parentId: string | null, depth: number) {
      const key = parentId ?? "root";
      const childIds = childrenMap[key] ?? [];

      for (const id of childIds) {
        const block = blocksById[id];
        if (block) {
          result.push({ id, depth });

          // If not collapsed, traverse children
          if (!block.isCollapsed) {
            traverse(id, depth + 1);
          }
        }
      }
    }

    traverse(rootParentId, 0);
    return result;
  }, [blocksById, childrenMap, rootParentId]);
}
