Loaded cached credentials.
## 🎨 UI/UX 코드 리뷰

### ⚠️ 심각도 높음 (High Priority)
직접적인 런타임 오류는 보이지 않으나, 디자인 시스템의 확장성과 유지보수를 해치는 패턴이 발견되었습니다.

[src/components/SubPagesSection.tsx:98] 이벤트 핸들러를 통한 스타일 직접 조작
**문제 설명**: `onMouseEnter`, `onMouseLeave` 이벤트 내에서 `e.currentTarget.style.backgroundColor`를 직접 수정하고 있습니다. 이는 React의 선언적 패러다임을 위반하며, 불필요한 JS 연산을 유발하고 CSS `:hover` 가상 클래스로 처리할 수 있는 것을 복잡하게 만듭니다. 또한 테마 변경 시 동기화 문제가 발생할 수 있습니다.
**해결 방법**: CSS 모듈이나 `styled-components` (또는 현재 프로젝트의 `common.css` 등)에 클래스를 정의하고 `:hover` 선택자를 사용하세요.
```tsx
// Before
<div
  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = isDark ? "rgba..." : "rgba..."; }}
  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}
>

// After
// CSS: .pageRow:hover { background-color: var(--color-interactive-hover); }
<div className="pageRow">
```

[src/components/settings/AdvancedSettings.tsx:50-54] 테마 변수 미사용 (하드코딩된 색상)
**문제 설명**: `backgroundColor: isDark ? "#2C2E33" : "#F1F3F5"`와 같이 16진수 색상 코드가 컴포넌트 내부에 하드코딩되어 있습니다. 이는 `src/theme/tokens.ts`나 `variables.css`에 정의된 디자인 시스템 토큰을 무시하는 행위로, 테마를 수정할 때 모든 파일을 찾아다녀야 하는 유지보수 지옥을 만듭니다. `AboutSettings.tsx`, `GitSettings.tsx` 등 설정 관련 컴포넌트 전반에 걸쳐 동일한 문제가 있습니다.
**해결 방법**: `var(--color-bg-secondary)` 또는 `var(--color-bg-tertiary)`와 같은 CSS 변수를 사용하세요.

### ⚡ 심각도 중간 (Medium Priority)

[src/components/CalendarModal.tsx:128] 접근성(A11y) 부족 - 키보드 네비게이션
**문제 설명**: 달력의 날짜 셀(`Box`)이 `onClick` 이벤트만 가지고 있습니다. `role="button"` 속성과 `tabIndex={0}`, 그리고 `onKeyDown` 핸들러가 없어 키보드 사용자나 스크린 리더 사용자가 날짜를 선택할 수 없습니다.
**해결 방법**: 상호작용 가능한 요소에는 시멘틱 태그(`<button>`)를 사용하거나 적절한 ARIA 속성을 부여하세요.

[src/components/SubPagesSection.tsx:88] 과도한 인라인 스타일 사용
**문제 설명**: `renderPageTree` 내부의 `div`에 방대한 양의 인라인 스타일(`style={{...}}`)이 적용되어 있습니다. 이는 코드 가독성을 해치고 렌더링 성능에 미세한 영향을 줄 수 있으며, 미디어 쿼리 적용이 불가능합니다.
**해결 방법**: 별도의 CSS 파일(예: `SubPagesSection.module.css`)로 스타일을 분리하세요.

[src/components/MetadataEditor.tsx:28] 타입 추론 로직의 취약성
**문제 설명**: `guessType` 함수에서 `true`/`false` 문자열 체크나 `Number.isNaN`에 의존하고 있습니다. 사용자가 의도치 않게 숫자로 시작하는 텍스트를 입력했을 때 타입이 멋대로 변경되어 UI가 튀는 경험(Layout Shift)을 줄 수 있습니다.
**해결 방법**: 사용자가 명시적으로 타입을 선택하지 않는 한, 입력 중에는 타입을 자동으로 변경하지 않거나, 변경 시 사용자에게 시각적 피드백(제안)을 주는 것이 좋습니다.

### 💡 기존 코드 개선 제안 (Code Improvements)

**1. 캘린더 로직 중복 제거 (DRY 원칙)**
`CalendarModal.tsx`와 `CalendarDropdown.tsx`에 날짜 계산, 렌더링 로직, 스타일이 거의 동일하게 중복되어 있습니다.

**Before:** (두 파일에 각각 존재)
```tsx
// CalendarModal.tsx & CalendarDropdown.tsx
const getDaysInMonth = (date: Date) => { ... }
const renderCalendar = () => { ... } // 유사한 JSX 구조 반복
```

**After:**
`src/components/common/CalendarGrid.tsx`로 공통 컴포넌트 분리
```tsx
// src/components/common/CalendarGrid.tsx
interface CalendarGridProps {
  currentDate: Date;
  onDayClick: (day: number) => void;
  getNoteStatus: (date: Date) => boolean;
}

export function CalendarGrid({ currentDate, onDayClick, getNoteStatus }: CalendarGridProps) {
  // ... 날짜 계산 및 그리드 렌더링 로직 ...
}
```

**2. 설정 페이지의 검색 로직 최적화**
`SettingsModal.tsx`의 `hasMatchInTab` 함수는 렌더링될 때마다 모든 탭의 키워드를 다시 생성하고 검색합니다.

**Before:**
```tsx
const hasMatchInTab = (tabValue: string) => {
  // 렌더링마다 거대한 객체 생성
  const tabContent = { ... };
  return tabContent[tabValue]?.some(...)
};
```

**After:**
`tabContent` 정의를 컴포넌트 밖으로 빼거나 `useMemo`를 사용하여 불필요한 객체 생성을 방지합니다.
```tsx
const TAB_KEYWORDS = {
  appearance: [ ... ],
  // ...
};

// Component 내부
const hasMatchInTab = useCallback((tabValue: string) => {
   if (!searchQuery.trim()) return true;
   return TAB_KEYWORDS[tabValue]?.some(k => k.includes(searchQuery.toLowerCase()));
}, [searchQuery]);
```

---
**총평**: 전반적인 컴포넌트 분리와 아키텍처는 깔끔하지만, **디자인 시스템(색상 토큰, 공통 스타일)의 적용이 일관되지 않은 점**이 가장 큰 개선 포인트입니다. 특히 다크 모드 지원을 위해 인라인 스타일 내의 삼항 연산자(`isDark ? ... : ...`) 사용을 줄이고 CSS 변수(`var(--color-...)`) 활용을 적극 권장합니다.

# 청크 정보
청크 번호: 1/1
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
- src/components/CalendarModal.tsx
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
- src/components/common/ContextMenu.tsx
- src/components/common/BulletPoint.tsx
- src/components/Breadcrumb.tsx
- src/components/NavigationButtons.tsx
- src/components/MetadataBadge.tsx
- src/components/ErrorNotifications.tsx
- src/components/SearchModal.tsx
- src/components/EmbeddedPageCard.tsx
- src/components/MigrationDialog.tsx
- src/components/HelpModal.tsx
- src/components/Updater.tsx
- src/components/SettingsModal.tsx
- src/components/SettingsModal.module.css
- src/components/common/common.css
- src/components/breadcrumb.css
- src/components/settings/types.ts
- src/styles/variables.css
- src/styles/layout.css
- src/styles/components.css
- src/styles/utilities.css
- src/styles/base.css
- src/theme/ThemeProvider.tsx
- src/theme/colors.ts
- src/theme/types.ts
- src/theme/tokens.ts
- src/theme/useTheme.ts
