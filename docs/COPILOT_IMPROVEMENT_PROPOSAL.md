# Oxinot 코파일럿 시스템 개선 제안서

## 개요

본 문서는 Oxinot 코파일럿 시스템의 현재 상태를 분석하고, 성능, UX, 아키텍처 측면에서의 개선 방안을 제안한다.

---

## 1. 현황 분석

### 1.1 현재 아키텍처

```
사용자 입력
    ↓
CopilotPanel (React)
    ↓
AgentOrchestrator (에이전트 루프)
    ↓
AI Provider (Claude/OpenAI/Ollama)
    ↓ (도구 호출)
Tool Registry → Tool Executor
    ↓
Zustand Stores / Tauri Backend
```

### 1.2 주요 문제점

| 구분 | 문제 | 영향 |
|------|------|------|
| 성능 | 블록 생성 시 개별 IPC 호출 | 100개 블록 생성 시 100번의 Tauri invoke |
| 성능 | AI 응답 대기 시간 | 스트리밍에도 불구하고 체감 지연 |
| 성능 | 불필요한 콘솔 로깅 | 프로덕션에서도 80개 이상의 console.log 출력 |
| UX | 진행 상황 불투명 | 사용자가 현재 무엇을 하는지 알 수 없음 |
| UX | 도구 승인 모달 빈약 | 왜 이 도구를 실행하는지 설명 부족 |
| 아키텍처 | 코드 중복 | utils/copilot과 services/ai/tools 이중 구조 |
| 아키텍처 | 시스템 프롬프트 정적 관리 | 도구 목록 변경 시 수동 동기화 필요 |

---

## 2. 성능 개선

### 2.1 블록 배치 생성 API

현재 `create_blocks_from_markdown`은 블록을 순차적으로 생성한다. Rust 백엔드에 배치 API를 추가하여 단일 트랜잭션으로 처리한다.

#### 변경 대상
- `src-tauri/src/commands/block.rs`: `create_blocks_batch` 커맨드 추가
- `src/services/ai/tools/block/createBlocksFromMarkdownTool.ts`: 배치 호출로 변경

#### 예상 구현

```rust
// src-tauri/src/commands/block.rs
#[tauri::command]
pub async fn create_blocks_batch(
    workspace_path: String,
    page_id: String,
    blocks: Vec<BlockCreateRequest>,
) -> Result<Vec<BlockData>, String> {
    // 단일 트랜잭션으로 처리
    // 부모-자식 관계는 임시 ID 매핑으로 해결
}
```

```typescript
// TypeScript 호출부
const blocks = flattenBlockHierarchy(parsedNodes);
const result = await invoke<BlockData[]>("create_blocks_batch", {
  workspacePath: context.workspacePath,
  pageId: params.pageId,
  blocks: blocks.map(b => ({
    content: b.content,
    tempId: b.tempId,
    parentTempId: b.parentTempId,
  })),
});
```

#### 예상 효과
- 100개 블록 기준: 100회 IPC → 1회 IPC
- 예상 속도 향상: 5-10배

### 2.2 로깅 레벨 시스템

개발/프로덕션 환경에 따른 로깅 레벨을 구현한다.

#### 변경 대상
- `src/utils/logger.ts`: 신규 생성
- 모든 console.log 호출부: logger로 교체

#### 구현 방안

```typescript
// src/utils/logger.ts
type LogLevel = "debug" | "info" | "warn" | "error";

const currentLevel: LogLevel = import.meta.env.PROD ? "warn" : "debug";

const levels: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

export function createLogger(module: string) {
  const shouldLog = (level: LogLevel) => levels[level] >= levels[currentLevel];

  return {
    debug: (...args: unknown[]) => {
      if (shouldLog("debug")) console.debug(`[${module}]`, ...args);
    },
    info: (...args: unknown[]) => {
      if (shouldLog("info")) console.info(`[${module}]`, ...args);
    },
    warn: (...args: unknown[]) => {
      if (shouldLog("warn")) console.warn(`[${module}]`, ...args);
    },
    error: (...args: unknown[]) => {
      if (shouldLog("error")) console.error(`[${module}]`, ...args);
    },
  };
}
```

