import React, {
  useReducer,
  useRef,
  useEffect,
  useState,
  useCallback,
  useMemo,
  memo,
} from "react";
import { Block } from "./types";
import { blockReducer } from "./blockReducer";
import {
  flattenBlocks,
  createBlock,
  hasChildren,
  findBlockById,
} from "./blockUtils";
import { parseMarkdownToBlocks } from "./blockUtils";
import { Breadcrumbs, Anchor } from "@mantine/core";
import "./BlockEditor.css";
import { Editor } from "../components/Editor";
import { KeyBinding } from "@codemirror/view";

// Helper function to get block path
function getBlockPath(block: Block): Block[] {
  const path: Block[] = [];
  let current: Block | null = block;
  while (current) {
    path.unshift(current);
    current = current.parent;
  }
  return path;
}

interface BlockEditorProps {
  initialContent?: string;
  onChange?: (blocks: Block[]) => void;
  theme?: "light" | "dark";
}

// Memoized Block component for performance - defined outside to avoid recreation
const BlockComponent = memo<{
  block: Block;
  isFocused: boolean;
  isOnActivePath: boolean;
  effectiveLevel: number;
  onContentChange: (blockId: string, content: string) => void;
  onFocusBlock: (blockId: string) => void;
  onToggleCollapse: (blockId: string) => void;
  onSetFocusRoot: (blockId: string) => void;
  theme: "light" | "dark";
  keybindings: KeyBinding[];
  children?: React.ReactNode;
}>(
  ({
    block,
    isFocused,
    isOnActivePath,
    effectiveLevel,
    onContentChange,
    onFocusBlock,
    onToggleCollapse,
    onSetFocusRoot,
    theme,
    keybindings,
    children,
  }) => {
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
              block.kind === "brace" ? "brace" : ""
            }`}
            onClick={() => onSetFocusRoot(block.id)}
            title={block.kind === "brace" ? "Brace block" : undefined}
          >
            <div
              className={`block-bullet ${isFocused ? "active" : ""} ${
                block.kind === "brace" ? "brace" : ""
              }`}
            />
          </div>

          <div className="block-editor-wrap">
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
                minHeight: "40px",
                fontSize: "16px",
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
    if (prevProps.isFocused !== nextProps.isFocused) return false;
    if (prevProps.theme !== nextProps.theme) return false;

    // For other changes, only re-render if they affect this block
    if (prevProps.block.collapsed !== nextProps.block.collapsed) return false;
    if (prevProps.block.kind !== nextProps.block.kind) return false;
    if (prevProps.isOnActivePath !== nextProps.isOnActivePath) return false;
    if (prevProps.effectiveLevel !== nextProps.effectiveLevel) return false;
    if (prevProps.block.children.length !== nextProps.block.children.length)
      return false;

    // Skip re-render - nothing important changed
    return true;
  },
);

BlockComponent.displayName = "BlockComponent";

export const BlockEditor: React.FC<BlockEditorProps> = ({
  initialContent = "",
  onChange,
  theme = "light",
}) => {
  const [blocks, dispatch] = useReducer(blockReducer, null, () => {
    if (!initialContent) {
      return [createBlock("", 0)];
    }
    return parseMarkdownToBlocks(initialContent);
  });

  const [focusedBlockId, setFocusedBlockId] = useState<string | null>(() => {
    const firstBlock = blocks[0];
    return firstBlock ? firstBlock.id : null;
  });
  const [focusRootId, setFocusRootId] = useState<string | null>(null);

  const isFirstRender = useRef(true);
  const prevBlockCountRef = useRef(blocks.length);

  // Notify parent of block changes
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    if (!onChange) return;
    const timeoutId = setTimeout(() => {
      onChange(blocks);
    }, 200);
    return () => clearTimeout(timeoutId);
  }, [blocks, onChange]);

  // Auto-focus newly created blocks
  useEffect(() => {
    const currentBlockCount = blocks.length;
    if (currentBlockCount > prevBlockCountRef.current) {
      // A block was added - focus it
      const flatBlocks = flattenBlocks(blocks);
      if (focusedBlockId) {
        const currentIndex = flatBlocks.findIndex(
          (b) => b.id === focusedBlockId,
        );
        if (currentIndex !== -1 && currentIndex + 1 < flatBlocks.length) {
          const nextBlock = flatBlocks[currentIndex + 1];
          // Small delay to allow React to render the new block
          setTimeout(() => {
            setFocusedBlockId(nextBlock.id);
          }, 10);
        }
      }
    }
    prevBlockCountRef.current = currentBlockCount;
  }, [blocks, focusedBlockId]);

  const handleContentChangeRef =
    useRef<(blockId: string, newContent: string) => void>();

  const handleContentChange = useCallback(
    (blockId: string, newContent: string) => {
      const flat = flattenBlocks(blocks);
      const current = flat.find((b) => b.id === blockId);

      // Auto-convert: if a bullet block's entire content becomes "{", convert to brace block
      if (current && current.kind !== "brace" && newContent.trim() === "{") {
        current.kind = "brace";
        current.braceState = "open";
        dispatch({
          type: "UPDATE_BLOCK",
          payload: { blockId, content: "" },
        });
        setTimeout(() => setFocusedBlockId(blockId), 0);
        return;
      }

      dispatch({
        type: "UPDATE_BLOCK",
        payload: { blockId, content: newContent },
      });
    },
    [blocks],
  );

  handleContentChangeRef.current = handleContentChange;

  const handleToggleCollapse = useCallback((blockId: string) => {
    dispatch({ type: "TOGGLE_COLLAPSE", payload: { blockId } });
  }, []);

  // Custom keybindings for block navigation
  const createBlockKeybindings = useCallback(
    (blockId: string, block: Block): KeyBinding[] => [
      {
        key: "Enter",
        run: (view) => {
          const state = view.state;
          const cursorPos = state.selection.main.head;
          const content = state.doc.toString();
          const contentLength = content.length;

          // Handle Enter key - split or create new block
          if (block.kind === "brace") {
            // For brace blocks, allow newlines (don't split)
            return false;
          }

          if (cursorPos === 0 && contentLength === 0) {
            // Empty block + Enter = outdent
            dispatch({
              type: "OUTDENT_BLOCK",
              payload: { blockId },
            });
            return true;
          }

          if (cursorPos === contentLength) {
            // At end - create new sibling block
            dispatch({
              type: "ADD_BLOCK",
              payload: {
                afterBlockId: blockId,
                level: block.level,
                content: "",
              },
            });
          } else {
            // In middle - split block
            dispatch({
              type: "SPLIT_BLOCK",
              payload: { blockId, offset: cursorPos },
            });
          }
          return true;
        },
      },
      {
        key: "Backspace",
        run: (view) => {
          const state = view.state;
          const cursorPos = state.selection.main.head;
          const content = state.doc.toString();

          if (cursorPos === 0 && content.length === 0) {
            // Delete empty block or merge with previous
            const flatBlocks = flattenBlocks(blocks);
            const index = flatBlocks.findIndex((b) => b.id === blockId);
            const previousBlock = index > 0 ? flatBlocks[index - 1] : null;

            if (previousBlock) {
              dispatch({
                type: "MERGE_WITH_PREVIOUS",
                payload: { blockId },
              });
            } else {
              dispatch({
                type: "DELETE_BLOCK",
                payload: { blockId },
              });
            }
            return true;
          }
          return false;
        },
      },
      {
        key: "Tab",
        run: () => {
          dispatch({
            type: "INDENT_BLOCK",
            payload: { blockId },
          });
          return true;
        },
      },
      {
        key: "Shift-Tab",
        run: () => {
          dispatch({
            type: "OUTDENT_BLOCK",
            payload: { blockId },
          });
          return true;
        },
      },
      {
        key: "ArrowUp",
        run: (view) => {
          const state = view.state;
          const cursorPos = state.selection.main.head;
          const line = state.doc.lineAt(cursorPos);

          // Only handle if we're on the first line
          if (line.number === 1) {
            const flatBlocks = flattenBlocks(blocks);
            const index = flatBlocks.findIndex((b) => b.id === blockId);
            const previousBlock = index > 0 ? flatBlocks[index - 1] : null;

            if (previousBlock) {
              setFocusedBlockId(previousBlock.id);
              return true;
            }
          }
          return false;
        },
      },
      {
        key: "ArrowDown",
        run: (view) => {
          const state = view.state;
          const cursorPos = state.selection.main.head;
          const line = state.doc.lineAt(cursorPos);

          // Only handle if we're on the last line
          if (line.number === state.doc.lines) {
            const flatBlocks = flattenBlocks(blocks);
            const index = flatBlocks.findIndex((b) => b.id === blockId);
            const nextBlock =
              index < flatBlocks.length - 1 ? flatBlocks[index + 1] : null;

            if (nextBlock) {
              setFocusedBlockId(nextBlock.id);
              return true;
            }
          }
          return false;
        },
      },
    ],
    [blocks, dispatch],
  );

  const currentRoot = useMemo(() => {
    if (!focusRootId) return null;
    return findBlockById(blocks, focusRootId);
  }, [blocks, focusRootId]);

  const displayedBlocks = useMemo(() => {
    if (!currentRoot) return blocks;
    return currentRoot.children;
  }, [blocks, currentRoot]);

  const breadcrumbPath = useMemo(() => {
    if (!focusRootId) return [];
    const focusedBlock = findBlockById(blocks, focusRootId);
    if (!focusedBlock) return [];
    return getBlockPath(focusedBlock);
  }, [blocks, focusRootId]);

  const breadcrumbItems = breadcrumbPath.map((block) => (
    <Anchor
      key={block.id}
      onClick={() => {
        if (block.parent) {
          setFocusRootId(block.parent.id);
        } else {
          setFocusRootId(null);
        }
      }}
    >
      {block.content || "(empty)"}
    </Anchor>
  ));

  const activePath = useMemo(() => {
    if (!focusedBlockId) return [];
    const focusedBlock = findBlockById(blocks, focusedBlockId);
    if (!focusedBlock) return [];
    return getBlockPath(focusedBlock);
  }, [blocks, focusedBlockId]);

  const activePathIds = useMemo(
    () => new Set(activePath.map((b) => b.id)),
    [activePath],
  );

  const renderBlock = useCallback(
    (block: Block, ancestors: Block[]): React.ReactNode => {
      const isFocused = focusedBlockId === block.id;
      const isOnActivePath = activePathIds.has(block.id);
      const effectiveLevel = block.level - (currentRoot?.level ?? 0);
      const keybindings = createBlockKeybindings(block.id, block);

      return (
        <BlockComponent
          key={block.id}
          block={block}
          isFocused={isFocused}
          isOnActivePath={isOnActivePath}
          effectiveLevel={effectiveLevel}
          onContentChange={(blockId, content) =>
            handleContentChangeRef.current?.(blockId, content)
          }
          onFocusBlock={setFocusedBlockId}
          onToggleCollapse={handleToggleCollapse}
          onSetFocusRoot={setFocusRootId}
          theme={theme}
          keybindings={keybindings}
        >
          {!block.collapsed &&
            hasChildren(block) &&
            block.children.map((child) =>
              renderBlock(child, [...ancestors, block]),
            )}
        </BlockComponent>
      );
    },
    [
      focusedBlockId,
      currentRoot,
      activePathIds,
      theme,
      createBlockKeybindings,
      handleToggleCollapse,
    ],
  );

  return (
    <div className={`block-editor-container theme-${theme}`}>
      {breadcrumbPath.length > 0 && (
        <div className="block-breadcrumbs">
          <Breadcrumbs separator="›">{breadcrumbItems}</Breadcrumbs>
        </div>
      )}

      <div className="blocks-list">
        {displayedBlocks.map((block) => renderBlock(block, []))}
      </div>

      {displayedBlocks.length === 0 && (
        <div
          className="empty-state"
          style={{ paddingLeft: `${(currentRoot?.level ?? 0) * 24}px` }}
        >
          <div className="block-line">
            <div className="block-toggle-placeholder" />
            <div className="block-bullet-container">
              <div className="block-bullet" />
            </div>
            <div className="block-editor-wrap">
              <Editor
                value=""
                onChange={() => {
                  dispatch({
                    type: "ADD_BLOCK",
                    payload: {
                      level: currentRoot ? currentRoot.level + 1 : 0,
                      afterBlockId: currentRoot?.id,
                    },
                  });
                }}
                theme={theme}
                lineNumbers={false}
                lineWrapping={true}
                className="block-editor"
                style={{
                  minHeight: "40px",
                  fontSize: "16px",
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BlockEditor;
