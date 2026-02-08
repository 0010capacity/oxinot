# Oxinot 코파일럿 시스템: 분석 및 개선 제안

**작성일**: 2026년 2월 8일  
**상태**: 분석 문서  
**대상**: 코파일럿 시스템 개선 담당자

---

## 📊 Executive Summary

Oxinot의 AI 코파일럿은 **강력한 도구 기반 에이전트 아키텍처**를 갖추고 있지만, 현재 설계는 **도구 지향적(tool-centric)** 으로 설계되어 있어 다음과 같은 문제를 야기합니다:

1. **도구 강박**: 모든 사용자 입력을 자동으로 에이전트 루프로 실행
2. **불필요한 도구 호출**: 일상적인 대화도 즉시 도구 실행 시도
3. **사용자 경험 저하**: 승인 모달, 로딩 상태가 모든 입력에 표시
4. **프롬프트 엔지니어링의 제한**: System prompt가 기술적 설명에만 집중

이 문서는:
- ✅ 현재 시스템의 구조 분석
- ✅ 도구 과도 사용의 근본 원인
- ✅ 구체적인 개선 전략
- ✅ 구현 단계별 가이드

을 제공합니다.

---

## 🔍 Part 1: 현재 시스템 분석

### 1.1 아키텍처 개요

```
사용자 입력
    ↓
CopilotPanel.handleSend()
    ↓
AgentOrchestrator.execute()
    ↓
AI Provider (Claude, OpenAI, etc.)
    ├─→ Tool Call 감지
    ├─→ executeTool()
    ├─→ Tool 실행 (block, page, context)
    └─→ 결과를 AI에 피드백
    ↓
Agent Loop (최대 50 iterations)
    ↓
최종 답변
```

### 1.2 핵심 컴포넌트

#### A. 도구 시스템 (Tool System)

**위치**: `src/services/ai/tools/`

**구조**:
```
tools/
├── registry.ts          # 도구 등록 관리
├── executor.ts          # 도구 실행 엔진
├── types.ts            # 타입 정의
├── block/              # 14개 블록 관련 도구
│   ├── createBlockTool
│   ├── updateBlockTool
│   ├── deleteBlockTool
│   ├── queryBlocksTool
│   └── ... (11개 더)
├── page/               # 5개 페이지 관련 도구
│   ├── createPageTool
│   ├── listPagesTool
│   ├── queryPagesTool
│   └── ...
└── context/            # 1개 컨텍스트 도구
    └── getCurrentContextTool
```

**도구 정의 패턴** (`Tool` 인터페이스):
```typescript
interface Tool<Params = any> {
  name: string;                    // "create_block" (snake_case)
  description: string;             // AI를 위한 설명
  parameters: ToolParameterSchema; // Zod 스키마
  execute: (params, context) => Promise<ToolResult>;
  requiresApproval?: boolean;      // 사용자 승인 필요
  isDangerous?: boolean;           // 위험한 작업 플래그
  category?: ToolCategory;         // BLOCK, PAGE, etc.
}
```

**총 20개 도구**: 모두 상태 변경 작업 (CRUD)

#### B. 에이전트 오케스트레이터 (AgentOrchestrator)

**위치**: `src/services/ai/agent/orchestrator.ts`

**핵심 메커니즘**:
1. 모든 도구를 AI에 전달
2. AI가 필요하면 도구 호출
3. 도구 결과를 AI에 다시 전달
4. 최종 답변까지 반복 (루프 방지 로직 포함)

**루프 방지 기능**:
```typescript
// orchestrator.ts line 141
const loopCheck = this.detectLooping();
if (loopCheck.isLooping) {
  // AI에게 루핑 경고 메시지 전달
  conversationHistory.push({
    role: "user",
    content: `⚠️ LOOPING DETECTED: ...`
  });
}
```

#### C. 멘션(Mentions) 시스템

**위치**: `src/services/ai/mentions/parser.ts`

**목적**: 사용자가 특정 블록/페이지를 참조할 수 있게 함

**문법**:
- `@current` - 현재 포커스된 블록
- `@selection` - 선택된 블록들
- `@block:UUID` - 특정 블록
- `@page:UUID` - 특정 페이지

**현재 사용 방식**:
```typescript
// CopilotPanel.tsx line 270-322
const resolveContextFromMentions = (text: string) => {
  // 멘션 파싱
  const mentions = parseMentions(text);
  // 실제 내용 조회해서 프롬프트에 추가
  // "[Context: Current Focused Block] ..."
}
```

### 1.3 사용자 입력 흐름 (Step-by-Step)

사용자가 "태양계에 대해 설명해줘"라고 입력할 때:

```
1. CopilotPanel.handleSend()
   ├─ inputValue = "태양계에 대해 설명해줘"
   ├─ addChatMessage("user", "태양계에 대해 설명해줘")
   ├─ setIsLoading(true)  // ← UI에 로딩 표시 시작

2. AgentOrchestrator 생성
   ├─ 모든 20개 도구를 시스템 프롬프트에 포함
   └─ execute() 메서드 호출

3. AI에게 요청 (system prompt + user message + tool list)
   ├─ system-prompt.md의 지침 (도구 사용 권장)
   ├─ 사용 가능한 모든 20개 도구 정의
   └─ 사용자 입력: "태양계에 대해 설명해줘"

4. AI 응답 (항상 도구 호출 시도)
   ├─ "먼저 현재 컨텍스트를 확인하겠습니다"
   └─ tool_call: "get_current_context"

5. Tool Execution
   ├─ executeTool("get_current_context", {}, context)
   ├─ 도구 승인 확인 (정책에 따라)
   └─ Tool 결과를 대화 이력에 추가

6. Loop 반복
   ├─ AI가 다시 응답하기 → 도구 호출 또는 최종 답변
   └─ 최대 50회 반복 (루프 방지)

7. 최종 답변
   ├─ AI가 "final_answer" 반환
   ├─ addChatMessage("assistant", "태양계는...")
   └─ setIsLoading(false)  // ← UI 로딩 제거
```

### 1.4 System Prompt 분석

