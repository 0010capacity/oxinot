import React, { memo, useCallback } from "react";
import { useBlock, useChildrenIds, useBlockStore } from "../stores/blockStore";
import { useDebouncedBlockUpdate } from "../hooks/useDebouncedBlockUpdate";
import { Editor } from "../components/Editor";
import "./BlockComponent.css";

interface BlockComponentProps {
  blockId: string;
  depth: number;
}

export const BlockComponent = memo(function BlockComponent({
  blockId,
  depth,
}: BlockComponentProps) {
  const block = useBlock(blockId);
  const childIds = useChildrenIds(blockId);
  const hasChildren = childIds.length > 0;

  const toggleCollapse = useBlockStore((state) => state.toggleCollapse);
  const createBlock = useBlockStore((state) => state.createBlock);
  const deleteBlock = useBlockStore((state) => state.deleteBlock);
  const indentBlock = useBlockStore((state) => state.indentBlock);
  const outdentBlock = useBlockStore((state) => state.outdentBlock);
  const setFocusedBlock = useBlockStore((state) => state.setFocusedBlock);

  const { debouncedUpdate, flushUpdate } = useDebouncedBlockUpdate(blockId);

  const handleContentChange = useCallback(
    (content: string) => {
      debouncedUpdate(content);
    },
    [debouncedUpdate],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        flushUpdate();
        createBlock(blockId);
      } else if (e.key === "Backspace" && block?.content === "") {
        e.preventDefault();
        deleteBlock(blockId);
      } else if (e.key === "Tab") {
        e.preventDefault();
        flushUpdate();
        if (e.shiftKey) {
          outdentBlock(blockId);
        } else {
          indentBlock(blockId);
        }
      }
    },
    [
      blockId,
      block?.content,
      flushUpdate,
      createBlock,
      deleteBlock,
      indentBlock,
      outdentBlock,
    ],
  );

  const handleFocus = useCallback(() => {
    setFocusedBlock(blockId);
  }, [blockId, setFocusedBlock]);

  const handleBlur = useCallback(() => {
    flushUpdate();
  }, [flushUpdate]);

  if (!block) return null;

  return (
    <div
      className="block-component"
      style={{ paddingLeft: `${depth * 24}px` }}
      onKeyDown={handleKeyDown}
    >
      <div className="block-row">
        {/* Collapse/Expand Toggle */}
        {hasChildren && (
          <button
            className={`collapse-toggle ${block.isCollapsed ? "collapsed" : ""}`}
            onClick={() => toggleCollapse(blockId)}
            aria-label={block.isCollapsed ? "Expand" : "Collapse"}
          >
            {block.isCollapsed ? "▶" : "▼"}
          </button>
        )}

        {/* Bullet Point */}
        <span className="block-bullet">•</span>

        {/* Content Editor */}
        <div className="block-content-wrapper">
          <Editor
            value={block.content}
            onChange={handleContentChange}
            onFocus={handleFocus}
            onBlur={handleBlur}
            lineNumbers={false}
            lineWrapping={true}
            className="block-editor"
            style={{
              minHeight: "32px",
              fontSize: "14px",
            }}
          />
        </div>
      </div>
    </div>
  );
});
