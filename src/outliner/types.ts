export type BlockKind = "bullet" | "fence" | "code" | "table";

export interface Block {
  id: string;
  /**
   * For normal blocks, this is the single-line content.
   * For brace blocks, this may contain multi-line plain text (including `\n`).
   * For table blocks, this will be empty, and tableData will be used.
   */
  content: string;
  level: number; // 0 = root level, 1 = first indent, etc.
  collapsed: boolean;
  children: Block[];
  parent: Block | null;

  /**
   * Distinguishes normal bullet blocks from special block types.
   * - "bullet": existing behavior (Enter creates/splits blocks)
   * - "fence": Enter inserts a newline inside `content` (plain text flow for `///` fence blocks)
   * - "code": Enter inserts a newline inside `content` (code block for ``` ... ``` blocks)
   * - "table": Represents a markdown table.
   */
  kind?: BlockKind;

  /**
   * For table blocks, this stores the table data.
   */
  tableData?: string[][];

  /**
   * Present only for fence/code blocks. Tracks whether the block is currently "open"
   * (i.e., triggered by `///` or ``` and not yet closed in the source representation).
   * This is useful during parsing/serialization.
   */
  fenceState?: "open" | "closed";

  /**
   * For code blocks, stores the language identifier (e.g., "javascript", "python")
   */
  language?: string;
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
      payload: {
        afterBlockId?: string;
        level?: number;
        kind?: BlockKind;
        newBlockId?: string;
        content?: string;
      };
    }
  | { type: "DELETE_BLOCK"; payload: { blockId: string } }
  | { type: "UPDATE_BLOCK"; payload: { blockId: string; content: string } }
  | {
      type: "UPDATE_BLOCK_DATA";
      payload: { blockId: string; data: Partial<Block> };
    }
  | { type: "INDENT_BLOCK"; payload: { blockId: string } }
  | { type: "OUTDENT_BLOCK"; payload: { blockId: string } }
  | { type: "MOVE_BLOCK_UP"; payload: { blockId: string } }
  | { type: "MOVE_BLOCK_DOWN"; payload: { blockId: string } }
  | { type: "TOGGLE_COLLAPSE"; payload: { blockId: string } }
  | { type: "MERGE_WITH_PREVIOUS"; payload: { blockId: string } }
  | {
      type: "SPLIT_BLOCK";
      payload: { blockId: string; offset: number; newBlockId?: string };
    };