#### 적용 우선순위
1. `openPageTool.ts` (80개 이상 로그)
2. `orchestrator.ts`
3. `ClaudeProvider.ts`

### 2.3 AI 요청 최적화

#### 시스템 프롬프트 압축

현재 시스템 프롬프트는 868줄로, 매 요청마다 전송된다. 토큰 수를 줄이면 응답 시간이 단축된다.

변경 방안:
- 중복 설명 제거
- 예시 코드 최소화
- 핵심 규칙만 유지

목표: 현재 대비 40% 토큰 감소

#### 도구 목록 동적 필터링

사용자 요청 유형에 따라 필요한 도구만 전송한다.

```typescript
// 예: 검색 요청 시
const searchTools = toolRegistry.getByCategory("search");
const pageTools = toolRegistry.getByCategory("page");
const relevantTools = [...searchTools, ...pageTools];
```

### 2.4 캐싱 전략

AI 에이전트 루프에서 반복되는 연산을 캐싱하여 성능을 최적화한다.

| 캐싱 대상 | 현재 상태 | 캐싱 효과 | 권장 여부 |
|-----------|----------|----------|----------|
| 시스템 프롬프트 | 매 요청마다 재생성 | 높음 | 권장 |
| 도구 정의 (Claude API 형식) | 매 요청마다 변환 | 중간 | 권장 |
| Conversation History | 계속 누적 | 높음 | 권장 |
| 검색 결과 | Tauri invoke 호출 | 낮음 | 조건부 |
| 페이지 목록 | Zustand 스토어에서 직접 읽음 | 없음 | 불필요 |

#### 시스템 프롬프트 캐싱

현재 `buildSystemPrompt()`가 매 반복마다 호출된다:

```typescript
// orchestrator.ts L518-545
private buildSystemPrompt(_config: AgentConfig): string {
  const blockStore = useBlockStore.getState();
  const pageStore = usePageStore.getState();
  // ... 868줄 프롬프트 + 동적 컨텍스트 생성
}
```

컨텍스트가 변경되지 않으면 캐시된 프롬프트를 재사용한다.

#### 변경 대상
- `src/services/ai/agent/orchestrator.ts`

#### 구현 방안

```typescript
private cachedSystemPrompt: string | null = null;
private lastContextHash: string | null = null;

private buildSystemPrompt(config: AgentConfig): string {
  const contextHash = this.getContextHash();
  
  if (this.cachedSystemPrompt && this.lastContextHash === contextHash) {
    return this.cachedSystemPrompt;
  }
  
  // 실제 생성 로직
  this.cachedSystemPrompt = /* ... */;
  this.lastContextHash = contextHash;
  return this.cachedSystemPrompt;
}

private getContextHash(): string {
  const blockStore = useBlockStore.getState();
  const uiStore = useBlockUIStore.getState();
  return `${blockStore.currentPageId}-${uiStore.focusedBlockId}`;
}
```

#### 예상 효과
- 동일 컨텍스트에서 50회 반복 시 49회의 문자열 생성 절약
- 프롬프트 빌드 시간: 10-50ms → 1ms

---

#### 도구 정의 캐싱

현재 `ClaudeProvider`에서 매 요청마다 도구를 Claude API 형식으로 변환한다:

```typescript
// ClaudeProvider.ts L48-56
const claudeTools = request.tools?.map((tool) => {
  const aiFunc = toolToAIFunction(tool);
  return {
    name: aiFunc.name,
    description: aiFunc.description,
    input_schema: aiFunc.parameters,
  };
});
```

도구 목록이 변경되지 않으면 캐시를 재사용한다.

#### 변경 대상
- `src/services/ai/ClaudeProvider.ts`
- `src/services/ai/OpenAIProvider.ts` (해당 시)

#### 구현 방안

