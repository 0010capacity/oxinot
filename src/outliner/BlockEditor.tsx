import React, {
  useReducer,
  useRef,
  useEffect,
  useState,
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
} from "./blockUtils";
import { parseMarkdownToBlocks } from "./blockUtils";
import { ONCHANGE_DEBOUNCE_MS, AUTO_FOCUS_DELAY_MS } from "./constants";
import { Breadcrumbs, Anchor } from "@mantine/core";
import "./BlockEditor.css";
import { Editor } from "../components/Editor";
import { createBlockKeybindings } from "./blockKeybindings";
import { checkBlockConversion } from "./blockConversion";
import { BlockComponent } from "./BlockComponent";

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
    }, ONCHANGE_DEBOUNCE_MS);
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
          }, AUTO_FOCUS_DELAY_MS);
        }
      }
    }
    prevBlockCountRef.current = currentBlockCount;
  }, [blocks, focusedBlockId]);

  const handleContentChange = useCallback(
    (blockId: string, newContent: string) => {
      const flat = flattenBlocks(blocks);
      const current = flat.find((b) => b.id === blockId);

      if (!current) {
        // Block not found, just update content
        dispatch({
          type: "UPDATE_BLOCK",
          payload: { blockId, content: newContent },
        });
        return;
      }

      // Check for auto-conversion
      const conversion = checkBlockConversion(current, newContent);
      if (conversion?.shouldConvert) {
        current.kind = conversion.kind;
        current.fenceState = "open";
        if (conversion.kind === "code" && conversion.language !== undefined) {
          current.language = conversion.language;
        }
        dispatch({
          type: "UPDATE_BLOCK",
          payload: { blockId, content: "" },
        });
        setTimeout(() => setFocusedBlockId(blockId), 0);
        return;
      }

      // Normal content update
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
      const keybindings = createBlockKeybindings(
        block.id,
        block,
        blocks,
        dispatch,
        setFocusedBlockId,
      );

      return (
        <BlockComponent
          key={block.id}
          block={block}
          state={{
            isFocused,
            isOnActivePath,
            effectiveLevel,
          }}
          handlers={{
            onContentChange: handleContentChange,
            onFocusBlock: setFocusedBlockId,
            onToggleCollapse: handleToggleCollapse,
            onSetFocusRoot: setFocusRootId,
          }}
          config={{
            theme,
            keybindings,
          }}
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
      blocks,
      dispatch,
      handleContentChange,
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
                  minHeight: "32px",
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
