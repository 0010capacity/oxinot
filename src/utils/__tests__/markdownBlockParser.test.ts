import { describe, expect, it } from "vitest";
import {
  type ParsedBlockNode,
  flattenBlockHierarchy,
  parseMarkdownToBlocks,
} from "../markdownBlockParser";

describe("parseMarkdownToBlocks", () => {
  it("should parse flat list items", () => {
    const markdown = "- Item 1\n- Item 2\n- Item 3";
    const result = parseMarkdownToBlocks(markdown);

    expect(result).toHaveLength(3);
    expect(result[0].content).toBe("Item 1");
    expect(result[1].content).toBe("Item 2");
    expect(result[2].content).toBe("Item 3");
    expect(result.every((node) => node.indent === 0)).toBe(true);
  });

  it("should parse nested list items", () => {
    const markdown = `- Root
  - Child 1
  - Child 2
- Another root`;

    const result = parseMarkdownToBlocks(markdown);

    expect(result).toHaveLength(2);
    expect(result[0].content).toBe("Root");
    expect(result[0].children).toHaveLength(2);
    expect(result[0].children[0].content).toBe("Child 1");
    expect(result[0].children[1].content).toBe("Child 2");
    expect(result[1].content).toBe("Another root");
    expect(result[1].children).toHaveLength(0);
  });

  it("should parse deeply nested structures", () => {
    const markdown = `- Level 0
  - Level 1
    - Level 2
      - Level 3`;

    const result = parseMarkdownToBlocks(markdown);

    expect(result).toHaveLength(1);
    expect(result[0].content).toBe("Level 0");
    expect(result[0].children[0].content).toBe("Level 1");
    expect(result[0].children[0].children[0].content).toBe("Level 2");
    expect(result[0].children[0].children[0].children[0].content).toBe(
      "Level 3"
    );
  });

  it("should handle Korean text", () => {
    const markdown = `- 모든 것이 블록입니다
- 블록은 중첩될 수 있습니다
  - 이것은 중첩된 블록
    - 이것은 더 깊은 중첩
- 무한한 확장 가능성`;

    const result = parseMarkdownToBlocks(markdown);

    expect(result).toHaveLength(3);
    expect(result[0].content).toBe("모든 것이 블록입니다");
    expect(result[1].content).toBe("블록은 중첩될 수 있습니다");
    expect(result[1].children).toHaveLength(1);
    expect(result[1].children[0].content).toBe("이것은 중첩된 블록");
    expect(result[1].children[0].children[0].content).toBe(
      "이것은 더 깊은 중첩"
    );
    expect(result[2].content).toBe("무한한 확장 가능성");
  });

  it("should skip empty lines", () => {
    const markdown = `- Item 1

- Item 2

- Item 3`;

    const result = parseMarkdownToBlocks(markdown);

    expect(result).toHaveLength(3);
    expect(result[0].content).toBe("Item 1");
    expect(result[1].content).toBe("Item 2");
    expect(result[2].content).toBe("Item 3");
  });

  it("should handle different bullet markers", () => {
    const markdown = `- Dash
* Asterisk
+ Plus`;

    const result = parseMarkdownToBlocks(markdown);

    expect(result).toHaveLength(3);
    expect(result[0].content).toBe("Dash");
    expect(result[1].content).toBe("Asterisk");
    expect(result[2].content).toBe("Plus");
  });

  it("should normalize AI-generated markdown with 1 space to 2 spaces", () => {
    // AI often generates "- Parent\n - Child" (1 space) instead of 2 spaces
    const markdownWithOneSpace = `- Parent
 - Child 1
 - Child 2
 - Child 3`;

    const result = parseMarkdownToBlocks(markdownWithOneSpace);

    expect(result).toHaveLength(1);
    expect(result[0].content).toBe("Parent");
    expect(result[0].children).toHaveLength(3);
    expect(result[0].children[0].content).toBe("Child 1");
    expect(result[0].children[0].indent).toBe(1);
    expect(result[0].children[1].content).toBe("Child 2");
    expect(result[0].children[1].indent).toBe(1);
    expect(result[0].children[2].content).toBe("Child 3");
    expect(result[0].children[2].indent).toBe(1);
  });

  it("should normalize mixed indentation with odd spaces", () => {
    const markdownWithOddSpaces = `- Level 0
 - Level 1 (1 space, should become 2)
   - Level 2 (3 spaces, should become 4)
     - Level 3 (5 spaces, should become 6)`;

    const result = parseMarkdownToBlocks(markdownWithOddSpaces);

    expect(result).toHaveLength(1);
    expect(result[0].content).toBe("Level 0");
    expect(result[0].indent).toBe(0);
    expect(result[0].children[0].content).toBe(
      "Level 1 (1 space, should become 2)"
    );
    expect(result[0].children[0].indent).toBe(1);
    expect(result[0].children[0].children[0].content).toBe(
      "Level 2 (3 spaces, should become 4)"
    );
    expect(result[0].children[0].children[0].indent).toBe(2);
    expect(result[0].children[0].children[0].children[0].content).toBe(
      "Level 3 (5 spaces, should become 6)"
    );
    expect(result[0].children[0].children[0].children[0].indent).toBe(3);
  });

  it("should handle Solar System example with AI-style 1-space indentation", () => {
    const solarSystemWithOneSpace = `- 태양계 개요
 - 태양계는 태양을 중심으로 하는 행성계
 - 약 46억 년 전에 형성됨
 - 태양의 중력으로 묶여 있는 천체들
- 태양
 - 태양계의 중심에 있는 항성
 - 전체 질량의 99.86% 차지
- 행성
 - 수성
 - 금성
 - 지구
 - 화성`;

    const result = parseMarkdownToBlocks(solarSystemWithOneSpace);

    expect(result).toHaveLength(3);

    // 태양계 개요
    expect(result[0].content).toBe("태양계 개요");
    expect(result[0].children).toHaveLength(3);
    expect(result[0].children[0].indent).toBe(1);
    expect(result[0].children[1].indent).toBe(1);
    expect(result[0].children[2].indent).toBe(1);

    // 태양
    expect(result[1].content).toBe("태양");
    expect(result[1].children).toHaveLength(2);
    expect(result[1].children[0].indent).toBe(1);
    expect(result[1].children[1].indent).toBe(1);

    // 행성 (with siblings)
    expect(result[2].content).toBe("행성");
    expect(result[2].children).toHaveLength(4);
    expect(result[2].children[0].content).toBe("수성");
    expect(result[2].children[0].indent).toBe(1);
    expect(result[2].children[1].content).toBe("금성");
    expect(result[2].children[1].indent).toBe(1);
    expect(result[2].children[2].content).toBe("지구");
    expect(result[2].children[2].indent).toBe(1);
    expect(result[2].children[3].content).toBe("화성");
    expect(result[2].children[3].indent).toBe(1);
  });

  it("should preserve indentation levels", () => {
    const markdown = `- Level 0
  - Level 1 (indent 2)
    - Level 2 (indent 4)
      - Level 3 (indent 6)`;

    const result = parseMarkdownToBlocks(markdown);
    const level1 = result[0];

    expect(level1.indent).toBe(0);
    expect(level1.children[0].indent).toBe(1);
    expect(level1.children[0].children[0].indent).toBe(2);
    expect(level1.children[0].children[0].children[0].indent).toBe(3);
  });
});