```typescript
private cachedClaudeTools: ClaudeTool[] | null = null;
private lastToolCount: number = 0;

private getClaudeTools(tools: Tool[]): ClaudeTool[] {
  if (this.cachedClaudeTools && tools.length === this.lastToolCount) {
    return this.cachedClaudeTools;
  }
  
  this.cachedClaudeTools = tools.map(tool => {
    const aiFunc = toolToAIFunction(tool);
    return {
      name: aiFunc.name,
      description: aiFunc.description,
      input_schema: aiFunc.parameters,
    };
  });
  this.lastToolCount = tools.length;
  return this.cachedClaudeTools;
}
```

#### 예상 효과
- 20개 도구 × 5회 루프 = 100회 변환 → 1회로 감소
- 도구 변환 시간: 5-20ms → 1ms

---

## 3. UX 개선

### 3.1 진행 상황 표시

현재는 로딩 인디케이터만 표시된다. 단계별 진행 상황을 사용자에게 보여준다.

#### 변경 대상
- `src/components/copilot/CopilotPanel.tsx`
- `src/stores/copilotUiStore.ts`

#### 구현 방안

```typescript
// copilotUiStore.ts 확장
interface CopilotUiStore {
  // 기존 필드...
  currentStep: AgentStepType | null;
  currentToolName: string | null;
  setCurrentStep: (step: AgentStepType | null, toolName?: string) => void;
}
```

```tsx
// CopilotPanel.tsx - 진행 상황 표시
{isLoading && (
  <Group align="center" gap="xs" ml="xs">
    <Loader size="xs" type="dots" />
    <Text size="xs" c="dimmed">
      {currentStep === "thinking" && "분석 중..."}
      {currentStep === "tool_call" && `${currentToolName} 실행 중...`}
      {currentStep === "observation" && "결과 처리 중..."}
    </Text>
  </Group>
)}
```

### 3.2 도구 승인 모달 개선

현재 모달은 도구 이름만 표시한다. 사용자가 판단할 수 있는 정보를 추가한다.

#### 변경 대상
- `src/components/copilot/ToolApprovalModal.tsx`

#### 개선 항목
1. 도구가 수행할 작업 설명 (자연어)
2. 영향 범위 표시 (어떤 페이지/블록에 영향)
3. 위험도 표시 (읽기/쓰기/삭제)

```tsx
// ToolApprovalModal.tsx 개선
<Modal opened={true} onClose={onDeny} title="도구 실행 승인" centered>
  <Stack gap="md">
    <Group>
      {toolCall.isDangerous ? (
        <IconAlertTriangle size={24} color="red" />
      ) : (
        <IconTool size={24} color="blue" />
      )}
      <div>
        <Text size="sm" fw={600}>{toolCall.toolName}</Text>
        <Text size="xs" c="dimmed">{toolCall.description}</Text>
      </div>
    </Group>

    <Paper p="sm" bg="var(--color-bg-secondary)">
      <Text size="xs" fw={500}>수행 내용:</Text>
      <Text size="sm">{getHumanReadableAction(toolCall)}</Text>
    </Paper>

    {toolCall.affectedItems && (
      <Paper p="sm" bg="var(--color-bg-secondary)">
        <Text size="xs" fw={500}>영향 범위:</Text>
        <Text size="sm">{toolCall.affectedItems}</Text>
      </Paper>
    )}

    <Group justify="flex-end" mt="md">
      <Button variant="default" onClick={onDeny}>거부</Button>
      <Button color={toolCall.isDangerous ? "red" : "blue"} onClick={onApprove}>
        승인
      </Button>
    </Group>
  </Stack>
</Modal>
```

### 3.3 에러 메시지 개선

기술적 에러 메시지를 사용자 친화적으로 변환한다.

#### 변경 대상
- `src/utils/errorMessages.ts`: 신규 생성
- `src/components/copilot/CopilotPanel.tsx`: 에러 핸들링 부분

#### 구현 방안

```typescript
// src/utils/errorMessages.ts
const errorMap: Record<string, string> = {
  "Page not found": "페이지를 찾을 수 없습니다. 페이지가 삭제되었거나 이동되었을 수 있습니다.",
  "Block not found": "블록을 찾을 수 없습니다.",
  "Network error": "네트워크 연결을 확인해주세요.",
  "API key invalid": "API 키가 유효하지 않습니다. 설정에서 확인해주세요.",
  "Rate limit": "요청 제한에 도달했습니다. 잠시 후 다시 시도해주세요.",
};

export function getUserFriendlyError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  
  for (const [key, value] of Object.entries(errorMap)) {
    if (message.toLowerCase().includes(key.toLowerCase())) {
      return value;
    }
  }
  
  return "작업을 완료할 수 없습니다. 다시 시도해주세요.";
}
```

