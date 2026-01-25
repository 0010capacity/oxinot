# 코파일럿 블록 생성 문제 분석 및 해결 방안

## 🚨 현재 문제

### 증상
코파일럿에게 "데모 노트 작성"을 요청했을 때:

**현재 동작** (❌ 잘못됨)
```
# 하나의 거대한 블록
- Project: Oxinot Documentation
  Overview
  Oxinot is a **block-based outliner** application built with Tauri...
  [모든 내용이 하나의 불렛 포인트에...]
```

**원하는 동작** (✅ 올바름)
```
- Project: Oxinot Documentation           # 블록 1
  - Overview                              # 블록 2 (자식)
  - Oxinot is a **block-based outliner**... # 블록 3 (자식)
    - Key Features                        # 블록 4 (손자)
      - Local-first architecture          # 블록 5 (증손)
      - Block-based editing
      - ...
  - Tech Stack                            # 블록 N
    - Frontend: React + TypeScript...     # 블록 N+1 (자식)
    - Backend: Tauri + Rust
    - ...
```

### 근본 원인
**시스템 프롬프트에 명시적인 "블록 단위 생성" 지침이 부족합니다.**

현재 시스템 프롬프트 (라인 262-344):
```typescript
"You are an AI agent in 'Oxinot', a block-based outliner (like Logseq/Roam).

BLOCK-BASED OUTLINER STRUCTURE:
- Each block is a bullet point with content
- Blocks can be nested (parent-child hierarchy)
- Types: bullet (text), code (triple backticks with language), fence (multiline text)
..."
```

**문제점**:
- ❌ "각 블록은 불렛 포인트"라고 설명만 하고
- ❌ 실제로 **블록 단위로 만들어야 한다**는 명시적 지침이 없음
- ❌ `create_page_with_blocks` 도구 사용 권장 없음
- ❌ 마크다운으로 계층 구조를 표현하면 안 된다는 경고 없음

---

## 🔍 원인 분석

### 1️⃣ 도구 선택 문제
코파일럿이 `create_page_with_blocks`를 사용할 수 있지만, **"언제 사용해야 하는지"** 모릅니다.

**현재 상황**:
```
요청: "데모 노트 작성"
↓
AI 생각: "마크다운 텍스트를 한 블록에 넣으면 되겠네?"
↓
사용 도구: create_page + (하나의 큰 블록)
↓
결과: 마크다운 포맷이 하나의 블록 안에...
```

### 2️⃣ 블록 생성 전략 부재
AI가 구조화된 데이터를 **블록으로 분해하는 방법**을 모릅니다.

```
원본 (구조화된 데이터):
{
  "title": "Project: Oxinot",
  "overview": "...",
  "features": ["feature1", "feature2"],
  "techStack": {
    "frontend": "React + TypeScript",
    ...
  }
}

AI가 이걸 어떻게 블록으로 변환해야 하는지 모름 ❌
```

### 3️⃣ 마크다운 vs 블록 구조 혼동
AI가 마크다운 문법(헤딩, 불렛)으로 계층 구조를 만들면:
- 사용자 입장: "아직도 평탄한 마크다운 텍스트일 뿐"
- 블록 에디터: "각 라인이 개별 블록이어야 하는데..."

---

## ✅ 해결 방안

### 1단계: 시스템 프롬프트 개선

**추가할 섹션** (orchestrator.ts의 buildSystemPrompt에):

```typescript
private buildSystemPrompt(_config: AgentConfig): string {
  const blockStore = useBlockStore.getState();
  const pageStore = usePageStore.getState();
  const uiStore = useBlockUIStore.getState();

  let systemPrompt = `You are an AI agent in 'Oxinot', a block-based outliner (like Logseq/Roam).

AGENT BEHAVIOR:
1. You MUST use tools to complete tasks - don't just describe what to do
2. Read current state first (list_pages, get_page_blocks) before making changes
3. Plan efficiently - avoid creating then deleting blocks
4. Use update_block instead of delete + create when possible
5. Only provide text responses when truly complete or need clarification
6. LEARN FROM FAILURES: If a tool call fails, DO NOT retry the same approach.
7. If you reach max iterations without completing, provide a summary.

⭐ CRITICAL: CREATING STRUCTURED CONTENT (NEW):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
When creating structured content (documentation, outlines, lists):
YOU MUST CREATE EACH ITEM AS A SEPARATE BLOCK, NOT AS MARKDOWN TEXT.

