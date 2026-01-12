/**
 * Decoration helper utilities
 *
 * This module provides reusable functions for creating common decoration patterns
 * used throughout the hybrid rendering system. These utilities reduce code duplication
 * and make the decoration logic more maintainable.
 */

import { Decoration, type WidgetType } from "@codemirror/view";
import type { Line } from "@codemirror/state";
import { getMarkerStyle } from "../theme/styles";

/**
 * Specification for a decoration to be created
 */
export interface DecorationSpec {
  from: number;
  to: number;
  decoration: Decoration;
}

/**
 * Configuration for styled text decoration
 */
export interface StyledTextConfig {
  className: string;
  style?: string;
  attributes?: Record<string, string>;
}

/**
 * Check if a line is the current cursor line
 */
export function isOnCursorLine(
  line: Line,
  cursorLineFrom: number,
  cursorLineTo: number,
): boolean {
  return line.from >= cursorLineFrom && line.to <= cursorLineTo;
}

/**
 * Check if a position is on the current cursor line
 */
export function isPositionOnCursorLine(
  pos: number,
  cursorLineFrom: number,
  cursorLineTo: number,
): boolean {
  return pos >= cursorLineFrom && pos <= cursorLineTo;
}

/**
 * Create a decoration that hides markdown markers
 *
 * The marker will be completely hidden in preview mode (block unfocused),
 * and dimmed/visible in edit mode (block has focus) for editing.
 *
 * @param from - Start position
 * @param to - End position
 * @param isEditMode - true if block is in edit mode (focused), false if in preview mode (unfocused)
 */
export function createHiddenMarker(
  from: number,
  to: number,
  isEditMode: boolean,
): DecorationSpec {
  return {
    from,
    to,
    decoration: Decoration.mark({
      class: isEditMode ? "cm-dim-marker" : "cm-hidden",
      attributes: {
        style: getMarkerStyle(isEditMode),
      },
    }),
  };
}

/**
 * Create a decoration for styled text (e.g., headings, emphasis, strong)
 */
export function createStyledText(
  from: number,
  to: number,
  config: StyledTextConfig,
): DecorationSpec {
  return {
    from,
    to,
    decoration: Decoration.mark({
      class: config.className,
      attributes: {
        ...(config.attributes || {}),
        ...(config.style ? { style: config.style } : {}),
      },
    }),
  };
}

/**
 * Create a decoration for completely hidden text
 */
export function createHiddenText(from: number, to: number): DecorationSpec {
  return {
    from,
    to,
    decoration: Decoration.replace({}),
  };
}

/**
 * Create a decoration for subtle/dimmed text (e.g., delimiters)
 */
export function createDimmedText(
  from: number,
  to: number,
  className = "cm-dim-marker",
): DecorationSpec {
  return {
    from,
    to,
    decoration: Decoration.mark({
      class: className,
      attributes: {
        style: "opacity: 0.4;",
      },
    }),
  };
}

/**
 * Create a decoration for very subtle text (e.g., table pipes)
 */
export function createVerySubtleText(
  from: number,
  to: number,
  className = "cm-very-subtle",
): DecorationSpec {
  return {
    from,
    to,
    decoration: Decoration.mark({
      class: className,
      attributes: {
        style: "opacity: 0.3;",
      },
    }),
  };
}

/**
 * Create a widget decoration at a specific position
 */
export function createWidget(
  pos: number,
  widget: WidgetType,
  side = 1,
): DecorationSpec {
  return {
    from: pos,
    to: pos,
    decoration: Decoration.widget({
      widget,
      side,
    }),
  };
}

/**
 * Create multiple hidden marker decorations efficiently
 */
export function createHiddenMarkers(
  ranges: Array<{ from: number; to: number }>,
  isEditMode: boolean,
): DecorationSpec[] {
  return ranges.map((range) =>
    createHiddenMarker(range.from, range.to, isEditMode),
  );
}

/**
 * Safely create a replacement decoration (checks for line breaks)
 *
 * CM6 does not allow replacing text that contains line breaks via plugins.
 * This helper checks if the range is safe to replace.
 */
export function createSafeReplacement(
  from: number,
  to: number,
  lineText: string,
  startOffset = 0,
): DecorationSpec | null {
  const textToReplace = lineText.slice(from - startOffset, to - startOffset);

  // Don't replace if it contains line breaks
  if (textToReplace.includes("\n")) {
    return null;
  }

  return {
    from,
    to,
    decoration: Decoration.replace({}),
  };
}

/**
 * Sort decoration specs by position (required by CM6)
 *
 * CM6's RangeSetBuilder requires decorations to be added in sorted order.
 * This helper ensures decorations are properly sorted.
 */
export function sortDecorations(
  decorations: DecorationSpec[],
): DecorationSpec[] {
  return decorations.sort((a, b) => {
    // RangeSetBuilder requires ranges ordered by `from`, then by `startSide`.
    // For identical `from`/`startSide`, order by `to` and then `endSide` to keep it stable/deterministic.
    const aStartSide =
      (a.decoration as any)?.startSide ??
      (a.decoration as any)?.spec?.startSide ??
      0;
    const bStartSide =
      (b.decoration as any)?.startSide ??
      (b.decoration as any)?.spec?.startSide ??
      0;

    const aEndSide =
      (a.decoration as any)?.endSide ??
      (a.decoration as any)?.spec?.endSide ??
      0;
    const bEndSide =
      (b.decoration as any)?.endSide ??
      (b.decoration as any)?.spec?.endSide ??
      0;

    if (a.from !== b.from) return a.from - b.from;
    if (aStartSide !== bStartSide) return aStartSide - bStartSide;
    if (a.to !== b.to) return a.to - b.to;
    return aEndSide - bEndSide;
  });
}

/**
 * Filter out invalid decorations
 *
 * Removes decorations where from >= to (invalid ranges)
 */
export function filterValidDecorations(
  decorations: DecorationSpec[],
): DecorationSpec[] {
  return decorations.filter((spec) => spec.from < spec.to);
}

/**
 * Create decorations for hiding both opening and closing markers
 */
export function createPairedMarkers(
  openFrom: number,
  openTo: number,
  closeFrom: number,
  closeTo: number,
  isEditMode: boolean,
): DecorationSpec[] {
  return [
    createHiddenMarker(openFrom, openTo, isEditMode),
    createHiddenMarker(closeFrom, closeTo, isEditMode),
  ];
}