### 3.4 키보드 단축키

자주 사용하는 기능에 키보드 단축키를 추가한다.

| 단축키 | 기능 |
|--------|------|
| `Cmd/Ctrl + Shift + K` | 코파일럿 패널 토글 |
| `Escape` | 실행 중지 / 패널 닫기 |
| `Cmd/Ctrl + Enter` | 메시지 전송 |

---

## 4. 아키텍처 개선

### 4.1 코드 통합

`src/utils/copilot/`의 기능을 `src/services/ai/tools/`로 통합한다.

#### 작업 내용
1. `src/utils/copilot/pageTools.ts` → `src/services/ai/tools/page/`로 마이그레이션
2. `src/utils/copilot/toolExecutor.ts` → `src/services/ai/tools/executor.ts`로 통합
3. `src/utils/copilot/index.ts`에서 새 경로로 재내보내기 (하위 호환성)
4. 6개월 후 `src/utils/copilot/` 제거

### 4.2 시스템 프롬프트 동적 생성

도구 목록을 레지스트리에서 자동으로 추출하여 시스템 프롬프트에 포함한다.

#### 변경 대상
- `src/services/ai/agent/buildSystemPrompt.ts`: 신규 생성
- `src/services/ai/agent/orchestrator.ts`: 동적 프롬프트 사용

#### 구현 방안

```typescript
// src/services/ai/agent/buildSystemPrompt.ts
import basePrompt from "./system-prompt-base.md?raw";
import { toolRegistry } from "../tools/registry";

export function buildSystemPrompt(): string {
  const tools = toolRegistry.getAll();
  
  const toolDocs = tools.map(tool => {
    const params = Object.entries(tool.parameters.shape || {})
      .map(([key, schema]) => `  - ${key}: ${schema.description || ""}`)
      .join("\n");
    
    return `### ${tool.name}\n${tool.description}\n\n파라미터:\n${params}`;
  }).join("\n\n");
  
  return basePrompt.replace("{{TOOL_DOCUMENTATION}}", toolDocs);
}
```

### 4.3 도구 이름 표준화

현재 불일치하는 도구 이름을 통일한다.

| 현재 | 변경 후 |
|------|---------|
| `search_notes` | `search_pages` |
| `query_pages` | `search_pages` (통합) |

마이그레이션 기간 동안 별칭을 지원한다:

```typescript
// toolRegistry.ts
registerAlias(oldName: string, newName: string): void {
  const tool = this.tools.get(newName);
  if (tool) {
    this.aliases.set(oldName, newName);
  }
}

get(name: string): Tool | undefined {
  const resolvedName = this.aliases.get(name) || name;
  return this.tools.get(resolvedName);
}
```

---

## 5. 시스템 프롬프트 개선

### 5.1 다국어 지원 명시

```markdown
## 언어 지원

사용자의 입력 언어와 동일한 언어로 응답한다.
지원 언어: 한국어, 영어, 중국어, 일본어 등 UTF-8 기반 모든 언어
```

### 5.2 도구 승인 정책 추가

```markdown
## 도구 승인 정책

일부 도구는 실행 전 사용자 승인이 필요하다:
- 삭제 작업 (delete_block, delete_page)
- 대량 수정 작업
- 사용자 설정에 따른 모든 도구

승인 대기 중에는 다른 작업을 진행하지 않는다.
승인이 거부되면 대안을 찾거나 사용자에게 안내한다.
```

### 5.3 토큰 최적화

다음 섹션들을 압축하거나 제거한다:

1. 반복되는 예시 코드 제거
2. "CRITICAL", "IMPORTANT" 등 강조 표현 최소화
3. 안티패턴 설명을 간략화

목표: 현재 868줄 → 500줄 이하

---