**위치**: `src/services/ai/agent/system-prompt.md`

**현재 설계 원칙** (system-prompt.md line 9-13):
```markdown
## [MUST] Core Principles

### 1. Tool-First Philosophy
- **NEVER describe actions** - just execute them
- Every state change MUST use a tool
- Don't say "I would create" - call `create_page` instead
```

**문제점**:
- ✗ "Tool-First" 원칙이 너무 절대적
- ✗ 도구 호출을 강요하는 방식
- ✗ 일반적인 정보 요청(추론)도 도구 호출 시도
- ✗ 프롬프트가 기술적 구현에만 집중

**좋은 점**:
- ✓ 명확한 단계별 지침
- ✓ 로핑 방지 지침 있음
- ✓ 마크다운 구조 명확
- ✓ 에러 핸들링 가이드

---

## 🎯 Part 2: 근본 원인 분석

### 문제: 왜 "무조건 도구를 쓰려고만 하나?"

#### 원인 1: System Prompt의 "Tool-First Philosophy"

```
현재 프롬프트:
"NEVER describe actions - just execute them"

결과:
- "태양계는 뭐예요?" → 즉시 get_current_context 호출
- "감사해요" → create_page나 update_block 시도
- 모든 입력이 도구 호출로 변환됨
```

#### 원인 2: 모든 도구를 항상 전달

```typescript
// orchestrator.ts line 87
const allTools = toolRegistry.getAll();  // 모든 20개 도구

// line 128
tools: allTools,  // AI 컨텍스트에 항상 포함
```

AI 입장에서:
- "도구가 있으니까 써야겠다"
- "먼저 컨텍스트를 확인해야겠다" → get_current_context 호출
- 도구가 없어도 해석할 수 있는 질문도 도구 호출

#### 원인 3: 도구 Approval이 UI 차단 요소

```typescript
// CopilotPanel.tsx line 325-330
const handleSend = async () => {
  setIsLoading(true);  // 모든 입력에 로딩 표시
  
  // 도구 승인 대기 중이면 UI 완전 차단
  // ToolApprovalModal이 모달로 표시됨
```

사용자 입장에서:
- 간단한 질문도 로딩 스피너 표시
- 예상치 못한 승인 모달
- "뭘 하고 있는 거지?" 혼란

#### 원인 4: Context 멘션의 의도와 현실의 괴리

```typescript
// mentions/parser.ts - 문법 정의
@current, @selection, @block:UUID, @page:UUID
```

설계 의도:
- "이 블록을 분석해줘 @current"
- "이 두 블록 연결해줘 @selection"

현실:
- 사용자가 멘션을 모름
- 멘션 없이도 항상 컨텍스트 자동 추가
- 자동 컨텍스트 추가 때문에 항상 도구 호출 시도

---

## 💡 Part 3: 개선 전략

### 3.1 핵심 철학 변경

**FROM**: "Tool-First" (모든 입력을 도구로)  
**TO**: "Intent-First" (의도를 먼저 파악, 필요할 때만 도구)

```
Intent-First 원칙:
1. 사용자 의도 분류
   - 정보 요청 (정보 제공만 필요) → 도구 불필요
   - 콘텐츠 생성 (페이지/블록 생성) → 도구 필요
   - 콘텐츠 수정 (업데이트/삭제) → 도구 필요
   - 일상적 대화 (인사말, 감사인사) → 도구 불필요

2. 의도에 따라 에이전트 모드 선택
   - "Light Mode": 도구 없이, 순수 대화
   - "Agent Mode": 도구 포함, 상태 변경 허용
   - "Hybrid Mode": 선택적 도구 사용
```

### 3.2 구체적 개선 방안

#### A. System Prompt 재설계

**목표**: 도구 사용의 명확한 조건 제시

```markdown
## System Prompt 개선 방향

### 1. Intent Classification (NEW)

사용자 입력을 4가지로 분류:

1. **Information Request** (정보 요청)
   - 신호: "뭐예요?", "설명해줘", "어떻게", "왜"
   - 예: "태양계는 뭐예요?"
   - 행동: **도구 호출 금지**, 순수 정보 제공
   
2. **Content Creation** (콘텐츠 생성)
   - 신호: "만들어줘", "추가해줘", "정리해줘"
   - 예: "마크다운 노트 만들어줘"
   - 행동: **도구 사용 필수** (create_page, create_blocks)
   
3. **Content Modification** (콘텐츠 수정)
   - 신호: "바꿔줘", "지워줘", "업데이트해줘"
   - 예: "이 섹션을 다시 작성해줘"
   - 행동: **도구 사용** (update_block, delete_block)
   
4. **Conversational** (일상 대화)
   - 신호: "감사해", "안녕", "좋아", "이해했어"
   - 예: "고마워요!"
   - 행동: **도구 호출 금지**, 친근한 응답

### 2. Tool Context Management (NEW)

도구는 필요할 때만 제공:

```typescript
// 의도별로 도구 선택적 제공
if (intent === "INFORMATION_REQUEST") {
  // 도구 없음
  tools: []
} else if (intent === "CONTENT_CREATION") {
  // 페이지/블록 도구만
  tools: [createPageTool, createBlockTool, ...]
} else if (intent === "CONTENT_MODIFICATION") {
  // 수정/삭제 도구만
  tools: [updateBlockTool, deleteBlockTool, ...]
}
```

### 3. Never Tool-Call Rules (ENHANCED)

```markdown
❌ DO NOT call tools:
- For information gathering about domains (태양계, 인류역사, etc)
- For general questions that don't require state changes
- For conversational responses (greetings, thanks, acknowledgments)
- For explaining concepts or providing analysis
- After user says "thanks", "no", "cancel", "nevermind"

✅ DO call tools when:
- User explicitly asks to create/modify/delete content
- User says "create a page", "add a block", "update"
- User provides content to be structured/organized
- Current context is explicitly mentioned as needing changes
```

### 4. Context Mention Clarity (NEW)

```markdown
### When to Use Context:

**ALWAYS include context if**:
- User says "@current" explicitly
- User says "this block" referring to focused block
- User says "these selected items"
- User mentions "previous discussion"

