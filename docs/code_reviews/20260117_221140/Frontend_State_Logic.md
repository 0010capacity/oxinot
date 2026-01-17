Loaded cached credentials.
## 🔄 상태 관리 및 로직 리뷰

### ⚠️ 심각도 높음 (High Priority)

**[src/stores/blockStore.ts:285] 낙관적 업데이트 실패 시 사용자 입력 데이터 손실 위험**
*   **문제 설명**: `createBlock`에서 낙관적 업데이트(Optimistic Update)로 임시 블록(`tempId`)을 생성한 후, 백엔드 요청(`invoke("create_block")`)이 실패하면 `catch` 블록에서 해당 `tempId`를 `blocksById`에서 즉시 삭제합니다.
    만약 사용자가 블록 생성 직후 빠르게 타이핑을 시작하여 내용이 입력된 상태에서 백엔드 요청이 실패한다면, 사용자가 작성 중이던 내용이 예고 없이 사라지게 됩니다.
*   **해결 방법**: 백엔드 저장 실패 시 블록을 삭제하는 대신, 해당 블록을 '에러 상태'(예: 붉은 테두리나 경고 아이콘 표시)로 유지하고 사용자에게 "저장 재시도" 또는 "내용 복사"를 할 수 있는 UI를 제공해야 합니다. `BlockData` 타입에 `syncError?: boolean` 필드 추가를 권장합니다.

### ⚡ 심각도 중간 (Medium Priority)

**[src/stores/pageStore.ts:98] 페이지 목록 전체 리로드에 따른 확장성 문제**
*   **문제 설명**: `loadPages`는 백엔드로부터 **모든** 페이지 데이터를 가져옵니다. `createPage`, `deletePage`, `convertToDirectory` 등 단일 항목 변경 후에도 `loadPages()`를 호출하여 전체 목록을 갱신하는 패턴이 자주 보입니다. 페이지 수가 수천 개로 늘어날 경우 심각한 성능 저하가 발생합니다.
*   **해결 방법**: `createPage` 등의 액션이 성공하면 서버에서 반환된 단일 페이지 데이터만 스토어의 `pagesById`와 `pageIds`에 직접 추가/수정/삭제하는 방식으로 변경하여 전체 리페치를 방지해야 합니다.

**[src/stores/blockStore.ts:186] `await Promise.resolve()`를 이용한 렌더링 블로킹 회피 (Hack)**
*   **문제 설명**: `createBlock` 내부에서 `await Promise.resolve()`를 사용하여 React가 낙관적 UI를 렌더링할 시간을 벌어주고 있습니다. 이는 비결정적인(non-deterministic) 해결책이며, 시스템 부하에 따라 여전히 UI 끊김이나 포커스 유실이 발생할 수 있습니다.
*   **해결 방법**: Zustand 스토어 내부에서 렌더링 타이밍을 제어하려 하기보다, 비동기 로직과 UI 상태 업데이트 로직을 명확히 분리하거나 `useTransition` 등을 고려해야 합니다. 혹은 `flushSync` 등을 사용할 수 있으나, 현재 구조에서는 `pendingUpdates` 큐 관리가 복잡하므로, 백엔드 응답 전까지 `tempId` 상태 관리를 더 견고하게 하는 것이 우선입니다.

**[src/stores/blockStore.ts:96] 거대해진 스토어 (God Store)**
*   **문제 설명**: `blockStore`가 CRUD, 페이지 로드, 트리 조작, 포커스 계산 등 너무 많은 책임을 지고 있습니다. 파일 크기가 크고 유지보수가 어렵습니다.
*   **해결 방법**: `BlockActions`를 슬라이스(Slice) 패턴으로 분리하는 것을 권장합니다. (예: `createBlockSlice`, `navigationSlice`, `treeOperationSlice`)

### 💡 기존 코드 개선 제안 (Code Improvements)

**1. `pageStore`의 전체 리로드 제거 및 불변성 최적화**

`createPage`가 전체 로드를 유발하지 않도록 수정합니다.

