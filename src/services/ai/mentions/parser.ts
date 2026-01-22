export interface Mention {
  type: "block" | "page" | "selection" | "current";
  uuid?: string;
  text: string; // Original mention text
  start: number; // Start position in text
  end: number; // End position in text
}

/**
 * Parse @-mentions from user input
 */
export function parseMentions(text: string): Mention[] {
  const mentions: Mention[] = [];

  // Regex patterns for different mention types
  const patterns = [
    { type: "block", regex: /@block:([0-9a-f-]{36})/gi },
    { type: "page", regex: /@page:([0-9a-f-]{36})/gi },
    { type: "selection", regex: /@selection\b/gi },
    { type: "current", regex: /@current\b/gi },
  ];

  for (const { type, regex } of patterns) {
    // Reset lastIndex because regex is global
    regex.lastIndex = 0;
    let match = regex.exec(text);
    while (match !== null) {
      mentions.push({
        type: type as Mention["type"],
        uuid: match[1],
        text: match[0],
        start: match.index,
        end: match.index + match[0].length,
      });
      match = regex.exec(text);
    }
  }

  // Sort by position
  return mentions.sort((a, b) => a.start - b.start);
}

/**
 * Check if cursor is inside a mention
 */
export function getMentionAtCursor(
  text: string,
  cursorPosition: number,
): Mention | null {
  const mentions = parseMentions(text);
  return (
    mentions.find(
      (m) => m.start <= cursorPosition && cursorPosition <= m.end,
    ) || null
  );
}

/**
 * Check if user is typing a new mention
 */
export function isTypingMention(
  text: string,
  cursorPosition: number,
): { trigger: string; query: string } | null {
  // Get text before cursor
  const textBeforeCursor = text.slice(0, cursorPosition);

  // Match @word or @block: or @page:
  // Use a regex that matches from the last @ symbol
  // ([\w]*)$ matches alphanumeric characters at the end
  const match = textBeforeCursor.match(/@([\w:]*)$/);

  if (match) {
    return {
      trigger: "@",
      query: match[1] || "",
    };
  }

  return null;
}