**NEVER auto-add context if**:
- User is asking general knowledge questions
- User is having small talk
- User hasn't explicitly referenced current content
- User is asking to create new content (not related to current)

**Example**:
- ❌ "태양계는 뭐야?" → DO NOT include current block context
- ✅ "@current 다시 정리해줄래?" → DO include context
- ✅ "이 주제에 대해 설명해줘" (while current block is focused) → DO include
```
```

#### B. CopilotPanel 구조 재설계

**현재 문제**:
```
모든 입력 → handleSend() → 즉시 AgentOrchestrator → setIsLoading(true)
```

**개선된 구조**:
```typescript
// 1. Intent 분류 (즉시, UI 차단 없음)
const intent = classifyIntent(userInput);

if (intent === "CONVERSATIONAL") {
  // 경로 1: 즉시 응답 (AI만)
  response = await getDirectResponse(userInput);
  addChatMessage("assistant", response);
  
} else if (intent === "INFORMATION_REQUEST") {
  // 경로 2: 정보 제공 (도구 없음)
  setIsLoading(true);
  response = await orchestrator.execute(userInput, { tools: [] });
  addChatMessage("assistant", response);
  
} else {
  // 경로 3: 에이전트 모드 (도구 포함)
  setIsLoading(true);
  const steps = await orchestrator.execute(userInput, { 
    tools: selectToolsByIntent(intent)
  });
  // 각 스텝 표시...
}
```

#### C. Tool Approval UX 개선

**현재 문제**: 모든 도구 승인이 모달로 표시 → UI 차단

**개선 방안**:
```typescript
// 도구별 승인 정책 세분화
const approval = {
  safe_read: "auto_approve",      // list_pages, get_block 등
  dangerous: "ask_before",         // delete_block, update_page 등
  creation: "ask_before",          // create_page, create_blocks
};

// Approval을 비동기 토스트 + 타이머로 (모달 아님)
// 또는 최소 "Auto-approve safe operations" 옵션
```

#### D. 멘션 시스템 개선

**현재 문제**: 
- 사용자가 멘션 문법을 모름
- 자동 컨텍스트 추가가 과도함

**개선 방안**:
```typescript
// 1. 멘션 자동완성 UI 개선
// @를 타이핑하면 드롭다운:
// - @current (현재 블록)
// - @selection (선택된 항목)
// - @page:검색창
// - @block:검색창

// 2. 자동 컨텍스트 추가 조건 명확화
const shouldAutoAddContext = () => {
  // 오직 다음의 경우만:
  // 1) 사용자가 explicitly 현재 블록을 언급
  // 2) 사용자가 "이것을" "이 부분을" 등 지시대명사 사용
  // 3) 지난 턴에서 현재 블록 이야기했음
  
  // 아니면: 자동 추가 하지 말 것
};
```

### 3.3 구현 체크리스트

#### Phase 1: Foundation (1-2주)
- [ ] `classifyIntent()` 함수 구현 (기본 4가지 분류)
- [ ] System Prompt 업데이트 (Intent Classification 추가)
- [ ] Tool selection logic 구현
- [ ] 테스트: "태양계" → 도구 호출 없음 ✓
- [ ] 테스트: "페이지 만들어" → 도구 호출 있음 ✓

#### Phase 2: UX Refinement (1주)
- [ ] CopilotPanel 구조 리팩토링 (3가지 경로)
- [ ] Tool Approval 정책 세분화
- [ ] 멘션 자동완성 UI (드롭다운)
- [ ] Context 자동추가 조건 명확화

#### Phase 3: Conversational Mode (1주)
- [ ] 일상 대화 감지 개선
- [ ] 직접 응답 (AI only) 경로 추가
- [ ] 응답 속도 개선 (도구 호출 스킵 시)
- [ ] 사용자 테스트 수행

#### Phase 4: Polish & Documentation (1주)
- [ ] 도구 descriptions 개선 (언제 사용하는가)
- [ ] 사용자 가이드 작성
- [ ] 에러 메시지 개선
- [ ] 성능 모니터링

---

## 📋 Part 4: 구현 가이드

### 4.1 Intent Classification 구현

```typescript
// src/services/ai/utils/intentClassifier.ts

export type Intent = 
  | "CONVERSATIONAL"
  | "INFORMATION_REQUEST"
  | "CONTENT_CREATION"
  | "CONTENT_MODIFICATION";

export function classifyIntent(userInput: string): Intent {
  const lower = userInput.toLowerCase().trim();
  
  // 1. Conversational 감지
  const conversationalPatterns = [
    /^(thanks?|thank you|감사|고마워|고마워요|잘했어|좋아|괜찮아|이해했어|맞아|응응|네|yes|ok|오케이)/,
    /^(hello|안녕|hi|bye|goodbye|안녕히|잘가)/,
    /^(sorry|죄송|미안해|실수했네)/,
  ];
  
  if (conversationalPatterns.some(p => p.test(lower))) {
    return "CONVERSATIONAL";
  }
  
  // 2. Content Creation 감지
  const creationPatterns = [
    /(?:만들어|추가해|작성해|구성해|정리해|조직해)(?:주|요)/,
    /(?:create|make|add|write|organize)/i,
    /^(?:새로운|새 )?(페이지|노트|문서|섹션)/,
  ];
  
  if (creationPatterns.some(p => p.test(lower))) {
    return "CONTENT_CREATION";
  }
  
  // 3. Content Modification 감지
  const modificationPatterns = [
    /(?:바꿔|수정해|변경해|업데이트|지워|삭제해|제거해)(?:주|요)/,
    /(?:change|modify|update|delete|remove)/i,
  ];
  
  if (modificationPatterns.some(p => p.test(lower))) {
    return "CONTENT_MODIFICATION";
  }
  
  // 기본값: Information Request
  return "INFORMATION_REQUEST";
}
```

### 4.2 Tool Selection 구현

