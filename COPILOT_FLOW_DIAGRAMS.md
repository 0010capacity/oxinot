# 코파일럿 도구 시스템 - 실행 흐름 다이어그램

## 1. 시스템 아키텍처 전체도

```
┌─────────────────────────────────────────────────────────────────────┐
│                         OXINOT 코파일럿                              │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  ┌──────────────────┐         ┌──────────────────────────────────┐ │
│  │  사용자 입력      │────────→│    CopilotPanel (UI)             │ │
│  │ "페이지 생성..."  │         │  - textarea                      │ │
│  └──────────────────┘         └──────────────┬───────────────────┘ │
│                                              │                      │
│                                              ▼                      │
│                          ┌────────────────────────────────────┐    │
│                          │   AgentOrchestrator                │    │
│                          │ - AI 요청 생성                     │    │
│                          │ - 도구 목록 포함                   │    │
│                          └────────────────┬───────────────────┘    │
│                                           │                        │
│                                           ▼                        │
│              ┌────────────────────────────────────────────────┐    │
│              │  Claude API (또는 다른 LLM)                     │    │
│              │                                                │    │
│              │  도구 선택: create_page_with_blocks            │    │
│              │  파라미터:  {                                 │    │
│              │    "title": "...",                            │    │
│              │    "blocks": [...]                            │    │
│              │  }                                             │    │
│              └────────────────┬─────────────────────────────┘    │
│                               │                                   │
│                               ▼                                   │
│         ┌─────────────────────────────────────────────────────┐  │
│         │  AgentOrchestrator (도구 응답 처리)                  │  │
│         │  - tool_use 블록 감지                              │  │
│         │  - toolRegistry.get("create_page_with_blocks")    │  │
│         └────────────┬────────────────────────────────────────┘  │
│                      │                                            │
│                      ▼                                            │
│      ┌──────────────────────────────────────────────────┐        │
│      │  Tool Registry (싱글톤)                           │        │
│      │  Map<name, Tool>                                 │        │
│      │                                                   │        │
│      │  ✅ create_page_with_blocks                      │        │
│      │  ✅ open_page                                    │        │
│      │  ✅ query_pages                                  │        │
│      │  ... (총 18+ 도구)                               │        │
│      └────────────┬─────────────────────────────────────┘        │
│                   │                                               │
│                   ▼                                               │
│   ┌────────────────────────────────────────────────────┐        │
│   │  createPageWithBlocksTool.execute()                 │        │
│   │                                                     │        │
│   │  1. Zod 검증 (자동)                                │        │
│   │  2. pageStore.createPage()                        │        │
│   │  3. 각 블록마다:                                   │        │
│   │     invoke("create_block", {...})                 │        │
│   │  4. dispatchBlockUpdate()                         │        │
│   │  5. ToolResult 반환                                │        │
│   └────────┬──────────────────────────────────────────┘        │
│            │                                                    │
│            ▼                                                    │
│   ┌────────────────────────────────────────────────────┐       │
│   │  Tauri Backend (Rust)                              │       │
│   │  - create_block 명령어 처리                        │       │
│   │  - SQLite DB 업데이트                             │       │
│   │  - 파일 시스템 처리                                │       │
│   └────────┬──────────────────────────────────────────┘       │
│            │                                                   │
│            ▼                                                   │
│   ┌────────────────────────────────────────────────────┐      │
│   │  페이지 & 블록 생성 완료                             │      │
│   │  - SQLite: 페이지 & 블록 레코드                     │      │
│   │  - Filesystem: .md 파일                            │      │
│   └────────────────────────────────────────────────────┘      │
│                                                                 │
│   ┌────────────────────────────────────────────────────┐      │
│   │  UI 업데이트                                        │      │
│   │  - pageStore에 새 페이지 추가                       │      │
│   │  - blockStore에 블록 추가                          │      │
│   │  - 화면 렌더링                                      │      │
│   └────────────────────────────────────────────────────┘      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. 데이터 흐름 (세부)

```
사용자 입력
  │
  ├─ "2026-01-25 일일 노트를 만들어줘"
  │
  ▼
CopilotPanel.handleSubmit()
  │
  ├─ useCopilotUiStore.addMessage('user', input)
  │
  ▼
AgentOrchestrator.generateResponse()
  │
  ├─ API 요청 생성
  │   {
  │     model: "claude-3-5-sonnet",
  │     messages: [...],
  │     tools: [  ← 도구 목록
  │       {
  │         name: "create_page_with_blocks",
  │         description: "Create a new page with initial block content...",
  │         input_schema: {
  │           type: "object",
  │           properties: {
  │             title: { type: "string" },
  │             blocks: { ... }
  │           }
  │         }
  │       },
  │       ... (다른 도구들)
  │     ]
  │   }
  │
  ▼
