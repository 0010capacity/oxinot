export interface Block {
  id: string;
  content: string;
  level: number; // 0 = root level, 1 = first indent, etc.
  collapsed: boolean;
  children: Block[];
  parent: Block | null;
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
  | { type: 'ADD_BLOCK'; payload: { afterBlockId?: string; level?: number } }
  | { type: 'DELETE_BLOCK'; payload: { blockId: string } }
  | { type: 'UPDATE_BLOCK'; payload: { blockId: string; content: string } }
  | { type: 'INDENT_BLOCK'; payload: { blockId: string } }
  | { type: 'OUTDENT_BLOCK'; payload: { blockId: string } }
  | { type: 'MOVE_BLOCK_UP'; payload: { blockId: string } }
  | { type: 'MOVE_BLOCK_DOWN'; payload: { blockId: string } }
  | { type: 'TOGGLE_COLLAPSE'; payload: { blockId: string } }
  | { type: 'MERGE_WITH_PREVIOUS'; payload: { blockId: string } }
  | { type: 'SPLIT_BLOCK'; payload: { blockId: string; offset: number } };
