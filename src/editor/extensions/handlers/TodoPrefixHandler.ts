import type { SyntaxNode } from "@lezer/common";
import type { DecorationSpec } from "../utils/decorationHelpers";
import { createHiddenMarker } from "../utils/decorationHelpers";
import { BaseHandler, type RenderContext } from "./types";

const TODO_PREFIX_REGEX = /^(TODO|DOING|DONE|LATER|CANCELED)(\s)/;

export class TodoPrefixHandler extends BaseHandler {
  constructor() {
    super("TodoPrefixHandler");
  }

  canHandle(_node: SyntaxNode): boolean {
    return false;
  }

  handle(_node: SyntaxNode, _context: RenderContext): DecorationSpec[] {
    return [];
  }

  static processLine(
    lineText: string,
    lineFrom: number,
    isEditMode: boolean,
  ): DecorationSpec[] {
    const decorations: DecorationSpec[] = [];

    const match = lineText.match(TODO_PREFIX_REGEX);
    if (!match) {
      return decorations;
    }

    const prefix = match[0];
    const start = 0;
    const end = prefix.length;
    const absoluteStart = lineFrom + start;
    const absoluteEnd = lineFrom + end;

    decorations.push(
      createHiddenMarker(absoluteStart, absoluteEnd, isEditMode),
    );

    return decorations;
  }
}