Claude API 응답
  │
  ├─ content: [
  │     {
  │       type: "text",
  │       text: "좋아요, 일일 노트를 만들겠습니다."
  │     },
  │     {
  │       type: "tool_use",
  │       name: "create_page_with_blocks",
  │       input: {
  │         title: "2026-01-25 일일 노트",
  │         blocks: [
  │           { content: "## 오늘의 주요 활동", indent: 0 },
  │           { content: "- [x] 작업 완료", indent: 1 },
  │           ...
  │         ]
  │       }
  │     }
  │   ]
  │
  ▼
AgentOrchestrator.processResponse()
  │
  ├─ response.content 반복
  │
  ├─ 텍스트 블록: UI에 추가
  │
  ├─ tool_use 블록 감지:
  │   ├─ name: "create_page_with_blocks"
  │   ├─ input: { title: "...", blocks: [...] }
  │
  ▼
toolRegistry.get("create_page_with_blocks")
  │
  ├─ Tool 객체 반환
  │
  ▼
Tool.execute(input, context)
  │
  ├─ 1️⃣ Zod 검증 (자동)
  │   ├─ title: string ✅
  │   ├─ blocks: array ✅
  │   ├─ blocks[].content: string ✅
  │   ├─ blocks[].indent: number (0-∞) ✅
  │
  ├─ 2️⃣ pageStore.createPage("2026-01-25 일일 노트")
  │   └─ newPageId 반환
  │
  ├─ 3️⃣ 각 블록 생성 루프
  │   │
  │   ├─ Block 0: "## 오늘의 주요 활동", indent=0
  │   │  ├─ invoke("create_block", {
  │   │  │   pageId: newPageId,
  │   │  │   parentId: null,
  │   │  │   afterBlockId: null,
  │   │  │   content: "## 오늘의 주요 활동",
  │   │  │   indent: 0
  │   │  │ })
  │   │  └─ lastBlockId = blockId0
  │   │
  │   ├─ Block 1: "- [x] 작업 완료", indent=1
  │   │  ├─ invoke("create_block", {
  │   │  │   pageId: newPageId,
  │   │  │   parentId: null,
  │   │  │   afterBlockId: blockId0,  ← 이전 블록 뒤에
  │   │  │   content: "- [x] 작업 완료",
  │   │  │   indent: 1
  │   │  │ })
  │   │  └─ lastBlockId = blockId1
  │   │
  │   └─ ... (6개 블록 모두)
  │
  ├─ 4️⃣ dispatchBlockUpdate(blocks)
  │   └─ blockStore 업데이트
  │
  ├─ 5️⃣ ToolResult 반환
  │   {
  │     success: true,
  │     data: {
  │       id: pageId,
  │       title: "2026-01-25 일일 노트",
  │       blocksCreated: 6,
  │       blocks: [...]
  │     }
  │   }
  │
  ▼
AgentOrchestrator.handleToolResult()
  │
  ├─ 결과를 UI에 표시
  │ "✅ 페이지를 성공적으로 생성했습니다."
  │
  ▼
사용자 화면에 새 페이지 표시
  │
  └─ 완료! ✅
```

---

## 3. 도구 등록 초기화 흐름

```
App.tsx 마운트
  │
  ├─ useEffect(() => {
  │    initializeToolRegistry()
  │  }, [])
  │
  ▼
initializeToolRegistry() 호출 (initialization.ts)
  │
  ├─ toolRegistry.getAll().length > 0 ?
  │   └─ 이미 초기화됨 → 스킵
  │
  ▼
toolRegistry.registerMany([
  ...pageTools,      ← import from page/index.ts
  ...blockTools,     ← import from block/index.ts
  ...contextTools,   ← import from context/index.ts
  ...navigationTools,← import from navigation/index.ts
  pingTool
])
  │
  ├─ pageTools 배열
  │   ├─ openPageTool
  │   ├─ queryPagesTool
  │   ├─ listPagesTool
  │   ├─ createPageTool
  │   └─ createPageWithBlocksTool  ← ⭐ 우리의 도구
  │
  ▼
각 도구마다 toolRegistry.register(tool)
  │
  ├─ validateTool(tool)
  │   ├─ name이 snake_case인가? ✅ create_page_with_blocks
  │   ├─ description이 있는가? ✅
  │   ├─ parameters가 있는가? ✅ Zod 스키마
  │   ├─ execute 함수가 있는가? ✅
  │
  ├─ toolRegistry.tools.set(name, tool)
  │
  ▼
초기화 완료
  │
  ├─ console.log("[ToolRegistry] ✅ Successfully initialized with 18 tools")
  │
  ▼
CopilotPanel 마운트
  │
  ├─ toolRegistry.getAll() 호출
  │
  ├─ 도구를 Claude API 호출에 포함
  │
  ▼
