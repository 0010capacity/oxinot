import type { BlockData } from "./stores/blockStore";

export const BLOCK_UPDATE_EVENT = "oxinot-block-update";

export interface BlockUpdateEventDetail {
  blocks: BlockData[];
  deletedBlockIds?: string[];
}

export function dispatchBlockUpdate(
  blocks: BlockData[],
  deletedBlockIds?: string[]
) {
  const event = new CustomEvent<BlockUpdateEventDetail>(BLOCK_UPDATE_EVENT, {
    detail: { blocks, deletedBlockIds },
  });
  window.dispatchEvent(event);
}
