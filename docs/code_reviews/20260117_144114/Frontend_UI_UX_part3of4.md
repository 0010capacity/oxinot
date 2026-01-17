Loaded cached credentials.
## 🎨 UI/UX 코드 리뷰

### ⚠️ 심각도 높음 (High Priority)
접근성 위반 및 잠재적인 성능 병목 현상이 발견되었습니다.

[src/components/SearchModal.tsx:167] 접근성(Accessibility) 위반
- **문제 설명**: 키보드 네비게이션(`ArrowDown`, `ArrowUp`)을 직접 구현하여 시각적으로는 선택된 항목이 변경되지만, 스크린 리더는 현재 어떤 항목이 선택되었는지 알 수 없습니다. 리스트 아이템에 적절한 ARIA 속성이 누락되어 있습니다.
- **해결 방법**:
  1. 검색 결과 컨테이너에 `role="listbox"`를 추가하세요.
  2. 각 결과 아이템에 `role="option"`과 `aria-selected={isSelected}`를 추가하세요.
  3. `TextInput`에 `aria-activedescendant={selectedId}`를 추가하여 포커스 관리와 연결하는 것이 가장 이상적입니다.

[src/components/EmbeddedPageCard.tsx:142] 성능 저하 (Performance)
- **문제 설명**: 읽기 전용(read-only) 미리보기를 위해 무거운 `<Editor />` 컴포넌트를 반복해서 렌더링하고 있습니다. 블록이 많은 페이지나 `EmbeddedPageCard`가 여러 개 사용되는 뷰에서 심각한 렌더링 지연과 메모리 사용량 증가를 유발합니다.
- **해결 방법**: 편집이 필요 없는 미리보기 상태에서는 Editor 인스턴스 대신 가벼운 `MarkdownRenderer`나 단순히 스타일링된 HTML/Text 컴포넌트를 사용하는 조건부 렌더링을 적용하세요.

### ⚡ 심각도 중간 (Medium Priority)
스타일링 일관성 및 유지보수성 문제가 있습니다.

[src/components/EmbeddedPageCard.tsx:241] 스타일링 일관성 부족 및 FOUC 위험
- **문제 설명**: 다크/라이트 모드 스타일링을 JS 로직(`isDark ? ... : ...`)과 인라인 스타일로 처리하고 있습니다. 이는 테마 전환 시 깜빡임(Flicker)을 유발하거나, CSS 변수의 이점을 활용하지 못해 유지보수를 어렵게 만듭니다.
- **해결 방법**: `src/styles/variables.css`에 정의된 CSS 변수(예: `--color-bg-elevated`, `--color-border-primary`)를 사용하여 `className`이나 CSS Module로 스타일을 이동하세요.

[src/components/HelpModal.tsx:189] 잘못된 스타일링 방식
- **문제 설명**: 컴포넌트 내부에서 `<style>` 태그를 사용하여 전역 CSS를 주입하고 있습니다. 이는 캡슐화를 깨뜨리고, 동일한 컴포넌트가 여러 번 마운트될 경우 스타일 태그가 중복 생성될 수 있습니다.
- **해결 방법**: 해당 스타일을 `HelpModal.module.css`로 분리하거나 `src/styles/components.css`와 같은 전역 스타일 파일로 이동하세요.

[src/components/Breadcrumb.tsx:47] 반응형 대응 미흡
- **문제 설명**: `truncateText` 함수가 글자 수(30자)를 기준으로 자르고 있습니다. 화면 해상도나 폰트 크기에 따라 30자가 너무 길거나 짧을 수 있어 UI가 깨지거나 공간이 낭비될 수 있습니다.
- **해결 방법**: JS로 자르는 대신 CSS의 `text-overflow: ellipsis; white-space: nowrap; overflow: hidden;`과 `max-width`를 활용하여 컨테이너 크기에 맞춰 자연스럽게 말줄임 처리하세요.

### 💡 기존 코드 개선 제안 (Code Improvements)

**1. BulletPoint 스타일링 최적화**
`src/components/common/BulletPoint.tsx`의 인라인 스타일을 CSS 클래스로 변환하여 렌더링 성능을 개선하고 가독성을 높입니다.

**Before:**
```tsx
// JS 내부에서 스타일 객체 생성
const getBulletStyle = (): CSSProperties => {
  const baseStyle: CSSProperties = {
    width: "var(--layout-bullet-size)",
    // ... 많은 인라인 스타일
  };
  // ... 조건문
};
return <div className="bullet-point" style={getBulletStyle()} />
```

**After:**
```tsx
// CSS Module 또는 별도 CSS 파일 활용
import "./BulletPoint.css";

// .bullet-point { ...base-styles }
// .bullet-point[data-type="fence"] { ... }
// .bullet-point[data-active="true"] { ... }

export function BulletPoint({ type = "default", isActive = false, ... }) {
  return (
    <div 
      className="bullet-point-wrapper"
      // ... event handlers
    >
      <div 
        className={`bullet-point bullet-point--${type}`}
        data-active={isActive} 
      />
    </div>
  );
}
```

### 🚀 새로운 기능 제안 (Feature Suggestions)

**1. 검색 결과 내 '명령(Command)' 실행 기능**
- **기능 설명**: `SearchModal`에서 단순히 페이지로 이동하는 것 외에, 검색된 항목에 대해 바로 '삭제', '이름 변경', '새 탭에서 열기' 등의 액션을 수행할 수 있는 기능을 제공합니다. (예: `Ctrl` + `Enter`로 컨텍스트 메뉴 열기 또는 우측 아이콘 제공)
- **구현 난이도**: 보통
- **예상 효과**: 파워 유저의 워크플로우 속도를 크게 향상시키고, "Command Palette"와 "Search"의 경험을 통합할 수 있습니다.

**2. 브레드크럼 호버 미리보기 (Breadcrumb Hover Preview)**
- **기능 설명**: 경로가 깊어지거나 이름이 길어 `...`으로 축약된 브레드크럼 항목에 마우스를 올렸을 때, 해당 페이지의 전체 제목과 간단한 요약(첫 3줄 등)을 툴팁으로 보여줍니다.
- **구현 난이도**: 쉬움
- **예상 효과**: 사용자가 페이지를 이동하지 않고도 현재 경로의 문맥을 빠르게 파악할 수 있어 탐색 효율이 증가합니다.

**3. 스켈레톤 로딩 (Skeleton Loading) 적용**
- **기능 설명**: `EmbeddedPageCard`나 `MigrationDialog` 등 데이터를 불러오는 동안 단순 텍스트("Loading...") 대신 실제 UI 형태의 회색 박스(스켈레톤)를 보여줍니다.
- **구현 난이도**: 쉬움 (Mantine UI의 `Skeleton` 컴포넌트 활용)
- **예상 효과**: 체감 로딩 속도를 줄이고 레이아웃 이동(CLS)을 방지하여 시각적 안정성을 제공합니다.

# 청크 정보
청크 번호: 3/4
파일 목록:
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
- src/components/SubPagesSection.css
- src/components/common/common.css
- src/components/breadcrumb.css
- src/components/settings/types.ts
- src/styles/variables.css
- src/styles/layout.css
