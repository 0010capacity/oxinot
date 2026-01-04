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
  findBlockById,
  generateBlockId,
  blocksToMarkdown,
} from "./blockUtils";
import { parseMarkdownToBlocks } from "./blockUtils";
import { Breadcrumbs, Anchor } from "@mantine/core";
import "./BlockEditor.css";
import {
  renderOutlinerBulletPreviewHtml,
  renderOutlinerBracePreviewHtml,
} from "./markdownRenderer";

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

    // Parse initial content with brace-block support (brace blocks can contain newlines).
    // Keeping this in `blockUtils` ensures parse/export stay consistent.
    return parseMarkdownToBlocks(initialContent);
  });

  const [focusedBlockId, setFocusedBlockId] = useState<string | null>(() => {
    const firstBlock = blocks[0];
    return firstBlock ? firstBlock.id : null;
  });
  const [focusRootId, setFocusRootId] = useState<string | null>(null);

  const [cursorPosition, setCursorPosition] = useState<number>(0);
  const inputRefs = useRef<Map<string, HTMLTextAreaElement>>(new Map());
  const isFirstRender = useRef(true);

  // Used to focus the *newly created* block after Enter split/add.
  // We must not rely on stale `blocks` captured in event handlers.
  const pendingFocusNextFromBlockIdRef = useRef<string | null>(null);

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
    console.log("[BlockEditor useEffect] blocks changed", {
      blockCount: blocks.length,
      focusedBlockId,
      pendingFocusNext: pendingFocusNextFromBlockIdRef.current,
    });

    if (!focusedBlockId) return;

    // If we have a pending "focus the next block after X", resolve it now
    // using the *current* blocks state (fresh after reducer update).
    if (pendingFocusNextFromBlockIdRef.current) {
      const fromId = pendingFocusNextFromBlockIdRef.current;
      pendingFocusNextFromBlockIdRef.current = null;

      console.log("[BlockEditor useEffect] Focusing next block after", {
        fromId,
      });

      const flat = flattenBlocks(blocks);
      const idx = flat.findIndex((b) => b.id === fromId);
      const next = idx >= 0 ? flat[idx + 1] : null;

      console.log("[BlockEditor useEffect] Next block found", {
        idx,
        nextId: next?.id,
      });

      if (next) {
        setFocusedBlockId(next.id);
        setCursorPosition(0);
        return;
      }
    }

    const input = inputRefs.current.get(focusedBlockId);
    if (input) {
      input.focus();
      input.setSelectionRange(cursorPosition, cursorPosition);
    }
  }, [blocks, focusedBlockId, cursorPosition]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>, blockId: string, block: Block) => {
      const target = e.target as HTMLTextAreaElement;
      const cursorPos = target.selectionStart;
      const content = target.value;

      if (e.key === "Enter") {
        console.log("[handleKeyDown] Enter pressed", {
          blockId,
          cursorPos,
          contentLength: content.length,
          isAtEnd: cursorPos === content.length,
          blockKind: block.kind,
        });
      }

      // Brace blocks: Enter should behave like a normal document (insert newline inside the block),
      // not "create/split blocks". Shift+Enter is not required here.
      if (e.key === "Enter" && block.kind === "brace" && !e.shiftKey) {
        e.preventDefault();

        const before = content.slice(0, cursorPos);
        const after = content.slice(cursorPos);
        const nextContent = `${before}\n${after}`;

        dispatch({
          type: "UPDATE_BLOCK",
          payload: { blockId, content: nextContent },
        });

        requestAnimationFrame(() => {
          setFocusedBlockId(blockId);
          setCursorPosition(cursorPos + 1);
        });

        return;
      }

      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();

        console.log("[handleKeyDown] Enter key action", {
          blockId,
          cursorPos,
          contentLength: content.length,
          isAtEnd: cursorPos === content.length,
          actionType:
            cursorPos === content.length ? "ADD_BLOCK" : "SPLIT_BLOCK",
        });

        // IMPORTANT:
        // - `blocks` in this key handler is stale after dispatch.
        // - Do NOT try to compute/focus the next block using `blocks` here.
        // Instead, record intent and resolve it in a `[blocks]` effect.
        pendingFocusNextFromBlockIdRef.current = blockId;

        if (cursorPos === content.length) {
          console.log("[handleKeyDown] Dispatching ADD_BLOCK");
          const newBlockId = generateBlockId();
          // If parent block has children, new block should be a child (level + 1)
          // Otherwise, new block should be a sibling (same level)
          const newLevel =
            block.children.length > 0 ? block.level + 1 : block.level;
          dispatch({
            type: "ADD_BLOCK",
            payload: { afterBlockId: blockId, level: newLevel, newBlockId },
          });
        } else {
          console.log("[handleKeyDown] Dispatching SPLIT_BLOCK");
          const newBlockId = generateBlockId();
          dispatch({
            type: "SPLIT_BLOCK",
            payload: { blockId, offset: cursorPos, newBlockId },
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
      // Auto-convert: if a bullet block's entire content becomes "{", convert it into a brace block.
      const flat = flattenBlocks(blocks);
      const current = flat.find((b) => b.id === blockId);
      if (current && current.kind !== "brace" && newContent.trim() === "{") {
        current.kind = "brace";
        current.braceState = "open";
        dispatch({
          type: "UPDATE_BLOCK",
          payload: { blockId, content: "" },
        });
        setTimeout(() => {
          setFocusedBlockId(blockId);
          setCursorPosition(0);
        }, 0);
        return;
      }

      dispatch({
        type: "UPDATE_BLOCK",
        payload: { blockId, content: newContent },
      });
    },
    [blocks],
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
              className={`block-bullet-container ${
                block.kind === "brace" ? "brace" : ""
              }`}
              onClick={() => setFocusRootId(block.id)}
              title={block.kind === "brace" ? "Brace block" : undefined}
            >
              <div
                className={`block-bullet ${isFocused ? "active" : ""} ${
                  block.kind === "brace" ? "brace" : ""
                }`}
              />
            </div>

            <div
              className="block-input-wrap"
              onMouseDown={() => {
                // Ensure the overlay textarea always receives focus/caret when clicking anywhere
                // on the rendered preview area.
                setFocusedBlockId(block.id);
              }}
            >
              <div
                className="block-preview"
                role="textbox"
                aria-readonly="true"
                tabIndex={-1}
                dangerouslySetInnerHTML={{
                  __html:
                    block.kind === "brace"
                      ? renderOutlinerBracePreviewHtml(block.content)
                      : renderOutlinerBulletPreviewHtml(block.content),
                }}
              />
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
                onClick={(e) =>
                  setCursorPosition(e.currentTarget.selectionStart)
                }
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

  // Generate debug JSON
  const debugJson = useMemo(() => {
    const serializeBlock = (block: Block): any => ({
      id: block.id.substring(0, 8),
      content: block.content.substring(0, 50),
      level: block.level,
      children: block.children.map(serializeBlock),
    });
    return JSON.stringify(blocks.map(serializeBlock), null, 2);
  }, [blocks]);

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
              <div
                className="block-input-wrap"
                onMouseDown={() => {
                  dispatch({
                    type: "ADD_BLOCK",
                    payload: {
                      level: currentRoot ? currentRoot.level + 1 : 0,
                      afterBlockId: currentRoot?.id,
                    },
                  });
                }}
              >
                <div className="block-preview" aria-hidden="true" />
                <textarea
                  className="block-input"
                  value=""
                  onChange={() => {
                    // no-op: this placeholder textarea is never meant to hold user input.
                    // A real block will be created on mouse down above.
                  }}
                  placeholder="Start writing..."
                  rows={1}
                />
              </div>
            </div>
          ) : (
            displayedBlocks.map((block) => renderBlock(block, []))
          )}
        </div>

        <div className="block-editor-debug">
          <div className="block-editor-debug-title">📝 Markdown Source</div>
          <div className="block-editor-debug-content">
            {blocksToMarkdown(blocks)}
          </div>
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
