import { useEffect } from "react";
import { useMantineColorScheme } from "@mantine/core";
import { useBlockStore } from "../stores/blockStore";
import { useViewStore } from "../stores/viewStore";
import { BlockComponent } from "./BlockComponent";
import "./BlockEditor.css";

interface BlockEditorProps {
  pageId: string;
}

export function BlockEditor({ pageId }: BlockEditorProps) {
  const { colorScheme } = useMantineColorScheme();
  const isDark = colorScheme === "dark";

  const loadPage = useBlockStore((state) => state.loadPage);
  const createBlock = useBlockStore((state) => state.createBlock);
  const isLoading = useBlockStore((state) => state.isLoading);
  const error = useBlockStore((state) => state.error);
  const childrenMap = useBlockStore((state) => state.childrenMap);

  const focusedBlockId = useViewStore((state) => state.focusedBlockId);

  // Load page blocks
  useEffect(() => {
    if (pageId) {
      loadPage(pageId);
    }
  }, [pageId, loadPage]);

  // Auto-create first block if page is empty
  useEffect(() => {
    if (!isLoading && !error && pageId) {
      const rootBlocks = childrenMap["root"] || [];
      const hasBlocks = rootBlocks.length > 0;

      if (!hasBlocks) {
        createBlock(null, "").catch((err) => {
          console.error("Failed to create initial block:", err);
        });
      }
    }
  }, [isLoading, error, pageId, childrenMap, createBlock]);

  if (isLoading) {
    return (
      <div
        className={`block-editor-container ${isDark ? "theme-dark" : "theme-light"}`}
      >
        <div
          style={{
            padding: "16px",
            opacity: 0.5,
            color: isDark ? "#909296" : "#868e96",
          }}
        >
          Loading...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className={`block-editor-container ${isDark ? "theme-dark" : "theme-light"}`}
      >
        <div style={{ padding: "16px", color: "#fa5252" }}>Error: {error}</div>
      </div>
    );
  }

  // Determine which blocks to show based on zoom level
  const blocksToShow = focusedBlockId
    ? [focusedBlockId]
    : childrenMap["root"] || [];

  return (
    <div
      className={`block-editor-container ${isDark ? "theme-dark" : "theme-light"}`}
    >
      <div className="blocks-list">
        {blocksToShow.length === 0 ? (
          <div className="empty-state">
            <div style={{ opacity: 0.5, padding: "20px" }}>
              Start typing to create your first block...
            </div>
          </div>
        ) : (
          blocksToShow.map((blockId) => (
            <BlockComponent key={blockId} blockId={blockId} depth={0} />
          ))
        )}
      </div>
    </div>
  );
}
