Loaded cached credentials.
## 🎨 UI/UX 코드 리뷰

### ⚠️ 심각도 높음 (High Priority)
런타임 성능 저하를 유발하거나 접근성을 심각하게 해치는 문제입니다.

[src/components/CalendarDropdown.tsx:55-80] **심각한 성능 저하 가능성 (O(N^2) 복잡도)**
`getDailyNotePage` 함수 내에서 `pageIds.find`를 호출하고, 그 내부에서 매번 `buildPath`를 재귀적으로 호출하여 전체 경로를 계산합니다. 페이지 수가 많아질수록 캘린더 렌더링이나 날짜 클릭 시 UI가 프리징될 수 있습니다.
**해결 방법:**
전체 페이지 경로를 미리 계산하여 Map(`path -> pageId`) 형태로 캐싱하거나, 스토어(Store) 레벨에서 경로 룩업 테이블을 관리해야 합니다. 렌더링 단계에서 매번 경로를 계산하지 마세요.

[src/components/CalendarDropdown.tsx:246] **접근성 위반 (키보드 사용 불가)**
날짜 셀이 `Box`(div)에 `onClick`으로 구현되어 있습니다. 이는 키보드 사용자(Tab 키 이동)나 스크린 리더 사용자가 날짜를 선택할 수 없게 만듭니다.
**해결 방법:**
`Box` 대신 `<button>` 태그를 사용하거나, Mantine의 `UnstyledButton`을 사용하세요. `role="gridcell"`과 적절한 `aria-label` (예: "2026년 1월 17일 선택")을 추가해야 합니다.

[src/components/FileTreeView.tsx:165] **접근성 위반 (비의미적 태그 사용)**
파일 트리 노드가 `div`와 `onClick`으로 구성되어 있어 키보드 탐색이 불가능합니다.
**해결 방법:**
트리 구조에는 `role="tree"`, `role="treeitem"`을 적용하고, 인터랙션 요소는 `<button>`으로 감싸 키보드 포커스가 가능하도록 수정해야 합니다.

### ⚡ 심각도 중간 (Medium Priority)
유지보수성과 일관성을 저해하는 문제입니다.

[src/components/EmbeddedBlockCard.tsx:117] **스타일링 일관성 부족 (Inline Styles)**
Mantine UI 라이브러리를 사용함에도 불구하고 `style={{ display: "flex", ... }}`와 같이 인라인 스타일이 과도하게 사용되고 있습니다. 이는 테마 변경 대응을 어렵게 하고 코드 가독성을 떨어뜨립니다.
**해결 방법:**
Mantine의 `Stack`, `Group`, `Box` 컴포넌트의 props(예: `display="flex"`)를 활용하거나, CSS Modules (`.module.css`) 또는 Mantine의 `className` 시스템을 사용하세요.

[src/components/titleBar/Clock.tsx:23] **불필요한 리렌더링 및 하이드레이션 불일치**
`useState("")`로 초기화한 뒤 `useEffect`에서 시간을 설정하면, 앱 로드 시 "00:00"이나 빈 공간이 잠깐 보였다가 시간이 나타나는 깜빡임(Flash)이 발생합니다. 또한 1초마다 컴포넌트 전체가 리렌더링됩니다.
**해결 방법:**
초기값을 `new Date()`로 설정하되, 서버 사이드 렌더링(SSR)이 아닌 클라이언트 전용(CSR) 환경(Tauri 등)이라면 초기 렌더링 시점부터 시간을 표시하도록 수정하세요. 리렌더링 최적화를 위해 시/분 텍스트 부분만 별도 컴포넌트로 분리하는 것도 고려할 수 있습니다.

[src/components/MetadataEditor.tsx:288] **키보드 접근성 저해**
`tabIndex={-1}`이 일부 버튼(Type Badge, Delete Button)에 적용되어 있습니다. 이는 키보드 사용자가 해당 기능을 실행할 수 없게 만듭니다.
**해결 방법:**
특수한 포커스 관리 의도가 없다면 `tabIndex={-1}`을 제거하여 순차적 탐색이 가능하게 하세요.

### 💡 기존 코드 개선 제안 (Code Improvements)

**1. 재귀적 경로 계산 로직 최적화 (Memoization)**
`CalendarDropdown.tsx`의 성능 문제를 해결하기 위한 제안입니다.

**Before:**
```typescript
const getPageIdByPath = (path: string): string | undefined => {
  return pageIds.find((id) => {
    // ...매번 재귀적으로 buildPath 호출...
    return buildPath(id) === path;
  });
};
```

**After:**
```typescript
// usePageStore 혹은 상위 컴포넌트에서 useMemo로 계산
const pathToIdMap = useMemo(() => {
  const map = new Map<string, string>();
  pageIds.forEach(id => {
    const path = buildPath(id); // buildPath도 메모이제이션 권장
    if (path) map.set(path, id);
  });
  return map;
}, [pageIds, pagesById]);

// O(1) 조회
const getPageIdByPath = (path: string) => pathToIdMap.get(path);
```

**2. 인라인 스타일을 Mantine Props로 변환**
**Before:**
```tsx
<Box style={{ display: "flex", gap: "8px", alignItems: "flex-start" }}>
```
**After:**
```tsx
<Group gap="xs" align="flex-start" wrap="nowrap">
```
이렇게 하면 Mantine의 테마 간격(`xs`, `md`)을 따르게 되어 일관성이 향상됩니다.

### 🚀 새로운 기능 제안 (Feature Suggestions)

**1. 커맨드 팔레트 기능 확장 (Action Provider)**
*   **기능 설명:** 현재 `CommandPalette.tsx`에 명령어가 하드코딩되어 있습니다. 이를 다른 컴포넌트(예: 플러그인, 현재 활성화된 에디터)에서 동적으로 명령어를 등록할 수 있는 `CommandRegistry` 패턴으로 변경합니다.
*   **구현 난이도:** 보통
*   **예상 효과:** 에디터가 포커스되었을 때만 "텍스트 굵게 하기" 명령어가 검색되는 등 문맥에 맞는(Context-aware) UX를 제공할 수 있습니다.

**2. 가상화된 트리 뷰 (Virtualized Tree View)**
*   **기능 설명:** `FileTreeView.tsx`나 `EmbeddedBlockCard.tsx`의 재귀적 렌더링은 데이터가 많아지면 느려집니다. `react-window` 같은 라이브러리를 사용해 보이는 부분만 렌더링합니다.
*   **구현 난이도:** 어려움 (트리 구조의 가상화는 복잡함)
*   **예상 효과:** 수천 개의 블록이나 파일이 있는 대규모 워크스페이스에서도 부드러운 스크롤 성능을 보장합니다.

# 청크 정보
청크 번호: 2/4
파일 목록:
- src/components/EmbeddedBlockCard.tsx
- src/components/CalendarDropdown.tsx
- src/components/CommandPalette.tsx
- src/components/LinkedReferences.tsx
- src/components/titleBar/WindowControls.tsx
- src/components/titleBar/Clock.tsx
- src/components/titleBar/ActionIcons.tsx
- src/components/layout/ContentWrapper.tsx
- src/components/layout/PageContainer.tsx
- src/components/layout/PageHeader.tsx
- src/components/layout/BottomLeftControls.tsx
- src/components/SyncProgress.tsx
- src/components/MetadataEditor.tsx
- src/components/TitleBar.tsx
- src/components/SnowEffect.tsx
- src/components/Editor.tsx
- src/components/FileTreeView.tsx
- src/components/GitStatusIndicator.tsx
- src/components/common/CollapseToggle.tsx
- src/components/common/IndentGuide.tsx
