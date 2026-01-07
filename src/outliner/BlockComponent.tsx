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
    const blocksById = useBlockStore((state) => state.blocksById);

    // Check if this block is on the focus path
    const isOnFocusPath = useMemo(() => {
      if (!focusedBlockId) return false;
      if (blockId === focusedBlockId) return true;

      // Check if focusedBlock is a descendant of this block
      let currentId: string | null = focusedBlockId;
      while (currentId) {
        if (currentId === blockId) return true;
        const currentBlock = blocksById[currentId] as typeof block | undefined;
        if (!currentBlock) break;
        currentId = currentBlock.parentId || null;
      }
      return false;
    }, [focusedBlockId, blockId, blocksById]);

    const toggleCollapse = useBlockStore((state) => state.toggleCollapse);
    const createBlock = useBlockStore((state) => state.createBlock);
    const deleteBlock = useBlockStore((state) => state.deleteBlock);
    const indentBlock = useBlockStore((state) => state.indentBlock);
    const outdentBlock = useBlockStore((state) => state.outdentBlock);
    const setFocusedBlock = useBlockStore((state) => state.setFocusedBlock);

    const { debouncedUpdate, flushUpdate } = useDebouncedBlockUpdate(blockId);
    const editorRef = useRef<EditorRef>(null);

    // Focus editor when this block becomes focused
    useEffect(() => {
      if (focusedBlockId === blockId && editorRef.current) {
        // Small delay to ensure DOM is ready
        setTimeout(() => {
          editorRef.current?.focus();
        }, 10);
      }
    }, [focusedBlockId, blockId]);

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
            if (content === "") {
              deleteBlock(blockId);
              return true; // Prevent default
            }
            return false; // Allow default backspace behavior
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
    ]);

    if (!block) return null;

    return (
      <div
        className={`block-component ${isOnFocusPath ? "on-focus-path" : ""}`}
      >
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
