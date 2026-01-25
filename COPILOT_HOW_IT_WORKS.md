# 코파일럿이 페이지를 생성하는 방식 - 정확한 분석

## 🎯 당신의 질문

> "지금 코파일럿에게 페이지 작성을 요청했을 때 코파일럿이 이 페이지를 하나의 그냥 md 파일로 인식하고 쓰는거야 아니면 블록 단위로 페이지에 내용들을 삽입하는거야?"

---

## ✅ 정답

**코파일럿이 실제로 하는 일**:

1. **페이지 생성** ✅
   - `createPageTool` 또는 `createPageWithBlocksTool` 사용

2. **블록 단위로 삽입** ✅
   - 각 블록을 **개별적으로** Tauri의 `create_block` 명령어로 호출
   - 마크다운 파일이 아니라 **블록 구조**로 저장

3. **마크다운도 지원** ✅
   - 블록의 `content` 필드에 마크다운 문법 사용 가능
   - 하지만 저장 형식은 **블록 단위** (마크다운 파일이 아님)

---

## 🔍 코드 분석

### createPageWithBlocksTool의 동작

```typescript
// 1️⃣ 페이지 생성
const newPageId = await pageStore.createPage(
  params.title,
  params.parentId || undefined
);

// 2️⃣ 각 블록을 개별적으로 생성
for (const block of params.blocks) {
  const newBlock: BlockData = await invoke<BlockData>("create_block", {
    workspacePath: context.workspacePath,
    request: {
      pageId: newPageId,
      parentId: block.parentBlockId ?? null,
      afterBlockId: insertAfterBlockId || null,
      content: block.content,
      indent: blockIndent,
    },
  });
  
  // 3️⃣ UI 업데이트
  dispatchBlockUpdate([newBlock]);
  lastBlockId = newBlock.id;
}
```

**핵심**: `params.blocks` 배열의 **각 요소**가 **개별 블록**으로 생성됨

---

## 📊 예시로 이해하기

### 시나리오: "Oxinot 문서 작성"

#### AI가 하는 일 (블록 단위)
```typescript
const toolCall = {
  name: "create_page_with_blocks",
  input: {
    title: "Project: Oxinot Documentation",
    blocks: [
      { content: "Overview", indent: 0 },
      { content: "Oxinot is a block-based outliner...", indent: 1 },
      { content: "Key Features", indent: 0 },
      { content: "Local-first architecture", indent: 1 },
      { content: "Block-based editing", indent: 1 },
      { content: "Tech Stack", indent: 0 },
      { content: "Frontend: React + TypeScript", indent: 1 },
      { content: "Backend: Tauri + Rust", indent: 1 }
    ]
  }
}
```

#### 내부 동작 (Tauri 백엔드)
```
1️⃣ 페이지 생성
   Page { id: "page-uuid-123", title: "Project: Oxinot Documentation" }

2️⃣ 각 블록을 순차적으로 생성
   invoke("create_block", { pageId: "page-uuid-123", content: "Overview", indent: 0 })
   → Block { id: "block-uuid-1", content: "Overview", indent: 0 }
   
   invoke("create_block", { pageId: "page-uuid-123", content: "Oxinot is...", indent: 1, parentId: null, afterBlockId: "block-uuid-1" })
   → Block { id: "block-uuid-2", content: "Oxinot is...", indent: 1 }
   
   ... (6개 블록 더)

3️⃣ SQLite DB에 저장
   pages 테이블: { id, title, parentId, ... }
   blocks 테이블: { id, pageId, content, indent, parentId, ... }
   
4️⃣ UI 업데이트
   dispatchBlockUpdate([block1, block2, block3, ...])
   → blockStore에 반영
   → React 컴포넌트 리렌더링
```

#### 사용자가 보는 화면
```
- Project: Oxinot Documentation        (block-1)
  - Overview                           (block-2)
    - Oxinot is a block-based...      (block-3)
  - Key Features                       (block-4)
    - Local-first architecture         (block-5)
    - Block-based editing              (block-6)
  - Tech Stack                         (block-7)
    - Frontend: React + TypeScript     (block-8)
    - Backend: Tauri + Rust            (block-9)
```

---

## ⚠️ 현재 문제

### 코파일럿이 실제로 하는 것 (문제점)
코파일럿이 `createPageWithBlocksTool`을 **제대로 사용하지 않음**

```typescript
❌ 현재 코파일럿의 동작:

create_page_with_blocks({
  title: "Project: Oxinot Documentation",
  blocks: [{
    content: `# Overview
Oxinot is a block-based outliner...

# Key Features
- Local-first architecture
- Block-based editing

# Tech Stack
- Frontend: React + TypeScript
- Backend: Tauri + Rust`
  }]  // ← 1개 블록만! (배열에 1개 요소)
})
```

