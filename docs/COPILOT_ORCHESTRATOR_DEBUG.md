# 코파일럿 오케스트레이터 문제 분석 보고서

**작성일**: 2026-02-18
**상태**: 수정 완료
**문제**: 코파일럿이 "확인하겠습니다"라고만 말하고 실제 도구를 호출하지 않음

---

## 1. 문제 현상

```
사용자: "빈 노트를 하나 만들어줘"
코파일럿: "먼저 현재 페이지 목록을 확인하고 빈 노트를 생성하겠습니다."
(실제 도구 호출 없음, 응답 종료)
```

---

## 2. 근본 원인 분석

Git 로그 분석 결과, **c95b857** 커밋과 기존 코드에서 **다섯 가지 문제**가 발견되었습니다.

### 2.1 원인 1: maxIterations 급감 (50 → 8) 🔴

**과거** (ThreadBlockService):
```typescript
for await (const step of orchestrator.execute(enrichedGoal, {
  maxIterations: 50,  // 충분한 "생각" 시간
  verbose: true,
  ...
})) {
```

**현재** (agentRunService.ts):
```typescript
const orchestratorConfig: AgentConfig = {
  maxIterations: config.maxIterations ?? 8,  // 너무 적음!
  maxTotalToolCalls: config.maxTotalToolCalls ?? 16,
};
```

**문제점**:
- AI가 도구를 호출하기 전에 "생각"할 iteration이 부족
- 8번 안에 도구 호출을 결정하지 못하면 그냥 텍스트로 응답
- ReAct 패턴에서 thought → tool_call → observation 사이클이 충분히 돌지 못함

### 2.2 원인 2: System Prompt에서 "Tool-First" 지시 제거 🔴

**과거** (c95b857 이전):
```markdown
### 2. Tool-First Philosophy
- **NEVER describe actions** - just execute them
- Every state change MUST use a tool
- Don't say "I would create" - call `create_page` instead
```

**현재** (c95b857 이후):
```markdown
### 1. Autonomous Tool Usage

You have access to all available tools. **You decide** when and whether to use them...

**Guidelines:**
- If the user is just chatting ("thanks", "hi", "cool") → respond conversationally without tools
```

**문제점**:
- "NEVER describe actions - just execute them" 지시가 **삭제됨**
- "Don't say 'I would create' - call `create_page` instead" 지시가 **삭제됨**
- "respond conversationally without tools"가 추가되어 AI가 도구 없이 텍스트만 반환해도 됨

### 2.3 원인 3: 피드백 루프 제거

**과거 orchestrator.ts**:
```typescript
if (!toolWasCalled && !finalAnswerReceived) {
  conversationHistory.push({
    role: "user",
    content: "Please use one of the available tools to make progress on the task, or provide a final answer if the task is complete.",
  });
}
```

**현재 orchestrator.ts**:
```typescript
// 텍스트가 있으면 무조건 final answer로 처리
if (accumulatedText.trim()) {
  const finalStep = this.createFinalStep(accumulatedText);
  this.state.status = "completed";
  yield finalStep;
  break;
}
```

**문제점**:
- 과거에는 tool 호출 없이 텍스트만 반환하면 **다시 시도하라는 피드백** 제공
- 현재는 텍스트가 있으면 **무조건 final answer로 처리하고 종료**

### 2.4 원인 4: ClaudeProvider 복수 tool call 유실

**위치**: `src/services/ai/ClaudeProvider.ts`

**문제**: Claude가 한 턴에 여러 개의 tool call을 반환할 때, 마지막 tool call만 yield하고 나머지는 유실됨.

### 2.5 원인 5: GoogleProvider 첫 번째 part만 처리

**위치**: `src/services/ai/GoogleProvider.ts`

**문제**: Google API가 여러 개의 `parts[]`를 반환할 수 있는데, `parts[0]`만 처리하고 나머지는 무시.

---

## 3. 하지 말아야 할 것

### ❌ 텍스트 패턴 감지
```typescript
// 이건 임시방편
if (/확인하.*겠습니다/.test(accumulatedText)) { ... }
```

### ❌ 코드 기반 Intent Classifier 추가
- `intentClassifier.ts`로 regex 기반 분류
- `toolSelector.ts`로 도구 필터링

**이유**: 진정한 AI 에이전트는 AI가 스스로 판단해야 함. 코드에서 미리 분류하는 건 AI를 "약간 이용"하는 것.

---

## 4. 적용된 수정 사항

### 4.1 maxIterations 복구

**파일**: `src/services/ai/agent/agentRunService.ts`, `orchestrator.ts`

```typescript
// 수정 후
maxIterations: config.maxIterations ?? 50,
const DEFAULT_MAX_ITERATIONS = 50;
```

### 4.2 System Prompt "Tool-First" 지시 복구

**파일**: `src/services/ai/agent/system-prompt.md`

```markdown
**CRITICAL: Tool-First Execution Rules**

- **NEVER describe actions** - just execute them via tool calls
- **NEVER say "I will check" or "Let me see"** - actually call the tool
- **NEVER say "I'll create"** - call `create_page` instead
- **Every state change MUST go through a tool call**
- When user asks to create/modify/delete → **IMMEDIATELY** call the tool
```

### 4.3 피드백 루프 복구 + 점진적 피드백

**파일**: `src/services/ai/agent/orchestrator.ts`

```typescript
if (accumulatedText.trim()) {
  this.emptyResponseCount = 0;

  if (
    this.totalToolCalls === 0 &&
    !this.isConversationalResponse(accumulatedText) &&
    this.state.iterations < 5
  ) {
    conversationHistory.push({
      role: "user",
      content: this.getEscalatingFeedback(this.state.iterations),
    });
    continue;
  }
  // ...
}
```

**점진적 피드백 메시지**:
- iteration 1: 일반 피드백 ("Please use tools...")
- iteration 2: 구체적 도구 이름 제시 ("`list_pages`, `create_blocks_from_markdown`")
- iteration 3+: 매우 명시적 지시 ("CRITICAL: You MUST call a tool NOW")

### 4.4 ClaudeProvider 복수 tool call 지원

**파일**: `src/services/ai/ClaudeProvider.ts`

Map 기반으로 여러 tool call을 수집하여 모두 yield하도록 수정.

### 4.5 GoogleProvider 모든 parts 처리

**파일**: `src/services/ai/GoogleProvider.ts`

`parts[]` 배열 전체를 순회하여 모든 tool call과 텍스트를 처리하도록 수정.

---

## 5. 수정 파일 목록

| 파일 | 수정 내용 |
|------|----------|
| `src/services/ai/agent/agentRunService.ts` | maxIterations 8 → 50 |
| `src/services/ai/agent/orchestrator.ts` | DEFAULT_MAX_ITERATIONS 8 → 50, 피드백 루프 복구, 점진적 피드백 추가 |
| `src/services/ai/agent/system-prompt.md` | Tool-First 지시 복구 |
| `src/services/ai/ClaudeProvider.ts` | Map 기반 복수 tool call 수집 |
| `src/services/ai/GoogleProvider.ts` | 모든 parts 순회 처리 |

---

## 6. 절대 하지 말아야 할 것

- ❌ 텍스트 패턴 감지 (`if (/확인하.*겠습니다/.test(...))`)
- ❌ 코드 기반 Intent Classifier 추가
- ❌ 코드에서 사용자 의도 분류

**이유**: 진정한 AI 에이전트는 AI가 스스로 판단해야 함.

---

**작성자**: Sisyphus AI Agent
**수정 완료**: 2026-02-18
