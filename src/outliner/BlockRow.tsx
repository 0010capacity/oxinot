import { BlockComponent } from "./BlockComponent";

interface BlockRowProps {
  blockId: string;
  depth: number;
}

export function BlockRow({ blockId, depth }: BlockRowProps) {
  return <BlockComponent blockId={blockId} depth={depth} />;
}