**왜 문제인가?**
- 도구 자체는 **블록 단위 생성**을 지원함 ✅
- 하지만 AI가 **모든 내용을 1개 블록에 때려박음** ❌
- 결과: 마크다운 텍스트가 한 블록 안에 \n으로 연결됨
- 사용자가 엔터하면 블록이 안 나뉨 (새 블록 생성 안 됨)

---

## 🔧 해결책 (이미 적용함)

### 시스템 프롬프트 수정
`src/services/ai/agent/orchestrator.ts` 라인 273-347에 추가한 내용:

```
⭐ CRITICAL: MARKDOWN TO BLOCKS CONVERSION (EACH LINE = ONE BLOCK)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FUNDAMENTAL RULE: When creating content, you MUST convert markdown with newlines
into SEPARATE BLOCKS.

WRONG ❌:
blocks: [{
  content: "# Heading\nContent\n## Sub\nItem"  // ← 1개 블록
}]

RIGHT ✅:
blocks: [
  { content: "Heading", indent: 0 },         // ← 4개 블록
  { content: "Content", indent: 1 },
  { content: "Sub", indent: 1 },
  { content: "Item", indent: 2 }
]
```

### 효과
AI가 **blocks 배열에 여러 요소**를 넣으도록 유도

```typescript
✅ 수정 후 기대되는 동작:

create_page_with_blocks({
  title: "Project: Oxinot Documentation",
  blocks: [           // ← 배열에 8개 요소!
    { content: "Overview", indent: 0 },
    { content: "Oxinot is a block-based...", indent: 1 },
    { content: "Key Features", indent: 0 },
    { content: "Local-first architecture", indent: 1 },
    { content: "Block-based editing", indent: 1 },
    { content: "Tech Stack", indent: 0 },
    { content: "Frontend: React + TypeScript", indent: 1 },
    { content: "Backend: Tauri + Rust", indent: 1 }
  ]
})
```

---

## 📋 정리

### 질문 1: 마크다운 파일로 인식하나?
**NO** ❌ 
- Oxinot은 마크다운 파일 형식이 아님
- SQLite DB + 블록 구조로 저장

### 질문 2: 블록 단위로 삽입하나?
**YES** ✅ (원칙적으로)
- `createPageWithBlocksTool`은 블록 단위 생성을 지원
- 각 블록이 개별적으로 `invoke("create_block", ...)`으로 생성됨
- 하지만 **AI가 이를 제대로 활용하지 않음**

### 질문 3: 현재 문제는?
AI가 **블록 배열에 1개 요소만 넣음** ❌
- `blocks: [{ content: "huge markdown\nwith newlines\neverywhere" }]`
- 이 거대한 마크다운 텍스트가 **1개 블록의 content**가 됨

### 질문 4: 어떻게 고치나?
시스템 프롬프트 수정 (이미 적용함) ✅
- AI가 마크다운을 줄 단위로 분리
- `blocks` 배열에 **여러 개 요소** 넣도록 유도

---

## 🎯 최종 답변

### 현재 상태
| 측면 | 상태 | 설명 |
|------|------|------|
| **도구 능력** | ✅ 완벽 | createPageWithBlocksTool이 블록 단위 생성 지원 |
| **코드 구현** | ✅ 완벽 | Tauri 백엔드가 각 블록을 개별적으로 생성 |
| **AI 활용** | ❌ 부족 | AI가 블록 배열을 제대로 채우지 않음 |
| **해결책** | ✅ 적용 | 시스템 프롬프트 수정으로 AI 행동 개선 |

### 작동 방식
1. **도구 호출**: `createPageWithBlocksTool`
2. **페이지 생성**: 1개 페이지
3. **블록 생성**: `blocks` 배열의 **각 요소마다 1개씩** invoke 호출
4. **DB 저장**: 블록 구조로 저장 (마크다운 파일 아님)
5. **UI 표시**: 계층적 불렛 포인트로 표시

### 문제의 원인
AI가 **blocks 배열을 제대로 구성하지 않아서** 
→ 1개 거대한 블록이 생성됨
→ 마크다운 텍스트가 그 1개 블록 안에 \n으로 연결됨

### 해결 방법 (이미 적용)
✅ 시스템 프롬프트에 마크다운→블록 변환 알고리즘 추가
→ AI가 **blocks 배열에 여러 요소** 넣도록 유도
→ 각 줄이 별도 블록으로 생성됨
→ 진정한 아웃라이너 경험 제공

---

**결론**: 
- **원칙적으로**: 블록 단위 ✅
- **현재 실제로**: 1개 거대한 블록 (문제) ❌
- **수정 후 기대**: 여러 블록 ✅
