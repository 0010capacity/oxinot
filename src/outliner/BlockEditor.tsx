import React, {
  useReducer,
  useRef,
  useEffect,
  useState,
  KeyboardEvent,
  useCallback,
  useMemo,
} from "react";
import { Block } from "./types";
import { blockReducer } from "./blockReducer";
import {
  flattenBlocks,
  createBlock,
  hasChildren,
  buildBlockTree,
  findBlockById,
} from "./blockUtils";
import { Breadcrumbs, Anchor } from "@mantine/core";
import "./BlockEditor.css";

// Helper function to get block path, needed for guide line logic
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

export const BlockEditor: React.FC<BlockEditorProps> = ({
  initialContent = "",
  onChange,
  theme = "light",
}) => {
  const [blocks, dispatch] = useReducer(blockReducer, null, () => {
    if (!initialContent) {
      return [createBlock("", 0)];
    }
    const lines = initialContent.split("\n").filter((line) => line.trim());
    const initialBlocks = lines.map((line) => {
      const indent = line.search(/\S/);
      const level = Math.floor(indent / 2);
      const content = line.trim().replace(/^[-*+]\s+/, "");
      return createBlock(content, level);
    });
    return buildBlockTree(initialBlocks);
  });

  const [focusedBlockId, setFocusedBlockId] = useState<string | null>(() => {
    const firstBlock = blocks[0];
    return firstBlock ? firstBlock.id : null;
  });
  const [focusRootId, setFocusRootId] = useState<string | null>(null);

  const [cursorPosition, setCursorPosition] = useState<number>(0);
  const inputRefs = useRef<Map<string, HTMLTextAreaElement>>(new Map());
  const isFirstRender = useRef(true);

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
  }, [blocks]);

  useEffect(() => {
    if (!focusedBlockId) return;
    const input = inputRefs.current.get(focusedBlockId);
    if (input) {
      input.focus();
      input.setSelectionRange(cursorPosition, cursorPosition);
    }
  }, [focusedBlockId, cursorPosition]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>, blockId: string, block: Block) => {
      const target = e.target as HTMLTextAreaElement;
      const cursorPos = target.selectionStart;
      const content = target.value;

      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        if (cursorPos === content.length) {
          dispatch({
            type: "ADD_BLOCK",
            payload: { afterBlockId: blockId, level: block.level },
          });
          requestAnimationFrame(() => {
            const flatBlocks = flattenBlocks(blocks);
            const index = flatBlocks.findIndex((b) => b.id === blockId);
            if (index !== -1) {
              setTimeout(() => {
                const updatedFlat = flattenBlocks(blocks);
                const nextBlock = updatedFlat[index + 1];
                if (nextBlock) {
                  setFocusedBlockId(nextBlock.id);
                  setCursorPosition(0);
                }
              }, 0);
            }
          });
        } else {
          dispatch({
            type: "SPLIT_BLOCK",
            payload: { blockId, offset: cursorPos },
          });
          requestAnimationFrame(() => {
            setTimeout(() => {
              const flatBlocks = flattenBlocks(blocks);
              const index = flatBlocks.findIndex((b) => b.id === blockId);
              const nextBlock = flatBlocks[index + 1];
              if (nextBlock) {
                setFocusedBlockId(nextBlock.id);
                setCursorPosition(0);
              }
            }, 0);
          });
        }
        return;
      }

      if (e.key === "Backspace" && cursorPos === 0) {
        e.preventDefault();
        const flatBlocks = flattenBlocks(blocks);
        const index = flatBlocks.findIndex((b) => b.id === blockId);
        if (index > 0) {
          const previousBlock = flatBlocks[index - 1];
          const previousContent = previousBlock.content;
          if (content.length === 0) {
            dispatch({ type: "DELETE_BLOCK", payload: { blockId } });
          } else {
            dispatch({ type: "MERGE_WITH_PREVIOUS", payload: { blockId } });
          }
          setTimeout(() => {
            setFocusedBlockId(previousBlock.id);
            setCursorPosition(previousContent.length);
          }, 0);
        } else if (flatBlocks.length > 1 && content.length === 0) {
          dispatch({ type: "DELETE_BLOCK", payload: { blockId } });
        }
        return;
      }

      if (e.key === "Tab" && !e.shiftKey) {
        e.preventDefault();
        dispatch({ type: "INDENT_BLOCK", payload: { blockId } });
        setTimeout(() => setCursorPosition(cursorPos), 0);
        return;
      }

      if (e.key === "Tab" && e.shiftKey) {
        e.preventDefault();
        dispatch({ type: "OUTDENT_BLOCK", payload: { blockId } });
        setTimeout(() => setCursorPosition(cursorPos), 0);
        return;
      }

      if (e.key === "ArrowUp" && e.altKey) {
        e.preventDefault();
        dispatch({ type: "MOVE_BLOCK_UP", payload: { blockId } });
        setTimeout(() => setCursorPosition(cursorPos), 0);
        return;
      }

      if (e.key === "ArrowDown" && e.altKey) {
        e.preventDefault();
        dispatch({ type: "MOVE_BLOCK_DOWN", payload: { blockId } });
        setTimeout(() => setCursorPosition(cursorPos), 0);
        return;
      }

      if (e.key === "ArrowUp" && !e.altKey && cursorPos === 0) {
        e.preventDefault();
        const flatBlocks = flattenBlocks(blocks);
        const index = flatBlocks.findIndex((b) => b.id === blockId);
        if (index > 0) {
          const previousBlock = flatBlocks[index - 1];
          setFocusedBlockId(previousBlock.id);
          setCursorPosition(previousBlock.content.length);
        }
        return;
      }

      if (e.key === "ArrowDown" && !e.altKey && cursorPos === content.length) {
        e.preventDefault();
        const flatBlocks = flattenBlocks(blocks);
        const index = flatBlocks.findIndex((b) => b.id === blockId);
        if (index < flatBlocks.length - 1) {
          const nextBlock = flatBlocks[index + 1];
          setFocusedBlockId(nextBlock.id);
          setCursorPosition(0);
        }
        return;
      }
    },
    [blocks],
  );

  const handleContentChange = useCallback(
    (blockId: string, newContent: string) => {
      dispatch({
        type: "UPDATE_BLOCK",
        payload: { blockId, content: newContent },
      });
    },
    [],
  );

  const handleToggleCollapse = useCallback((blockId: string) => {
    dispatch({ type: "TOGGLE_COLLAPSE", payload: { blockId } });
  }, []);

  const currentRoot = useMemo(() => {
    return focusRootId ? findBlockById(blocks, focusRootId) : null;
  }, [blocks, focusRootId]);

  const displayedBlocks = useMemo(() => {
    if (currentRoot) {
      return currentRoot.children;
    }
    return blocks;
  }, [blocks, currentRoot]);

  const breadcrumbPath = useMemo(() => {
    if (!focusRootId) return [];
    const focusedBlock = findBlockById(blocks, focusRootId);
    if (!focusedBlock) return [];
    return getBlockPath(focusedBlock);
  }, [blocks, focusRootId]);

  const breadcrumbItems = useMemo(
    () => [
      <Anchor href="#" onClick={() => setFocusRootId(null)} key="home">
        Home
      </Anchor>,
      ...breadcrumbPath.map((block) => (
        <Anchor
          href="#"
          onClick={() => setFocusRootId(block.id)}
          key={block.id}
        >
          {block.content.substring(0, 20) || "Untitled"}
        </Anchor>
      )),
    ],
    [breadcrumbPath],
  );

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
      const isCollapsed = block.collapsed;
      const hasChildBlocks = hasChildren(block);
      const isFocused = focusedBlockId === block.id;
      const isOnActivePath = activePathIds.has(block.id);

      // Check if this block or any descendant contains the focused block
      const checkFocusWithin = (b: Block): boolean => {
        if (activePathIds.has(b.id)) return true;
        return b.children.some(checkFocusWithin);
      };
      const isFocusWithin = checkFocusWithin(block);

      const effectiveLevel = block.level - (currentRoot?.level ?? 0);

      return (
        <div
          key={block.id}
          className={`block-container ${hasChildBlocks ? "has-children" : ""} ${isFocusWithin ? "focus-within" : ""} ${isOnActivePath ? "on-active-path" : ""}`}
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
                onClick={() => handleToggleCollapse(block.id)}
                aria-label={isCollapsed ? "Expand" : "Collapse"}
              >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path
                    d={isCollapsed ? "M4 2L8 6L4 10" : "M2 4L6 8L10 4"}
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            ) : (
              <div className="block-toggle-placeholder" />
            )}

            <div
              className="block-bullet-container"
              onClick={() => setFocusRootId(block.id)}
            >
              <div className={`block-bullet ${isFocused ? "active" : ""}`} />
            </div>

            <textarea
              ref={(el) => {
                if (el) {
                  inputRefs.current.set(block.id, el);
                } else {
                  inputRefs.current.delete(block.id);
                }
              }}
              className="block-input"
              value={block.content}
              onChange={(e) => handleContentChange(block.id, e.target.value)}
              onKeyDown={(e) => handleKeyDown(e, block.id, block)}
              onFocus={() => setFocusedBlockId(block.id)}
              onClick={(e) => setCursorPosition(e.currentTarget.selectionStart)}
              placeholder={
                block.level === 0 && !currentRoot ? "Start writing..." : ""
              }
              rows={1}
              style={{ height: "auto", minHeight: "24px" }}
              onInput={(e) => {
                const target = e.target as HTMLTextAreaElement;
                target.style.height = "auto";
                target.style.height = `${target.scrollHeight}px`;
              }}
            />
          </div>

          {!isCollapsed && hasChildBlocks && (
            <div
              className={`block-children ${isFocusWithin ? "focus-within" : ""}`}
            >
              {block.children.map((child) =>
                renderBlock(child, [...ancestors, block]),
              )}
            </div>
          )}
        </div>
      );
    },
    [
      focusedBlockId,
      handleContentChange,
      handleKeyDown,
      handleToggleCollapse,
      currentRoot,
      activePathIds,
    ],
  );

  return (
    <>
      <Breadcrumbs className="block-editor-breadcrumbs">
        {breadcrumbItems}
      </Breadcrumbs>
      <div className={`block-editor ${theme}`}>
        <div className="block-editor-content">
          {displayedBlocks.length === 0 ? (
            <div
              className="block-line"
              style={{
                paddingLeft: `${(currentRoot?.level ?? -1) * 24}px`,
              }}
            >
              <div className="block-toggle-placeholder" />
              <div className="block-bullet-container">
                <div className="block-bullet" />
              </div>
              <textarea
                className="block-input"
                value=""
                onChange={(e) => {
                  dispatch({
                    type: "ADD_BLOCK",
                    payload: {
                      level: currentRoot ? currentRoot.level + 1 : 0,
                      afterBlockId: currentRoot?.id,
                    },
                  });
                }}
                placeholder="Start writing..."
                rows={1}
              />
            </div>
          ) : (
            displayedBlocks.map((block) => renderBlock(block, []))
          )}
        </div>

        <div className="block-editor-help">
          <div className="help-item">
            <kbd>Enter</kbd> New block
          </div>
          <div className="help-item">
            <kbd>Tab</kbd> Indent
          </div>
          <div className="help-item">
            <kbd>Shift</kbd>+<kbd>Tab</kbd> Outdent
          </div>
          <div className="help-item">
            <kbd>Alt</kbd>+<kbd>↑</kbd>/<kbd>↓</kbd> Move block
          </div>
          <div className="help-item">
            <kbd>Backspace</kbd> Merge/Delete
          </div>
        </div>
      </div>
    </>
  );
};