```typescript
// src/services/ai/utils/toolSelector.ts

export function selectToolsByIntent(intent: Intent): Tool[] {
  switch (intent) {
    case "CONVERSATIONAL":
      return []; // 도구 불필요
    
    case "INFORMATION_REQUEST":
      return [contextTools]; // 현재 컨텍스트만
    
    case "CONTENT_CREATION":
      return [
        createPageTool,
        createPageWithBlocksTool,
        createBlockTool,
        createBlocksBatchTool,
        createBlocksFromMarkdownTool,
        validateMarkdownStructureTool,
        getMarkdownTemplateTool,
      ];
    
    case "CONTENT_MODIFICATION":
      return [
        updateBlockTool,
        appendToBlockTool,
        deleteBlockTool,
        queryBlocksTool,
        getBlockTool,
        getPageBlocksTool,
      ];
  }
}
```

### 4.3 Updated System Prompt Structure

```markdown
# Oxinot Copilot System Prompt (Improved)

You are Oxinot Copilot, an AI assistant in a markdown outliner.

## Core Principle: Intent-First, Tool-When-Needed

Your job is to:
1. Understand the user's actual intent
2. Respond appropriately based on intent
3. Use tools ONLY when necessary for state changes

### Intent Categories

#### 1. Conversational (일상 대화)
- User says: "thanks", "감사해", "좋아", "안녕"
- Your response: Warm, brief reply. NO tools.
- Example: User: "감사합니다!" → You: "기꺼워요! 더 도와드릴 것 있으세요?"

#### 2. Information Request (정보 요청)
- User asks: "뭐야?", "설명해줘", "어떻게", "왜", "왕자는 누구"
- Your response: Clear explanation. NO tools needed.
- When current context is relevant, explain using it.
- Example: User: "태양계는 뭐야?" → You: "태양계는 태양을 중심으로..."

#### 3. Content Creation (콘텐츠 생성)
- User asks: "페이지 만들어", "노트 작성해", "정리해줄래"
- Your response: Use tools to create pages/blocks.
- Steps:
  1. Clarify what to create (if needed)
  2. create_page()
  3. create_blocks_from_markdown()
  4. Confirm success

#### 4. Content Modification (콘텐츠 수정)
- User asks: "바꿔줘", "업데이트해", "지워줄래"
- Your response: Use tools to modify/delete.
- Validate current context first, then modify.

### When to Use Tools

✅ Use tools when:
- User explicitly requests to CREATE/MODIFY/DELETE
- Current context needs to change
- User references specific blocks/pages

❌ DO NOT use tools:
- For information questions (just explain)
- For conversational responses (just chat)
- For analysis or explanations
- When user hasn't explicitly asked for changes

### Available Tools (Conditional)

**Note**: Available tools depend on intent classification.
- Conversational: No tools
- Information: Context tool only
- Creation: Creation tools only
- Modification: Modification tools only

[Rest of prompt structure...]
```

### 4.4 CopilotPanel 리팩토링

```typescript
// src/components/copilot/CopilotPanel.tsx (Refactored)

const handleSend = async () => {
  if (!inputValue.trim()) return;
  
  const currentInput = inputValue;
  setInputValue("");
  
  // Step 1: Classify intent (빠르게, UI 차단 없음)
  const intent = classifyIntent(currentInput);
  console.log("[Copilot] Intent:", intent);
  
  // Add user message immediately
  addChatMessage("user", currentInput);
  
  // Step 2: Route based on intent
  if (intent === "CONVERSATIONAL") {
    // 경로 1: Direct response (도구 없음)
    await handleConversational(currentInput);
  } else if (intent === "INFORMATION_REQUEST") {
    // 경로 2: Information mode (컨텍스트만)
    await handleInformation(currentInput);
  } else {
    // 경로 3: Agent mode (선택된 도구들)
    await handleAgentMode(currentInput, intent);
  }
};

private async handleConversational(input: string) {
  // AI에게 빠르게 응답하라고 지시
  // 도구 없이, 친근하게
  const response = await this.getQuickResponse(input);
  addChatMessage("assistant", response);
}

private async handleInformation(input: string) {
  // Information 모드: 도구 없이 설명
  setIsLoading(true);
  try {
    for await (const step of orchestrator.execute(enrichedGoal, {
      tools: [contextTools], // 컨텍스트만
      ...
    })) {
      // 스텝 표시...
    }
  } finally {
    setIsLoading(false);
  }
}

private async handleAgentMode(input: string, intent: Intent) {
  // Agent 모드: 필요한 도구들로 작동
  setIsLoading(true);
  try {
    const selectedTools = selectToolsByIntent(intent);
    for await (const step of orchestrator.execute(enrichedGoal, {
      tools: selectedTools,
      ...
    })) {
      // 스텝 표시...
    }
  } finally {
    setIsLoading(false);
  }
}
```

---

## 🧪 Part 5: 테스트 전략

### 5.1 Intent Classification 테스트

```typescript
// src/services/ai/utils/__tests__/intentClassifier.test.ts

describe("classifyIntent", () => {
  describe("CONVERSATIONAL", () => {
    it("should classify 'thanks'", () => {
      expect(classifyIntent("thanks!")).toBe("CONVERSATIONAL");
    });
    it("should classify Korean casual 'cool'", () => {
      expect(classifyIntent("좋아요!")).toBe("CONVERSATIONAL");
    });
    it("should classify greetings", () => {
      expect(classifyIntent("hello")).toBe("CONVERSATIONAL");
    });
  });
  
  describe("INFORMATION_REQUEST", () => {
    it("should classify 'what is'", () => {
      expect(classifyIntent("what is the solar system?"))
        .toBe("INFORMATION_REQUEST");
    });
    it("should classify 'explain'", () => {
      expect(classifyIntent("explain photosynthesis"))
        .toBe("INFORMATION_REQUEST");
    });
  });
  
  describe("CONTENT_CREATION", () => {
    it("should classify 'create page'", () => {
      expect(classifyIntent("create a page"))
        .toBe("CONTENT_CREATION");
    });
    it("should classify Korean '만들어줘'", () => {
      expect(classifyIntent("페이지 만들어줘"))
        .toBe("CONTENT_CREATION");
    });
  });
  
  describe("CONTENT_MODIFICATION", () => {
    it("should classify 'update'", () => {
      expect(classifyIntent("update this block"))
        .toBe("CONTENT_MODIFICATION");
    });
    it("should classify Korean '바꿔줘'", () => {
      expect(classifyIntent("이 부분 바꿔줘"))
        .toBe("CONTENT_MODIFICATION");
    });
  });
});
```

