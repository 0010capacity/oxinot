Loaded cached credentials.
## 🎨 UI/UX 코드 리뷰

### ⚡ 심각도 중간 (Medium Priority)

**[src/components/fileTree/PageTreeItem.tsx:73] 불필요한 JS 상태 기반 Hover 처리**
마우스 오버 효과를 위해 `useState(isHovered)`와 `onMouseEnter/Leave` 이벤트를 사용하고 있습니다. 파일 트리는 아이템 개수가 많아질 수 있는 리스트 컴포넌트이므로, 마우스 이동마다 React 상태 업데이트와 리렌더링을 유발하는 방식은 렌더링 성능을 저하시키고 UI 반응성을 떨어뜨립니다.
**해결 방법:** JS 상태 대신 CSS(또는 CSS Modules, styled-components)의 `:hover` 가상 클래스와 CSS 변수, 또는 부모의 클래스를 참조하는 방식(group-hover)으로 변경하여 브라우저 네이티브 스타일링 엔진이 처리하도록 개선해야 합니다.

**[src/components/settings/AdvancedSettings.tsx:43] & [src/components/settings/GitSettings.tsx:38] 네이티브 Alert/Confirm 사용**
모던 데스크톱 앱(Tauri) 환경에서 `window.confirm`과 같은 브라우저 네이티브 블로킹 팝업을 사용하고 있습니다. 이는 앱의 전체적인 디자인 언어와 이질적이며, 사용자 경험을 저해합니다. (`WorkspacePicker.tsx`에서는 이미 `Modal`을 잘 사용하고 있습니다.)
**해결 방법:** `window.confirm` 대신 Mantine의 `Modal` 컴포넌트나 `@mantine/modals`의 `openConfirmModal` 함수를 사용하여 앱의 테마가 적용된 비동기 모달로 교체하세요.

**[src/components/WorkspacePicker.tsx:135] 명령형 스타일 조작 (Imperative Style Manipulation)**
`onMouseEnter` 이벤트 핸들러 내부에서 `e.currentTarget.style.backgroundColor = ...`와 같이 DOM 스타일을 직접 조작하고 있습니다. 이는 React의 선언적 UI 패턴을 위반하며, 테마 변경이나 유지보수 시 스타일 파편화를 초래합니다.
**해결 방법:** Mantine의 `Styles API` 또는 CSS 클래스(`:hover`)를 사용하여 선언적으로 스타일을 정의하세요.

**[src/components/FileTreeIndex.tsx] & [src/components/fileTree/PageTreeItem.tsx] 매직 넘버(Magic Number) 사용**
들여쓰기(Indent) 깊이를 계산할 때 `depth * 24`와 같이 `24`라는 숫자가 하드코딩되어 여러 파일에 분산되어 있습니다. 디자인 시스템의 변경(예: 간격을 넓히거나 좁힘) 시 일관성을 유지하기 어렵습니다.
**해결 방법:** 해당 값을 상수로 분리(예: `INDENT_SIZE_PX`)하거나 CSS 변수(`var(--indent-size)`)로 정의하여 관리하세요.

---

### 💡 기존 코드 개선 제안 (Code Improvements)

**1. PageTreeItem의 Hover 로직 CSS로 이관**
불필요한 리렌더링을 방지하기 위해 CSS 기반으로 변경하는 제안입니다.

**Before (JS State):**
```tsx
// src/components/fileTree/PageTreeItem.tsx
const [isHovered, setIsHovered] = useState(false);

return (
  <div
    onMouseEnter={() => setIsHovered(true)}
    onMouseLeave={() => setIsHovered(false)}
  >
    {/* ... */}
    {isHovered && !isEditing && (
      <Group>{/* Action Buttons */}</Group>
    )}
  </div>
);
```

**After (CSS/CSS Modules):**
```tsx
// PageTreeItem.tsx
// state 제거
import classes from './PageTreeItem.module.css'; // 가정

return (
  <div className={classes.container}>
    {/* ... */}
    {!isEditing && (
      <Group className={classes.actions}>
        {/* Action Buttons */}
      </Group>
    )}
  </div>
);

/* PageTreeItem.module.css */
.actions {
  opacity: 0;
  transition: opacity 0.2s ease;
}

.container:hover .actions {
  opacity: 1;
}
```

**2. Indent 사이즈 상수화**
`src/constants/layout.ts` 같은 파일에 정의하여 일관성을 확보합니다.

**Before:**
```tsx
paddingLeft: `${depth * 24}px`,
```

**After:**
```tsx
// src/constants/layout.ts
export const INDENT_PER_LEVEL = 24;

// Component
import { INDENT_PER_LEVEL } from '../../constants/layout';
paddingLeft: `${depth * INDENT_PER_LEVEL}px`,
```

---

### 🚀 새로운 기능 제안 (Feature Suggestions)

**1. 가상화된 트리 리스트 (Virtualized Tree List)**
*   **기능 설명:** 현재 구조는 재귀적으로 모든 컴포넌트를 렌더링합니다. 페이지(노드)가 수천 개로 늘어날 경우 초기 로딩과 드래그 성능이 급격히 저하될 것입니다. 화면에 보이는 부분만 렌더링하는 Windowing 기법을 적용합니다.
*   **구현 난이도:** 어려움 (트리 구조의 접기/펼치기 상태와 가변 높이를 가상화 리스트 라이브러리와 연동해야 함)
*   **예상 효과:** 대량의 문서를 다루는 사용자에게 압도적인 스크롤 성능과 메모리 효율성 제공.

**2. 테마 프리뷰 (Theme Preview)**
*   **기능 설명:** `ThemeSettings.tsx`에서 색상 모드나 변형(Variant)을 선택할 때, 실제 UI가 어떻게 변하는지 보여주는 작은 미리보기 카드(Mock UI)를 제공합니다.
*   **구현 난이도:** 보통
*   **예상 효과:** 사용자가 설정을 변경할 때마다 전체 앱을 둘러보지 않고도 직관적으로 테마를 결정할 수 있어 설정 경험이 향상됩니다.

**3. 드래그 앤 드롭 시각적 피드백 강화**
*   **기능 설명:** 현재 `FileTreeIndex.tsx`의 커스텀 고스트 이미지는 단순 `div`입니다. 드래그 중인 파일의 계층 구조나, 드롭될 위치의 깊이(Depth) 가이드라인을 시각적으로 더 명확하게 표시(예: 파란색 가로줄이 들여쓰기 수준에 맞춰 이동)합니다.
*   **구현 난이도:** 보통
*   **예상 효과:** 사용자가 실수로 잘못된 계층으로 파일을 이동시키는 오류를 줄여줍니다.

# 청크 정보
청크 번호: 1/4
파일 목록:
- src/components/SubPagesSection.tsx
- src/components/settings/ThemeSettings.tsx
- src/components/settings/DailyNotesSettings.tsx
- src/components/settings/AdvancedSettings.tsx
- src/components/settings/AboutSettings.tsx
- src/components/settings/AppearanceSettings.tsx
- src/components/settings/LanguageSettings.tsx
- src/components/settings/DatetimeSettings.tsx
- src/components/settings/HomepageSettings.tsx
- src/components/settings/OutlinerSettings.tsx
- src/components/settings/ShortcutsSettings.tsx
- src/components/settings/GitSettings.tsx
- src/components/FileTreeIndex.tsx
- src/components/WorkspacePicker.tsx
- src/components/fileTree/PageTreeItem.tsx
- src/components/fileTree/NewPageInput.tsx
