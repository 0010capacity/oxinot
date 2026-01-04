import { KeyBinding } from "@codemirror/view";
import { Block, BlockAction } from "./types";
import { flattenBlocks } from "./blockUtils";

/**
 * Create keybindings for a specific block in the outliner
 */
export function createBlockKeybindings(
  blockId: string,
  block: Block,
  blocks: Block[],
  dispatch: (action: BlockAction) => void,
  setFocusedBlockId: (id: string) => void,
): KeyBinding[] {
  return [
    {
      key: "Enter",
      run: (view) => {
        const state = view.state;
        const cursorPos = state.selection.main.head;
        const content = state.doc.toString();
        const contentLength = content.length;

        // Handle Enter key - split or create new block
        if (block.kind === "fence" || block.kind === "code") {
          // For fence and code blocks, allow newlines (don't split)
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
  ];
}
