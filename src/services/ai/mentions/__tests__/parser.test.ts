import { describe, it, expect } from "vitest";
import { parseMentions, isTypingMention } from "../parser";

describe("Mention Parser", () => {
  it("should parse block mentions", () => {
    const text = "Check @block:123e4567-e89b-12d3-a456-426614174000";
    const mentions = parseMentions(text);

    expect(mentions).toHaveLength(1);
    expect(mentions[0].type).toBe("block");
    expect(mentions[0].uuid).toBe("123e4567-e89b-12d3-a456-426614174000");
  });

  it("should parse keyword mentions", () => {
    const text = "Use @selection and @current";
    const mentions = parseMentions(text);

    expect(mentions).toHaveLength(2);
    // Sort order depends on implementation, but likely by position
    expect(mentions[0].text).toBe("@selection");
    expect(mentions[1].text).toBe("@current");
  });

  it("should detect typing mention", () => {
    const text = "Hello @block";
    const result = isTypingMention(text, text.length);

    expect(result).not.toBeNull();
    expect(result?.trigger).toBe("@");
    expect(result?.query).toBe("block");
  });

  it("should detect typing mention with colon", () => {
    const text = "Hello @block:";
    const result = isTypingMention(text, text.length);

    expect(result).not.toBeNull();
    expect(result?.query).toBe("block:");
  });

  it("should not detect mention if not preceded by @", () => {
    const text = "Hello block";
    const result = isTypingMention(text, text.length);

    expect(result).toBeNull();
  });
});
