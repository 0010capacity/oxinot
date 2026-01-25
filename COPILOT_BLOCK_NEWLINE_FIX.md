# 코파일럿 블록 생성 - 실제 문제 분석

## 🎯 정확한 문제 이해

### 사용자의 설명
> "마크다운 문법은 지원하지. 헤딩 써도 되는데. **우리 인간이 문서를 쓸 때에는 엔터를 눌러 개행하면 밑에 새로운 블록이 분할되는거지** 해당 블록 안에서 개행되는게 아니야."

### 즉, 문제는:

**현재 코파일럿의 동작** ❌
```
코파일럿이 생성한 블록:
- Project: Oxinot Documentation
  Overview
  Oxinot is a block-based outliner...
  
  Key Features
  - Local-first architecture
  - Block-based editing
  
  Tech Stack
  - Frontend: React + TypeScript
  - Backend: Tauri + Rust

→ 한 개의 블록 안에 \n (줄바꿈)으로 모든 내용이 들어있음
→ 사용자가 엔터를 누르면 "이 블록 내에서" 줄이 바뀜
```

**원하는 동작** ✅
```
인간이 수동으로 작성할 때:
- Project: Oxinot Documentation    [블록 1]
  ↓ (엔터)
  - Overview                         [블록 2 - 자식]
    ↓ (엔터)
    - Oxinot is a block-based...    [블록 3 - 손자]
  ↓ (엔터)
  - Key Features                     [블록 4 - 자식]
    ↓ (엔터)
    - Local-first architecture       [블록 5 - 손자]
    ↓ (엔터)
    - Block-based editing            [블록 6 - 손자]

→ 각 줄이 **별도의 블록**
→ 각 블록은 들여쓰기로 계층 구조 표현
→ 사용자가 엔터를 누르면 "새로운 블록" 생성
```

---

## 🔍 근본 원인

### 현재 코파일럿의 문제점

**1️⃣ 마크다운 포맷을 그대로 블록에 넣음**
```typescript
❌ WRONG - AI가 하는 일
create_page_with_blocks({
  blocks: [{
    content: `# Overview
Oxinot is a block-based outliner...

## Key Features
- Local-first architecture
- Block-based editing

## Tech Stack`
  }]
})
```

**문제**: 
- 하나의 `content` 필드에 `\n`을 포함한 텍스트 그대로 넣음
- CodeMirror가 이 텍스트를 **한 블록 내에서** 표시
- 사용자는 이 블록 안에서 엔터를 누르면 **줄만 바뀜**, 새 블록이 안 만들어짐

**2️⃣ 현재 시스템 프롬프트의 오류**
이전에 추가한 프롬프트:
```
RIGHT PATTERN ✅ (Creates separate blocks with hierarchy):
create_page_with_blocks({
  blocks: [
    { content: "Overview", indent: 0 },
    { content: "Oxinot is a block-based outliner application...", indent: 1 },
    ...
  ]
})
```

이건 맞는데, **AI가 이 지침을 무시하고** 여전히 마크다운을 한 블록에 넣고 있음.

---

## 💡 해결책

### 근본 원인: AI가 마크다운 형식으로 생각함

**마크다운 문법:**
```markdown
# Heading 1
Content 1

## Heading 2
Content 2
```

**필요한 변환:**
```
마크다운의 "줄" → 하나의 블록
마크다운의 "들여쓰기" → indent 값
```

### 시스템 프롬프트 개선 (수정)

더 명확하게, **마크다운을 블록으로 변환하는 방법**을 명시해야 함:

```typescript
⭐ CRITICAL: MARKDOWN TO BLOCKS CONVERSION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
In Oxinot, you CANNOT put markdown with newlines inside a single block.
Each semantic line in markdown = ONE SEPARATE BLOCK

MARKDOWN → BLOCKS CONVERSION RULES:

Input (Markdown with newlines):
# Heading 1
Content under heading 1
## Sub-heading
Content under sub-heading

WRONG ❌ - Do NOT do this:
blocks: [{
  content: "# Heading 1\nContent under heading 1\n## Sub-heading\nContent under sub-heading"
}]
← Results in ONE block with internal newlines. When user presses Enter, they edit within this block.

RIGHT ✅ - Do this instead:
blocks: [
  { content: "Heading 1", indent: 0 },
  { content: "Content under heading 1", indent: 1 },
  { content: "Sub-heading", indent: 1 },
  { content: "Content under sub-heading", indent: 2 }
]
← Results in 4 separate blocks. When user presses Enter in any block, a NEW block is created.