❌ WRONG - This creates ONE massive block:
create_page_with_blocks(
  title: "Project Documentation",
  blocks: [{
    content: "# Overview\\n\\nOxinot is a block-based outliner...\\n## Features\\n- Feature 1\\n- Feature 2\\n## Tech Stack\\n- Frontend: React\\n- Backend: Tauri"
  }]
)

✅ RIGHT - This creates 10+ individual blocks with proper hierarchy:
create_page_with_blocks(
  title: "Project Documentation",
  blocks: [
    { content: "Project: Oxinot Documentation", indent: 0 },
    { content: "Overview", indent: 1 },
    { content: "Oxinot is a block-based outliner application built with Tauri, designed for structured thinking and knowledge management.", indent: 2 },
    { content: "Key Features", indent: 1 },
    { content: "Local-first architecture: Your data stays on your device", indent: 2 },
    { content: "Block-based editing: Structure your thoughts with nested blocks", indent: 2 },
    { content: "Graph view: Visualize connections between your notes", indent: 2 },
    { content: "AI Copilot: Get intelligent assistance while writing", indent: 2 },
    { content: "Markdown support: Full markdown formatting capabilities", indent: 2 },
    { content: "Tech Stack", indent: 1 },
    { content: "Frontend: React + TypeScript + TailwindCSS", indent: 2 },
    { content: "Backend: Tauri + Rust", indent: 2 },
    { content: "Database: SQLite for indexing", indent: 2 },
    { content: "Graph Visualization: D3.js", indent: 2 }
  ]
)

HIERARCHY RULES:
- indent: 0 = Root level (main title)
- indent: 1 = First level (sections)
- indent: 2 = Second level (subsections)
- indent: 3+ = Deeper levels
- Each item becomes ONE editable block (one bullet point)
- Users can collapse/expand sections by clicking bullets

EXAMPLES:
1. Instructions with steps:
   - "Write installation guide" → Each step is a separate block
   - "Fix this code" → Each change is a separate block
   
2. Structured data:
   - "Create product list" → Each product is a block
   - "Make team directory" → Each person is a block

3. Outlines/Documentation:
   - ALWAYS create as nested blocks, not as markdown text
   - Use headings as section headers (indent: 1)
   - Use content descriptions under them (indent: 2+)

