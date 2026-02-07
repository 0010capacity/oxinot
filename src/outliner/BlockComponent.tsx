import type { KeyBinding } from "@codemirror/view";
import type { EditorView } from "@codemirror/view";
import { Box, Popover, useComputedColorScheme } from "@mantine/core";

import {
  IconCopy,
  IconIndentDecrease,
  IconIndentIncrease,
  IconTrash,
} from "@tabler/icons-react";
import type React from "react";
import {
  memo,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useTranslation } from "react-i18next";
import { Editor, type EditorRef } from "../components/Editor";
import { MetadataBadges } from "../components/MetadataBadge";
import { MetadataEditor } from "../components/MetadataEditor";
import {
  ContextMenu,
  type ContextMenuSection,
} from "../components/common/ContextMenu";
import {
  type BlockData,
  useBlockContent,
  useBlockIsCollapsed,
  useBlockMetadata,
  useBlockStore,
  useChildrenIds,
} from "../stores/blockStore";
import { useTargetCursorPosition } from "../stores/blockUIStore";
import { useBlockUIStore } from "../stores/blockUIStore";
import { useOutlinerSettingsStore } from "../stores/outlinerSettingsStore";
import { useIsBlockFocused } from "../stores/viewStore";
// NOTE: We intentionally avoid debounced store writes while typing.
// The editor owns the live draft; we commit on flush points (blur/navigation/etc).
import { useViewStore } from "../stores/viewStore";
import * as batchOps from "../utils/batchBlockOperations";
import { showToast } from "../utils/toast";
import { DeleteConfirmModal } from "./DeleteConfirmModal";
import { MacroContentWrapper } from "./MacroContentWrapper";
import { editorStateCache } from "./editorStateCache";
import "./BlockComponent.css";
import { INDENT_PER_LEVEL } from "../constants/layout";
import { useIsBlockSelected } from "../hooks/useBlockSelection";
import { BlockOrderContext } from "./BlockEditor";
import {
  calculateNextBlockCursorPosition,
  calculatePrevBlockCursorPosition,
} from "./cursorPositionUtils";

interface BlockComponentProps {
  blockId: string;
  depth: number;
}

