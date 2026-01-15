/**
 * Metadata parsing utilities for block metadata
 * Handles parsing and validation of key::value format
 */

export interface ParsedMetadata {
  metadata: Record<string, string>;
  cleanContent: string;
}

/**
 * Check if a line matches the metadata format (key::value)
 */
export function isMetadataLine(line: string): boolean {
  const trimmed = line.trim();

  // Must contain :: but not at start or end
  if (!trimmed.includes("::")) {
    return false;
  }

  // Must not start with ID:: (that's the ID marker)
  if (trimmed.startsWith("ID::")) {
    return false;
  }

  // Split and validate
  const colonIndex = trimmed.indexOf("::");
  if (colonIndex <= 0 || colonIndex >= trimmed.length - 2) {
    return false;
  }

  const key = trimmed.slice(0, colonIndex).trim();
  const value = trimmed.slice(colonIndex + 2).trim();

  return key.length > 0 && value.length > 0;
}

/**
 * Parse a single metadata line into key and value
 */
export function parseMetadataLine(
  line: string
): { key: string; value: string } | null {
  if (!isMetadataLine(line)) {
    return null;
  }

  const trimmed = line.trim();
  const colonIndex = trimmed.indexOf("::");

  const key = trimmed.slice(0, colonIndex).trim();
  const value = trimmed.slice(colonIndex + 2).trim();

  return { key, value };
}

/**
 * Parse block content to extract metadata and clean content
 * Metadata lines are removed from content and returned separately
 */
export function parseBlockMetadata(content: string): ParsedMetadata {
  const lines = content.split("\n");
  const metadata: Record<string, string> = {};
  const contentLines: string[] = [];

  for (const line of lines) {
    const parsed = parseMetadataLine(line);
    if (parsed) {
      metadata[parsed.key] = parsed.value;
    } else {
      contentLines.push(line);
    }
  }

  return {
    metadata,
    cleanContent: contentLines.join("\n"),
  };
}

/**
 * Serialize metadata back to key::value format
 */
export function serializeMetadata(metadata: Record<string, string>): string {
  const entries = Object.entries(metadata);
  if (entries.length === 0) {
    return "";
  }

  // Sort by key for consistent output
  entries.sort(([a], [b]) => a.localeCompare(b));

  return entries.map(([key, value]) => `${key}::${value}`).join("\n");
}

/**
 * Merge content and metadata into a single string
 */
export function mergeContentWithMetadata(
  content: string,
  metadata: Record<string, string>
): string {
  const metadataStr = serializeMetadata(metadata);
  if (!metadataStr) {
    return content;
  }

  if (!content.trim()) {
    return metadataStr;
  }

  return `${content}\n${metadataStr}`;
}

/**
 * Validate if a string is valid JSON
 */
export function isValidJSON(str: string): boolean {
  try {
    JSON.parse(str);
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if a metadata value is a JSON object or array
 */
export function isJSONValue(value: string): boolean {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
    (trimmed.startsWith("[") && trimmed.endsWith("]"))
  ) {
    return isValidJSON(value);
  }
  return false;
}
