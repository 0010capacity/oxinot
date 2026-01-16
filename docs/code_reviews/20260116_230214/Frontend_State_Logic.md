Loaded cached credentials.
## 🔄 상태 관리 및 로직 리뷰

### ⚠️ 심각도 높음 (High Priority)

**1. [src/contexts/WorkspaceContext.tsx] & [src/stores/workspaceStore.ts] 상태 관리의 이중화 (Single Source of Truth 위반)**
*   **문제 설명**: 현재 프로젝트에 `WorkspaceContext`와 `useWorkspaceStore`(Zustand)가 공존하고 있습니다. 두 곳 모두 `workspacePath`, `fileTree`, `currentFile` 등의 상태를 관리하고 있으며, 파일 시스템 작업(`loadDirectory`, `openFile` 등)도 중복 구현되어 있습니다. 컴포넌트가 어느 쪽을 구독하느냐에 따라 상태 불일치(Inconsistency)가 발생할 수 있으며, 유지보수가 매우 어렵습니다.
*   **해결 방법**: `WorkspaceContext`를 완전히 제거하고 모든 파일 시스템 상태 및 로직을 `useWorkspaceStore`로 통합해야 합니다. Context API는 불필요한 리렌더링을 유발할 수 있으므로 Selector 패턴이 잘 갖춰진 Zustand로의 통합이 성능상 유리합니다.

**2. [src/stores/blockStore.ts:220] 낙관적 업데이트 시 임시 ID(Temp ID)와 데이터 손실 위험**
*   **문제 설명**: `createBlock`에서 `tempId`를 생성하여 UI를 즉시 업데이트한 후, 비동기로 백엔드 호출을 합니다. 만약 사용자가 타이핑을 매우 빠르게 하여 실제 ID가 반환되기 전에 `updateBlockContent`(자동 저장)가 트리거되면, `tempId`를 가진 블록에 대한 업데이트 요청이 백엔드로 전송되어 실패하거나 데이터가 유실될 수 있습니다.
*   **해결 방법**:
    1.  블록 생성 중에는 해당 블록에 대한 추가 업데이트(내용 수정 등)를 큐(Queue)에 쌓아두거나, ID가 교체될 때까지 `useDebouncedBlockUpdate`가 대기하도록 처리해야 합니다.
    2.  또는 `createBlock`의 낙관적 업데이트 로직 내에서, 실제 ID 교체 시점까지 해당 블록의 `isLoading` 상태를 관리하여 저장을 잠시 지연시켜야 합니다.

**3. [src/stores/blockGraphHelpers.ts:39] 대규모 데이터셋에서의 성능 저하 (O(N) 복잡도)**
*   **문제 설명**: `rebuildChildrenMapForParents` 함수는 `Object.values(blocksById)`를 통해 메모리에 있는 **모든** 블록을 순회하며 필터링합니다. 블록 수가 수천 개 이상으로 늘어날 경우, 드래그 앤 드롭이나 들여쓰기/내어쓰기 작업 시 심각한 프레임 저하가 발생합니다.
*   **해결 방법**: 전체 블록을 순회하는 대신, 변경된 부모 ID의 `childrenMap` 배열만 직접 수정(splice 등)하는 방식으로 변경해야 합니다. 불변성을 유지해야 한다면 Immer의 기능을 활용하여 해당 배열 부분만 효율적으로 업데이트해야 합니다.

### ⚡ 심각도 중간 (Medium Priority)

**1. [src/stores/pageStore.ts:67] 비효율적인 페이지 목록 갱신 전략**
*   **문제 설명**: `createPage`, `deletePage` 등이 실행될 때마다 `loadPages`를 호출하여 전체 페이지 목록을 다시 가져오고 있습니다. 페이지 수가 많아지면 이는 불필요한 네트워크/IPC 오버헤드입니다.
*   **해결 방법**: `createPage`가 성공하면 반환된 `PageData`를 로컬 스토어(`pagesById`, `pageIds`)에 직접 추가하고, `deletePage`는 로컬에서 제거하는 방식으로 최적화해야 합니다. 전체 리로드는 초기화 시점이나 명시적 새로고침 시에만 수행해야 합니다.

**2. [src/stores/blockStore.ts:373] `deleteBlock`의 안전장치 부족**
*   **문제 설명**: `deleteBlock`은 백엔드에서 삭제된 ID 목록을 받아와 클라이언트 상태를 업데이트합니다. 하지만 삭제 대상 블록이 현재 `focusedBlockId`이거나 `mergingBlockId`인 경우에 대한 UI 상태 정리(cleanup) 로직이 명시적이지 않아, 삭제된 블록을 참조하려는 시도로 런타임 에러가 발생할 수 있습니다.
*   **해결 방법**: `updatePartialBlocks` 내부 혹은 `deleteBlock`의 `finally` 블록에서 `useBlockUIStore`의 상태를 확인하고, 삭제된 ID가 포커스/선택되어 있다면 이를 해제하거나 인접 블록으로 포커스를 이동시키는 로직을 추가해야 합니다.

**3. [src/hooks/useHomepage.ts] 과도한 의존성과 복잡도 (Coupling)**
*   **문제 설명**: `useHomepage` 훅이 `PageStore`, `ViewStore`, `WorkspaceStore`, `AppSettingsStore` 등 거의 모든 스토어에 의존하며 비즈니스 로직(페이지 계층 생성, 경로 찾기 등)을 과도하게 포함하고 있습니다.
*   **해결 방법**: 페이지 계층 구조를 생성하거나 경로로 페이지를 찾는 로직은 `PageStore`의 Action으로 이동시키고, `useHomepage`는 단순히 "설정에 따라 적절한 페이지를 연다"는 조정자 역할만 수행하도록 리팩토링해야 합니다.