describe("flattenBlockHierarchy", () => {
  it("should flatten hierarchy with parent references", () => {
    const nodes: ParsedBlockNode[] = [
      {
        content: "Root",
        indent: 0,
        lineNumber: 0,
        children: [
          {
            content: "Child 1",
            indent: 1,
            lineNumber: 1,
            children: [],
          },
          {
            content: "Child 2",
            indent: 1,
            lineNumber: 2,
            children: [],
          },
        ],
      },
      {
        content: "Another Root",
        indent: 0,
        lineNumber: 3,
        children: [],
      },
    ];

    const result = flattenBlockHierarchy(nodes);

    expect(result).toHaveLength(4);

    expect(result[0].content).toBe("Root");
    expect(result[0].parentBlockId).toBe(null);

    expect(result[1].content).toBe("Child 1");
    expect(result[1].parentBlockId).toMatch(/^temp_/);

    expect(result[2].content).toBe("Child 2");
    expect(result[2].parentBlockId).toBe(result[1].parentBlockId);

    expect(result[3].content).toBe("Another Root");
    expect(result[3].parentBlockId).toBe(null);
  });

  it("should set proper insert order with insertAfterBlockId", () => {
    const nodes: ParsedBlockNode[] = [
      {
        content: "Item 1",
        indent: 0,
        lineNumber: 0,
        children: [],
      },
      {
        content: "Item 2",
        indent: 0,
        lineNumber: 1,
        children: [],
      },
      {
        content: "Item 3",
        indent: 0,
        lineNumber: 2,
        children: [],
      },
    ];

    const result = flattenBlockHierarchy(nodes);

    expect(result).toHaveLength(3);
    expect(result[0].insertAfterBlockId).toBeNull();
    expect(result[1].insertAfterBlockId).toBeDefined();
    expect(result[1].insertAfterBlockId).toMatch(/^temp_/);
    expect(result[2].insertAfterBlockId).toBeDefined();
    expect(result[2].insertAfterBlockId).toMatch(/^temp_/);
    expect(result[1].insertAfterBlockId).not.toBe(result[2].insertAfterBlockId);
  });
});

