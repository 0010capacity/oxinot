import type { KeyBinding } from "@codemirror/view";
import type { EditorView } from "@codemirror/view";
import { useComputedColorScheme } from "@mantine/core";
import { IconCopy } from "@tabler/icons-react";
import type React from "react";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Editor, type EditorRef } from "../components/Editor";
import {
  useBlock,
  useBlockStore,
  useChildrenIds,
  useFocusedBlockId,
} from "../stores/blockStore";
import { useOutlinerSettingsStore } from "../stores/outlinerSettingsStore";
// NOTE: We intentionally avoid debounced store writes while typing.
// The editor owns the live draft; we commit on flush points (blur/navigation/etc).
import { useViewStore } from "../stores/viewStore";
import { useDragDropBlock } from "./dragDrop/useDragDropBlock";
import "./BlockComponent.css";

interface BlockComponentProps {
  blockId: string;
  depth: number;
}

export const BlockComponent: React.FC<BlockComponentProps> = memo(
  ({ blockId, depth }: BlockComponentProps) => {
    const computedColorScheme = useComputedColorScheme("light");
    const isDark = computedColorScheme === "dark";

    const block = useBlock(blockId);
    const childIds = useChildrenIds(blockId);
    const hasChildren = childIds.length > 0;
    const focusedBlockId = useFocusedBlockId();
    const showIndentGuides = useOutlinerSettingsStore(
      (state) => state.showIndentGuides,
    );

    const toggleCollapse = useBlockStore((state) => state.toggleCollapse);
    const createBlock = useBlockStore((state) => state.createBlock);
    const deleteBlock = useBlockStore((state) => state.deleteBlock);
    const indentBlock = useBlockStore((state) => state.indentBlock);
    const outdentBlock = useBlockStore((state) => state.outdentBlock);
    const setFocusedBlock = useBlockStore((state) => state.setFocusedBlock);
    const targetCursorPosition = useBlockStore(
      (state) => state.targetCursorPosition,
    );
    const clearTargetCursorPosition = useBlockStore(
      (state) => state.clearTargetCursorPosition,
    );

    const {
      handleDragStart,
      handleDragOver,
      handleDrop,
      handleDragEnd,
      getDragOverClass,
      isDragging,
    } = useDragDropBlock();

    const blockComponentRef = useRef<HTMLDivElement>(null);

    const editorRef = useRef<EditorRef>(null);
    const appliedPositionRef = useRef<number | null>(null);

    // Consolidated IME state
    const imeStateRef = useRef({
      isComposing: false,
      lastInputWasComposition: false, // Track if last beforeinput was composition
      enterPressed: false,
      contentBeforeEnter: "",
      cursorBeforeEnter: 0,
      pendingOperation: null as {
        type: "split" | "create";
        offset?: number;
      } | null,
    });

    // Local draft is the immediate source of truth while editing.
    // This prevents controlled-value "ping-pong" that can break IME composition.
    const [draft, setDraft] = useState<string>(block.content);

    // Keep the latest draft in a ref so callbacks/keybindings can stay stable
    // (otherwise keybindings change every keystroke and the editor view gets recreated).
    const draftRef = useRef<string>(block.content);

    // Keep draft in sync when the underlying block changes (e.g., page load, external update)
    // but do not overwrite while this block is focused (editing session owns the draft).
    useEffect(() => {
      if (focusedBlockId !== blockId) {
        setDraft(block.content);
        draftRef.current = block.content;
      }
    }, [block.content, focusedBlockId, blockId]);

    // Commit helper: stable callback reading from refs (doesn't change every keystroke).
    const commitDraft = useCallback(() => {
      const latestDraft = draftRef.current;
      const latestBlock = useBlockStore.getState().blocksById[blockId];

      // Avoid unnecessary writes; also tolerate missing block during transitions.
      if (latestBlock && latestDraft !== latestBlock.content) {
        useBlockStore.getState().updateBlockContent(blockId, latestDraft);
      }
    }, [blockId]);

    // Focus editor when this block becomes focused
    useEffect(() => {
      if (focusedBlockId === blockId && editorRef.current) {
        const view = editorRef.current?.getView();

        // If already focused and no target position, skip (mouse click already handled)
        if (view?.hasFocus && targetCursorPosition === null) {
          return;
        }

        if (view && !view.hasFocus) {
          // Set cursor position
          let pos: number;
          if (targetCursorPosition !== null) {
            // Use specified position (from keyboard nav)
            pos = Math.min(targetCursorPosition, view.state.doc.length);
            appliedPositionRef.current = targetCursorPosition;
            clearTargetCursorPosition();
          } else {
            // No target position: set cursor to end of content
            pos = view.state.doc.length;
            appliedPositionRef.current = null;
          }

          view.dispatch({
            selection: { anchor: pos, head: pos },
          });

          // Focus the editor
          view.focus();
        } else if (
          view &&
          targetCursorPosition !== null &&
          appliedPositionRef.current !== targetCursorPosition
        ) {
          // Already focused, just adjust cursor position (keyboard nav)
          const pos = Math.min(targetCursorPosition, view.state.doc.length);
          view.dispatch({
            selection: { anchor: pos, head: pos },
          });
          appliedPositionRef.current = targetCursorPosition;
          clearTargetCursorPosition();
        }
      } else if (focusedBlockId !== blockId) {
        // Reset applied position when this block is no longer focused
        appliedPositionRef.current = null;
      }
    }, [
      focusedBlockId,
      blockId,
      targetCursorPosition,
      clearTargetCursorPosition,
    ]);

    // Handle IME composition events: track state and execute pending block operations
    useEffect(() => {
      const view = editorRef.current?.getView();
      if (!view) return;

      const handleCompositionStart = () => {
        imeStateRef.current.isComposing = true;
        imeStateRef.current.lastInputWasComposition = true;
        imeStateRef.current.enterPressed = false;
      };

      const handleCompositionEnd = () => {
        imeStateRef.current.isComposing = false;
        // Keep lastInputWasComposition flag - will be cleared on next non-IME input
      };

      // Track input events to detect IME vs normal input
      const handleBeforeInput = (e: Event) => {
        const inputEvent = e as InputEvent;

        // Set flag based on whether this is composition input
        if (
          inputEvent.inputType === "insertCompositionText" ||
          inputEvent.inputType === "deleteCompositionText"
        ) {
          imeStateRef.current.lastInputWasComposition = true;
        } else if (
          inputEvent.inputType === "insertText" ||
          inputEvent.inputType === "deleteContentBackward"
        ) {
          // Regular text input - clear the IME flag
          imeStateRef.current.lastInputWasComposition = false;
        }
        // insertLineBreak is ignored - we check the flag before it fires
      };

      // Intercept Enter key during or after IME composition at DOM level (capture phase)
      const handleKeyDown = (e: KeyboardEvent) => {
        // Determine if this Enter is IME-related by checking:
        // 1. Active composition (e.g., Japanese IME candidate selection)
        // 2. Last input was composition-based (e.g., Korean IME finished composition)
        const isImeRelated =
          imeStateRef.current.isComposing ||
          imeStateRef.current.lastInputWasComposition;

        if (e.key === "Enter" && !e.shiftKey && isImeRelated) {
          e.preventDefault();
          e.stopPropagation();

          const cursor = view.state.selection.main.head;
          const content = view.state.doc.toString();
          const contentLength = content.length;

          // Save state before block operation
          imeStateRef.current.enterPressed = true;
          imeStateRef.current.contentBeforeEnter = content;
          imeStateRef.current.cursorBeforeEnter = cursor;

          // Clear IME flag - we've processed the IME Enter
          imeStateRef.current.lastInputWasComposition = false;

          // Execute block operation immediately since composition is already done
          commitDraft();

          if (cursor === contentLength) {
            createBlock(blockId);
          } else {
            useBlockStore.getState().splitBlockAtOffset(blockId, cursor);
          }

          // Reset state
          imeStateRef.current.enterPressed = false;
          imeStateRef.current.contentBeforeEnter = "";
          imeStateRef.current.cursorBeforeEnter = 0;

          return false;
        }
      };

      const dom = view.dom;
      dom.addEventListener("compositionstart", handleCompositionStart);
      dom.addEventListener("compositionend", handleCompositionEnd);
      dom.addEventListener("beforeinput", handleBeforeInput);
      dom.addEventListener("keydown", handleKeyDown, { capture: true });

      return () => {
        dom.removeEventListener("compositionstart", handleCompositionStart);
        dom.removeEventListener("compositionend", handleCompositionEnd);
        dom.removeEventListener("beforeinput", handleBeforeInput);
        dom.removeEventListener("keydown", handleKeyDown, { capture: true });
      };
    }, [blockId, createBlock, commitDraft]);

    const handleFocus = useCallback(() => {
      // Reset IME state when focusing a different block
      if (focusedBlockId !== blockId) {
        imeStateRef.current.lastInputWasComposition = false;
        setFocusedBlock(blockId);
      }
    }, [blockId, setFocusedBlock, focusedBlockId]);

    const handleContentChange = useCallback((content: string) => {
      draftRef.current = content;
      setDraft(content);
    }, []);

    const handleBlur = useCallback(() => {
      commitDraft();
      // Clear IME state on blur
      imeStateRef.current.lastInputWasComposition = false;
    }, [commitDraft]);

    const handleCopyBlockId = useCallback(
      async (e: React.MouseEvent) => {
        e.stopPropagation();

        if (!blockId) return;

        try {
          await navigator.clipboard.writeText(blockId);
        } catch {
          // Fallback for environments where Clipboard API isn't available
          try {
            const textarea = document.createElement("textarea");
            textarea.value = blockId;
            textarea.style.position = "fixed";
            textarea.style.left = "-9999px";
            textarea.style.top = "-9999px";
            document.body.appendChild(textarea);
            textarea.focus();
            textarea.select();
            document.execCommand("copy");
            document.body.removeChild(textarea);
          } catch {
            // no-op
          }
        }
      },
      [blockId],
    );

    const handleBulletClick = useCallback(
      (e: React.MouseEvent) => {
        e.stopPropagation();
        if (hasChildren) {
          // Calculate full path from root to this block
          const blocksById = useBlockStore.getState().blocksById;
          const path: string[] = [];
          let currentId: string | null = blockId;

          // Build path from current block to root
          while (currentId) {
            path.unshift(currentId);
            const currentBlock = blocksById[currentId] as
              | typeof block
              | undefined;
            if (!currentBlock) break;
            currentId = currentBlock.parentId || null;
          }

          // Set the full path in view store
          useViewStore.setState({
            focusedBlockId: blockId,
            zoomPath: path,
          });
        } else {
          // Otherwise just focus
          setFocusedBlock(blockId);
          editorRef.current?.focus();
        }
      },
      [blockId, hasChildren, setFocusedBlock],
    );

    // Create custom keybindings for CodeMirror to handle block operations
    const keybindings: KeyBinding[] = useMemo(() => {
      return [
        {
          key: "Enter",
          run: (view: EditorView) => {
            // If Enter was pressed during/after IME composition, skip normal processing
            if (
              imeStateRef.current.isComposing ||
              imeStateRef.current.lastInputWasComposition ||
              imeStateRef.current.enterPressed
            ) {
              return true; // Already handled by keydown capture
            }

            const cursor = view.state.selection.main.head;
            const content = view.state.doc.toString();
            const contentLength = content.length;

            // Check if we're inside a code block
            const beforeCursor = content.slice(0, cursor);

            // Count opening and closing fences before cursor
            const openFencesBeforeCursor = (beforeCursor.match(/^```/gm) || [])
              .length;
            const closeFencesBeforeCursor = (
              beforeCursor.match(/^```$/gm) || []
            ).length;

            // If we have more opening fences than closing fences, we're inside a code block
            const isInsideCodeBlock =
              openFencesBeforeCursor > closeFencesBeforeCursor;

            if (isInsideCodeBlock) {
              // Allow default behavior (insert newline) when inside code block
              return false;
            }

            // Check if we're at the end of a line that starts with ```
            const line = view.state.doc.lineAt(cursor);
            const lineText = line.text;
            const isAtLineEnd = cursor === line.to;
            const isCodeFence = lineText.trim().match(/^```\w*$/);

            if (isCodeFence && isAtLineEnd) {
              // Auto-create code block structure
              const indent = lineText.match(/^\s*/)?.[0] || "";

              view.dispatch({
                changes: {
                  from: line.from,
                  to: line.to,
                  insert: `${lineText}\n${indent}\n${indent}\`\`\``,
                },
                selection: { anchor: line.to + 1 + indent.length },
              });

              return true;
            }

            commitDraft();

            // Determine whether to split block or create new sibling based on cursor position
            if (cursor === contentLength) {
              // Cursor at end: create new sibling block
              createBlock(blockId);
            } else {
              // Cursor in middle: split current block
              useBlockStore.getState().splitBlockAtOffset(blockId, cursor);
            }

            return true; // Prevent default CodeMirror behavior
          },
        },
        {
          key: "Shift-Enter",
          run: () => {
            // Allow default behavior (insert newline)
            return false;
          },
        },
        {
          key: "Backspace",
          run: (view: EditorView) => {
            const content = view.state.doc.toString();
            const cursor = view.state.selection.main.head;

            if (content === "") {
              // Empty block - delete and move to previous
              const prevBlockId = useBlockStore
                .getState()
                .getPreviousBlock(blockId);
              deleteBlock(blockId);
              if (prevBlockId) {
                const prevBlock = useBlockStore
                  .getState()
                  .getBlock(prevBlockId);
                if (prevBlock) {
                  // Move to end of previous block
                  setFocusedBlock(prevBlockId, prevBlock.content.length);
                } else {
                  setFocusedBlock(prevBlockId);
                }
              }
              return true;
            }

            if (cursor === 0) {
              // At start of non-empty block - merge with previous
              const prevBlockId = useBlockStore
                .getState()
                .getPreviousBlock(blockId);
              if (prevBlockId) {
                const prevBlock = useBlockStore
                  .getState()
                  .getBlock(prevBlockId);
                if (prevBlock) {
                  // Merge current content into previous block
                  const prevLength = prevBlock.content.length;
                  const newContent = prevBlock.content + content;
                  commitDraft();
                  useBlockStore
                    .getState()
                    .updateBlockContent(prevBlockId, newContent);
                  deleteBlock(blockId);
                  // Set cursor at the merge point
                  setFocusedBlock(prevBlockId, prevLength);
                  return true;
                }
              }
            }
            return false; // Allow default backspace behavior
          },
        },
        {
          key: "ArrowUp",
          run: (view: EditorView) => {
            const cursor = view.state.selection.main.head;
            const line = view.state.doc.lineAt(cursor);

            // Only navigate if on first line
            if (line.number === 1) {
              const prevBlockId = useBlockStore
                .getState()
                .getPreviousBlock(blockId);
              if (prevBlockId) {
                commitDraft();

                // Calculate column position in current line
                const columnPos = cursor - line.from;

                // Get previous block and calculate target position
                const prevBlock = useBlockStore
                  .getState()
                  .getBlock(prevBlockId);
                if (prevBlock) {
                  const prevContent = prevBlock.content;
                  const lines = prevContent.split("\n");
                  const lastLine = lines[lines.length - 1];

                  // Calculate position: sum of all previous lines + target column
                  let targetPos = 0;
                  for (let i = 0; i < lines.length - 1; i++) {
                    targetPos += lines[i].length + 1; // +1 for newline
                  }
                  targetPos += Math.min(columnPos, lastLine.length);

                  setFocusedBlock(prevBlockId, targetPos);
                } else {
                  setFocusedBlock(prevBlockId);
                }
                return true;
              }
            }
            return false; // Allow default behavior
          },
        },
        {
          key: "ArrowDown",
          run: (view: EditorView) => {
            const cursor = view.state.selection.main.head;
            const line = view.state.doc.lineAt(cursor);
            const lastLine = view.state.doc.lines;

            // Only navigate if on last line
            if (line.number === lastLine) {
              const nextBlockId = useBlockStore
                .getState()
                .getNextBlock(blockId);
              if (nextBlockId) {
                commitDraft();

                // Calculate column position in current line
                const columnPos = cursor - line.from;

                // Get next block and calculate target position
                const nextBlock = useBlockStore
                  .getState()
                  .getBlock(nextBlockId);
                if (nextBlock) {
                  const nextContent = nextBlock.content;
                  const firstLine = nextContent.split("\n")[0];
                  const targetPos = Math.min(columnPos, firstLine.length);

                  setFocusedBlock(nextBlockId, targetPos);
                } else {
                  setFocusedBlock(nextBlockId);
                }
                return true;
              }
            }
            return false; // Allow default behavior
          },
        },
        {
          key: "Tab",
          preventDefault: true,
          run: () => {
            // Preserve current cursor position inside the editor when indenting.
            // Without this, the block re-parenting can cause the cursor to jump to the start.
            const view = editorRef.current?.getView();
            const cursorPos = view?.state.selection.main.head ?? null;

            commitDraft();
            if (cursorPos !== null) {
              setFocusedBlock(blockId, cursorPos);
            }
            indentBlock(blockId);
            return true;
          },
        },
        {
          key: "Shift-Tab",
          preventDefault: true,
          run: () => {
            // Preserve current cursor position inside the editor when outdenting.
            const view = editorRef.current?.getView();
            const cursorPos = view?.state.selection.main.head ?? null;

            commitDraft();
            if (cursorPos !== null) {
              setFocusedBlock(blockId, cursorPos);
            }
            outdentBlock(blockId);
            return true;
          },
        },
      ];
    }, [
      blockId,
      createBlock,
      deleteBlock,
      indentBlock,
      outdentBlock,
      setFocusedBlock,
      commitDraft,
    ]);

    if (!block) return null;

    // Render only one indent guide at this block's depth level
    const indentGuide =
      showIndentGuides && depth > 0 ? (
        <div
          className="indent-guide"
          style={{
            left: `${depth * 24 + 18}px`, // Align with collapse toggle center (20px width / 2 + 4px margin)
          }}
        />
      ) : null;

    return (
      <div
        ref={blockComponentRef}
        className={`block-component ${getDragOverClass(blockId)} ${isDragging && blockId === useBlockStore.getState().blocksById[blockId]?.id ? "dragging-source" : ""}`}
        draggable
        onDragStart={() => handleDragStart(blockId)}
        onDragOver={(e) => {
          const rect = blockComponentRef.current?.getBoundingClientRect();
          if (!rect) return;
          const midpoint = rect.top + rect.height / 2;
          const position: "above" | "below" | "inside" =
            e.clientY < midpoint - 10
              ? "above"
              : e.clientY > midpoint + 10
                ? "below"
                : "inside";
          handleDragOver(e, blockId, position);
        }}
        onDrop={(e) => handleDrop(e, blockId)}
        onDragEnd={handleDragEnd}
      >
        {indentGuide}
        <div className="block-row" style={{ paddingLeft: `${depth * 24}px` }}>
          {/* Collapse/Expand Toggle */}
          {hasChildren ? (
            <button
              type="button"
              className={`collapse-toggle ${block.isCollapsed ? "collapsed" : ""}`}
              onClick={() => toggleCollapse(blockId)}
              aria-label={block.isCollapsed ? "Expand" : "Collapse"}
            >
              {block.isCollapsed ? "▶" : "▼"}
            </button>
          ) : (
            <div className="collapse-toggle-placeholder" />
          )}

          {/* Bullet Point - clickable for zoom */}
          <button
            type="button"
            className="block-bullet-wrapper"
            onClick={handleBulletClick}
            style={{
              cursor: hasChildren ? "pointer" : "default",
              border: "none",
              background: "transparent",
              padding: 0,
            }}
            title={hasChildren ? "Click to zoom into this block" : undefined}
          >
            <div className="block-bullet" />
          </button>

          {/* Content Editor */}
          <div
            className="block-content-wrapper"
            style={{ position: "relative" }}
          >
            <div
              style={{
                position: "absolute",
                right: 6,
                top: 4,
                display: "flex",
                gap: 6,
                opacity: 0.0,
                transition: "opacity 120ms ease",
                pointerEvents: "none",
              }}
              className="block-copy-id-toolbar"
            >
              <button
                type="button"
                onClick={handleCopyBlockId}
                title="Copy block ID"
                style={{
                  pointerEvents: "auto",
                  border: "none",
                  background: "transparent",
                  color: "var(--color-text-tertiary, rgba(127,127,127,0.5))",
                  borderRadius: 4,
                  padding: "2px",
                  fontSize: 12,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <IconCopy size={14} stroke={1.5} />
              </button>
            </div>

            <Editor
              ref={editorRef}
              value={draft}
              onChange={handleContentChange}
              onFocus={handleFocus}
              onBlur={handleBlur}
              lineNumbers={false}
              lineWrapping={true}
              theme={isDark ? "dark" : "light"}
              keybindings={keybindings}
              // FOCUS STATE PROP:
              // -----------------
              // This determines whether markdown markers are visible or hidden
              // focusedBlockId comes from useViewStore and is set when user clicks/focuses a block
              //
              // When true (block has focus):
              //   → shouldShowMarkers = true (via shouldShowMarkersForLine in hybridRendering.ts)
              //   → Markers are visible → Shows raw markdown (e.g., [[link]], # heading)
              //
              // When false (block unfocused):
              //   → shouldShowMarkers = false
              //   → Markers are hidden → Renders formatted content (e.g., link, styled heading)
              isFocused={focusedBlockId === blockId}
              className="block-editor"
              style={{
                minHeight: "24px",
                fontSize: "14px",
              }}
            />
          </div>
        </div>

        {/* Render children recursively if not collapsed */}
        {hasChildren && !block.isCollapsed && (
          <div className="block-children">
            {childIds.map((childId) => (
              <BlockComponent
                key={childId}
                blockId={childId}
                depth={depth + 1}
              />
            ))}
          </div>
        )}

        <style>
          {`
            .block-content-wrapper:hover .block-copy-id-toolbar {
              opacity: 0.6 !important;
            }
            .block-copy-id-toolbar button:hover {
              background: rgba(127, 127, 127, 0.1) !important;
              color: var(--color-text-secondary, rgba(127,127,127,0.8)) !important;
            }
          `}
        </style>
      </div>
    );
  },
);