### 5.2 Integration 테스트

```typescript
// src/components/copilot/__tests__/CopilotPanel.integration.test.ts

describe("CopilotPanel Intent Routing", () => {
  it("should NOT call tools for 'thanks'", async () => {
    const { getByText, queryByTestId } = render(<CopilotPanel />);
    
    await userEvent.click(getByText("Send"));
    userEvent.type(inputField, "thanks!");
    
    // Should respond without loading spinner
    await waitFor(() => {
      expect(queryByTestId("loading-spinner")).not.toBeInTheDocument();
    });
  });
  
  it("should call tools for 'create page'", async () => {
    const { getByText } = render(<CopilotPanel />);
    
    userEvent.type(inputField, "create a note about AI");
    await userEvent.click(getByText("Send"));
    
    // Should show loading spinner
    expect(queryByTestId("loading-spinner")).toBeInTheDocument();
    
    // Should call create_page tool
    await waitFor(() => {
      expect(createPageTool).toHaveBeenCalled();
    });
  });
});
```

---

## 📈 Part 6: 기대 효과

### Before (현재)
```
사용자: "감사합니다!"
Copilot:
  1. [로딩...] 5초
  2. 도구: get_current_context 호출
  3. 도구: validate_markdown_structure 호출
  4. 도구 승인 모달 표시
  5. 응답: "감사합니다! 현재 컨텍스트는..."
  
문제: 간단한 감사말에 5초, 불필요한 도구 호출
```

### After (개선 후)
```
사용자: "감사합니다!"
Copilot:
  1. Intent: CONVERSATIONAL (즉시)
  2. 응답: "기꺼워요!" (0.5초)

사용자: "태양계는 뭐야?"
Copilot:
  1. Intent: INFORMATION_REQUEST
  2. 응답: "태양계는 태양을 중심으로..." (1초, 도구 없음)

사용자: "이 주제로 페이지 만들어줄래?"
Copilot:
  1. Intent: CONTENT_CREATION
  2. [로딩...] 도구 호출 (필요한 것만)
  3. create_page → create_blocks_from_markdown
  4. 응답: "페이지 생성 완료!"

개선:
- ✓ 대화 응답 속도 10배 향상
- ✓ 불필요한 도구 호출 0으로 감소
- ✓ 사용자 혼란 제거 (예측 가능한 동작)
- ✓ 토큰 사용량 30-40% 감소
```

---

## 🎓 Part 7: 권장 사항

### 즉시 적용 가능한 Quick Wins

1. **System Prompt 업데이트**
   - "Tool-First" → "Intent-First"로 변경
   - 도구 호출 금지 명확히 (정보 요청, 대화)
   - 소요: 1시간

2. **Intent Classification 추가**
   - 간단한 regex 기반 분류기 추가
   - CopilotPanel에서 사용
   - 소요: 2시간

3. **Approval 정책 개선**
   - 자동 승인 추가 (safe operations)
   - 소요: 1시간

### 중기 개선 (1-2주)

4. **도구 선택적 전달**
   - Intent별 도구 필터링
   - 소요: 3시간

5. **멘션 UI 개선**
   - 자동완성 드롭다운
   - 소요: 2시간

### 장기 비전 (1개월)

6. **Conversational Mode** 
   - AI-only 응답 경로
   - 응답 속도 극대화
   - 소요: 1주

7. **Multi-turn 대화 개선**
   - 대화 히스토리 관리
   - Context window 최적화
   - 소요: 1주

---

## 📐 Part 8: 블록 구조 문제 분석 및 개선

### 문제 상황

사용자: "Logseq 스타일의 회의 노트 페이지 만들어줄래?"

**현재 동작** (문제):
```
AI가 만드는 구조:
- 회의 노트
  - 참석자: Alice, Bob
  - 시간: 2월 8일 2시
  - 안건
    - 프로젝트 A 진행도
    - 예산 검토
  - 결정사항
    - [결정1]
    - [결정2]
```

**현재 코드 분석**:
```typescript
// createPageWithBlocksTool.ts
// 문제: 블록을 순서대로 생성하기만 함
// parentBlockId/insertAfterBlockId를 직접 관리해야 함
// AI가 직접 UUID를 생성해야 하는 복잡한 로직

for (const block of params.blocks) {
  const newBlock = await invoke("create_block", {
    pageId: newPageId,
    parentId: block.parentBlockId ?? null,  // ← AI가 UUID 직접 관리
    afterBlockId: insertAfterBlockId || null,
    content: block.content,
    indent: blockIndent,  // ← indent 값도 제공해야 함
  });
  lastBlockId = newBlock.id;
}
```

**문제점**:
1. **AI가 UUID를 생성해야 함**: AI가 실제로 UUID를 만들지 못하므로, `parentBlockId`와 `insertAfterBlockId`를 체계적으로 관리 불가
2. **계층 구조 표현의 복잡성**: `indent` 값과 `parentBlockId`가 동시에 필요 → 혼란
3. **마크다운 형식이 더 자연스러움**: 들여쓰기만 있으면 자동 계층 구조 구성 가능

### 블록 기반 아웃라이너의 핵심 개념

**Logseq 구조 (참고)**:
```
각 블록은 다음을 가짐:
- 콘텐츠 (텍스트)
- 부모 블록 (있으면)
- 자식 블록들 (배열)
- 형제 블록 순서 (같은 부모 아래)

시각적으로:
- Block A (level 0)
  - Block B (level 1, parent=A)
  - Block C (level 1, parent=A)
    - Block D (level 2, parent=C)
    - Block E (level 2, parent=C)
- Block F (level 0)
```