### 💡 기존 코드 개선 제안 (Code Improvements)

**1. `rebuildChildrenMapForParents` 최적화 제안**
전체 블록 순회(O(N))를 제거하고, 기존 childrenMap을 기반으로 수정합니다.

```typescript
// Before
export function rebuildChildrenMapForParents(
  parentIds: Set<string>,
  blocksById: Record<string, BlockData>,
  currentChildrenMap: Record<string, string[]>
): Record<string, string[]> {
  const updated = { ...currentChildrenMap };
  for (const parentId of parentIds) {
    // ⚠️ 성능 병목: 모든 블록을 순회함
    updated[parentId] = Object.values(blocksById)
      .filter((b) => (b.parentId ?? "root") === parentId)
      .sort((a, b) => a.orderWeight - b.orderWeight)
      .map((b) => b.id);
  }
  return updated;
}

// After (개념적 제안 - Immer 사용 시 더 간단해질 수 있음)
// 실제 구현 시에는 blocksById에서 해당 parentId를 가진 녀석들만 추려낼 수 있는 인덱스가 없으므로,
// Store 레벨에서 children 배열을 직접 조작(push, splice)하는 것이 훨씬 효율적입니다.
// helpers에서는 단순히 정렬만 담당하거나, Store의 action 내부 로직으로 흡수하는 것이 좋습니다.
```

**2. `WorkspaceContext` 제거 및 Store 통합**
`src/contexts/WorkspaceContext.tsx`를 삭제하고 `src/main.tsx`의 Provider 제거 후, 컴포넌트에서 `useWorkspaceStore`를 직접 사용하도록 변경합니다.

```typescript
// src/stores/workspaceStore.ts 에 Context의 유용한 에러 핸들링 로직 통합
// 컴포넌트 사용 예시:
// Before
// const { openFile } = useWorkspace();

// After
// const openFile = useWorkspaceStore(state => state.openFile);
```

### 🚀 새로운 기능 제안 (Feature Suggestions)

**1. 실행 취소/다시 실행 (Undo/Redo) 시스템**
*   **기능 설명**: 블록 작성, 삭제, 들여쓰기, 이동 등의 작업에 대한 Undo/Redo 기능을 제공합니다.
*   **구현 난이도**: 어려움
*   **예상 효과**: 편집기 경험(DX)이 대폭 향상됩니다. 현재 `zundo`와 같은 미들웨어를 `blockStore`에 적용하거나, Command Pattern을 도입하여 Action을 캡슐화해야 합니다. 현재 구조는 상태 변경이 파편화되어 있어 실수 복구가 불가능합니다.

**2. 블록 가상화 (Virtualization)**
*   **기능 설명**: `BlockEditor` 렌더링 시 화면에 보이는 블록만 렌더링하고 나머지는 가상화 처리합니다.
*   **구현 난이도**: 보통
*   **예상 효과**: 현재 페이지에 블록이 수백 개 이상일 경우 초기 로딩과 스크롤 성능이 크게 향상됩니다. `react-window`나 `tanstack-virtual` 도입을 고려해볼 수 있습니다.

**3. 로컬 변경 사항 충돌 해결 (Conflict Resolution)**
*   **기능 설명**: `gitStore`와 연계하여, 로컬 파일이 외부(다른 프로세스나 Git Pull)에 의해 변경되었을 때, 현재 편집 중인 내용과 충돌을 감지하고 사용자에게 알림을 주는 기능입니다.
*   **구현 난이도**: 보통
*   **예상 효과**: 데이터 덮어쓰기 사고를 방지하여 데이터 무결성을 보장합니다.

### 📝 종합 의견
코드는 전반적으로 모듈화가 잘 되어 있고 TypeScript 타입 정의도 충실합니다. 특히 `Zustand`와 `Immer`를 활용한 상태 관리 패턴은 적절합니다.

그러나 **`WorkspaceContext`와 `WorkspaceStore`의 중복**은 프로젝트 규모가 커지기 전에 반드시 해결해야 할 기술 부채입니다. 또한 **블록 그래프 조작 시 O(N) 연산**이 포함된 부분은 향후 성능 이슈의 주범이 될 가능성이 매우 높으므로 조기 최적화가 필요합니다. `blockStore`의 낙관적 업데이트 로직은 UX를 위해 필수적이나, `tempId` 처리 방식에 대한 견고함을 더해야 합니다.

# 청크 정보
청크 번호: 1/1
파일 목록:
- src/stores/blockStore.ts
- src/stores/syncStore.ts
- src/stores/workspaceStore.ts
- src/stores/blockUIStore.ts
- src/stores/navigationStore.ts
- src/stores/blockGraphHelpers.ts
- src/stores/appSettingsStore.ts
- src/stores/errorStore.ts
- src/stores/advancedSettingsStore.ts
- src/stores/outlinerSettingsStore.ts
- src/stores/themeStore.ts
- src/stores/snowStore.ts
- src/stores/updaterStore.ts
- src/stores/clockFormatStore.ts
- src/stores/gitStore.ts
- src/stores/viewStore.ts
- src/stores/pageStore.ts
- src/hooks/useDebouncedBlockUpdate.ts
- src/hooks/useHomepage.ts
- src/hooks/useGitManagement.ts
- src/hooks/useKeyboardShortcuts.ts
- src/hooks/useWorkspaceInitializer.ts
- src/contexts/WorkspaceContext.tsx