```typescript
// Before (src/stores/pageStore.ts)
createPage: async (title: string, parentId?: string) => {
  // ... check workspacePath
  const newPage = await invoke<PageData>("create_page", { ... });
  // loadPages() 호출에 의존하거나 호출자가 수행함
  return newPage.id;
},

// After suggestion
createPage: async (title: string, parentId?: string) => {
  const workspacePath = useWorkspaceStore.getState().workspacePath;
  if (!workspacePath) throw new Error("No workspace selected");

  const newPage = await invoke<PageData>("create_page", {
    workspacePath,
    request: { title, parentId: parentId || null },
  });

  set((state) => {
    state.pagesById[newPage.id] = newPage;
    state.pageIds.push(newPage.id);
    // 필요한 경우 정렬 로직 추가
  });

  return newPage.id;
},
```

**2. `blockGraphHelpers`의 성능 최적화**

`updateChildrenMap` 함수에서 불필요한 배열 순회나 정렬이 발생할 수 있습니다.

```typescript
// src/stores/blockGraphHelpers.ts
// 개선 제안: 정렬 시 map lookup을 줄이기 위해 updatedWeights를 미리 만드는 부분은 좋으나,
// 전체 sort가 아닌 삽입 정렬 등을 고려할 수 있습니다. (현재는 O(N log N))
// 하지만 현재 구현도 최적화가 어느 정도 되어 있으므로, 주석을 통해
// 대량의 블록 이동 시 성능 모니터링이 필요함을 명시하는 것이 좋습니다.
```

### 🚀 새로운 기능 제안 (Feature Suggestions)

**1. Undo/Redo (실행 취소/다시 실행) 미들웨어 도입**
*   **기능 설명**: 노트 앱에서 필수적인 실행 취소 기능을 상태 관리 레벨에서 지원합니다.
*   **구현 난이도**: 보통 (Zustand 미들웨어 활용)
*   **예상 효과**: 실수로 블록을 삭제하거나 내용을 덮어썼을 때 복구할 수 있어 사용자 경험(UX)과 신뢰도가 대폭 상승합니다. `zundo` 라이브러리 도입을 추천합니다.

**2. Block Transclusion (임베드) 지원을 위한 상태 구조 개선**
*   **기능 설명**: 한 블록의 내용을 다른 페이지에서도 참조하여 보여주는 기능 (Roam Research의 Block Reference).
*   **구현 난이도**: 어려움
*   **예상 효과**: 현재 `BlockData` 구조는 계층형(트리)에 최적화되어 있습니다. 그래프형 데이터베이스처럼 다대다 관계를 지원하려면 `parentId`가 아닌 별도의 `parents` 배열이나 링크 테이블이 필요할 수 있습니다. 현재 구조가 고착화되기 전에 고려해볼 만합니다.

**3. 로컬 우선 충돌 해결 (Conflict Resolution) UI**
*   **기능 설명**: `gitStore`에서 충돌 발생 시 단순히 에러 메시지만 띄우고 있습니다. 파일 변경 사항을 비교하거나(Diff), "내 변경사항 유지/서버 버전 유지"를 선택할 수 있는 UI 상태 관리가 필요합니다.
*   **구현 난이도**: 어려움
*   **예상 효과**: Git 기반 동기화의 안정성 확보.

# 청크 정보
청크 번호: 1/1
파일 목록:
- src/stores/blockStore.ts
- src/stores/syncStore.ts
- src/stores/commandStore.ts
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
- src/stores/shortcutStore.ts
- src/stores/gitStore.ts
- src/stores/viewStore.ts
- src/stores/pageStore.ts
- src/hooks/useQueryMacro.ts
- src/hooks/useDebouncedBlockUpdate.ts
- src/hooks/useHomepage.ts
- src/hooks/useGitManagement.ts
- src/hooks/useKeyboardShortcuts.ts
- src/hooks/useCoreCommands.ts
- src/hooks/useWorkspaceInitializer.ts