**현재 Oxinot 구조**:
```typescript
interface BlockData {
  id: string;
  pageId: string;
  parentId: string | null;      // 부모 블록 ID
  content: string;               // 콘텐츠
  orderWeight: number;           // 형제 간 순서
  isCollapsed: boolean;
  blockType: "bullet" | "code" | "fence";
}
```

**중요**: parentId + orderWeight로 계층 구조 표현  
마크다운은 **들여쓰기로 자동 계층 구조** 표현

### 해결책: 마크다운 기반 접근 강화

#### 현재 도구 분석

**createBlocksFromMarkdownTool** (Good 👍):
```typescript
// 마크다운만 받으면 자동으로 계층 구조 생성!
const markdown = `
- 회의 노트
  - 참석자: Alice, Bob
  - 시간: 2월 8일 2시
  - 안건
    - 프로젝트 A 진행도
    - 예산 검토
`;

// 자동으로 정확한 계층 구조 생성
await createBlocksFromMarkdownTool.execute({
  pageId: "...",
  markdown: markdown
}, context);
```

**parseMarkdownToBlocks** (내부 로직):
```typescript
// 자동 정규화 기능!
function normalizeMarkdownIndentation(markdown: string) {
  // "- Item\n - SubItem" (1 space) 
  //   → "- Item\n  - SubItem" (2 spaces) 자동 수정
  if (spaceCount % 2 === 1) {
    normalizedSpaces = spaceCount + 1;  // 1 → 2, 3 → 4, 등
  }
}
```

**createPageWithBlocksTool** (Bad ❌):
```typescript
// 문제: 마크다운이 아니라 JSON 배열로 블록을 하나하나 정의해야 함
// AI가 직접 parentBlockId와 insertAfterBlockId를 관리해야 함
// UUID를 생성해야 함 (불가능)

{
  blocks: [
    { content: "회의 노트", parentBlockId: null, insertAfterBlockId: null },
    { 
      content: "참석자: Alice, Bob", 
      parentBlockId: "{{TEMP_UUID_OF_BLOCK_0}}", // ← 이게 가능?
      insertAfterBlockId: null 
    },
    // ... 복잡함
  ]
}
```

### 개선 방안

#### 1. System Prompt 재작성 (최우선)

**현재** (시스템 프롬프트 일부):
```markdown
## Step 3: Create Page
- Use `create_page` with appropriate `parentId` and `isDirectory`

## Step 4: Generate & Validate Markdown
- Create proper indented markdown structure with 2-space indentation
- Call `validate_markdown_structure(...)`

## Step 5: Create Blocks
- Call `create_blocks_from_markdown(pageId, markdown)`
```

**문제**: `create_page_with_blocks`와 `create_block`의 사용 조건이 명확하지 않음

**개선된 프롬프트**:
```markdown
## 블록 생성 워크플로우 (CRITICAL)

사용자가 "페이지 만들어달라"고 할 때:

### Step 1-2: 페이지 생성 (기존대로)
list_pages() → create_page() → 페이지ID 받음

### Step 3: 마크다운 구조 생성
여기서 중요한 것:
- **마크다운 형식 = 최고의 계층 표현 방식**
- 들여쓰기만 정확하면 자동으로 계층 구조 구성

정확한 마크다운 예시:
```markdown
- 회의 노트
  - 참석자: Alice, Bob
  - 시간: 2월 8일 2시
  - 안건
    - 프로젝트 A 진행도
    - 예산 검토
  - 결정사항
    - 승인됨
    - 다음주 재검토
```

### Step 4: 마크다운 검증
validate_markdown_structure(markdown, expectedBlockCount)

### Step 5: 블록 생성
create_blocks_from_markdown(pageId, markdown) ← 이것만 사용!

### ⚠️ NEVER 사용:
- ❌ create_page_with_blocks (구조화된 콘텐츠 필요할 때만, 매우 제한적)
- ❌ create_block (1개 블록만 필요할 때만)
- ❌ 직접 UUID 생성/관리

### 마크다운 형식의 중요성:

**정확한 구조의 핵심 = 2칸 들여쓰기**:

```
Level 0 (루트): - Content
Level 1 (1단 인덴트): - Content      (2 spaces)
Level 2 (2단 인덴트): - Content      (4 spaces)
Level 3 (3단 인덴트): - Content      (6 spaces)
```

**형제 블록 (sibling)**:
```markdown
- 메인 토픽
  - 서브토픽 1    ← 같은 레벨
  - 서브토픽 2    ← 같은 레벨 (같은 들여쓰기)
  - 서브토픽 3    ← 같은 레벨
- 다음 메인 토픽
  - 서브토픽 A
```

**NOT 계단식 패턴**:
```markdown
❌ WRONG (계단식):
- 메인 토픽
  - 서브토픽 1
    - 서브토픽 2      ← 이렇게 하면 깊은 중첩
      - 서브토픽 3

✅ CORRECT (평탄한 형제):
- 메인 토픽
  - 서브토픽 1       ← 모두 같은 레벨
  - 서브토픽 2       ← 모두 같은 레벨
  - 서브토픽 3       ← 모두 같은 레벨
```
```

#### 2. 도구 재평가 및 개선

**도구별 사용 조건**:

| 도구 | 사용 조건 | 예시 |
|------|---------|------|
| `create_blocks_from_markdown` | **기본값**: 구조 있는 콘텐츠 | "회의 노트 만들어" (안건, 참석자, 결정사항 포함) |
| `create_page_with_blocks` | **매우 제한적**: 평탄한 구조만 | "할 일 목록 만들어" (항목만 나열, 인덴트 없음) |
| `create_page` + `create_block` | **최소한**: 1-2개 블록만 | "빈 페이지 만들어" + "첫 문장 추가" |

**권장사항**:
```typescript
// System prompt에 추가할 내용
if (contentHasStructure(userInput)) {
  // "안건", "섹션", "부분" 등이 있으면
  // → markdown 형식으로 만들고 create_blocks_from_markdown 사용
} else if (contentIsFlat(userInput)) {
  // 단순 목록만 있으면
  // → create_page_with_blocks (또는 markdown 사용 가능)
} else {
  // 매우 간단하면
  // → create_page + create_block
}
```

