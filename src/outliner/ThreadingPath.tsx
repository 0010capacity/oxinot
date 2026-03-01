import { memo, useCallback, useEffect, useRef, useState } from "react";
import { useBlockStore } from "../stores/blockStore";
import { useBlockUIStore } from "../stores/blockUIStore";
import { useOutlinerSettingsStore } from "../stores/outlinerSettingsStore";

interface Point {
  x: number;
  y: number;
}

/**
 * Get the ancestor chain from root to the focused block (excluding the focused block itself)
 */
function getAncestors(
  focusedBlockId: string,
  blocksById: Record<string, { parentId: string | null } | undefined>,
): string[] {
  const ancestors: string[] = [];
  let currentId: string | null = focusedBlockId;

  while (currentId) {
    const block: { parentId: string | null } | undefined = blocksById[currentId];
    if (!block?.parentId) break;
    ancestors.unshift(block.parentId);
    currentId = block.parentId;
  }

  return ancestors;
}

/**
 * Get bullet center position for a block element using its data-block-row-id
 */
function getBulletCenterByRowId(blockId: string): Point | null {
  const blockRow = document.querySelector(
    `[data-block-row-id="${blockId}"]`,
  ) as HTMLElement | null;
  if (!blockRow) return null;

  const bulletWrapper = blockRow.querySelector(".block-bullet-wrapper");
  if (!bulletWrapper) return null;

  const rect = bulletWrapper.getBoundingClientRect();
  return {
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height / 2,
  };
}

/**
 * Build SVG path segments for the threading path.
 * For each consecutive pair (parent → child) in the waypoint chain,
 * draws a vertical line from parent bullet down, then a smooth curve into child bullet.
 */
function buildPathSegments(waypoints: Point[]): string {
  if (waypoints.length < 2) return "";

  // Fixed arc radius — always the same regardless of vertical distance
  const r = 8;
  const pathParts: string[] = [];

  for (let i = 0; i < waypoints.length - 1; i++) {
    const from = waypoints[i];
    const to = waypoints[i + 1];

    if (i === 0) {
      pathParts.push(`M ${from.x} ${from.y}`);
    }

    // How far we can arc: clamp r to half the available space in each axis
    const dx = Math.abs(to.x - from.x);
    const dy = Math.abs(to.y - from.y);
    const rx = Math.min(r, dx / 2);
    const ry = Math.min(r, dy / 2);

    // Vertical line straight down, stopping rx pixels short of the arc start
    const arcStartY = to.y - ry;
    if (arcStartY > from.y) {
      pathParts.push(`L ${from.x} ${arcStartY}`);
    }

    // Arc end: rx pixels into the horizontal run toward to.x
    const arcEndX = to.x > from.x ? from.x + rx : from.x - rx;
    const sweepFlag = to.x > from.x ? 0 : 1;

    // SVG arc with fixed radii — produces a consistent quarter-circle corner
    pathParts.push(
      `A ${rx} ${ry} 0 0 ${sweepFlag} ${arcEndX} ${to.y}`,
    );

    // Horizontal line to the bullet center
    if (arcEndX !== to.x) {
      pathParts.push(`L ${to.x} ${to.y}`);
    }
  }

  return pathParts.join(" ");
}

export const ThreadingPath = memo(function ThreadingPath() {
  const showBulletThreading = useOutlinerSettingsStore(
    (s) => s.showBulletThreading,
  );
  const focusedBlockId = useBlockUIStore((s) => s.focusedBlockId);
  const blocksById = useBlockStore((s) => s.blocksById);

  const containerRef = useRef<HTMLDivElement>(null);
  const [pathD, setPathD] = useState<string | null>(null);

  const calculatePath = useCallback(() => {
    if (!showBulletThreading || !focusedBlockId) {
      setPathD(null);
      return;
    }

    // Get ancestors (root → ... → parent), then append focused block
    const ancestors = getAncestors(focusedBlockId, blocksById);

    // Root level blocks (no ancestors) don't need threading
    if (ancestors.length === 0) {
      setPathD(null);
      return;
    }

    // Build waypoint list: [...ancestors, focusedBlockId]
    const waypointIds = [...ancestors, focusedBlockId];

    // Resolve each waypoint to its bullet center position in the DOM
    const waypoints: Point[] = [];
    for (const id of waypointIds) {
      const point = getBulletCenterByRowId(id);
      if (!point) {
        // If any waypoint isn't visible/found, skip the path
        setPathD(null);
        return;
      }
      waypoints.push(point);
    }

    const newPathD = buildPathSegments(waypoints);
    setPathD(newPathD || null);
  }, [showBulletThreading, focusedBlockId, blocksById]);

  // Calculate path when focused block changes
  useEffect(() => {
    const rafId = requestAnimationFrame(() => {
      calculatePath();
    });
    return () => cancelAnimationFrame(rafId);
  }, [calculatePath]);

  // Recalculate on scroll/resize
  useEffect(() => {
    if (!focusedBlockId || !showBulletThreading) return;

    const handleScroll = () => {
      requestAnimationFrame(calculatePath);
    };

    window.addEventListener("scroll", handleScroll, true);
    window.addEventListener("resize", handleScroll);

    return () => {
      window.removeEventListener("scroll", handleScroll, true);
      window.removeEventListener("resize", handleScroll);
    };
  }, [focusedBlockId, showBulletThreading, calculatePath]);

  if (!pathD) {
    return null;
  }

  return (
    <div
      ref={containerRef}
      className="threading-path-container"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        pointerEvents: "none",
        zIndex: 5,
        overflow: "visible",
      }}
    >
      <svg
        style={{
          width: "100%",
          height: "100%",
          overflow: "visible",
        }}
      >
        <path
          d={pathD}
          fill="none"
          stroke="var(--color-thread-line)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="threading-path-line"
        />
      </svg>
    </div>
  );
});
