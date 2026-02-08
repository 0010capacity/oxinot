/**
 * Intent Classification System
 * Determines user intent (conversational, information, creation, modification)
 * to enable flexible tool usage and response patterns.
 *
 * Key Principle: Intent-First Philosophy
 * - CONVERSATIONAL: Casual chat, no tools needed
 * - INFORMATION_REQUEST: Need data lookup, limited tools
 * - CONTENT_CREATION: Create new blocks/pages, full tool access
 * - CONTENT_MODIFICATION: Edit/delete existing, full tool access
 */

export type Intent =
  | "CONVERSATIONAL"
  | "INFORMATION_REQUEST"
  | "CONTENT_CREATION"
  | "CONTENT_MODIFICATION";

interface IntentClassificationResult {
  intent: Intent;
  confidence: number; // 0-1, higher = more confident
  reasoning: string;
}

/**
 * Regex patterns for intent detection
 * Ordered by specificity: most specific patterns first
 */
const PATTERNS = {
  // Content modification intents (highest priority)
  modification: [
    /^(?:delete|remove|erase|destroy|discard)\s+/i,
    /^(?:update|edit|modify|change|replace|revise|rewrite)\s+/i,
    /^(?:move|rename|reorganize|reorder)\s+/i,
    /^(?:merge|combine|split|break|separate)\s+/i,
  ],

  // Content creation intents
  creation: [
    /^(?:create|make|add|write|generate|draft|compose)\s+/i,
    /^(?:new|write)\s+(?:page|block|note|document|list|outline)/i,
    /^(?:plan|outline|structure|organize|outline)\s+/i,
    /^(?:convert|transform|format|restructure)\s+.*(?:into|to|as)\s+/i,
  ],

  // Information request intents
  information: [
    /^(?:what|where|when|who|which|why|how)\s+/i,
    /^(?:tell|show|find|search|look up|list|get|retrieve)\s+/i,
    /^(?:list|show|display)\s+(?:all|the|recent|latest)\s+/i,
    /^(?:do you|can you|could you)\s+(?:know|see|find|tell me)/i,
  ],

  // Conversational patterns (lower priority)
  conversational: [
    /^(?:thanks|thank you|appreciate|cool|awesome|nice|good|great|ok|sure|yeah)/i,
    /^(?:hello|hi|hey|greetings|good\s+(?:morning|afternoon|evening))/i,
    /^(?:how\s+(?:are|are you|is|is it))\s+/i,
    /^(?:what\s+do\s+you\s+think|your\s+(?:opinion|thoughts))/i,
  ],
};

/**
 * Special markers that indicate content modification regardless of verb
 */
const MODIFICATION_MARKERS = [/delete_block/, /delete_page/, /remove_block/];

/**
 * Keywords that always indicate information requests
 */
const INFORMATION_KEYWORDS = [
  "list",
  "show",
  "find",
  "search",
  "look",
  "retrieve",
  "get",
  "fetch",
];

/**
 * Classify user intent from input text
 * Supports English and Korean inputs
 *
 * @param userInput - The user's input text
 * @returns Classification result with intent and confidence
 */
export function classifyIntent(userInput: string): IntentClassificationResult {
  if (!userInput || userInput.trim().length === 0) {
    return {
      intent: "CONVERSATIONAL",
      confidence: 0.5,
      reasoning: "Empty input",
    };
  }

  const trimmed = userInput.trim();

  // Check for modification markers (tool-specific indicators)
  for (const marker of MODIFICATION_MARKERS) {
    if (marker.test(trimmed)) {
      return {
        intent: "CONTENT_MODIFICATION",
        confidence: 0.95,
        reasoning: "Tool marker detected in input",
      };
    }
  }

  // Check for modification patterns
  for (const pattern of PATTERNS.modification) {
    if (pattern.test(trimmed)) {
      return {
        intent: "CONTENT_MODIFICATION",
        confidence: 0.9,
        reasoning: "Modification verb detected",
      };
    }
  }

  // Check for creation patterns
  for (const pattern of PATTERNS.creation) {
    if (pattern.test(trimmed)) {
      return {
        intent: "CONTENT_CREATION",
        confidence: 0.9,
        reasoning: "Creation verb detected",
      };
    }
  }

  // Check for information patterns and keywords
  const hasInfoKeyword = INFORMATION_KEYWORDS.some((keyword) =>
    new RegExp(`\\b${keyword}\\b`, "i").test(trimmed),
  );

  if (hasInfoKeyword) {
    return {
      intent: "INFORMATION_REQUEST",
      confidence: 0.85,
      reasoning: "Information keyword found",
    };
  }

  for (const pattern of PATTERNS.information) {
    if (pattern.test(trimmed)) {
      return {
        intent: "INFORMATION_REQUEST",
        confidence: 0.8,
        reasoning: "Question pattern detected",
      };
    }
  }

  // Check for conversational patterns
  for (const pattern of PATTERNS.conversational) {
    if (pattern.test(trimmed)) {
      return {
        intent: "CONVERSATIONAL",
        confidence: 0.85,
        reasoning: "Conversational phrase detected",
      };
    }
  }

  // Default: If input contains multiple sentences or reads like instructions,
  // lean toward CONTENT_CREATION. Otherwise CONVERSATIONAL.
  const sentenceCount = trimmed.split(/[.!?]+/).filter((s) => s.trim()).length;
  const isLongInput = trimmed.length > 100;
  const seemsLikeInstruction =
    /(?:do|make|create|write|generate|plan|organize)\b/i.test(trimmed);

  if ((sentenceCount > 1 || isLongInput) && seemsLikeInstruction) {
    return {
      intent: "CONTENT_CREATION",
      confidence: 0.6,
      reasoning: "Multi-sentence instruction pattern",
    };
  }

  // Fallback: treat as conversational
  return {
    intent: "CONVERSATIONAL",
    confidence: 0.5,
    reasoning: "No strong intent markers detected",
  };
}

/**
 * Check if intent is a creation/modification type (requires tool access)
 */
export function isContentModification(intent: Intent): boolean {
  return intent === "CONTENT_CREATION" || intent === "CONTENT_MODIFICATION";
}

/**
 * Check if intent is conversational (no tools needed)
 */
export function isConversational(intent: Intent): boolean {
  return intent === "CONVERSATIONAL";
}
