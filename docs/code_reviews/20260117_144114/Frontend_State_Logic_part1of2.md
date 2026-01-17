Loaded cached credentials.
## 🔄 상태 관리 및 로직 리뷰

### ⚠️ 심각도 높음 (High Priority)

**1. [src/stores/blockStore.ts:372] 낙관적 업데이트 롤백(Revert) 시 데이터 유실 위험**
`updateBlock` 함수에서 에러 발생 시, 함수 진입 시점에 캡처한 `block` 스냅샷으로 상태를 덮어씁니다. 사용자가 빠르게 연속적인 입력을 하여 여러 `updateBlock` 호출이 비동기로 진행될 때, 앞선 요청이 실패하여 롤백되면 뒤따른 성공적인 업데이트(최신 상태)까지 과거 상태로 덮어씌워지는 **Race Condition**이 발생할 수 있습니다.
*   **해결 방법:** 실패 시 단순히 과거 스냅샷으로 덮어쓰기보다는, 안전하게 서버에서 해당 블록의 최신 데이터를 다시 가져오거나(`invoke("get_block", ...)`) 페이지 전체를 리로드(`loadPage`)하여 데이터 정합성을 맞춰야 합니다.

**2. [src/stores/pageStore.ts:90] 페이지 생성 시 스토어 상태 불일치**
`createPage` 액션이 백엔드 호출 후 반환된 `newPage` 데이터를 스토어(`pagesById`, `pageIds`)에 반영하지 않고 ID만 반환합니다. "let loadPages handle it"이라는 주석이 있지만, 이 함수 자체만 호출해서는 스토어가 업데이트되지 않아 UI에 새 페이지가 즉시 반영되지 않는 문제가 발생할 수 있습니다.
*   **해결 방법:** `createPage` 성공 시 반환된 `PageData`를 즉시 `pagesById`에 추가하고 `pageIds` 배열에도 추가하는 로직을 포함시켜야 합니다.

### ⚡ 심각도 중간 (Medium Priority)

**1. [src/stores/blockStore.ts:182] 복잡한 Temp ID 처리와 펜딩 업데이트 로직**
`createBlock` 내부에서 `tempId`를 생성하고 `Promise.resolve()`로 틱을 양보한 뒤 백엔드 호출, 이후 `tempId` 교체 및 `pendingUpdates` 처리까지 로직이 매우 복잡하고 깁니다. 이는 유지보수가 어렵고 예기치 않은 타이밍 이슈를 유발할 수 있습니다.
*   **해결 방법:** `pendingUpdates` 처리 로직을 별도의 함수로 분리하거나, 낙관적 업데이트 로직을 단순화해야 합니다. 가능하다면 UUID 생성을 프론트엔드에서 수행하여 처음부터 `realId`를 사용하는 방식(백엔드가 허용한다면)을 고려해볼 수 있습니다.

**2. [src/stores/viewStore.ts:87] Breadcrumb 수동 관리의 취약성**
`viewStore`의 `openNote` 등에서 `breadcrumb` 배열을 인자(`parentNames`)로 받아 수동으로 구성하고 있습니다. 페이지 구조나 제목이 변경되었을 때 이 breadcrumb 정보가 자동으로 동기화되지 않고 stale 상태가 될 가능성이 높습니다.
*   **해결 방법:** `breadcrumb`를 상태로 저장하기보다는, `currentNotePath`와 `pageStore`의 계층 구조 데이터를 기반으로 렌더링 시점에 계산(Derived State)하거나 Selector로 구현하는 것이 데이터 무결성 측면에서 안전합니다.

### 💡 기존 코드 개선 제안 (Code Improvements)

**1. `blockStore` 구조 분리 (Slice Pattern 적용)**
`blockStore.ts` 파일이 너무 비대합니다(약 600라인). CRUD, 트리 조작, 포커스/이동 로직이 혼재되어 있습니다.

**Before:**
```typescript
// src/stores/blockStore.ts
export const useBlockStore = create<BlockStore>()(
  immer((set, get) => ({
    // ... CRUD actions
    // ... Tree manipulation actions
    // ... Navigation actions
  }))
);
```

**After:**
```typescript
// src/stores/slices/createBlockSlice.ts
export const createBlockSlice = (set, get) => ({
  createBlock: async (...) => { ... },
  updateBlock: async (...) => { ... },
});

// src/stores/slices/createTreeSlice.ts
export const createTreeSlice = (set, get) => ({
  indentBlock: async (...) => { ... },
  moveBlock: async (...) => { ... },
});

// src/stores/blockStore.ts
export const useBlockStore = create<BlockStore>()(
  immer((...a) => ({
    ...createBlockSlice(...a),
    ...createTreeSlice(...a),
    // ...
  }))
);
```

**2. Selector 최적화 및 좀비 차일드 방지**
`useBlock` 훅에서 블록이 삭제되었을 때 `undefined`를 반환할 수 있음을 명시적으로 처리하는 것이 좋습니다.

**Before:**
```typescript
export const useBlock = (id: string) =>
  useBlockStore((state) => state.blocksById[id]);
```

**After:**
```typescript
// 반환 타입에 undefined 명시 및 안전한 접근 유도
export const useBlock = (id: string) =>
  useBlockStore((state) => state.blocksById[id] ?? undefined);
```

### 🚀 새로운 기능 제안 (Feature Suggestions)

**1. 실행 취소/다시 실행 (Undo/Redo) 미들웨어 도입**
*   **기능 설명:** 블록 편집, 이동, 삭제 등의 작업에 대한 Undo/Redo 기능. 현재 `navigationStore`는 페이지 이동 히스토리만 관리하므로 편집 히스토리가 부재합니다.
*   **구현 난이도:** 어려움 (서버 상태와 동기화 문제 해결 필요)
*   **예상 효과:** 사용자 경험(UX)이 대폭 향상되며, 실수로 삭제한 블록 복구 가능.
*   **제안:** `zundo`와 같은 Zustand 미들웨어를 도입하거나, Command 패턴을 적용하여 각 액션(`createBlock`, `updateBlock` 등)의 역방향 액션을 정의해야 합니다.

**2. 파일 시스템 감지 (File Watcher) 연동**
*   **기능 설명:** 외부에서 파일이 변경되었을 때 `workspaceStore`나 `pageStore`가 이를 감지하여 자동으로 갱신하는 기능.
*   **구현 난이도:** 보통 (Tauri 이벤트 리스너 활용)
*   **예상 효과:** 외부 에디터와 함께 사용할 때 데이터 동기화 보장.
*   **제안:** `tauri-plugin-fs-watch` 등을 활용하여 파일 변경 이벤트를 구독하고, 변경된 파일 경로에 따라 적절한 스토어 액션(`loadPage`, `loadDirectory` 등)을 트리거합니다.

# 청크 정보
청크 번호: 1/2
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
