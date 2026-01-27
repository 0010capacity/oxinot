# Oxinot Copilot 개선 제안서

> 작성일: 2025년 1월
> 대상: Copilot Agent 시스템 전반

---

## 📋 목차

1. [현재 상태 분석](#1-현재-상태-분석)
2. [핵심 문제점](#2-핵심-문제점)
3. [개선 제안](#3-개선-제안)
4. [구현 계획](#4-구현-계획)
5. [성공 지표](#5-성공-지표)

---

## 1. 현재 상태 분석

### 1.1 아키텍처 구조

```
src/services/ai/
├── agent/
│   ├── system-prompt.md      # 868줄 - 상세한 시스템 프롬프트 (미사용!)
│   ├── orchestrator.ts       # 에이전트 실행 엔진 (하드코딩된 프롬프트 사용)
│   ├── errorRecovery.ts      # 에러 분류 및 복구 로직
│   └── types.ts              # 타입 정의
├── tools/
│   ├── block/                # 블록 관련 툴 14개
│   ├── page/                 # 페이지 관련 툴 6개
│   ├── context/              # 컨텍스트 툴
│   ├── navigation/           # 네비게이션 툴
│   ├── executor.ts           # 툴 실행 및 승인
│   └── registry.ts           # 툴 레지스트리
└── providers/                # AI 제공자 (Claude, OpenAI, Google, Ollama)
```

### 1.2 현재 동작 방식

1. 사용자가 CopilotPanel에서 메시지 입력
2. AgentOrchestrator가 목표를 받아 실행 시작
3. AI Provider에게 시스템 프롬프트 + 사용자 목표 전송
4. AI가 툴 호출 또는 최종 답변 반환
5. 최대 50회 반복 또는 최종 답변까지 계속

### 1.3 강점

- ✅ 다양한 AI 제공자 지원 (Claude, OpenAI, Google, Ollama)
- ✅ 체계적인 툴 시스템 (Zod 검증, 레지스트리 패턴)
- ✅ 사용자 승인 시스템 (dangerous_only, always, never 정책)
- ✅ 에러 분류 및 복구 시스템 (errorRecovery.ts)
- ✅ 스트리밍 응답 지원
- ✅ 멘션 기능 (@page, @block)

---

## 2. 핵심 문제점

### 🚨 Critical #1: 프롬프트 불일치 (가장 심각)

**현상:**
- `system-prompt.md` (868줄)가 존재하지만 **실제로 사용되지 않음**
- `orchestrator.ts`의 `buildSystemPrompt()`에서 **하드코딩된 간단한 프롬프트** 사용
- 테스트는 `system-prompt.md`를 검증하지만, 실제 실행에는 다른 프롬프트 사용

**증거:**
```typescript
// orchestrator.ts - 실제 사용되는 코드
private buildSystemPrompt(_config: AgentConfig): string {
  let systemPrompt = `You are an AI agent in 'Oxinot'...`;
  // ~150줄 하드코딩된 프롬프트
}

// agentLoopingFix.test.ts - 테스트 코드
const systemPromptPath = path.join(__dirname, "..", "system-prompt.md");
systemPromptContent = readFileSync(systemPromptPath, "utf-8");
// system-prompt.md를 테스트하지만 실제로는 사용 안 됨!
```

**영향:**
- 테스트 무의미화 (다른 프롬프트 테스트 중)
- 루핑 방지, 상세 워크플로우 등 중요 지침이 LLM에게 전달 안 됨
- `system-prompt.md` 업데이트해도 실제 동작에 반영 안 됨

---

### 🚨 Critical #2: 루핑 방지 메커니즘 부재

**현상:**
- 코드 레벨에서 루핑 감지/방지 메커니즘이 **전혀 없음**
- 오직 프롬프트 지시에만 의존 (그마저도 실제 사용 프롬프트에는 없음)
- 같은 툴 연속 호출, 진행 없는 반복을 시스템이 감지 못함

**테스트에서 확인된 루핑 패턴:**
```
Pattern 1: list_pages 루핑
  create_page → list_pages → list_pages → list_pages → ...

Pattern 2: query_pages 루핑
  create_page → query_pages → query_pages → query_pages → ...
```

**코드 분석:**
```typescript
// orchestrator.ts - 루핑 감지 로직 없음
while (this.state.iterations < this.state.maxIterations && !this.shouldStop) {
  // 단순히 최대 반복 횟수만 체크
  // 같은 툴 연속 호출 감지 없음
  // 진행 상황 추적 없음
}
```

---

### 🟡 Medium #1: 프롬프트 과잉 (868줄)

**현상:**
- `system-prompt.md`가 868줄로 과도하게 김
- 같은 내용이 3번 이상 반복 (루핑 방지 지침 등)
- 모든 것이 "CRITICAL", "MOST CRITICAL"로 표시되어 우선순위 불명확

**영향:**
- 토큰 소비 증가 → 비용 증가, 응답 속도 저하
- LLM이 중요한 부분을 놓칠 수 있음
- 컨텍스트 윈도우 압박

---

### 🟡 Medium #2: 상태 추적 부족

**현상:**
- 에이전트가 "무엇을 완료했는지" 추적하지 않음
- 각 반복에서 처음부터 다시 판단해야 함
- "페이지 생성 완료 → 블록 생성 단계" 같은 상태 전이가 명시적이지 않음

**현재 코드:**
```typescript
// 상태는 있지만 활용이 제한적
status: "idle" | "thinking" | "acting" | "completed" | "failed"
// "페이지 생성 완료", "블록 생성 중" 같은 세부 상태 없음
```

---

### 🟡 Medium #3: errorRecovery.ts 미활용

**현상:**
- 훌륭한 에러 분류/복구 시스템이 구현되어 있음
- 하지만 `orchestrator.ts`에서 **실제로 사용하지 않음**

**errorRecovery.ts 기능:**
- 에러 분류 (NOT_FOUND, VALIDATION, PERMISSION 등)
- 복구 전략 제안 (RETRY, ALTERNATIVE, CLARIFY 등)
- 대안 접근법 프롬프트 생성

**현재 orchestrator.ts:**
```typescript
} catch (error) {
  const errorMessage = error instanceof Error ? error.message : "Unknown error";
  // errorRecovery 사용 안 함!
  this.state.error = errorMessage;
  this.state.status = "failed";
  throw error;
}
```

---

## 3. 개선 제안

### 🎯 Phase 1: 즉시 수정 (1-2일)

#### 1.1 system-prompt.md 통합

**목표:** `system-prompt.md`를 실제로 사용하도록 수정

**변경 파일:** `orchestrator.ts`

```typescript
// 제안하는 구현
import { readFileSync } from 'fs';
import { join } from 'path';

// 또는 Vite/Webpack raw import 사용
// import systemPromptBase from './system-prompt.md?raw';

private buildSystemPrompt(config: AgentConfig): string {
  // 기본 프롬프트 로드
  const basePrompt = this.loadSystemPrompt();
  
  // 동적 컨텍스트 추가
  const dynamicContext = this.buildDynamicContext();
  
  return basePrompt + "\n\n## 현재 컨텍스트\n" + dynamicContext;
}

private loadSystemPrompt(): string {
  // 빌드 타임에 번들되도록 처리
  // 또는 런타임에 캐싱하여 로드
}

private buildDynamicContext(): string {
  const blockStore = useBlockStore.getState();
  const pageStore = usePageStore.getState();
  const uiStore = useBlockUIStore.getState();
  
  let context = "";
  
  // 현재 포커스된 블록
  const focusedId = uiStore.focusedBlockId;
  if (focusedId) {
    const block = blockStore.blocksById[focusedId];
    if (block) {
      context += `- 현재 포커스된 블록: "${block.content}" (ID: ${focusedId})\n`;
    }
  }
  
  // 현재 페이지
  const pageId = blockStore.currentPageId;
  if (pageId) {
    const page = pageStore.pagesById[pageId];
    if (page) {
      context += `- 현재 페이지: "${page.title}" (ID: ${pageId})\n`;
    }
  }
  
  return context;
}
```

#### 1.2 루핑 감지 메커니즘 추가

**목표:** 코드 레벨에서 루핑 패턴 감지 및 방지

**변경 파일:** `orchestrator.ts`

```typescript
interface ToolCallHistory {
  toolName: string;
  params: unknown;
  timestamp: number;
}

class AgentOrchestrator {
  private toolCallHistory: ToolCallHistory[] = [];
  
  private detectLooping(): { isLooping: boolean; reason?: string } {
    const recentCalls = this.toolCallHistory.slice(-5);
    
    // 패턴 1: 같은 툴 3회 연속 호출
    if (recentCalls.length >= 3) {
      const lastThree = recentCalls.slice(-3);
      const allSameTool = lastThree.every(c => c.toolName === lastThree[0].toolName);
      if (allSameTool) {
        return { 
          isLooping: true, 
          reason: `같은 툴 '${lastThree[0].toolName}'이(가) 3회 연속 호출됨` 
        };
      }
    }
    
    // 패턴 2: 읽기 전용 툴만 반복 (list_pages, query_pages, get_page_blocks)
    const readOnlyTools = ['list_pages', 'query_pages', 'get_page_blocks', 'query_blocks'];
    const last4 = recentCalls.slice(-4);
    if (last4.length >= 4 && last4.every(c => readOnlyTools.includes(c.toolName))) {
      return { 
        isLooping: true, 
        reason: '읽기 전용 툴만 4회 연속 호출됨 - 진행 없음' 
      };
    }
    
    // 패턴 3: create 후 list/query 반복
    if (recentCalls.length >= 3) {
      const hasCreate = recentCalls.some(c => c.toolName.includes('create'));
      const last2 = recentCalls.slice(-2);
      const last2AreQueries = last2.every(c => 
        c.toolName === 'list_pages' || c.toolName === 'query_pages'
      );
      if (hasCreate && last2AreQueries) {
        return { 
          isLooping: true, 
          reason: 'create 후 불필요한 검증 쿼리 반복' 
        };
      }
    }
    
    return { isLooping: false };
  }
  
  // execute() 메서드 내에서 사용
  async *execute(goal: string, config: AgentConfig) {
    // ... 기존 코드 ...
    
    onToolCall: async (toolName: string, params: unknown) => {
      // 툴 호출 기록
      this.toolCallHistory.push({
        toolName,
        params,
        timestamp: Date.now()
      });
      
      // 루핑 감지
      const loopCheck = this.detectLooping();
      if (loopCheck.isLooping) {
        console.warn(`[AgentOrchestrator] 루핑 감지: ${loopCheck.reason}`);
        
        // 루핑 중단 프롬프트 주입
        conversationHistory.push({
          role: "user",
          content: `⚠️ 루핑 감지됨: ${loopCheck.reason}\n\n` +
            `현재까지 수행한 작업을 바탕으로 다음 단계로 진행하세요. ` +
            `같은 조회 작업을 반복하지 마세요. ` +
            `이미 가진 정보로 작업을 완료하거나, 완료할 수 없다면 최종 답변을 제공하세요.`
        });
      }
      
      // ... 기존 툴 실행 코드 ...
    }
  }
}
```

---

### 🔄 Phase 2: 중기 개선 (1주일)

#### 2.1 프롬프트 최적화

**목표:** 868줄 → 400줄 이하로 축소, 우선순위 명확화

**새로운 프롬프트 구조:**

```markdown
# Oxinot Copilot System Prompt

## [MUST] 핵심 원칙 (절대 위반 불가)

### 1. 도구 우선
- 설명하지 말고 실행하라
- 모든 상태 변경은 도구를 통해

### 2. 상태 먼저 읽기
- 변경 전 현재 상태 확인 (list_pages, get_page_blocks)
- 단, 생성 직후 검증 쿼리는 금지

### 3. 루핑 금지 (가장 중요)
- list_pages, query_pages는 작업당 1회만
- create_page 결과의 ID를 즉시 사용
- 검증을 위한 재쿼리 금지

### 4. 완료 조건
- 페이지 생성만으로는 미완료
- 반드시 블록 생성까지 완료

## [SHOULD] 권장 워크플로우

1. 목표 이해
2. 상태 확인 (1회)
3. 페이지 생성 (필요시)
4. Markdown 생성 및 검증
5. 블록 생성
6. 최종 답변

## [SHOULD] 블록 생성 가이드

- 2 spaces per indent level
- 모든 줄은 "- "로 시작
- validate_markdown_structure → create_blocks_from_markdown

## [COULD] 참고 사항

- 템플릿 사용 가능 (get_markdown_template)
- 에러 발생 시 대안 시도

## 동적 컨텍스트

[여기에 현재 페이지, 블록 등 동적 정보 추가]
```

#### 2.2 작업 상태 추적 시스템

**목표:** 에이전트가 "어디까지 했는지" 명시적으로 추적

**새로운 타입:**

```typescript
// types.ts에 추가
interface TaskProgress {
  phase: 'analyzing' | 'planning' | 'creating_page' | 'creating_blocks' | 'verifying' | 'complete';
  completedSteps: string[];
  pendingSteps: string[];
  createdResources: {
    pages: Array<{ id: string; title: string }>;
    blocks: Array<{ id: string; pageId: string }>;
  };
}

interface AgentState {
  // 기존 필드들...
  taskProgress: TaskProgress;
}
```

**활용:**

```typescript
// orchestrator.ts
private updateTaskProgress(toolName: string, result: ToolResult) {
  if (toolName === 'create_page' && result.success) {
    this.state.taskProgress.phase = 'creating_page';
    this.state.taskProgress.completedSteps.push(`페이지 생성: ${result.data.title}`);
    this.state.taskProgress.createdResources.pages.push({
      id: result.data.id,
      title: result.data.title
    });
    this.state.taskProgress.pendingSteps = ['블록 생성', '검증'];
  }
  // ... 다른 툴들에 대한 처리
}

// 프롬프트에 진행 상황 주입
private injectProgressContext(): string {
  const progress = this.state.taskProgress;
  return `
## 현재 진행 상황
- 단계: ${progress.phase}
- 완료: ${progress.completedSteps.join(', ') || '없음'}
- 남음: ${progress.pendingSteps.join(', ') || '없음'}
- 생성된 페이지: ${progress.createdResources.pages.map(p => p.title).join(', ') || '없음'}
`;
}
```

#### 2.3 errorRecovery.ts 통합

**목표:** 이미 구현된 에러 복구 시스템 실제 활용

```typescript
// orchestrator.ts
import { classifyError, getAlternativeApproachPrompt, isRecoverable } from './errorRecovery';

// 툴 실행 실패 시
if (!result.success) {
  const errorInfo = classifyError(result.error || 'Unknown error', {
    toolName,
    toolParams: params,
    goal: this.state.goal,
    attemptCount: this.getToolAttemptCount(toolName)
  });
  
  if (isRecoverable(errorInfo)) {
    const recoveryPrompt = getAlternativeApproachPrompt(errorInfo, this.state.goal);
    conversationHistory.push({
      role: "user",
      content: recoveryPrompt
    });
  } else {
    // 복구 불가능한 에러 - 사용자에게 알림
    this.state.status = 'failed';
    this.state.error = errorInfo.message;
  }
}
```

---

### 🚀 Phase 3: 장기 개선 (2-4주)

#### 3.1 프롬프트 버전 관리 시스템

**목표:** 프롬프트 변경 추적, A/B 테스트 지원

```typescript
// src/services/ai/agent/promptManager.ts

interface PromptVersion {
  version: string;
  content: string;
  metadata: {
    author: string;
    date: string;
    description: string;
    testResults?: {
      successRate: number;
      avgIterations: number;
      loopingRate: number;
    };
  };
}

class PromptManager {
  private versions: Map<string, PromptVersion> = new Map();
  private currentVersion: string = 'latest';
  
  async loadVersion(version: string): Promise<string> {
    // 버전별 프롬프트 로드
  }
  
  async compareVersions(v1: string, v2: string): Promise<VersionDiff> {
    // 버전 간 차이 비교
  }
  
  setActiveVersion(version: string): void {
    this.currentVersion = version;
  }
  
  // A/B 테스트용
  getRandomVersion(options: string[]): string {
    return options[Math.floor(Math.random() * options.length)];
  }
}
```

#### 3.2 성능 모니터링 대시보드

**수집 메트릭:**

```typescript
interface AgentMetrics {
  // 실행 메트릭
  totalExecutions: number;
  successRate: number;
  averageIterations: number;
  averageDuration: number;
  
  // 루핑 메트릭
  loopingDetections: number;
  loopingRate: number;
  mostCommonLoopPattern: string;
  
  // 툴 사용 메트릭
  toolCallCounts: Record<string, number>;
  toolSuccessRates: Record<string, number>;
  toolAvgDuration: Record<string, number>;
  
  // 에러 메트릭
  errorCounts: Record<string, number>;
  recoverySuccessRate: number;
}
```

#### 3.3 동적 프롬프트 최적화

**목표:** 작업 유형에 따라 관련 가이드만 포함

```typescript
interface TaskType {
  type: 'create_page' | 'edit_content' | 'search' | 'organize' | 'summarize';
  requiredTools: string[];
  relevantPromptSections: string[];
}

function detectTaskType(goal: string): TaskType {
  // NLP 또는 키워드 기반 작업 유형 감지
}

function buildOptimizedPrompt(taskType: TaskType): string {
  // 작업 유형에 필요한 섹션만 포함
  // 예: 검색 작업 → 페이지 생성 가이드 제외
}
```

---

## 4. 구현 계획

### Phase 1: 즉시 수정 (Priority: Critical)

| 작업 | 예상 시간 | 담당 | 상태 |
|------|----------|------|------|
| system-prompt.md 통합 | 2시간 | - | 🔴 미시작 |
| 루핑 감지 메커니즘 | 4시간 | - | 🔴 미시작 |
| 테스트 업데이트 | 2시간 | - | 🔴 미시작 |

### Phase 2: 중기 개선 (Priority: High)

| 작업 | 예상 시간 | 담당 | 상태 |
|------|----------|------|------|
| 프롬프트 최적화 | 4시간 | - | 🔴 미시작 |
| 작업 상태 추적 | 6시간 | - | 🔴 미시작 |
| errorRecovery 통합 | 3시간 | - | 🔴 미시작 |

### Phase 3: 장기 개선 (Priority: Medium)

| 작업 | 예상 시간 | 담당 | 상태 |
|------|----------|------|------|
| 프롬프트 버전 관리 | 8시간 | - | 🔴 미시작 |
| 성능 모니터링 | 12시간 | - | 🔴 미시작 |
| 동적 프롬프트 | 8시간 | - | 🔴 미시작 |

---

## 5. 성공 지표

### 정량적 지표

| 지표 | 현재 (예상) | 목표 | 측정 방법 |
|------|------------|------|----------|
| 루핑 발생률 | ~30% | <5% | 루핑 감지 로그 |
| 평균 반복 횟수 | ~15회 | <8회 | 실행 로그 |
| 작업 성공률 | ~60% | >90% | 완료/실패 비율 |
| 프롬프트 토큰 | ~3000 | <1500 | 토큰 카운트 |

### 정성적 지표

- [ ] 페이지 생성 후 블록 누락 없음
- [ ] list_pages/query_pages 루핑 제거
- [ ] 에러 발생 시 자동 복구
- [ ] 사용자가 진행 상황 이해 가능

---

## 부록: 빠른 시작 가이드

### Phase 1 즉시 구현 코드

아래 코드를 `orchestrator.ts`에 적용하면 가장 심각한 문제들이 해결됩니다:

```typescript
// 1. 파일 상단에 import 추가
import systemPromptContent from './system-prompt.md?raw';

// 2. toolCallHistory 추가
private toolCallHistory: Array<{
  toolName: string;
  timestamp: number;
}> = [];

// 3. 루핑 감지 메서드 추가
private detectLooping(): { isLooping: boolean; reason?: string } {
  const recent = this.toolCallHistory.slice(-3);
  if (recent.length >= 3) {
    const allSame = recent.every(c => c.toolName === recent[0].toolName);
    if (allSame) {
      return { isLooping: true, reason: `${recent[0].toolName} 3회 연속 호출` };
    }
  }
  
  const readOnly = ['list_pages', 'query_pages', 'get_page_blocks'];
  const last4 = this.toolCallHistory.slice(-4);
  if (last4.length >= 4 && last4.every(c => readOnly.includes(c.toolName))) {
    return { isLooping: true, reason: '읽기 전용 툴만 반복' };
  }
  
  return { isLooping: false };
}

// 4. buildSystemPrompt 교체
private buildSystemPrompt(config: AgentConfig): string {
  // 기본 프롬프트 (system-prompt.md 사용)
  let prompt = systemPromptContent;
  
  // 동적 컨텍스트 추가
  const blockStore = useBlockStore.getState();
  const pageStore = usePageStore.getState();
  const uiStore = useBlockUIStore.getState();
  
  prompt += "\n\n---\n\n## 동적 컨텍스트\n\n";
  
  const focusedId = uiStore.focusedBlockId;
  if (focusedId) {
    const block = blockStore.blocksById[focusedId];
    if (block) {
      prompt += `- 포커스 블록: "${block.content}" (${focusedId})\n`;
    }
  }
  
  const pageId = blockStore.currentPageId;
  if (pageId) {
    const page = pageStore.pagesById[pageId];
    if (page) {
      prompt += `- 현재 페이지: "${page.title}" (${pageId})\n`;
    }
  }
  
  return prompt;
}

// 5. onToolCall 콜백에 루핑 감지 추가
onToolCall: async (toolName: string, params: unknown) => {
  this.toolCallHistory.push({ toolName, timestamp: Date.now() });
  
  const loopCheck = this.detectLooping();
  if (loopCheck.isLooping) {
    console.warn(`[Orchestrator] 루핑 감지: ${loopCheck.reason}`);
    conversationHistory.push({
      role: "user",
      content: `⚠️ 루핑 감지: ${loopCheck.reason}\n` +
        `같은 조회를 반복하지 마세요. 이미 가진 정보로 진행하거나 최종 답변을 제공하세요.`
    });
  }
  
  // ... 기존 툴 실행 코드 ...
}
```

---

## 변경 이력

| 날짜 | 버전 | 변경 내용 |
|------|------|----------|
| 2025-01 | 1.0 | 초안 작성 |