Loaded cached credentials.
안녕하세요, 'UI/UX & Design System Specialist'입니다.
제출해주신 React 및 Tauri 기반의 블록 에디터 프로젝트(Oxinot) 코드를 분석하였습니다.

전반적으로 **Mantine UI**와 **CSS Variables**를 활용한 테마 시스템이 체계적으로 구축되어 있으며, **Zustand**를 통한 상태 관리도 깔끔합니다. 다만, 일부 컴포넌트에서 사용자 경험(UX)을 저해할 수 있는 네이티브 알림창 사용과 유지보수가 어려운 하드코딩된 로직들이 발견되었습니다.

다음은 상세 리뷰 리포트입니다.

---

## 🎨 UI/UX 코드 리뷰

### ⚠️ 심각도 높음 (High Priority)

**1. [src/components/WorkspacePicker.tsx:69] 네이티브 Confirm 창 사용으로 인한 UX 단절**
*   **문제 설명**: 워크스페이스 삭제 시 브라우저 기본 `window.confirm()`을 사용하고 있습니다. 이는 커스텀 디자인된 다크 모드/라이트 모드 테마와 이질감이 크며, 애플리케이션의 몰입도를 해칩니다.
*   **해결 방법**: 이미 프로젝트에 `Mantine`의 `Modal` 컴포넌트가 사용되고 있으므로, 이를 활용한 커스텀 확인 모달로 대체해야 합니다. (`MigrationDialog`나 `FileTreeIndex`의 삭제 모달 패턴 참조)

**2. [src/components/fileTree/PageTreeItem.tsx:288-305] 접근성(Accessibility) 부족**
*   **문제 설명**: 페이지 제목을 클릭하여 이동하는 로직이 `Text` 컴포넌트(span/div)의 `onClick`에 바인딩되어 있습니다. `role="button"`이나 `tabIndex`가 없어 키보드 사용자(Tab 키 이동)가 페이지 트리를 탐색할 수 없습니다.
*   **해결 방법**: 해당 요소를 `<button>` 태그로 감싸거나, 적절한 ARIA 속성을 추가하여 키보드 인터랙션을 지원해야 합니다.

### ⚡ 심각도 중간 (Medium Priority)

**1. [src/components/SettingsModal.tsx:327-434] 유지보수가 어려운 검색 로직**
*   **문제 설명**: 설정 모달의 검색 기능이 `tabContent`라는 거대한 객체 안에 하드코딩된 키워드 배열로 구현되어 있습니다. 새로운 설정이 추가될 때마다 이 배열을 수동으로 업데이트해야 하므로 누락될 가능성이 높습니다.
*   **해결 방법**: 설정 항목 데이터 구조 자체에 `keywords` 속성을 포함시키고, 이를 동적으로 순회하며 검색하도록 리팩토링하는 것이 좋습니다.

**2. [src/components/FileTreeIndex.tsx:143-324] 과도한 콘솔 로그**
*   **문제 설명**: `FileTreeIndex` 컴포넌트 내에 `console.log`가 다수 남아있습니다. 이는 프로덕션 빌드 시 불필요한 노이즈를 발생시킵니다.
*   **해결 방법**: 디버깅용 로그는 제거하거나, 개발 모드에서만 동작하는 로거 유틸리티로 대체하세요.

**3. [src/components/EmbeddedBlockCard.tsx:238] 인라인 스타일 남용**
*   **문제 설명**: 테마 색상(`rgba(...)`)이 코드 내에 하드코딩되어 인라인 스타일로 적용되고 있습니다. 이는 `src/theme/colors.ts`나 `variables.css`에서 정의한 디자인 시스템과 괴리가 생길 수 있습니다.
*   **해결 방법**: CSS Modules 또는 Mantine의 `style` prop에서 CSS 변수(`var(--color-bg-elevated)`)를 사용하도록 변경하세요.

### 💡 기존 코드 개선 제안 (Code Improvements)

#### 1. 설정 검색 로직 구조 개선
`SettingsModal.tsx`의 하드코딩된 검색 로직을 데이터 기반으로 변경하여 유지보수성을 높입니다.

**Before:**
```typescript
// src/components/SettingsModal.tsx
const hasMatchInTab = (tabValue: string) => {
  const tabContent: Record<string, string[]> = {
    appearance: [
      t("settings.appearance.font_family").toLowerCase(),
      // ... 수동으로 추가된 수십 개의 키워드
    ],
    // ...
  };
  return tabContent[tabValue]?.some((item) => item.includes(query)) ?? false;
};
```