CONVERSION ALGORITHM:
1. Parse markdown line by line
2. For each line:
   - Determine indent based on heading level (# → 0, ## → 1, ### → 2, etc.)
   - Remove markdown syntax (# ## symbols)
   - Create ONE block per line
3. Maintain hierarchy via indent

EXAMPLES:

Input markdown:
# Project Documentation
This is an overview of the project.
## Features
- Feature 1: Description
- Feature 2: Description
## Implementation
- Backend: Node.js
- Frontend: React

Conversion:
blocks: [
  { content: "Project Documentation", indent: 0 },
  { content: "This is an overview of the project.", indent: 1 },
  { content: "Features", indent: 1 },
  { content: "Feature 1: Description", indent: 2 },
  { content: "Feature 2: Description", indent: 2 },
  { content: "Implementation", indent: 1 },
  { content: "Backend: Node.js", indent: 2 },
  { content: "Frontend: React", indent: 2 }
]

KEY PRINCIPLE:
A block's content is a SINGLE LINE of text.
If you see a newline (\n) in your planned content → CREATE A NEW BLOCK instead.

ANTI-PATTERN ❌:
```
content: "Line 1\nLine 2\nLine 3"  ← This is WRONG
```

CORRECT PATTERN ✅:
```
blocks: [
  { content: "Line 1", indent: 0 },
  { content: "Line 2", indent: 0 },
  { content: "Line 3", indent: 0 }
]
```

INDENT RULES:
- Heading levels map to indent:
  - # (top-level heading) → indent: 0
  - ## (second-level heading) → indent: 1
  - ### (third-level heading) → indent: 2
- Content under a heading → indent: heading-level + 1
- List items → Same indent as their nesting level

TOOL TO USE:
When you have structured content with multiple lines/items:
ALWAYS use create_page_with_blocks (not create_page + multiple create_block calls)
This ensures all blocks are created atomically with proper hierarchy.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## 📝 수정 코드

파일: `src/services/ai/agent/orchestrator.ts`  
메서드: `buildSystemPrompt` (라인 257)

**변경사항**: 기존 추가된 CRITICAL 섹션을 완전히 교체

```diff
- ⭐ CRITICAL: STRUCTURED CONTENT MUST USE SEPARATE BLOCKS
- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- When creating ANY structured content (documentation, outlines, lists, hierarchies):
- EACH SEMANTIC ITEM = ONE SEPARATE BLOCK with appropriate indent level.
- 
- WRONG PATTERN ❌ (Creates ONE massive block):
- create_page_with_blocks({
-   title: "Documentation",
-   blocks: [{
-     content: "# Overview\\nOxinot is a block-based outliner...\\n## Features\\n- Feature 1\\n- Feature 2\\n## Tech Stack\\n- Frontend: React\\n- Backend: Tauri"
-   }]
- })
- Result: Everything in one block (flat markdown, not Logseq/Roam style)
- 
- RIGHT PATTERN ✅ (Creates separate blocks with hierarchy):
- create_page_with_blocks({
-   title: "Documentation",
-   blocks: [
-     { content: "Overview", indent: 0 },
-     { content: "Oxinot is a block-based outliner application built with Tauri...", indent: 1 },
-     { content: "Features", indent: 0 },
-     { content: "Block-based editing: Structure your thoughts with nested blocks", indent: 1 },
-     { content: "Graph view: Visualize connections between your notes", indent: 1 },
-     { content: "Tech Stack", indent: 0 },
-     { content: "Frontend: React + TypeScript + TailwindCSS", indent: 1 },
-     { content: "Backend: Tauri + Rust", indent: 1 }
-   ]
- })
- Result: 8 separate editable blocks (true outliner style, can collapse/expand)
- 
- INDENT RULES:
- - indent: 0 = Root level (main section titles)
- - indent: 1 = First nested level (subsections or content)
- - indent: 2 = Second nested level (sub-subsections)
- - indent: 3+ = Deeper nesting as needed
- 
- BLOCK BOUNDARY RULES:
- - Headings (# ## ###) → Each becomes a separate block at appropriate indent
- - List items → Each item is a separate block
- - Paragraphs → Can be 1 block each (or grouped if closely related)
- - Code blocks → 1 block with triple backticks
- - Sections → Represented as blocks, not markdown syntax
- 
- ANTI-PATTERNS TO AVOID:
- - Do NOT use markdown headings (# ## ###) inside block content
- - Do NOT use list bullets (- [ ]) inside block content to represent items
- - Do NOT put multiple semantic units in one block
- - Instead: Create each unit as its own block at appropriate indent
- 
- TOOL SELECTION FOR STRUCTURED CONTENT:
- - create_page_with_blocks: Creating new page with 5+ items → use for structured content
- - create_block: Adding single blocks to existing pages
- - update_block: Modifying existing block content
- - insert_block_below: Adding blocks in specific locations
- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

+ ⭐ CRITICAL: MARKDOWN TO BLOCKS CONVERSION (EACH LINE = ONE BLOCK)
+ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
+ FUNDAMENTAL RULE: In Oxinot, when you see markdown with newlines (\n),
+ you MUST convert each line to a SEPARATE BLOCK with proper indent.
+ You CANNOT put multi-line text (with \n) in a single block's content.
+
+ WHY: When a user presses Enter in a block:
+ - WRONG DESIGN: If block.content = "Line1\nLine2\nLine3", 
+   pressing Enter just adds a newline WITHIN that block
+ - CORRECT DESIGN: Each line is separate block,
+   pressing Enter creates a NEW block below (Logseq/Roam style)
+
+ MARKDOWN → BLOCKS CONVERSION ALGORITHM:
+ 1. Parse your markdown output line by line
+ 2. For each non-empty line:
+    a) Detect heading level from # symbols
+    b) Remove # symbols from content
+    c) Calculate indent: (heading_level - 1) or context-based
+    d) Create ONE block per line
+ 3. Result: Multiple blocks with hierarchy via indent
+
+ EXAMPLE CONVERSION:
+
+ Your planned markdown output:
+ ---
+ # Project Documentation
+ Oxinot is a block-based outliner.
+ ## Overview
+ Fast, lightweight, keyboard-driven.
+ ## Features
+ - Local-first architecture
+ - Block-based editing
+ ---
+
+ WRONG ❌ - Do NOT do this:
+ blocks: [{
+   content: "# Project Documentation\nOxinot is a block-based outliner.\n## Overview\nFast, lightweight, keyboard-driven.\n## Features\n- Local-first architecture\n- Block-based editing"
+ }]
+ Result: ONE block. User presses Enter → just adds newline inside this block.
+
+ RIGHT ✅ - Do THIS instead:
+ blocks: [
+   { content: "Project Documentation", indent: 0 },
+   { content: "Oxinot is a block-based outliner.", indent: 1 },
+   { content: "Overview", indent: 1 },
+   { content: "Fast, lightweight, keyboard-driven.", indent: 2 },
+   { content: "Features", indent: 1 },
+   { content: "Local-first architecture", indent: 2 },
+   { content: "Block-based editing", indent: 2 }
+ ]
+ Result: 7 blocks. User presses Enter in "Overview" block → NEW block is created below it.
+
+ INDENT CALCULATION:
+ - # heading → indent: 0 (root)
+ - ## heading → indent: 1 (section)
+ - ### heading → indent: 2 (subsection)
+ - Content under heading → indent: heading_indent + 1
+ - List items → indent: nesting_level
+
+ CHECKING YOUR WORK:
+ Before calling create_page_with_blocks, verify:
+ - [ ] Each block.content is a SINGLE LINE (no \n characters)
+ - [ ] No block contains # ## ### symbols (already removed)
+ - [ ] Indent values increase/decrease logically
+ - [ ] Related content is nested under section headers
+
+ TOOLS:
+ - create_page_with_blocks: For structured content at page creation
+ - create_block: For adding single blocks later
+ - insert_block_below: For precise placement
+ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## ✨ 예상 결과

### 수정 전
```
사용자: "Oxinot 문서 작성"
↓
AI: create_page_with_blocks로 전체 마크다운을 한 블록에
↓
결과: 
- Project: Oxinot Documentation
  [한 블록 안에 모든 내용]
  
사용자가 이 블록 내에서 엔터를 누르면 → 줄만 바뀜 (새 블록 안 됨)
```

### 수정 후
```
사용자: "Oxinot 문서 작성"
↓
AI: 마크다운을 파싱하여 각 줄을 별도 블록으로 생성
↓
결과:
- Project: Oxinot Documentation
  - Oxinot is a block-based outliner...
  - Overview
    - Fast, lightweight, keyboard-driven
  - Features
    - Local-first architecture
    - Block-based editing
  
사용자가 "Features" 블록에서 엔터를 누르면 → 새로운 블록 생성 (엔터 처리 작동!)
```

---

## 🎓 결론

### 문제
- 코파일럿이 마크다운을 **하나의 거대한 블록**에 넣음
- 사용자는 그 블록 내에서만 엔터할 수 있음 (새 블록이 안 만들어짐)
- 따라서 아웃라이너처럼 느껴지지 않음

### 원인
- 시스템 프롬프트가 **마크다운 형식의 뉘앙스**를 충분히 강조하지 않음
- "각 줄은 하나의 블록이어야 한다"는 것이 명확하지 않음

### 해결
- 시스템 프롬프트에 **마크다운→블록 변환 알고리즘** 명시
- AI가 블록을 생성할 때 자동으로 **줄 단위로 분리**하도록 유도
- 예제로 ❌ WRONG과 ✅ RIGHT 명확하게 보여주기

---

**변경파일**: `src/services/ai/agent/orchestrator.ts`  
**변경범위**: 라인 273-327 (기존 CRITICAL 섹션 교체)  
**변경난이도**: ⭐⭐ (간단, 텍스트 교체)
