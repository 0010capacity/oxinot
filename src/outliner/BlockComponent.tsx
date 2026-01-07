import React, { memo, useCallback, useRef, useEffect, useMemo } from "react";
import { useMantineColorScheme } from "@mantine/core";
import {
  useBlock,
  useChildrenIds,
  useBlockStore,
  useFocusedBlockId,
} from "../stores/blockStore";
import { useDebouncedBlockUpdate } from "../hooks/useDebouncedBlockUpdate";
import { useViewStore } from "../stores/viewStore";
import { useOutlinerSettingsStore } from "../stores/outlinerSettingsStore";
import { Editor, EditorRef } from "../components/Editor";
import type { KeyBinding } from "@codemirror/view";
import type { EditorView } from "@codemirror/view";
import "./BlockComponent.css";

interface BlockComponentProps {
  blockId: string;
  depth: number;
}

export const BlockComponent: React.FC<BlockComponentProps> = memo(
  function BlockComponent({ blockId, depth }) {
    const { colorScheme } = useMantineColorScheme();
    const isDark = colorScheme === "dark";

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

    const { debouncedUpdate, flushUpdate } = useDebouncedBlockUpdate(blockId);
    const editorRef = useRef<EditorRef>(null);

    // Focus editor when this block becomes focused
    useEffect(() => {
      if (focusedBlockId === blockId && editorRef.current) {
        setTimeout(() => {
          const view = editorRef.current?.getView();
          if (view) {
            view.focus();

            // Set cursor position if specified
            if (targetCursorPosition !== null) {
              const pos = Math.min(targetCursorPosition, view.state.doc.length);
              view.dispatch({
                selection: { anchor: pos, head: pos },
              });
              clearTargetCursorPosition();
            }
          }
        }, 10);
      }
    }, [
      focusedBlockId,
      blockId,
      targetCursorPosition,
      clearTargetCursorPosition,
    ]);

    const handleContentChange = useCallback(
      (content: string) => {
        debouncedUpdate(content);
      },
      [debouncedUpdate],
    );

    const handleFocus = useCallback(() => {
      setFocusedBlock(blockId);
    }, [blockId, setFocusedBlock]);

    const handleBlur = useCallback(() => {
      flushUpdate();
    }, [flushUpdate]);

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
          run: () => {
            flushUpdate();
            createBlock(blockId);
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
            } else if (cursor === 0) {
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
                  flushUpdate();
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
                flushUpdate();

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
                flushUpdate();

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
            flushUpdate();
            indentBlock(blockId);
            return true;
          },
        },
        {
          key: "Shift-Tab",
          preventDefault: true,
          run: () => {
            flushUpdate();
            outdentBlock(blockId);
            return true;
          },
        },
      ];
    }, [
      blockId,
      flushUpdate,
      createBlock,
      deleteBlock,
      indentBlock,
      outdentBlock,
      setFocusedBlock,
    ]);

    if (!block) return null;

    // Render only one indent guide at this block's depth level
    const indentGuide =
      showIndentGuides && depth > 0 ? (
        <div
          className="indent-guide"
          style={{
            left: `${depth * 24 + 14}px`, // Align with collapse toggle center (20px width / 2 + 4px margin)
          }}
        />
      ) : null;

    return (
      <div className="block-component">
        {indentGuide}
        <div className="block-row" style={{ paddingLeft: `${depth * 24}px` }}>
          {/* Collapse/Expand Toggle */}
          {hasChildren ? (
            <button
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
          <div
            className="block-bullet-wrapper"
            onClick={handleBulletClick}
            style={{ cursor: hasChildren ? "pointer" : "default" }}
            title={hasChildren ? "Click to zoom into this block" : undefined}
          >
            <div className="block-bullet" />
          </div>

          {/* Content Editor */}
          <div className="block-content-wrapper">
            <Editor
              ref={editorRef}
              value={block.content}
              onChange={handleContentChange}
              onFocus={handleFocus}
              onBlur={handleBlur}
              lineNumbers={false}
              lineWrapping={true}
              theme={isDark ? "dark" : "light"}
              keybindings={keybindings}
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
      </div>
    );
  },
);