시스템 준비 완료 ✅
```

---

## 4. 타입 안전성 체크

```
사용자 입력 (JSON)
  │
  ▼
┌─────────────────────────────────────┐
│  JSON (동적 타입)                    │
│  {                                  │
│    "title": "...",                  │
│    "blocks": [                      │
│      { "content": "...", "indent": 0 }
│    ]                                │
│  }                                  │
└──────────┬──────────────────────────┘
           │
           ▼ (AI가 생성)
┌──────────────────────────────────────┐
│  Zod 검증 (자동)                     │
│  parameters: z.object({             │
│    title: z.string(),                │
│    blocks: z.array(                 │
│      z.object({                     │
│        content: z.string(),         │
│        indent: z.number().min(0)    │
│      })                              │
│    )                                │
│  })                                  │
└──────────┬──────────────────────────┘
           │
           ├─ ✅ title는 문자열?
           ├─ ✅ blocks는 배열?
           ├─ ✅ 각 블록의 content는 문자열?
           ├─ ✅ 각 블록의 indent는 0 이상의 숫자?
           │
           ▼
┌──────────────────────────────────────┐
│  TypeScript 타입 (정적 타입)         │
│                                      │
│  interface Params {                  │
│    title: string;                   │
│    blocks: Array<{                  │
│      content: string;               │
│      indent?: number;               │
│    }>;                              │
│  }                                   │
│                                      │
│  tool.execute(params: Params) {      │
│    // params는 TypeScript에서         │
│    // 완벽히 타입화됨 ✅             │
│  }                                   │
└─────────────────────────────────────┘
```

---

## 5. 오류 처리 흐름

```
Tool 실행 시작
  │
  ├─ try {
  │
  │   // Zod 검증 (자동)
  │   if (검증 실패) → throw Error
  │
  │   // pageStore.createPage()
  │   if (부모 페이지 없음) → return { success: false, error: "..." }
  │
  │   // 블록 생성 루프
  │   for (block of blocks) {
  │     try {
  │       invoke("create_block", ...)  ← Tauri 호출
  │     } catch (blockError) {
  │       console.error(blockError)
  │       // 계속 진행 (부분 실패 허용)
  │     }
  │   }
  │
  │   // 성공 반환
  │   return { success: true, data: {...} }
  │
  │ } catch (error) {
  │
  │   // 예상 외 오류
  │   return {
  │     success: false,
  │     error: error.message
  │   }
  │
  │ }
  │
  ▼
ToolResult 반환
  │
  ├─ success: true/false
  ├─ data: {...} (성공 시)
  ├─ error: "..." (실패 시)
  │
  ▼
AgentOrchestrator에서 처리
  │
  ├─ 성공 시: "✅ 완료했습니다"
  ├─ 실패 시: "❌ 오류: ..."
  │
  ▼
사용자에게 피드백 제공
```

---

## 6. 도구 추가 체크리스트 (향후 참고)

```
새 도구 추가 시:

[ ] 1. 도구 파일 생성
    src/services/ai/tools/[category]/myNewTool.ts
    
    export const myNewTool: Tool = {
      name: "my_new_tool",              ← snake_case
      description: "...",
      category: "...",
      requiresApproval: false,
      parameters: z.object({...}),
      async execute(params, context) {
        // 구현
      }
    }

[ ] 2. index.ts에 export
    src/services/ai/tools/[category]/index.ts
    
    export { myNewTool };
    export const myTools = [ myNewTool ];

[ ] 3. initialization.ts에 등록
    toolRegistry.registerMany([
      ...myTools
    ])

[ ] 4. 테스트 작성
    src/services/ai/tools/__tests__/myNewTool.test.ts

[ ] 5. 문서화
    src/services/ai/tools/TOOLS.md 업데이트

이 체크리스트만 따르면 자동으로:
  ✅ Zod 검증
  ✅ AI API에 노출
  ✅ 실행 파이프라인
  ✅ 오류 처리
```

---

## 핵심 포인트

### 1️⃣ 도구는 자동으로 검증됨
- Zod 스키마가 자동으로 입력을 검증
- 잘못된 형식은 즉시 거부

### 2️⃣ 타입 안전성 보장
- JSON → Zod 검증 → TypeScript 타입
- 런타임과 컴파일 타임 모두 안전

### 3️⃣ 확장 가능한 설계
- 새 도구 추가가 간단
- 기존 코드 변경 최소화

### 4️⃣ AI가 자동으로 선택
- 도구 설명으로 AI가 판단
- 파라미터를 자동으로 생성

### 5️⃣ 오류 처리 우수
- 부분 실패 허용 (일부 블록 생성 실패해도 계속)
- 명확한 오류 메시지

---

**생성일**: 2026-01-25  
**신뢰도**: 높음 (실제 코드 기반)  
**사용 목적**: 시스템 이해 및 트러블슈팅