#### 3. 마크다운 파서 개선 (이미 부분적으로 구현됨)

**현재 좋은 점**:
```typescript
// src/utils/markdownBlockParser.ts
function normalizeMarkdownIndentation(markdown: string) {
  // AI의 흔한 실수 자동 수정: "1 space" → "2 spaces"
  if (spaceCount % 2 === 1 && spaceCount > 0) {
    const normalizedSpaces = spaceCount + 1;
    // 자동 정정!
  }
}
```

**더 개선할 점**:
```typescript
// 추가 정규화 기능
function enhanceMarkdownNormalization(markdown: string) {
  // 1. 혼합된 bullet 스타일 정규화
  markdown = markdown.replace(/^[\*\+]/gm, "-");  // * or + → -로 통일
  
  // 2. 불필요한 빈 줄 제거 (구조 명확히)
  markdown = markdown.replace(/\n\n+/g, "\n");
  
  // 3. 탭 → 공백 변환
  markdown = markdown.replace(/\t/g, "  ");  // 탭 → 2 spaces
  
  // 4. 후행 공백 제거
  markdown = markdown.split("\n").map(line => line.trimEnd()).join("\n");
  
  return markdown;
}
```

### 4. 실전 예시: 사용자 요청별 처리

#### 예1: "회의 노트 만들어줄래?" (구조 있음)
```
사용자: "회의 노트 만들어. 참석자, 시간, 안건, 결정사항 섹션으로."

AI 동작:
1. Intent: CONTENT_CREATION
2. 마크다운 생성:
   ```markdown
   - 회의 노트
     - 참석자
       - [TBD]
     - 시간
       - [TBD]
     - 안건
       - [TBD]
     - 결정사항
       - [TBD]
   ```
3. validate_markdown_structure()
4. create_blocks_from_markdown(pageId, markdown)
5. "회의 노트 생성 완료!" ✓
```

#### 예2: "할 일 목록 만들어줄래?" (구조 없음, 평탄)
```
사용자: "오늘 할 일 목록"

AI 동작:
1. Intent: CONTENT_CREATION
2. 마크다운 생성:
   ```markdown
   - 이메일 회신
   - 보고서 작성
   - 미팅 준비
   - 문서 검토
   ```
3. validate_markdown_structure()
4. create_blocks_from_markdown(pageId, markdown)
5. "할 일 목록 생성 완료!" ✓
```

#### 예3: "이 마크다운을 페이지로 만들어줄래?" (사용자가 마크다운 제공)
```
사용자: 
```
프로젝트 계획
- Phase 1
  - 기획
  - 설계
- Phase 2
  - 개발
  - 테스트
```

AI 동작:
1. 사용자 마크다운 정규화
2. validate_markdown_structure()
3. create_blocks_from_markdown()
4. 완료 ✓
```

### 5. 에러 시나리오 처리

**문제**: AI가 잘못된 마크다운을 생성했을 때

```typescript
// System prompt 추가
"❌ createPageWithBlocksTool 사용 금지:
  - 이유: AI가 parentBlockId/insertAfterBlockId를 관리할 수 없음
  - UUID 생성 불가능
  - 들여쓰기보다 복잡함

✅ 해결책: 마크다운 + validate + create_blocks_from_markdown
  - 마크다운이 잘못되면 validate가 경고
  - 경고를 받으면 마크다운 수정
  - 그 다음 create_blocks_from_markdown 실행
"
```

### 6. 마크다운 검증 도구 개선

현재:
```typescript
export const validateMarkdownStructureTool: Tool = {
  // 검증만 함
};
```

개선 제안:
```typescript
// 검증 + 제안 기능 추가
{
  success: true,
  data: {
    isValid: true,
    blockCount: 12,
    warnings: [
      "Line 5: Only 1 space indentation detected. Auto-normalized to 2 spaces.",
      "Recommend: Use - instead of * for consistency"
    ],
    suggestions: [
      "Consider grouping related items"
    ]
  }
}
```

### 체크리스트

블록 구조 개선을 위해:

- [ ] System Prompt에서 `createPageWithBlocksTool` 사용 조건 명확히
- [ ] `createPageWithBlocks` vs `createBlocksFromMarkdown` 비교 테이블 추가
- [ ] 마크다운 형식 가이드 상세화
- [ ] AI가 항상 마크다운을 먼저 검증하도록 지시
- [ ] 마크다운 정규화 함수 강화
- [ ] 실제 페이지 생성 테스트 (회의 노트, 프로젝트 계획 등)

---

## 📚 Part 9: 참고 자료

### 현재 코드 위치

**Core Agent System**:
- System Prompt: `src/services/ai/agent/system-prompt.md`
- Orchestrator: `src/services/ai/agent/orchestrator.ts`
- Error Recovery: `src/services/ai/agent/errorRecovery.ts`
- Types: `src/services/ai/agent/types.ts`

**UI Components**:
- CopilotPanel: `src/components/copilot/CopilotPanel.tsx`
- MentionAutocomplete: `src/components/copilot/MentionAutocomplete.tsx`
- ToolApprovalModal: `src/components/copilot/ToolApprovalModal.tsx`

**Tool System**:
- Tool Registry: `src/services/ai/tools/registry.ts`
- Tool Executor: `src/services/ai/tools/executor.ts`
- Tool Types: `src/services/ai/tools/types.ts`

**Block/Page Tools**:
- Block Tools: `src/services/ai/tools/block/` (14개 도구)
- Page Tools: `src/services/ai/tools/page/` (5개 도구)
- Context Tools: `src/services/ai/tools/context/`
- Mentions: `src/services/ai/mentions/parser.ts`

**Block Structure**:
- Block Store: `src/stores/blockStore.ts`
- Block Utils: `src/outliner/blockUtils.ts`
- Block Types: `src/outliner/types.ts`
- Markdown Parser: `src/utils/markdownBlockParser.ts`
- Markdown Renderer: `src/outliner/markdownRenderer.ts`

