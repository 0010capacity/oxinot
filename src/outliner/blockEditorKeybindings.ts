import type { KeyBinding } from "@codemirror/view";
import type { EditorView } from "@codemirror/view";

export interface BlockKeybindingActions {
  createBlock: (afterBlockId: string | null) => Promise<string>;
  setFocusedBlock: (
    blockId: string,
    targetCursorPosition?: number | null,
  ) => void;
  commitDraft: () => Promise<void>;
  mergeWithPrevious: (id: string, draftContent?: string) => Promise<void>;
  splitBlockAtCursor: (
    id: string,
    offset: number,
    draftContent?: string,
  ) => Promise<void>;
  getPreviousBlock?: (id: string) => string | null;
  getNextBlock?: (id: string) => string | null;
  getBlock?: (id: string) => { content: string } | undefined;
}

export function createStableBlockKeybindings(
  blockId: string,
  actions: BlockKeybindingActions,
  imeStateRef: React.MutableRefObject<{
    isComposing: boolean;
    lastInputWasComposition: boolean;
    enterPressed: boolean;
    contentBeforeEnter: string;
    cursorBeforeEnter: number;
    pendingOperation: {
      type: "split" | "create";
      offset?: number;
    } | null;
  }>,
  draftRef: React.MutableRefObject<string>,
  setDraft: React.Dispatch<React.SetStateAction<string>>,
): KeyBinding[] {
  const {
    createBlock,
    setFocusedBlock,
    commitDraft,
    mergeWithPrevious,
    splitBlockAtCursor,
    getPreviousBlock,
    getNextBlock,
    getBlock,
  } = actions;

  return [
    {
      key: "Mod-Shift-m",
      run: () => {
        return false;
      },
    },
    {
      key: "Enter",
      run: (view: EditorView) => {
        if (
          imeStateRef.current.isComposing ||
          imeStateRef.current.lastInputWasComposition ||
          imeStateRef.current.enterPressed
        ) {
          return true;
        }

        const cursor = view.state.selection.main.head;
        const content = view.state.doc.toString();
        const contentLength = content.length;

        const beforeCursor = content.slice(0, cursor);
        const openFencesBeforeCursor = (beforeCursor.match(/^```/gm) || [])
          .length;
        const closeFencesBeforeCursor = (beforeCursor.match(/^```$/gm) || [])
          .length;

        const isInsideCodeBlock =
          openFencesBeforeCursor > closeFencesBeforeCursor;

        if (isInsideCodeBlock) {
          return false;
        }

        const line = view.state.doc.lineAt(cursor);
        const lineText = line.text;
        const isAtLineEnd = cursor === line.to;
        const isCodeFence = lineText.trim().match(/^```\w*$/);

        if (isCodeFence && isAtLineEnd) {
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

        return true;
      },
    },
    {
      key: "Shift-Enter",
      run: () => {
        return false;
      },
    },
    {
      key: "Backspace",
      run: (view: EditorView) => {
        const content = view.state.doc.toString();
        const cursor = view.state.selection.main.head;
        const selection = view.state.selection.main;

        if (selection.from !== selection.to) {
          return false;
        }

        if (cursor === 0) {
          mergeWithPrevious(blockId, content);
          return true;
        }
        return false;
      },
    },
    {
      key: "ArrowUp",
      run: (view: EditorView) => {
        const cursor = view.state.selection.main.head;
        const line = view.state.doc.lineAt(cursor);

        if (line.number === 1) {
          if (getPreviousBlock) {
            const prevBlockId = getPreviousBlock(blockId);
            if (prevBlockId) {
              commitDraft();

              const columnPos = cursor - line.from;
              const prevBlock = getBlock ? getBlock(prevBlockId) : undefined;
              if (prevBlock) {
                const lastLine = prevBlock.content.split("\n").pop() || "";
                const targetPos = Math.min(columnPos, lastLine.length);
                setFocusedBlock(prevBlockId, targetPos);
              } else {
                setFocusedBlock(prevBlockId);
              }
              return true;
            }
          }
        }
        return false;
      },
    },
    {
      key: "ArrowDown",
      run: (view: EditorView) => {
        const cursor = view.state.selection.main.head;
        const line = view.state.doc.lineAt(cursor);
        const lastLine = view.state.doc.lines;

        if (line.number === lastLine) {
          if (getNextBlock) {
            const nextBlockId = getNextBlock(blockId);
            if (nextBlockId) {
              commitDraft();

              const columnPos = cursor - line.from;
              const nextBlock = getBlock ? getBlock(nextBlockId) : undefined;
              if (nextBlock) {
                const firstLine = nextBlock.content.split("\n")[0] || "";
                const targetPos = Math.min(columnPos, firstLine.length);
                setFocusedBlock(nextBlockId, targetPos);
              } else {
                setFocusedBlock(nextBlockId);
              }
              return true;
            }
          }
        }
        return false;
      },
    },
    {
      key: "Tab",
      preventDefault: true,
      run: () => {
        return false;
      },
    },
    {
      key: "Shift-Tab",
      preventDefault: true,
      run: () => {
        return false;
      },
    },
  ];
}
