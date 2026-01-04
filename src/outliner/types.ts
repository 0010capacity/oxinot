export type BlockKind = "bullet" | "brace";

export interface Block {
  id: string;
  /**
   * For normal blocks, this is the single-line content.
   * For brace blocks, this may contain multi-line plain text (including `\n`).
   */
  content: string;
  level: number; // 0 = root level, 1 = first indent, etc.
  collapsed: boolean;
  children: Block[];
  parent: Block | null;

  /**
   * Distinguishes normal bullet blocks from `{ ... }` brace blocks.
   * - "bullet": existing behavior (Enter creates/splits blocks, Shift+Enter for newline within textarea if enabled)
   * - "brace": Enter inserts a newline inside `content` (plain text flow)
   */
  kind?: BlockKind;

  /**
   * Present only for brace blocks. Tracks whether the block is currently "open"
   * (i.e., triggered by `{` and not yet closed by `}` in the source representation).
   * This is useful during parsing/serialization.
   */
  braceState?: "open" | "closed";
}

export interface BlockTree {
  blocks: Block[];
}

export interface BlockPosition {
  blockId: string;
  offset: number;
}

export interface BlockSelection {
  anchor: BlockPosition;
  focus: BlockPosition;
}

export type BlockAction =
  | {
      type: "ADD_BLOCK";
      payload: { afterBlockId?: string; level?: number; kind?: BlockKind };
    }
  | { type: "DELETE_BLOCK"; payload: { blockId: string } }
  | { type: "UPDATE_BLOCK"; payload: { blockId: string; content: string } }
  | { type: "INDENT_BLOCK"; payload: { blockId: string } }
  | { type: "OUTDENT_BLOCK"; payload: { blockId: string } }
  | { type: "MOVE_BLOCK_UP"; payload: { blockId: string } }
  | { type: "MOVE_BLOCK_DOWN"; payload: { blockId: string } }
  | { type: "TOGGLE_COLLAPSE"; payload: { blockId: string } }
  | { type: "MERGE_WITH_PREVIOUS"; payload: { blockId: string } }
  | { type: "SPLIT_BLOCK"; payload: { blockId: string; offset: number } };
