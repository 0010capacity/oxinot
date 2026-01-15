import type { KeyBinding } from "@codemirror/view";
import type { EditorView } from "@codemirror/view";
import {
  Badge,
  Box,
  Popover,
  Table,
  Tooltip,
  useComputedColorScheme,
} from "@mantine/core";
import { IconCopy } from "@tabler/icons-react";
import type React from "react";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Editor, type EditorRef } from "../components/Editor";
import { MetadataEditor } from "../components/MetadataEditor";
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
      (state) => state.showIndentGuides
    );

    const toggleCollapse = useBlockStore((state) => state.toggleCollapse);
    const createBlock = useBlockStore((state) => state.createBlock);
    const indentBlock = useBlockStore((state) => state.indentBlock);
    const outdentBlock = useBlockStore((state) => state.outdentBlock);
    const mergeWithPrevious = useBlockStore((state) => state.mergeWithPrevious);
    const splitBlockAtCursor = useBlockStore(
      (state) => state.splitBlockAtCursor
    );
    const setFocusedBlock = useBlockStore((state) => state.setFocusedBlock);
    const targetCursorPosition = useBlockStore(
      (state) => state.targetCursorPosition
    );
    const clearTargetCursorPosition = useBlockStore(
      (state) => state.clearTargetCursorPosition
    );

    const blockComponentRef = useRef<HTMLDivElement>(null);

    const editorRef = useRef<EditorRef>(null);
    const appliedPositionRef = useRef<number | null>(null);
    const popoverDropdownRef = useRef<HTMLDivElement>(null);

    // Local metadata editing state
    const [isMetadataOpen, setIsMetadataOpen] = useState(false);
    const metadataCloseTimeoutRef = useRef<ReturnType<
      typeof setTimeout
    > | null>(null);

    // Log isMetadataOpen changes
    useEffect(() => {
      console.log("isMetadataOpen changed:", isMetadataOpen, { blockId });
    }, [isMetadataOpen, blockId]);

    // Cleanup timeout on unmount
    useEffect(() => {
      return () => {
        if (metadataCloseTimeoutRef.current) {
          clearTimeout(metadataCloseTimeoutRef.current);
        }
      };
    }, []);

    // Handle outside clicks to close metadata editor
    useEffect(() => {
      if (!isMetadataOpen) return;

      const handleDocumentClick = (event: MouseEvent) => {
        const target = event.target as Node;

        // Check if click is outside the block component
        if (
          blockComponentRef.current &&
          !blockComponentRef.current.contains(target)
        ) {
          console.log("Outside click detected, closing metadata");
          setIsMetadataOpen(false);
        }
      };

      document.addEventListener("click", handleDocumentClick);
      return () => {
        document.removeEventListener("click", handleDocumentClick);
      };
    }, [isMetadataOpen]);

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
    // but do not overwrite while this block is focused (editing session owns the draft),
    // UNLESS we are navigating to this block programmatically (targetCursorPosition is set),
    // which implies a structural change (merge/split/move) where store is authoritative.
    useEffect(() => {
      const isProgrammaticNav = targetCursorPosition !== null;

      if (focusedBlockId !== blockId || isProgrammaticNav) {
        // Only update if content is actually different to prevent unnecessary renders
        if (block.content !== draftRef.current) {
          setDraft(block.content);
          draftRef.current = block.content;
        }
      }
    }, [block.content, focusedBlockId, blockId, targetCursorPosition]);

    // Commit helper: stable callback reading from refs (doesn't change every keystroke).
    const commitDraft = useCallback(async () => {
      const latestDraft = draftRef.current;
      const latestBlock = useBlockStore.getState().blocksById[blockId];

      // Avoid unnecessary writes; also tolerate missing block during transitions.
      if (latestBlock && latestDraft !== latestBlock.content) {
        await useBlockStore.getState().updateBlockContent(blockId, latestDraft);
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
          // For split, we pass the content directly to the store action to ensure atomic update
          // For create (at end), we trigger save but can proceed with creation independently

          if (cursor === contentLength) {
            commitDraft();
            createBlock(blockId);
          } else {
            // Pass current content to ensure split happens on the correct text
            splitBlockAtCursor(blockId, cursor, content);
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
    }, [blockId, createBlock, commitDraft, splitBlockAtCursor]);

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

    const handleBlur = useCallback(async () => {
      // If metadata editor is open, don't close it or commit
      // The metadata editor will handle its own lifecycle via onClose
      if (isMetadataOpen) {
        console.log("handleBlur: metadata editor is open, ignoring blur");
        return;
      }

      // Normal blur handling (metadata editor is not open)
      await commitDraft();

      // Clear IME state on blur
      imeStateRef.current.lastInputWasComposition = false;
    }, [commitDraft, isMetadataOpen]);

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
      [blockId]
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
      [blockId, hasChildren, setFocusedBlock]
    );

    // Create custom keybindings for CodeMirror to handle block operations
    const handleContentChangeWithTrigger = useCallback(
      (value: string) => {
        // Trigger for metadata modal: "::"
        if (value.endsWith("::")) {
          console.log("Metadata trigger detected:", { value, blockId });
          const newValue = value.slice(0, -2);
          draftRef.current = newValue;
          setDraft(newValue);
          console.log("Setting isMetadataOpen to true");
          setIsMetadataOpen(true);
          return;
        }
        handleContentChange(value);
      },
      [handleContentChange]
    );

    const keybindings: KeyBinding[] = useMemo(() => {
      return [
        {
          key: "Mod-Shift-m",
          run: () => {
            setIsMetadataOpen(true);
            return true;
          },
        },
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

            // Start async operations but return true immediately to prevent default behavior
            // Determine whether to split block or create new sibling based on cursor position
            if (cursor === contentLength) {
              // Cursor at end: create new sibling block
              // Commit current block changes first
              commitDraft();
              createBlock(blockId);
            } else {
              // Cursor in middle: split current block
              // Pass content explicitly to avoid race conditions with store state
              splitBlockAtCursor(blockId, cursor, content);
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

            if (cursor === 0) {
              // At start of block (empty or not)
              // Delegate to store action which handles:
              // 1. If empty -> delete and move to previous
              // 2. If content -> merge with previous
              // 3. If no previous -> no-op
              mergeWithPrevious(blockId, content);
              return true;
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

            // Start async operations but return true immediately to prevent default behavior
            commitDraft().then(() => {
              indentBlock(blockId).then(() => {
                if (cursorPos !== null) {
                  setFocusedBlock(blockId, cursorPos);
                }
              });
            });
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

            // Start async operations but return true immediately to prevent default behavior
            commitDraft().then(() => {
              outdentBlock(blockId).then(() => {
                if (cursorPos !== null) {
                  setFocusedBlock(blockId, cursorPos);
                }
              });
            });
            return true;
          },
        },
      ];
    }, [
      blockId,
      createBlock,
      setFocusedBlock,
      indentBlock,
      outdentBlock,
      commitDraft,
      mergeWithPrevious,
      splitBlockAtCursor,
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
        className="block-component"
        onClick={(e) => {
          console.log("blockComponent clicked");
          e.stopPropagation();
        }}
      >
        {indentGuide}
        <div className="block-row" style={{ paddingLeft: `${depth * 24}px` }}>
          {/* Collapse/Expand Toggle */}
          {hasChildren ? (
            <button
              type="button"
              className={`collapse-toggle ${
                block.isCollapsed ? "collapsed" : ""
              }`}
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

            <Popover
              opened={isMetadataOpen}
              onClose={() => {
                console.log("Popover onClose called");
                setIsMetadataOpen(false);
              }}
              position="bottom"
              withArrow
              shadow="md"
              trapFocus={false}
              closeOnEscape
              closeOnClickOutside
              withinPortal={true}
              transitionProps={{ duration: 0 }}
            >
              <Popover.Target>
                <Box style={{ width: "100%" }}>
                  <Editor
                    ref={editorRef}
                    value={draft}
                    onChange={handleContentChangeWithTrigger}
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
                </Box>
              </Popover.Target>
              <Popover.Dropdown
                p={0}
                ref={popoverDropdownRef}
                style={{ minWidth: "300px" }}
                onClick={(e) => {
                  console.log("Popover.Dropdown clicked, stopping propagation");
                  e.stopPropagation();
                }}
              >
                <MetadataEditor
                  blockId={blockId}
                  onClose={() => {
                    console.log("MetadataEditor onClose called");
                    setIsMetadataOpen(false);
                    // Return focus to editor after metadata is saved
                    setTimeout(() => {
                      console.log("Returning focus to editor");
                      editorRef.current?.focus();
                    }, 0);
                  }}
                />
              </Popover.Dropdown>
            </Popover>

            {/* Metadata Badge - small indicator with tooltip */}
            {block.metadata && Object.keys(block.metadata).length > 0 && (
              <Box mt={2}>
                <Tooltip
                  label={
                    <Table
                      verticalSpacing={2}
                      horizontalSpacing="xs"
                      style={{ fontSize: "12px", color: "inherit" }}
                    >
                      <Table.Tbody>
                        {Object.entries(block.metadata).map(([k, v]) => (
                          <Table.Tr key={k}>
                            <Table.Td
                              style={{
                                fontWeight: 600,
                                paddingRight: 8,
                                opacity: 0.7,
                                borderBottom: "none",
                              }}
                            >
                              {k}:
                            </Table.Td>
                            <Table.Td style={{ borderBottom: "none" }}>
                              {v}
                            </Table.Td>
                          </Table.Tr>
                        ))}
                      </Table.Tbody>
                    </Table>
                  }
                  position="bottom-start"
                  openDelay={300}
                  color={isDark ? "dark" : "gray"}
                  withArrow
                >
                  <Badge
                    size="xs"
                    variant="dot"
                    color="gray"
                    style={{
                      cursor: "pointer",
                      textTransform: "none",
                      paddingLeft: 0,
                      background: "transparent",
                      border: "none",
                      fontWeight: 400,
                      opacity: 0.6,
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsMetadataOpen(true);
                    }}
                  >
                    {Object.keys(block.metadata).length} properties
                  </Badge>
                </Tooltip>
              </Box>
            )}
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
  }
);