**After:**
```typescript
// 개선 제안: 각 설정 탭을 설정 객체로 정의
interface SettingTabConfig {
  id: string;
  icon: React.FC<any>;
  labelKey: string; // i18n key
  keywords: string[]; // 검색 키워드 (i18n key 포함)
  component: React.FC<any>;
}

const SETTINGS_TABS: SettingTabConfig[] = [
  {
    id: 'appearance',
    icon: IconAppWindow,
    labelKey: 'settings.tabs.appearance',
    keywords: ['settings.appearance.font_family', 'inter', 'font'],
    component: AppearanceSettings
  },
  // ... 다른 탭들
];

// 렌더링 및 검색 시
const hasMatchInTab = (tab: SettingTabConfig) => {
    const query = searchQuery.toLowerCase();
    // 라벨과 키워드 모두 검색 (translate 함수 적용)
    return t(tab.labelKey).toLowerCase().includes(query) || 
           tab.keywords.some(k => t(k).toLowerCase().includes(query) || k.includes(query));
}
```

#### 2. 날짜 관련 경로 계산 최적화
`CalendarDropdown.tsx`에서 매 렌더링마다 `pagePathMap`을 재생성하는 비용을 줄입니다.

**Before:**
```typescript
// src/components/CalendarDropdown.tsx
const pagePathMap = useMemo(() => {
  const map = new Map<string, string>();
  // ... 재귀적으로 모든 페이지의 경로를 계산 (O(N*Depth))
  return map;
}, [pagesById, pageIds]); // pagesById가 변경될 때마다 전체 재계산
```

**After:**
```typescript
// 개선 제안: pageIds가 많아지면 성능 저하 우려. 
// 1. 경로 계산 로직을 store의 selector나 별도 유틸리티로 분리
// 2. 혹은 필요한 시점(클릭 시)에만 경로를 계산하거나, 전체 맵 대신 필요한 날짜의 경로만 확인

const getDailyNotePage = useCallback((date: Date) => {
    const targetPath = getFullDailyNotePath(date);
    // 전체 맵을 만드는 대신, pageIds를 순회하며 경로가 일치하는지 확인 (혹은 스토어에서 경로 캐싱 지원)
    return pageIds.find(id => buildPath(id) === targetPath);
}, [pagesById, pageIds, getFullDailyNotePath]);
```

### 🚀 새로운 기능 제안 (Feature Suggestions)

**1. 커맨드 팔레트(Command Palette) 퍼지 검색(Fuzzy Search) 도입**
*   **기능 설명**: 현재 `includes` 기반의 단순 매칭을 사용 중입니다. 오타가 있거나 축약어 입력 시에도 명령어를 찾을 수 있도록 퍼지 검색(예: `fuse.js`)을 도입합니다.
*   **구현 난이도**: 쉬움 (라이브러리 교체 수준)
*   **예상 효과**: 키보드 중심 사용자의 생산성이 크게 향상됩니다. (예: "tgid" 입력 -> "Toggle Indent Guides" 매칭)

**2. 가상화된 파일 트리 (Virtualized File Tree)**
*   **기능 설명**: `FileTreeIndex`나 `FileTreeView`에서 페이지가 수천 개로 늘어날 경우 DOM 노드가 너무 많아져 렌더링 성능이 저하될 수 있습니다. `react-window` 등을 사용하여 화면에 보이는 항목만 렌더링합니다.
*   **구현 난이도**: 보통
*   **예상 효과**: 대규모 문서 관리 시 스크롤 성능 저하 방지 및 초기 로딩 속도 개선.

**3. 삭제된 페이지 복구 (Trash/Bin)**
*   **기능 설명**: 현재 삭제 시 영구 삭제(`deletePage`)가 수행됩니다. 실수로 인한 데이터 손실을 방지하기 위해 '휴지통' 개념을 도입하여 복구할 수 있는 기능을 제공합니다.
*   **구현 난이도**: 보통 (DB 스키마에 `deleted_at` 필드 추가 및 UI 필터링 필요)
*   **예상 효과**: 사용자 실수에 대한 안전장치 제공으로 UX 신뢰도 향상.

---
**총평:**
Oxinot 프로젝트는 UI/UX 측면에서 일관성 있는 디자인 시스템을 갖추고 있습니다. 특히 `ThemeProvider`와 `useTheme`를 통한 테마 관리 구조가 인상적입니다. 위에서 언급한 `window.confirm` 제거와 접근성 보완 작업만 선행된다면 훨씬 완성도 높은 애플리케이션이 될 것입니다.

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
- src/components/QueryBlock.tsx
- src/components/ErrorNotifications.tsx
- src/components/SearchModal.tsx
- src/components/EmbeddedPageCard.tsx
- src/components/MigrationDialog.tsx
- src/components/HelpModal.tsx
- src/components/Updater.tsx
- src/components/SettingsModal.tsx
- src/components/SettingsModal.module.css
- src/components/SubPagesSection.css
- src/components/common/IndentGuide.module.css
- src/components/common/CollapseToggle.module.css
- src/components/breadcrumb.css
- src/components/settings/types.ts
- src/components/CommandRegistry.ts
- src/styles/variables.css
- src/styles/layout.css
- src/styles/components.css
- src/styles/utilities.css
- src/styles/base.css
- src/theme/ThemeProvider.tsx
- src/theme/schema.ts
- src/theme/colors.ts
- src/theme/types.ts
- src/theme/tokens.ts
- src/theme/useTheme.ts
- src/theme/themes.ts
