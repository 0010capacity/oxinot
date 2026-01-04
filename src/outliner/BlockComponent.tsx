import React, { memo } from "react";
import { Block } from "./types";
import { hasChildren } from "./blockUtils";
import { Editor } from "../components/Editor";
import { KeyBinding } from "@codemirror/view";

// Grouped props for better organization
export interface BlockComponentProps {
  block: Block;
  state: {
    isFocused: boolean;
    isOnActivePath: boolean;
    effectiveLevel: number;
  };
  handlers: {
    onContentChange: (blockId: string, content: string) => void;
    onFocusBlock: (blockId: string) => void;
    onToggleCollapse: (blockId: string) => void;
    onSetFocusRoot: (blockId: string) => void;
  };
  config: {
    theme: "light" | "dark";
    keybindings: KeyBinding[];
  };
  children?: React.ReactNode;
}

/**
 * Memoized Block component for performance
 * Represents a single block in the outliner with its editor and bullet point
 */
export const BlockComponent = memo<BlockComponentProps>(
  ({ block, state, handlers, config, children }) => {
    const { isFocused, isOnActivePath, effectiveLevel } = state;
    const { onContentChange, onFocusBlock, onToggleCollapse, onSetFocusRoot } =
      handlers;
    const { theme, keybindings } = config;
    const isCollapsed = block.collapsed;
    const hasChildBlocks = hasChildren(block);

    return (
      <div
        className={`block-container ${hasChildBlocks ? "has-children" : ""} ${children ? "focus-within" : ""} ${isOnActivePath ? "on-active-path" : ""}`}
        data-block-id={block.id}
      >
        <div
          className={`block-line ${isFocused ? "focused" : ""}`}
          style={{ paddingLeft: `${effectiveLevel * 24}px` }}
        >
          {hasChildBlocks ? (
            <button
              className={`block-toggle ${
                isCollapsed ? "collapsed" : "expanded"
              }`}
              onClick={() => onToggleCollapse(block.id)}
              aria-label={isCollapsed ? "Expand" : "Collapse"}
            >
              <svg
                width="10"
                height="10"
                viewBox="0 0 10 10"
                fill="none"
                aria-hidden="true"
                focusable="false"
              >
                <path
                  d={isCollapsed ? "M4 2.5L6.5 5L4 7.5" : "M2.5 4L5 6.5L7.5 4"}
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          ) : (
            <div className="block-toggle-placeholder" />
          )}

          <div
            className={`block-bullet-container ${
              block.kind === "fence"
                ? "fence"
                : block.kind === "code"
                  ? "code"
                  : ""
            }`}
            onClick={() => onSetFocusRoot(block.id)}
            title={
              block.kind === "fence"
                ? "Fence block"
                : block.kind === "code"
                  ? `Code block${block.language ? ` (${block.language})` : ""}`
                  : undefined
            }
          >
            <div
              className={`block-bullet ${isFocused ? "active" : ""} ${
                block.kind === "fence"
                  ? "fence"
                  : block.kind === "code"
                    ? "code"
                    : ""
              }`}
            />
          </div>

          <div
            className={`block-editor-wrap ${
              block.kind === "code"
                ? "code-block-editor"
                : block.kind === "fence"
                  ? "fence-block-editor"
                  : ""
            }`}
          >
            <Editor
              value={block.content}
              onChange={(newContent) => onContentChange(block.id, newContent)}
              onFocus={() => onFocusBlock(block.id)}
              theme={theme}
              lineNumbers={false}
              lineWrapping={true}
              keybindings={keybindings}
              className="block-editor"
              style={{
                minHeight: "32px",
                fontSize: block.kind === "code" ? "14px" : "16px",
              }}
            />
          </div>
        </div>

        {!isCollapsed && hasChildBlocks && children && (
          <div className={`block-children ${children ? "focus-within" : ""}`}>
            {children}
          </div>
        )}
      </div>
    );
  },
  (prevProps, nextProps) => {
    // Only re-render if THIS block's content changed or focus changed
    // Don't re-render just because siblings changed
    if (prevProps.block.id !== nextProps.block.id) return false;
    if (prevProps.block.content !== nextProps.block.content) return false;
    if (prevProps.state.isFocused !== nextProps.state.isFocused) return false;
    if (prevProps.config.theme !== nextProps.config.theme) return false;

    // For other changes, only re-render if they affect this block
    if (prevProps.block.collapsed !== nextProps.block.collapsed) return false;
    if (prevProps.block.kind !== nextProps.block.kind) return false;
    if (prevProps.state.isOnActivePath !== nextProps.state.isOnActivePath)
      return false;
    if (prevProps.state.effectiveLevel !== nextProps.state.effectiveLevel)
      return false;
    if (prevProps.block.children.length !== nextProps.block.children.length)
      return false;

    // Skip re-render - nothing important changed
    return true;
  },
);

BlockComponent.displayName = "BlockComponent";