describe("Solar System Example - Hierarchical Structure", () => {
  it("should parse Solar System with planets as siblings under Mercury parent (after normalization)", () => {
    // Note: With 1-space indentation normalization, " - Venus" becomes "  - Venus"
    // This makes all planets children of Mercury (first item)
    const solarSystemMarkdown = `- Mercury
 - Venus
 - Earth
   - Moon
 - Mars
 - Jupiter
 - Saturn
 - Uranus
 - Neptune`;

    const result = parseMarkdownToBlocks(solarSystemMarkdown);

    // After normalization, all items with 1 space become children of Mercury
    expect(result).toHaveLength(1);
    expect(result[0].content).toBe("Mercury");
    expect(result[0].children).toHaveLength(7);
    expect(result[0].children[0].content).toBe("Venus");
    expect(result[0].children[1].content).toBe("Earth");
    expect(result[0].children[1].children).toHaveLength(1);
    expect(result[0].children[1].children[0].content).toBe("Moon");
    expect(result[0].children[2].content).toBe("Mars");
  });

  it("should flatten Solar System structure with correct parent relationships (after normalization)", () => {
    // After normalization, Venus/Earth/Mars become children of Mercury
    const solarSystemMarkdown = `- Mercury
 - Venus
 - Earth
   - Moon
 - Mars`;

    const nodes = parseMarkdownToBlocks(solarSystemMarkdown);
    const flattened = flattenBlockHierarchy(nodes);

    expect(flattened).toHaveLength(5);

    const mercury = flattened[0];
    const venus = flattened[1];
    const earth = flattened[2];
    const moon = flattened[3];
    const mars = flattened[4];

    expect(mercury.content).toBe("Mercury");
    expect(mercury.parentBlockId).toBeNull();

    expect(venus.content).toBe("Venus");
    expect(venus.parentBlockId).toMatch(/^temp_/); // Child of Mercury after normalization

    expect(earth.content).toBe("Earth");
    expect(earth.parentBlockId).toMatch(/^temp_/); // Child of Mercury after normalization

    expect(moon.content).toBe("Moon");
    expect(moon.parentBlockId).toBeDefined();
    expect(moon.parentBlockId).not.toBeNull();

    expect(mars.content).toBe("Mars");
    expect(mars.parentBlockId).toMatch(/^temp_/); // Child of Mercury after normalization
  });
});
