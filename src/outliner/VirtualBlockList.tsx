import { useMemo, useRef } from "react";
import { Virtuoso, type VirtuosoHandle } from "react-virtuoso";
import { BlockComponent } from "./BlockComponent";

interface VirtualBlockListProps {
  blockIds: string[];
  blockOrder: string[];
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
 *   blockIds={blocksToShow}
 *   blockOrder={blockOrder}
 *   isDark={isDark}
 *   editorFontSize={14}
 *   editorLineHeight={1.5}
 * />
 */
export function VirtualBlockList({
  blockIds,
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
    [editorFontSize, editorLineHeight],
  );

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
          <BlockComponent blockId={blockId} depth={0} />
        </div>
      )}
      overscan={5}
      increaseViewportBy={{
        top: 100,
        bottom: 100,
      }}
    />
  );
}
