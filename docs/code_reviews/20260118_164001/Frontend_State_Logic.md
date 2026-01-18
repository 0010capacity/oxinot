Loaded cached credentials.
## 🔄 상태 관리 및 로직 리뷰

### ⚠️ 심각도 높음 (High Priority)

**[src/stores/blockStore.ts:257] 블록 생성 실패 시 사용자 입력 데이터 유실 위험**
*   **문제 설명**: `createBlock` 함수에서 낙관적 업데이트(Optimistic Update)를 통해 임시 블록(`tempId`)을 먼저 생성합니다. 이후 백엔드 요청(`create_block`)이 실패할 경우 `catch` 블록에서 해당 임시 블록을 삭제(`delete state.blocksById[tempId]`)합니다.
    이때, 사용자가 생성 요청 대기 중에 해당 블록에 입력한 내용(`pendingUpdates` 또는 스토어 상태)이 별도 백업 없이 삭제되어 데이터가 유실됩니다.
*   **해결 방법**: 에러 발생 시 블록을 즉시 삭제하기보다 '에러 상태(error status)'로 변경하여 UI에 표시하고, 사용자가 내용을 복사하거나 재시도할 수 있도록 처리해야 합니다.

### ⚡ 심각도 중간 (Medium Priority)

**[src/stores/pageStore.ts:316] Selector의 불필요한 배열 참조 생성으로 인한 리렌더링**
*   **문제 설명**: `usePageChildrenIds` 훅에서 `state.pageIds.filter(...)`를 통해 매번 새로운 배열 참조를 반환하고 있습니다. `zustand`는 기본적으로 엄격한 동등성 검사(Strict Equality)를 수행하므로, 스토어가 업데이트될 때마다 반환된 배열의 내용이 같더라도 참조가 달라 컴포넌트 리렌더링을 유발합니다.
*   **해결 방법**: `shallow` 비교 함수를 사용하거나 `useShallow`를 적용해야 합니다.
    ```typescript
    import { shallow } from "zustand/shallow";
    // ...
    export const usePageChildrenIds = (parentId: string | null) =>
      usePageStore((state) => {
        return state.pageIds.filter((id) => {
          const page = state.pagesById[id];
          return page && (page.parentId ?? null) === parentId;
        });
      }, shallow); // shallow 추가
    ```

**[src/stores/workspaceStore.ts:162, 227] 파일 조작 후 비효율적인 전체 트리 리로드**
*   **문제 설명**: `deleteItem`, `renameItem` 등의 파일 시스템 조작 후 `loadDirectory`를 호출하여 전체 파일 트리를 다시 읽어옵니다. 이는 불필요한 IPC/비동기 오버헤드를 발생시키며 UI 반응성을 저하시킬 수 있습니다.
*   **해결 방법**: 성공 시 로컬 `fileTree` 상태를 낙관적으로(optimistically) 먼저 업데이트하고, 필요시 백그라운드에서 동기화하는 방식으로 개선을 권장합니다.

### 💡 기존 코드 개선 제안 (Code Improvements)

**[src/stores/blockStore.ts:145] 레거시 메서드 정리**
*   **제안**: `loadPage`는 단순히 `openPage`를 호출하는 래퍼 역할을 하고 있습니다. 혼란을 방지하기 위해 제거하거나 `@deprecated`를 명시하고 호출처를 `openPage`로 통일하는 것이 좋습니다.
    ```typescript
    // Before
    loadPage: async (pageId: string) => {
      return get().openPage(pageId);
    },

    // After
    // loadPage 제거 및 사용하는 컴포넌트에서 openPage 직접 호출
    ```

**[src/hooks/useCoreCommands.ts:39] 거대 의존성 배열을 가진 useMemo 최적화**
*   **제안**: `coreCommands`를 생성하는 `useMemo`의 의존성 배열이 매우 큽니다(`isRepo`, `hasChanges`, `workspacePath`, `options` 등). 이는 잦은 재연산을 유발할 수 있습니다. 명령어 정의를 컴포넌트 외부나 별도 팩토리 함수로 분리하고, 동적인 부분(예: git 상태)만 스토어에서 가져와 주입하는 구조로 변경하면 가독성과 성능이 개선됩니다.

### 🚀 새로운 기능 제안 (Feature Suggestions)

**1. 페이지 작업에 대한 Undo/Redo (실행 취소/다시 실행) 지원**
*   **기능 설명**: 현재 `blockStore`에는 `zundo`(`temporal`)가 적용되어 있어 블록 편집의 실행 취소가 가능하지만, `pageStore`(페이지 삭제, 이동, 이름 변경)에는 적용되어 있지 않습니다. 페이지 삭제와 같은 파괴적인 작업에 대해 안전장치가 부족합니다.
*   **구현 난이도**: 보통
*   **예상 효과**: 실수로 페이지를 삭제하거나 이동했을 때 복구할 수 있어 사용자 경험과 데이터 안전성이 크게 향상됩니다. `blockStore`와 유사하게 `pageStore`에도 `temporal` 미들웨어 도입을 제안합니다.

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