export const BlockComponent: React.FC<BlockComponentProps> = memo(
  ({ blockId, depth }: BlockComponentProps) => {
    const blockOrder = useContext(BlockOrderContext);
    const computedColorScheme = useComputedColorScheme("light");
    const isDark = computedColorScheme === "dark";

    const blockContent = useBlockContent(blockId);
    const isCollapsed = useBlockIsCollapsed(blockId);
    const childrenIds = useChildrenIds(blockId);
    const hasChildren = childrenIds.length > 0;
    const blockMetadata = useBlockMetadata(blockId);
    const isFocused = useIsBlockFocused(blockId);
    const showIndentGuides = useOutlinerSettingsStore(
      (state) => state.showIndentGuides,
    );

    const toggleCollapse = useBlockStore((state) => state.toggleCollapse);
    const createBlock = useBlockStore((state) => state.createBlock);
    const indentBlock = useBlockStore((state) => state.indentBlock);
    const outdentBlock = useBlockStore((state) => state.outdentBlock);
    const mergeWithPrevious = useBlockStore((state) => state.mergeWithPrevious);
    const splitBlockAtCursor = useBlockStore(
      (state) => state.splitBlockAtCursor,
    );
    const deleteBlock = useBlockStore((state) => state.deleteBlock);
    const targetCursorPosition = useTargetCursorPosition();
    const setFocusedBlock = useBlockUIStore((state) => state.setFocusedBlock);
    const clearTargetCursorPosition = useBlockUIStore(
      (state) => state.clearTargetCursorPosition,
    );
    const toggleBlockSelection = useBlockUIStore(
      (state) => state.toggleBlockSelection,
    );
    const selectBlockRange = useBlockUIStore((state) => state.selectBlockRange);
    const lastSelectedBlockId = useBlockUIStore(
      (state) => state.lastSelectedBlockId,
    );
    const isSelected = useIsBlockSelected(blockId);

    const { t } = useTranslation();

    const blockComponentRef = useRef<HTMLDivElement>(null);
    const blockRowRef = useRef<HTMLDivElement>(null);
    const scrollContainerRef = useRef<HTMLElement | null>(null);

    const editorRef = useRef<EditorRef>(null);
    const appliedPositionRef = useRef<number | null>(null);
    const popoverDropdownRef = useRef<HTMLDivElement>(null);

    const [isMetadataOpen, setIsMetadataOpen] = useState(false);
    const metadataCloseTimeoutRef = useRef<ReturnType<
      typeof setTimeout
    > | null>(null);

    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [blocksToDelete, setBlocksToDelete] = useState<string[]>([]);

    const copyBlocksAsMarkdown = useCallback(() => {
      const currentSelectedIds = useBlockUIStore.getState().selectedBlockIds;
      const targetBlocks =
        currentSelectedIds.length > 0 ? currentSelectedIds : [blockId];

      const orderedBlocks = blockOrder.filter((id) =>
        targetBlocks.includes(id),
      );

      const blocksById = useBlockStore.getState().blocksById;

      const markdown = orderedBlocks
        .map((id) => {
          const blk = blocksById[id];
          if (!blk) return "";

          let depth = 0;
          let currentId: string | null = id;

          while (currentId) {
            const currentBlock = blocksById[currentId] as BlockData | undefined;
            if (!currentBlock?.parentId) break;
            depth++;
            currentId = currentBlock.parentId;
          }

          const indent = "  ".repeat(depth);

          return `${indent}- ${blk.content}`;
        })
        .filter((line) => line.length > 0)
        .join("\n");

      navigator.clipboard.writeText(markdown);

      const count = orderedBlocks.length;
      showToast({
        message:
          count > 1
            ? `Copied ${count} blocks to clipboard`
            : "Copied to clipboard",
        type: "success",
      });

      if (currentSelectedIds.length > 0) {
        useBlockUIStore.getState().clearSelectedBlocks();
        useBlockUIStore.getState().clearSelectionAnchor();
      }
    }, [blockOrder, blockId]);

    const countDescendantBlocks = useCallback((blockId: string): number => {
      const childrenMap = useBlockStore.getState().childrenMap;
      let count = 0;
      const queue: string[] = [blockId];

      while (queue.length > 0) {
        const currentId = queue.shift();
        if (currentId === undefined) break;
        const children = childrenMap[currentId] || [];
        count += children.length;
        queue.push(...children);
      }

      return count;
    }, []);

    const contextMenuSections: ContextMenuSection[] = useMemo(() => {
      const currentSelectedIds = useBlockUIStore.getState().selectedBlockIds;
      const currentIsSelected = currentSelectedIds.includes(blockId);

      const targetBlocks =
        currentIsSelected && currentSelectedIds.length > 0
          ? currentSelectedIds
          : [blockId];
      const isBatchOperation = targetBlocks.length > 1;

      return [
        {
          items: [
            {
              label: isBatchOperation
                ? `${t("common.indent") || "Indent"} (${targetBlocks.length})`
                : t("common.indent") || "Indent",
              icon: <IconIndentIncrease size={16} />,
              onClick: async () => {
                for (const id of targetBlocks) {
                  await indentBlock(id);
                }
                if (isBatchOperation) {
                  useBlockUIStore.getState().clearSelectedBlocks();
                }
              },
              disabled: !batchOps.canIndentBlocks(targetBlocks),
            },
            {
              label: isBatchOperation
                ? `${t("common.outdent")} (${targetBlocks.length})`
                : t("common.outdent"),
              icon: <IconIndentDecrease size={16} />,
              onClick: async () => {
                for (const id of targetBlocks) {
                  await outdentBlock(id);
                }
                if (isBatchOperation) {
                  useBlockUIStore.getState().clearSelectedBlocks();
                }
              },
              disabled: !batchOps.canOutdentBlocks(targetBlocks),
            },
            {
              label: isBatchOperation
                ? `${t("common.duplicate")} (${targetBlocks.length})`
                : t("common.duplicate"),
              icon: <IconCopy size={16} />,
              onClick: async () => {
                for (const id of targetBlocks) {
                  await createBlock(id);
                }
                if (isBatchOperation) {
                  useBlockUIStore.getState().clearSelectedBlocks();
                }
              },
            },
            {
              label: isBatchOperation
                ? `${t("common.delete") || "Delete"} (${targetBlocks.length})`
                : t("common.delete") || "Delete",
              icon: <IconTrash size={16} />,
              color: "red",
              onClick: () => {
                setBlocksToDelete(targetBlocks);
                setShowDeleteConfirm(true);
              },
            },
          ],
        },
        {
          items: [
            {
              label: isBatchOperation
                ? `${t("common.context_menu.copy_content")} (${
                    targetBlocks.length
                  })`
                : t("common.context_menu.copy_content"),
              onClick: copyBlocksAsMarkdown,
            },
            {
              label: t("common.context_menu.copy_id"),
              onClick: () => {
                navigator.clipboard.writeText(blockId);
              },
            },
            {
              label: t("common.context_menu.edit_metadata"),
              onClick: () => {
                setIsMetadataOpen(true);
              },
            },
          ],
        },
      ];
    }, [
      t,
      blockId,
      indentBlock,
      outdentBlock,
      createBlock,
      copyBlocksAsMarkdown,
    ]);

    // Ref to store text selection for context menu
    const savedTextSelectionRef = useRef<string>("");

    // Text selection context menu
    const textSelectionSections: ContextMenuSection[] = useMemo(
      () => [
        {
          items: [
            {
              label: t("common.context_menu.copy"),
              onClick: () => {
                const selectedText = savedTextSelectionRef.current;
                if (selectedText) {
                  navigator.clipboard.writeText(selectedText);
                  showToast({
                    message: "Copied to clipboard",
                    type: "success",
                  });
                }
              },
            },
            {
              label: t("common.context_menu.cut"),
              onClick: async () => {
                const selectedText = savedTextSelectionRef.current;
                if (selectedText && editorRef.current) {
                  await navigator.clipboard.writeText(selectedText);
                  // Delete selected text by replacing with empty string
                  const view = editorRef.current.getView();
                  if (view) {
                    const { from, to } = view.state.selection.main;
                    view.dispatch({
                      changes: { from, to, insert: "" },
                      selection: { anchor: from },
                    });
                  }
                  showToast({
                    message: "Cut to clipboard",
                    type: "success",
                  });
                }
              },
            },
          ],
        },
      ],
      [t],
    );

    // Cleanup timeout on unmount
    useEffect(() => {
      return () => {
        if (metadataCloseTimeoutRef.current) {
          clearTimeout(metadataCloseTimeoutRef.current);
        }
      };
    }, []);

    // Cache scroll container on mount to avoid repeated DOM traversal during scroll operations
    // This runs once per block and significantly improves performance for deeply nested structures
    useEffect(() => {
      if (scrollContainerRef.current || !blockRowRef.current) {
        return;
      }

      let element: HTMLElement | null = blockRowRef.current;
      while (element && element !== document.documentElement) {
        const computed = window.getComputedStyle(element);
        if (computed.overflowY === "auto" || computed.overflowY === "scroll") {
          scrollContainerRef.current = element;
          break;
        }
        element = element.parentElement;
      }
    }, []);

    // Auto-scroll the focused block into view when focused
    // Positions block at ~40% from top of viewport for better readability
    useEffect(() => {
      if (!isFocused || !blockRowRef.current) {
        return;
      }

      // Use cached scroll container to avoid expensive DOM traversal
      const scrollContainer = scrollContainerRef.current;

      if (scrollContainer && blockRowRef.current) {
        // Calculate scroll position to place block at 40% from viewport top
        const blockRect = blockRowRef.current.getBoundingClientRect();
        const containerRect = scrollContainer.getBoundingClientRect();
        const targetScrollTop =
          scrollContainer.scrollTop +
          blockRect.top -
          containerRect.top -
          containerRect.height * 0.4;

        scrollContainer.scrollTo({
          top: targetScrollTop,
          behavior: "smooth",
        });
      } else if (blockRowRef.current) {
        // Fallback: use scrollIntoView for window-level scrolling
        blockRowRef.current.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      }
    }, [isFocused]);

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
          setIsMetadataOpen(false);
        }
      };

      document.addEventListener("click", handleDocumentClick);
      return () => {
        document.removeEventListener("click", handleDocumentClick);
      };
    }, [isMetadataOpen]);

    // Handle keyboard shortcuts (Ctrl+C for copy)
    useEffect(() => {
      if (!isFocused) return;

      const handleCopy = (event: KeyboardEvent) => {
        // Ctrl+C or Cmd+C
        if ((event.ctrlKey || event.metaKey) && event.key === "c") {
          const { selectedBlockIds } = useBlockUIStore.getState();
          // Only handle if blocks are selected (let browser handle text selection)
          if (selectedBlockIds.length > 0) {
            event.preventDefault();
            event.stopPropagation();
            copyBlocksAsMarkdown();
          }
        }
      };

      document.addEventListener("keydown", handleCopy, true);
      return () => {
        document.removeEventListener("keydown", handleCopy, true);
      };
    }, [isFocused, copyBlocksAsMarkdown]);

    // Handle Shift+Arrow key selection when this block is focused
    useEffect(() => {
      if (!isFocused) return;

      const handleKeyDown = (event: KeyboardEvent) => {
        // Clear selection and anchor if navigating without Shift
        if (
          !event.shiftKey &&
          (event.key === "ArrowUp" || event.key === "ArrowDown")
        ) {
          useBlockUIStore.getState().clearSelectionAnchor();
          useBlockUIStore.getState().clearSelectedBlocks();
          return;
        }

        if (!event.shiftKey) return;

        const state = useBlockUIStore.getState();

        // Set anchor on first Shift+Arrow if not already set
        if (!state.selectionAnchorId) {
          useBlockUIStore.setState({ selectionAnchorId: blockId });
        }

        const anchorId = state.selectionAnchorId || blockId;

        if (event.key === "ArrowUp") {
          event.preventDefault();
          event.stopPropagation();
          // Use blockOrder for cross-depth navigation
          const currentIndex = blockOrder.indexOf(blockId);
          if (currentIndex > 0) {
            const prevBlockId = blockOrder[currentIndex - 1];
            // Extend selection from fixed anchor to the new block
            selectBlockRange(anchorId, prevBlockId, blockOrder);
            // Update focus to the new block so further arrow keys continue from there
            setFocusedBlock(prevBlockId);
          }
        } else if (event.key === "ArrowDown") {
          event.preventDefault();
          event.stopPropagation();
          // Use blockOrder for cross-depth navigation
          const currentIndex = blockOrder.indexOf(blockId);
          if (currentIndex >= 0 && currentIndex < blockOrder.length - 1) {
            const nextBlockId = blockOrder[currentIndex + 1];
            // Extend selection from fixed anchor to the new block
            selectBlockRange(anchorId, nextBlockId, blockOrder);
            // Update focus to the new block so further arrow keys continue from there
            setFocusedBlock(nextBlockId);
          }
        }
      };

      document.addEventListener("keydown", handleKeyDown, true);
      return () => {
        document.removeEventListener("keydown", handleKeyDown, true);
      };
    }, [isFocused, blockId, blockOrder, selectBlockRange, setFocusedBlock]);

    const handleStaticMouseDown = useCallback(
      (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();

        // Calculate text position from click location in static renderer
        let cursorPos = 0;

        // Use caretRangeFromPoint to find caret position at click coordinates
        const range = document.caretRangeFromPoint(e.clientX, e.clientY);
        if (range && e.currentTarget.contains(range.startContainer)) {
          // Calculate offset from the start of the block content
          const preCaretRange = document.createRange();
          preCaretRange.selectNodeContents(e.currentTarget);
          preCaretRange.setEnd(range.startContainer, range.startOffset);
          cursorPos = preCaretRange.toString().length;
        }

        // Store click coordinates for fallback
        useBlockUIStore
          .getState()
          .setPendingFocusSelection(blockId, e.clientX, e.clientY);

        // Set focus with calculated cursor position
        setFocusedBlock(blockId, cursorPos);
      },
      [blockId, setFocusedBlock],
    );

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
    const [draft, setDraft] = useState<string>(blockContent || "");

    // Keep the latest draft in a ref so callbacks/keybindings can stay stable
    // (otherwise keybindings change every keystroke and the editor view gets recreated).
    const draftRef = useRef<string>(blockContent || "");

    // Keep draft in sync when the underlying block changes (e.g., page load, external update)
    // but do not overwrite while this block is focused (editing session owns the draft),
    // UNLESS we are navigating to this block programmatically (targetCursorPosition is set),
    // which implies a structural change (merge/split/move) where store is authoritative.
    useEffect(() => {
      const isProgrammaticNav = targetCursorPosition !== null;
      const focusedBlockId = useBlockUIStore.getState().focusedBlockId;
      const isTargetOfNav = focusedBlockId === blockId && isProgrammaticNav;

      console.log(
        `[BlockComponent:blockContentEffect] blockId=${blockId.slice(0, 8)}, blockContent="${blockContent?.slice(0, 30)}", draftRef="${draftRef.current.slice(0, 30)}", isFocused=${isFocused}, targetCursorPosition=${targetCursorPosition}, isProgrammaticNav=${isProgrammaticNav}, isTargetOfNav=${isTargetOfNav}`,
      );

      if (!isFocused || isTargetOfNav) {
        // Only update if content is actually different to prevent unnecessary renders
        // CRITICAL: If draftRef differs from blockContent, DO NOT sync.
        // This means there are unsaved local edits - let them commit first.
        if (blockContent === draftRef.current) {
          console.log(
            `[BlockComponent:blockContentEffect] Syncing draft from blockContent for blockId=${blockId.slice(0, 8)}`,
          );
          // Content hasn't changed locally, safe to sync from store
          setDraft(blockContent ?? "");
        } else if (isTargetOfNav && blockContent !== "") {
          console.log(
            `[BlockComponent:blockContentEffect] Programmatic nav (target of nav) - overriding draft for blockId=${blockId.slice(0, 8)}`,
          );
          // Only override if this is the NEWLY FOCUSED block (target of nav)
          // AND blockContent is not empty (not stale from concurrent commit)
          setDraft(blockContent ?? "");
          draftRef.current = blockContent ?? "";
        } else {
          console.log(
            `[BlockComponent:blockContentEffect] SKIP - unsaved edits or not target of nav for blockId=${blockId.slice(0, 8)}`,
          );
        }
      }

      // Only clear targetCursorPosition if this is the focused block
      // This ensures other blocks don't see stale programmatic nav flags
      if (isFocused && targetCursorPosition !== null) {
        console.log(
          `[BlockComponent:blockContentEffect] Clearing targetCursorPosition after focus for blockId=${blockId.slice(0, 8)}`,
        );
        clearTargetCursorPosition();
      }
    }, [
      blockContent,
      isFocused,
      targetCursorPosition,
      blockId,
      clearTargetCursorPosition,
    ]);

    // Commit helper: stable callback reading from refs (doesn't change every keystroke).
    const commitDraft = useCallback(async () => {
      const latestDraft = draftRef.current;
      const latestBlock = useBlockStore.getState().blocksById[blockId];

      console.log(
        `[BlockComponent:commitDraft] START blockId=${blockId.slice(0, 8)}, draft="${latestDraft.slice(0, 30)}", stored="${latestBlock?.content.slice(0, 30)}"`,
      );

      // Avoid unnecessary writes; also tolerate missing block during transitions.
      if (latestBlock && latestDraft !== latestBlock.content) {
        console.log(
          `[BlockComponent:commitDraft] Calling updateBlockContent for blockId=${blockId.slice(0, 8)}`,
        );
        try {
          await useBlockStore
            .getState()
            .updateBlockContent(blockId, latestDraft);
          const updatedBlock = useBlockStore.getState().blocksById[blockId];
          console.log(
            `[BlockComponent:commitDraft] DONE updateBlockContent for blockId=${blockId.slice(0, 8)}, stored="${updatedBlock?.content.slice(0, 30)}"`,
          );
        } catch (error) {
          console.error(
            `[BlockComponent:commitDraft] ERROR updateBlockContent failed for blockId=${blockId.slice(0, 8)}:`,
            error,
          );
        }
      } else {
        console.log(
          `[BlockComponent:commitDraft] SKIP - no change needed for blockId=${blockId.slice(0, 8)}`,
        );
      }
    }, [blockId]);

    // Commit draft when focus is lost.
    useEffect(() => {
      console.log(
        `[BlockComponent:isFocusedEffect] blockId=${blockId.slice(0, 8)}, isFocused=${isFocused}`,
      );
      if (isFocused === false) {
        console.log(
          `[BlockComponent:isFocusedEffect] Focus lost, committing draft for blockId=${blockId.slice(0, 8)}`,
        );
        commitDraft();
      }
    }, [isFocused, commitDraft, blockId]);

    // Save editor state before losing focus, restore when regaining focus
    // Also trigger commit when losing focus to ensure onBlur handlers equivalent behavior
    useEffect(() => {
      const view = editorRef.current?.getView();
      if (!view) return;

      if (isFocused) {
        // When gaining focus: restore cached state if available
        const cachedState = editorStateCache.get(blockId);
        if (cachedState) {
          view.setState(cachedState);
        }
      } else {
        // When losing focus: save current editor state
        editorStateCache.set(blockId, view.state);
      }
    }, [isFocused, blockId]);

    // Focus editor when this block becomes focused
    useEffect(() => {
      if (isFocused && editorRef.current) {
        const view = editorRef.current?.getView();

        if (!view) {
          return;
        }

        if (view.hasFocus && targetCursorPosition === null) {
          return;
        }

        if (!view.hasFocus) {
          let pos: number;
          if (targetCursorPosition !== null) {
            pos = Math.min(targetCursorPosition, view.state.doc.length);
            appliedPositionRef.current = targetCursorPosition;
            clearTargetCursorPosition();
          } else {
            pos = view.state.doc.length;
            appliedPositionRef.current = null;
          }

          view.dispatch({
            selection: { anchor: pos, head: pos },
          });

          view.focus();
        } else if (
          targetCursorPosition !== null &&
          appliedPositionRef.current !== targetCursorPosition
        ) {
          const pos = Math.min(targetCursorPosition, view.state.doc.length);
          view.dispatch({
            selection: { anchor: pos, head: pos },
          });
          appliedPositionRef.current = targetCursorPosition;
          clearTargetCursorPosition();
        }
      } else if (!isFocused) {
        appliedPositionRef.current = null;
      }
    }, [isFocused, targetCursorPosition, clearTargetCursorPosition, editorRef]);

    // Apply cursor position from click coordinates when Editor mounts
    // This converts screen coordinates (from StaticMarkdownRenderer click) to text position
    useLayoutEffect(() => {
      if (!isFocused) return;

      const view = editorRef.current?.getView();
      if (!view) return;

      const pendingSelection = useBlockUIStore.getState().pendingFocusSelection;
      if (!pendingSelection || pendingSelection.blockId !== blockId) return;

      // Use CodeMirror's native coordinate→position mapping
      const pos = view.posAtCoords({
        x: pendingSelection.clientX,
        y: pendingSelection.clientY,
      });

      if (pos !== null) {
        // Clamp to document bounds
        const clampedPos = Math.min(Math.max(0, pos), view.state.doc.length);

        // Dispatch selection to place cursor at the mapped position
        view.dispatch({
          selection: { anchor: clampedPos, head: clampedPos },
        });
      }

      // Clear pending selection after applying
      useBlockUIStore.getState().clearPendingFocusSelection();

      // Focus the editor so user can immediately start typing
      editorRef.current?.focus();
    }, [isFocused, blockId]);

    useLayoutEffect(() => {
      const focusRequest = useBlockUIStore.getState().focusRequest;
      if (!focusRequest || focusRequest.blockId !== blockId) return;

      const view = editorRef.current?.getView();
      if (!view) return;

      const targetPos = useBlockUIStore.getState().targetCursorPosition;
      if (targetPos !== null) {
        const pos = Math.min(targetPos, view.state.doc.length);
        view.dispatch({
          selection: { anchor: pos, head: pos },
        });
      }

      view.focus();
      useBlockUIStore.getState().clearFocusRequest();
    }, [blockId]);

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
        // Clear IME flag on Space key - ensures normal text input after composition
        if (e.key === " ") {
          imeStateRef.current.lastInputWasComposition = false;
        }

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

          if (cursor === contentLength) {
            commitDraft().then(() => {
              createBlock(blockId);
            });
          } else {
            const beforeContent = content.slice(0, cursor);
            draftRef.current = beforeContent;
            setDraft(beforeContent);

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
      if (!isFocused) {
        imeStateRef.current.lastInputWasComposition = false;
        setFocusedBlock(blockId);
      }
    }, [blockId, setFocusedBlock, isFocused]);

    const handleContentChange = useCallback(
      (content: string) => {
        console.log(
          `[BlockComponent:handleContentChange] blockId=${blockId.slice(0, 8)}, newContent="${content.slice(0, 30)}"`,
        );
        draftRef.current = content;
        setDraft(content);
      },
      [blockId],
    );

    const handleBlur = useCallback(async () => {
      console.log(
        `[BlockComponent:handleBlur] START for blockId=${blockId.slice(0, 8)}, isMetadataOpen=${isMetadataOpen}`,
      );

      // If metadata editor is open, don't close it or commit
      // The metadata editor will handle its own lifecycle via onClose
      if (isMetadataOpen) {
        console.log("[BlockComponent:handleBlur] SKIP - metadata editor open");
        return;
      }

      // Normal blur handling (metadata editor is not open)
      console.log(
        `[BlockComponent:handleBlur] Committing draft for blockId=${blockId.slice(0, 8)}`,
      );
      await commitDraft();
      console.log(
        `[BlockComponent:handleBlur] DONE for blockId=${blockId.slice(0, 8)}`,
      );

      // Clear IME state on blur
      imeStateRef.current.lastInputWasComposition = false;
    }, [commitDraft, isMetadataOpen]);

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
            const currentBlock = blocksById[currentId] as BlockData | undefined;
            if (!currentBlock) break;
            currentId = currentBlock.parentId || null;
          }

          // Set the full path in view store
          useViewStore.setState({
            zoomPath: path,
          });
          setFocusedBlock(blockId);
        } else {
          // Otherwise just focus - let useLayoutEffect handle focus timing
          setFocusedBlock(blockId);
        }
      },
      [blockId, hasChildren, setFocusedBlock],
    );

    // Create custom keybindings for CodeMirror to handle block operations
    const handleContentChangeWithTrigger = useCallback(
      (value: string) => {
        // Trigger for metadata modal: "::"
        if (value.endsWith("::")) {
          const newValue = value.slice(0, -2);
          draftRef.current = newValue;
          setDraft(newValue);
          setIsMetadataOpen(true);
          return;
        }
        handleContentChange(value);
      },
      [handleContentChange],
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

            if (cursor === contentLength) {
              commitDraft().then(() => {
                createBlock(blockId);
              });
            } else {
              const beforeContent = content.slice(0, cursor);
              draftRef.current = beforeContent;
              setDraft(beforeContent);

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
            const selection = view.state.selection.main;

            // If text is selected, let default backspace behavior handle deletion
            if (selection.from !== selection.to) {
              return false;
            }

            if (cursor === 0) {
              console.log(
                `[BlockComponent] Backspace at cursor 0 for block ${blockId.slice(0, 8)}, content="${content.slice(0, 20)}"`,
              );
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
                  const targetPos = calculatePrevBlockCursorPosition(
                    columnPos,
                    prevBlock.content,
                  );
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
                  const targetPos = calculateNextBlockCursorPosition(
                    columnPos,
                    nextBlock.content,
                  );
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
            console.log(
              "[BlockComponent:Tab] Tab key pressed, blockId:",
              blockId,
            );

            // Start async operations but return true immediately to prevent default behavior
            commitDraft()
              .then(() => {
                console.log(
                  "[BlockComponent:Tab] commitDraft done, calling indentBlock",
                );
                indentBlock(blockId)
                  .then(() => {
                    console.log("[BlockComponent:Tab] indentBlock done");
                    // Don't restore focus immediately - it causes React Hook errors
                    // during structural reconciliation. The block content is preserved,
                    // user can click to refocus if needed.
                    console.log(
                      "[BlockComponent:Tab] Focus restoration skipped to avoid Hook errors",
                    );
                  })
                  .catch((err) => {
                    console.error(
                      "[BlockComponent:Tab] indentBlock failed:",
                      err,
                    );
                  });
              })
              .catch((err) => {
                console.error("[BlockComponent:Tab] commitDraft failed:", err);
              });
            return true;
          },
        },
        {
          key: "Shift-Tab",
          preventDefault: true,
          run: () => {
            // Start async operations but return true immediately to prevent default behavior
            commitDraft().then(() => {
              outdentBlock(blockId).then(() => {
                // Don't restore focus immediately - it causes React Hook errors
                // during structural reconciliation. The block content is preserved,
                // user can click to refocus if needed.
                console.log(
                  "[BlockComponent:Shift-Tab] Focus restoration skipped to avoid Hook errors",
                );
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

    // Render only one indent guide at this block's depth level
    const indentGuide =
      showIndentGuides && depth > 0 ? (
        <div
          className="indent-guide"
          style={{
            left: `${depth * INDENT_PER_LEVEL + 18}px`, // Align with collapse toggle center (20px width / 2 + 4px margin)
          }}
        />
      ) : null;

    // Early return if block has no content and no metadata
    // This guard is placed AFTER all hooks (including useMemo) to comply with React Hook rules
    if (blockContent === undefined && blockMetadata === undefined) {
      return null;
    }

    return (
      <ContextMenu
        sections={contextMenuSections}
        textSelectionSections={textSelectionSections}
      >
        <div
          ref={blockComponentRef}
          className="block-component"
          onMouseDown={(e) => {
            // Save text selection before right-click might clear it
            if (e.button === 2) {
              e.stopPropagation(); // Prevent parent blocks from handling this right-click

              const selection = window.getSelection();
              if (selection && selection.rangeCount > 0) {
                const range = selection.getRangeAt(0);
                if (!range.collapsed) {
                  savedTextSelectionRef.current = selection.toString();
                } else {
                  savedTextSelectionRef.current = "";
                }
              } else {
                savedTextSelectionRef.current = "";
              }

              // If no text selection, prevent default and clear browser selection
              if (!savedTextSelectionRef.current) {
                e.preventDefault();
                window.getSelection()?.removeAllRanges();

                // If this block is not selected, select it
                if (!isSelected) {
                  useBlockUIStore.getState().setSelectedBlocks([blockId]);
                }
              }
            }
          }}
          onKeyDown={(e) => {
            // Handle keyboard navigation for accessibility
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              e.stopPropagation();
            }
          }}
        >
          {indentGuide}
          {/* biome-ignore lint/a11y/useKeyWithClickEvents: Selection via mouse is the primary UX; keyboard navigation is handled by collapse button and arrow keys */}
          <div
            ref={blockRowRef}
            className="block-row"
            style={{
              paddingLeft: `${depth * INDENT_PER_LEVEL}px`,
              backgroundColor: isSelected
                ? "rgba(128, 128, 128, 0.1)"
                : undefined,
              transition: "background-color 0.15s ease",
            }}
            onClick={(e: React.MouseEvent) => {
              // If clicking this block's row (not collapse/bullet) and it's not currently focused,
              // we need to save any other focused block's draft before changing focus
              const target = e.target as HTMLElement;
              const isCollapseButton = target.closest(".collapse-toggle");
              const isBulletButton = target.closest(".block-bullet-wrapper");

              // Don't interfere with special controls
              if (isCollapseButton || isBulletButton) {
                return;
              }

              // Handle multi-select with Ctrl/Cmd + Click
              if (e.ctrlKey || e.metaKey) {
                e.stopPropagation();
                toggleBlockSelection(blockId);
              }
              // Handle range select with Shift + Click
              else if (e.shiftKey && blockOrder.length > 0) {
                e.stopPropagation();
                // Use lastSelectedBlockId or current block as anchor
                const anchorBlockId = lastSelectedBlockId || blockId;
                if (anchorBlockId && anchorBlockId !== blockId) {
                  selectBlockRange(anchorBlockId, blockId, blockOrder);
                } else {
                  // No anchor or same block, just select this block
                  useBlockUIStore.getState().setSelectedBlocks([blockId]);
                }
              }
              // Clear selection on regular click without modifiers
              else if (!e.shiftKey && !e.ctrlKey && !e.metaKey) {
                useBlockUIStore.getState().clearSelectedBlocks();
                useBlockUIStore.getState().clearSelectionAnchor();
              }
            }}
            onMouseDown={(e: React.MouseEvent) => {
              const target = e.target as HTMLElement;
              const isCollapseButton = target.closest(".collapse-toggle");
              const isBulletButton = target.closest(".block-bullet-wrapper");

              if (isCollapseButton || isBulletButton) {
                return;
              }

              console.log(
                `[BlockComponent:onMouseDown] START for blockId=${blockId.slice(0, 8)}, isFocused=${isFocused}`,
              );

              if (isFocused && editorRef.current) {
                const view = editorRef.current.getView();
                if (view?.hasFocus) {
                  console.log(
                    `[BlockComponent:onMouseDown] Committing draft for blockId=${blockId.slice(0, 8)}`,
                  );
                  commitDraft().then(() => {
                    console.log(
                      `[BlockComponent:onMouseDown] Draft committed, blurring blockId=${blockId.slice(0, 8)}`,
                    );
                    view.contentDOM.blur();
                  });
                  return;
                }
              }

              if (!isFocused) {
                console.log(
                  `[BlockComponent:onMouseDown] Setting focus to blockId=${blockId.slice(0, 8)}`,
                );
                // CRITICAL: Do NOT set targetCursorPosition yet - wait for store to be updated
                // If we set it now, other blocks' blockContentEffect might fire before the store update completes
                // causing them to override their draft with stale values
                setFocusedBlock(blockId);
              }
            }}
          >
            {/* Collapse/Expand Toggle */}
            {hasChildren ? (
              <button
                type="button"
                className={`collapse-toggle ${isCollapsed ? "collapsed" : ""}`}
                onClick={() => toggleCollapse(blockId)}
                aria-label={isCollapsed ? "Expand" : "Collapse"}
              >
                {isCollapsed ? "▶" : "▼"}
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
              <MacroContentWrapper
                content={blockContent || ""}
                blockId={blockId}
                isFocused={isFocused}
                onEdit={() => setFocusedBlock(blockId)}
                onMouseDownCapture={handleStaticMouseDown}
              >
                <Popover
                  opened={isMetadataOpen}
                  onClose={() => {
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
                        isFocused={isFocused}
                        className="block-editor"
                        style={{}}
                      />
                    </Box>
                  </Popover.Target>
                  <Popover.Dropdown
                    p={0}
                    ref={popoverDropdownRef}
                    style={{ minWidth: "300px" }}
                    onClick={(e) => {
                      e.stopPropagation();
                    }}
                  >
                    <MetadataEditor
                      blockId={blockId}
                      onClose={() => {
                        setIsMetadataOpen(false);
                        setTimeout(() => {
                          editorRef.current?.focus();
                        }, 0);
                      }}
                    />
                  </Popover.Dropdown>
                </Popover>
              </MacroContentWrapper>

              {/* Metadata Badge - small indicator with tooltip */}
              {blockMetadata && (
                <Box
                  onClick={(e) => {
                    e.stopPropagation();
                  }}
                >
                  <MetadataBadges
                    metadata={blockMetadata}
                    onBadgeClick={() => setIsMetadataOpen(true)}
                  />
                </Box>
              )}
            </div>
          </div>

          {/* Render children recursively if not collapsed */}
          {hasChildren && !isCollapsed && (
            <div className="block-children">
              {childrenIds.map((childId: string) => (
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

        <DeleteConfirmModal
          opened={showDeleteConfirm}
          onClose={() => setShowDeleteConfirm(false)}
          onConfirm={async () => {
            for (const id of blocksToDelete) {
              await deleteBlock(id);
            }
            if (blocksToDelete.length > 0) {
              useBlockUIStore.getState().clearSelectedBlocks();
            }
            setShowDeleteConfirm(false);
          }}
          blocksToDelete={blocksToDelete}
          totalBlocksCount={blocksToDelete.reduce(
            (sum, id) => sum + 1 + countDescendantBlocks(id),
            0,
          )}
          hasDescendants={blocksToDelete.some(
            (id) => countDescendantBlocks(id) > 0,
          )}
        />
      </ContextMenu>
    );
  },
);