### 관련 설정
- 도구 승인 정책: `useAISettingsStore` (toolApprovalPolicy)
- UI 상태: `useCopilotUiStore` (isLoading, chatMessages)
- Tool Approval: `useToolApprovalStore`
- Block UI State: `useBlockUIStore`
- Page State: `usePageStore`

### 블록 구조 이해하기

**마크다운 → 블록 변환**:
```
markdown string
  ↓
parseMarkdownToBlocks() (자동 정규화)
  ↓
buildHierarchyImpl() (계층 구조 구성)
  ↓
create_blocks_from_markdown() (DB 저장)
  ↓
실제 블록 객체들
```

**중요 파일들**:
- `blockStore.ts`: BlockData 인터페이스, 블록 CRUD
- `blockUtils.ts`: 트리 조작, 계층 쿼리
- `markdownBlockParser.ts`: 마크다운 정규화 + 파싱
- `createBlocksFromMarkdownTool.ts`: 도구 구현

### 유용한 리소스
- [Claude API Tool Use Docs](https://docs.anthropic.com/claude/guide/tool-use)
- [Intent Classification Best Practices](https://huggingface.co/tasks/text-classification)
- [Prompt Engineering for Classification](https://github.com/brexhq/prompt-engineering)
- [Logseq Documentation](https://docs.logseq.com/) (아키텍처 참고)
- [Block-Based Outlining Patterns](https://roamresearch.com/) (Roam Research 참고)

---

## ✅ 종합 체크리스트

### 📋 전체 프로젝트 진행도

**Phase 1: 근본 개선 (2-3주)**
- [ ] Part 1-2 문제 분석 검토
- [ ] Intent Classification 함수 구현
- [ ] System Prompt 기본 구조 업데이트 (Intent-First)
- [ ] 테스트 케이스 작성 (conversational, information, creation)
- [ ] 기본 테스트 통과

**Phase 2: 블록 구조 개선 (1-2주)**
- [ ] createPageWithBlocksTool 사용 조건 명확화 (Part 8)
- [ ] System Prompt에 마크다운 형식 가이드 추가
- [ ] 마크다운 정규화 기능 강화 (탭 → 공백, bullet 통일 등)
- [ ] 도구 비교 테이블 추가 (markdown vs create_page_with_blocks)
- [ ] 실제 페이지 생성 테스트 (회의 노트, 프로젝트 계획)
- [ ] 사용자가 제공한 마크다운 처리 테스트

**Phase 3: UX 개선 (1주)**
- [ ] CopilotPanel 구조 리팩토링 (3가지 경로)
- [ ] Tool Selection 로직 구현
- [ ] Approval Policy 세분화
- [ ] 멘션 자동완성 UI 개선
- [ ] Context 자동추가 조건 명확화

**Phase 4: Polish & Documentation (1주)**
- [ ] 도구 descriptions 개선
- [ ] 사용자 가이드 작성
- [ ] 에러 메시지 개선
- [ ] 성능 모니터링 추가

### 🎯 블록 구조 구현 체크리스트

**System Prompt 업데이트**:
- [ ] "블록 생성 워크플로우" 섹션 추가 (Part 8 참고)
- [ ] `createPageWithBlocksTool` 사용 조건 명확히
- [ ] `createBlocksFromMarkdown` 우선 추천
- [ ] 마크다운 형식 정확한 예시
  - [ ] 정확한 구조 (2칸 들여쓰기)
  - [ ] 형제 블록 vs 계단식 패턴
  - [ ] 예시: 회의 노트, 할 일, 프로젝트 계획

**도구 개선**:
- [ ] createBlocksFromMarkdownTool 설명 강화
- [ ] createPageWithBlocksTool 사용 경고 추가
- [ ] validateMarkdownStructureTool에 제안 기능 추가

**마크다운 파서 개선**:
- [ ] 탭 → 공백 변환 추가
- [ ] Bullet 스타일 통일 (* + - → -)
- [ ] 혼합된 들여쓰기 자동 정정
- [ ] 테스트 케이스 작성

**테스트**:
- [ ] "회의 노트 만들어" → 정확한 계층 구조
- [ ] "할 일 목록 만들어" → 평탄한 구조
- [ ] 사용자 마크다운 입력 → 정규화 + 생성
- [ ] 혼합된 들여쓰기 → 자동 정정

### 📊 성공 지표

**Before (현재 문제)**:
- ❌ 블록 구조가 예측 불가능
- ❌ AI가 UUID를 관리해야 함
- ❌ createPageWithBlocksTool이 복잡함
- ❌ 사용자가 구조를 명확히 이해 못함

**After (개선 후)**:
- ✅ 마크다운만으로 정확한 계층 구조
- ✅ AI가 간단한 마크다운 형식만 관리
- ✅ createBlocksFromMarkdown 한 가지 방식
- ✅ 사용자가 예상한 구조 생성

---

## ✨ 최종 정리

**이 문서의 목표**:
1. ✅ **Part 1-2**: 코파일럿의 도구 강박 문제 분석
2. ✅ **Part 3-4**: Intent-First 패러다임으로 해결
3. ✅ **Part 5-7**: 단계별 구현 가이드와 테스트
4. ✅ **Part 8**: 블록 구조 문제와 마크다운 기반 해결책
5. ✅ **Part 9**: 전체 참고 자료 정리

**이 문서를 읽은 후 할 일**:
1. 팀과 함께 Part 1-2의 문제를 공유
2. Part 8의 블록 구조 개선안 검토
3. Intent Classification 함수부터 시작 (Quick Win)
4. Phase 1 → 2 → 3 → 4 진행

**최종 목표**: 
Oxinot 코파일럿을 **자연스럽고 유연한 AI 어시스턴트**로 진화시켜, 
사용자가:
- 일상적인 대화 ↔ 강력한 페이지/블록 작성
을 자연스럽게 함께 사용할 수 있도록 하기.

그리고 페이지를 만들 때는:
- **마크다운 기반의 직관적인 계층 구조**
로 Logseq처럼 자연스럽게 동작하도록 하기.

---

**작성자**: Sisyphus AI Agent  
**마지막 업데이트**: 2026-02-08  
**상태**: 분석 완료 + 구현 가이드 포함
