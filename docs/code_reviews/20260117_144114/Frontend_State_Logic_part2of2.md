Loaded cached credentials.
## 🔄 상태 관리 및 로직 리뷰

### ⚠️ 심각도 높음 (High Priority)
발견된 심각한 데이터 불일치나 치명적인 문제는 없습니다.

### ⚡ 심각도 중간 (Medium Priority)

**[src/hooks/useKeyboardShortcuts.ts:16] 불필요한 이벤트 리스너 재생성 (Performance/Stability)**
*   **문제 설명**: `useKeyboardShortcuts` 훅은 `handlers` 객체를 의존성 배열(`[handlers]`)에 포함하고 있습니다. 만약 이 훅을 사용하는 부모 컴포넌트에서 핸들러 객체를 인라인으로 생성하여 전달할 경우(예: `useKeyboardShortcuts({ onCommandPalette: ... })`), 매 렌더링마다 `handlers` 객체의 참조가 변경되어 `useEffect`가 재실행됩니다. 이는 `keydown` 이벤트 리스너를 매번 제거하고 다시 등록하게 만들어 성능 낭비를 초래합니다.
*   **해결 방법**: `handlers` 객체를 `useRef`로 감싸서 의존성을 제거하거나, 개별 함수들을 `useCallback`으로 메모이제이션된 상태로 받도록 변경해야 합니다. 아래 **Code Improvements** 섹션에서 `useRef`를 활용한 해결책을 제시합니다.

**[src/hooks/useDebouncedBlockUpdate.ts:32-38, 60-66] 로직 중복 (Code Duplication)**
*   **문제 설명**: `tempId`를 실제 `realId`로 매핑하는 로직이 `debouncedUpdate` 내부와 `flushUpdate` 내부에 정확히 동일하게 반복되고 있습니다. 이는 유지보수 시 한쪽만 수정될 위험이 있으며 코드의 가독성을 저해합니다.
*   **해결 방법**: ID 해석 로직을 내부 헬퍼 함수로 분리하여 재사용해야 합니다.

### 💡 기존 코드 개선 제안 (Code Improvements)

#### 1. `useKeyboardShortcuts`의 불필요한 리스너 바인딩 방지
핸들러가 변경되더라도 이벤트 리스너를 다시 붙이지 않도록 `useRef` 패턴(Latest Ref)을 적용합니다.

**Before:**
```typescript
export const useKeyboardShortcuts = (handlers: KeyboardShortcutHandlers) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
       // ... handlers.onCommandPalette() 호출
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handlers]); // handlers가 변경될 때마다 리스너 재생성
};
```

**After:**
```typescript
import { useEffect, useRef } from "react";

export const useKeyboardShortcuts = (handlers: KeyboardShortcutHandlers) => {
  // 최신 핸들러를 ref에 저장
  const handlersRef = useRef(handlers);

  useEffect(() => {
    handlersRef.current = handlers;
  }, [handlers]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // ref를 통해 최신 핸들러 접근
      const currentHandlers = handlersRef.current;

      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        currentHandlers.onCommandPalette();
      }
      // ... 기타 핸들러
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []); // 의존성 배열 비움 -> 마운트 시 한 번만 바인딩
};
```

#### 2. `useDebouncedBlockUpdate` 로직 중복 제거
ID 매핑 로직을 분리하여 코드의 일관성을 유지합니다.

**Before:**
```typescript
// (중복 코드 생략)
if (currentBlockId.startsWith("temp-")) {
  const realId = state.tempIdMap[currentBlockId];
  if (realId) {
    currentBlockId = realId;
  }
}
// ...
```

**After:**
```typescript
// 내부 헬퍼 함수
const resolveBlockId = (id: string) => {
  const state = useBlockStore.getState();
  if (id.startsWith("temp-")) {
    const realId = state.tempIdMap[id];
    return realId || id;
  }
  return id;
};

const debouncedUpdate = useCallback((content: string) => {
  // ...
  timerRef.current = setTimeout(() => {
    if (pendingContentRef.current !== undefined) {
      const currentBlockId = resolveBlockId(blockIdRef.current); // 헬퍼 사용
      const currentUpdateBlockContent = useBlockStore.getState().updateBlockContent;
      currentUpdateBlockContent(currentBlockId, pendingContentRef.current);
      pendingContentRef.current = undefined;
    }
  }, DEBOUNCE_MS);
}, []);
```

### 🚀 새로운 기능 제안 (Feature Suggestions)

**1. Git 충돌 해결 UI (Conflict Resolution UI)**
*   **기능 설명**: 현재 `useGitManagement`는 충돌 발생 시 "수동으로 해결하라"는 메시지만 표시합니다. 충돌난 파일 목록을 보여주고, '내 변경 사항 수락(Ours)' 또는 '원격 변경 사항 수락(Theirs)'을 선택할 수 있는 간단한 UI/로직을 추가합니다.
*   **구현 난이도**: 어려움 (Tauri 백엔드와의 긴밀한 연동 필요)
*   **예상 효과**: 개발자 경험 향상. 터미널을 열지 않고 앱 내에서 Git 워크플로우를 완결할 수 있음.

**2. 입력 상태 표시기 (Optimistic Saving Indicator)**
*   **기능 설명**: `useDebouncedBlockUpdate`에서 현재 저장이 대기 중인지(`pendingContentRef` 존재), 저장 중인지, 완료되었는지를 나타내는 상태(`isSaving`, `lastSavedAt`)를 반환합니다.
*   **구현 난이도**: 쉬움
*   **예상 효과**: 사용자가 데이터가 안전하게 저장되고 있는지 시각적으로 확인할 수 있어 신뢰도 향상.

**3. 단축키 관리자 (Shortcuts Manager)**
*   **기능 설명**: `useKeyboardShortcuts`에 하드코딩된 키(k, ,, ?)를 설정(Store)에서 불러오도록 변경하여 사용자가 단축키를 커스터마이징할 수 있게 합니다.
*   **구현 난이도**: 보통
*   **예상 효과**: 개인화된 사용자 경험 제공 및 접근성 향상.

# 청크 정보
청크 번호: 2/2
파일 목록:
- src/hooks/useDebouncedBlockUpdate.ts
- src/hooks/useHomepage.ts
- src/hooks/useGitManagement.ts
- src/hooks/useKeyboardShortcuts.ts
- src/hooks/useWorkspaceInitializer.ts