ANTI-PATTERN TO AVOID:
- Do NOT use markdown headings (# ## ###) inside block content
- Do NOT create lists with - bullet syntax inside block content  
- Do NOT put multi-line text with line breaks in a single block
- Instead: Create each semantic unit as its own block at appropriate indent level

TOOL SELECTION:
- Use create_page_with_blocks for: Initial structured content creation
- Use create_block for: Adding single blocks to existing pages
- Use update_block for: Modifying existing block content
- Use insert_block_below for: Adding blocks after specific locations
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

BLOCK-BASED OUTLINER STRUCTURE:
- Each block is a bullet point with content
- Blocks can be nested (parent-child hierarchy)
- Types: bullet (text), code (triple backticks with language), fence (multiline text)
- Pages can be regular notes OR directories (folders that contain other pages)

[... 기존 내용 계속 ...]`;

    return systemPrompt;
  }
}
```

---

## 📋 구체적 수정 사항

### 파일: `src/services/ai/agent/orchestrator.ts`

**변경 위치**: `buildSystemPrompt` 메서드 (라인 257-347)

**구체적 추가 내용**:

```typescript
// 라인 271 (BLOCK-BASED OUTLINER STRUCTURE 전에) 추가:

// ⭐ CRITICAL SECTION 추가
const structuredContentSection = `
⭐ CRITICAL: CREATING STRUCTURED CONTENT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
When creating ANY structured content (documentation, lists, outlines, hierarchies):

PRINCIPLE: Each semantic item = One block

❌ ANTI-PATTERN: Multi-line markdown in one block
create_page_with_blocks(title: "X", blocks: [{
  content: "# Section\\n Content line 1\\n Content line 2\\n## Subsection\\n- Item 1\\n- Item 2"
}])
Result: One giant block. Not editable as separate items.

✅ CORRECT PATTERN: Each item as separate block with indent
create_page_with_blocks(title: "X", blocks: [
  { content: "Section", indent: 0 },
  { content: "Content line 1", indent: 1 },
  { content: "Content line 2", indent: 1 },
  { content: "Subsection", indent: 1 },
  { content: "Item 1", indent: 2 },
  { content: "Item 2", indent: 2 }
])
Result: 6 separate editable blocks. Logseq/Roam style.

WHEN TO USE WHICH TOOL:
- create_page_with_blocks: Creating new page with 5+ items → use for structure
- create_block: Adding 1-2 blocks to existing page
- update_block: Modifying existing block content

HOW TO DETERMINE BLOCK BOUNDARIES:
- Headings → Separate blocks (represent sections)
- List items → Separate blocks (represent items)
- Paragraphs → Can be 1 block each or grouped (context-dependent)
- Code blocks → 1 block with triple backticks
- Table rows → Can be separate blocks or 1 block per row

INDENT CALCULATION:
- Heading level → indent value
  - # Heading → indent: 0
  - ## Heading → indent: 1
  - ### Heading → indent: 2
- List nesting → indent value
  - Top level item → indent: 0 or 1 (depending on context)
  - Nested item (indented) → indent + 1
- Content under section → indent: parent.indent + 1
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`;
```

---

## 🎯 예제: 변환 과정

### 사용자 요청
```
"Oxinot 프로젝트 문서 작성해줘"
```

### 입력 (마크다운)
```markdown
# Project: Oxinot Documentation

## Overview
Oxinot is a block-based outliner application...

## Key Features
- Local-first architecture: Your data stays on your device
- Block-based editing: Structure your thoughts with nested blocks
- Graph view: Visualize connections between your notes

## Tech Stack
### Frontend
React + TypeScript + TailwindCSS

### Backend  
Tauri + Rust
```

### AI의 변환 (현재 ❌ 잘못된 방식)
```typescript
create_page_with_blocks({
  title: "Project: Oxinot Documentation",
  blocks: [{
    content: `# Overview
Oxinot is a block-based outliner...

## Key Features
- Local-first architecture...
- Block-based editing...

## Tech Stack
Frontend: React...
Backend: Tauri...`
  }]
})
```

### AI의 변환 (개선 후 ✅ 올바른 방식)
```typescript
create_page_with_blocks({
  title: "Project: Oxinot Documentation",
  blocks: [
    { content: "Overview", indent: 0 },
    { content: "Oxinot is a block-based outliner application built with Tauri, designed for structured thinking and knowledge management.", indent: 1 },
    { content: "Key Features", indent: 0 },
    { content: "Local-first architecture: Your data stays on your device", indent: 1 },
    { content: "Block-based editing: Structure your thoughts with nested blocks", indent: 1 },
    { content: "Graph view: Visualize connections between your notes", indent: 1 },
    { content: "Tech Stack", indent: 0 },
    { content: "Frontend", indent: 1 },
    { content: "React + TypeScript + TailwindCSS", indent: 2 },
    { content: "Backend", indent: 1 },
    { content: "Tauri + Rust", indent: 2 },
    { content: "Database: SQLite for indexing", indent: 2 },
    { content: "Graph Visualization: D3.js", indent: 2 }
  ]
})
```

---

## 📝 수정 코드

파일 위치: `src/services/ai/agent/orchestrator.ts`

메서드: `buildSystemPrompt` (라인 257-347)

**변경 사항**: 라인 271 (BLOCK-BASED OUTLINER STRUCTURE 바로 앞에 새 섹션 추가)

```diff
  private buildSystemPrompt(_config: AgentConfig): string {
    const blockStore = useBlockStore.getState();
    const pageStore = usePageStore.getState();
    const uiStore = useBlockUIStore.getState();

    let systemPrompt = `You are an AI agent in 'Oxinot', a block-based outliner (like Logseq/Roam).

AGENT BEHAVIOR:
1. You MUST use tools to complete tasks - don't just describe what to do
2. Read current state first (list_pages, get_page_blocks) before making changes
3. Plan efficiently - avoid creating then deleting blocks
4. Use update_block instead of delete + create when possible
5. Only provide text responses when truly complete or need clarification
6. LEARN FROM FAILURES: If a tool call fails, DO NOT retry the same approach. Analyze the error and try a different strategy.
7. If you reach max iterations without completing, provide a summary of what you accomplished and what's left.

+ ⭐ CRITICAL: STRUCTURED CONTENT = SEPARATE BLOCKS
+ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
+ When creating structured content (documentation, lists, outlines, hierarchies):
+ ALWAYS create each semantic item as a SEPARATE BLOCK with appropriate indent.
+
+ ❌ WRONG: Multi-line markdown in one block
+ create_page_with_blocks(title: "X", blocks: [{
+   content: "# Section\\nContent\\n## Subsection\\n- Item 1\\n- Item 2"
+ }])
+ → Result: ONE giant block (not Logseq style)
+
+ ✅ RIGHT: Each item as separate block
+ create_page_with_blocks(title: "X", blocks: [
+   { content: "Section", indent: 0 },
+   { content: "Content", indent: 1 },
+   { content: "Subsection", indent: 1 },
+   { content: "Item 1", indent: 2 },
+   { content: "Item 2", indent: 2 }
+ ])
+ → Result: 5 editable blocks (true Logseq style)
+
+ INDENT RULES:
+ - indent: 0 = Root level
+ - indent: 1 = Section/first nested level
+ - indent: 2+ = Deeper nesting
+ - Heading level roughly = indent value (# → 0, ## → 1, ### → 2)
+
+ BLOCK BOUNDARY RULES:
+ - Headings → Separate blocks (represent sections)
+ - List items → Separate blocks (represent items)
+ - Paragraphs → 1 block each or grouped (use judgment)
+ - Code blocks → 1 block with triple backticks
+
+ TOOL SELECTION:
+ - create_page_with_blocks: Creating new page with structured content
+ - create_block: Adding single blocks to existing pages
+ - update_block: Modifying block content
+ - insert_block_below: Adding blocks in specific order
+ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

BLOCK-BASED OUTLINER STRUCTURE:
- Each block is a bullet point with content
- Blocks can be nested (parent-child hierarchy)
- Types: bullet (text), code (triple backticks with language), fence (multiline text)
- Pages can be regular notes OR directories (folders that contain other pages)

[... 나머지 기존 내용 ...]
```

---

## 🚀 적용 후 예상 결과

### 적용 전 (현재)
```
❌ 하나의 거대한 불렛 포인트에 전체 마크다운 포함
- Project: Oxinot Documentation
  # Overview
  Oxinot is a **block-based outliner** application...
  [모든 내용이 한 블록에...]
```

### 적용 후 (수정 예정)
```
✅ 각 항목이 개별 불렛 포인트 (Logseq 스타일)
- Project: Oxinot Documentation
  - Overview
    - Oxinot is a block-based outliner application...
  - Key Features
    - Local-first architecture: Your data stays on your device
    - Block-based editing: Structure your thoughts with nested blocks
    - Graph view: Visualize connections between your notes
  - Tech Stack
    - Frontend
      - React + TypeScript + TailwindCSS
    - Backend
      - Tauri + Rust
    - Database: SQLite for indexing
    - Graph Visualization: D3.js
```

---

## ✨ 추가 개선 사항

### 옵션 1: 예제 추가 (권장)
CopilotPanel이나 별도의 프롬프트에 예제 추가:
```
"데모 노트 작성" → 자동으로 블록 단위 생성 지침 포함
"문서 작성" → 계층적 블록 구조로 생성
```

### 옵션 2: 도구 설명 개선
`createPageWithBlocksTool`의 description 업데이트:
```typescript
description: `Create a new page with initial block content.
              IMPORTANT: Use this to create structured content where EACH item 
              is a separate block with appropriate indent (0=root, 1=nested, 2+=deeper).
              Do NOT put multi-line markdown in single block.`
```

### 옵션 3: 검증 추가 (고급)
도구 실행 전 AI에게 블록 구조 검증 요청:
```typescript
// execute 전에 파라미터 검증
if (allBlocksInOneContent(params.blocks)) {
  warn("Consider splitting content into multiple blocks");
}
```

---

## 📊 변경 영향도

| 항목 | 영향 | 노력 |
|------|------|------|
| 시스템 프롬프트 수정 | 높음 ✅ | 낮음 (1파일) |
| 기존 기능 | 없음 ✅ | 0 |
| 다른 도구 | 없음 ✅ | 0 |
| 테스트 필요 | 낮음 | 수동 테스트만 |

---

## 🎓 결론

### 근본 원인
AI가 **"언제 블록을 분리해야 하는지"** 몰라서, 구조화된 콘텐츠를 마크다운으로 한 블록에 넣음.

### 해결책
시스템 프롬프트에 **명시적 지침** 추가:
- "각 의미 있는 항목 = 하나의 블록"
- "indent로 계층 구조 표현"
- "마크다운 헤딩/불렛 문법을 블록 콘텐츠에 사용하지 말 것"
- 예제 제시 (❌ 잘못된 예 vs ✅ 올바른 예)

### 기대 효과
✅ 코파일럿이 Logseq/Roam 스타일의 계층적 블록 구조 생성  
✅ 각 항목이 개별 불렛 포인트로 편집 가능  
✅ 사용자가 블록을 접기/펼치기 가능  
✅ 진정한 아웃라이너 UX 제공

---

**변경 파일**: `src/services/ai/agent/orchestrator.ts`  
**변경 라인**: 257-347 (buildSystemPrompt 메서드)  
**변경 난이도**: ⭐ (매우 쉬움 - 텍스트 추가만)  
**테스트**: 수동 테스트로 충분
