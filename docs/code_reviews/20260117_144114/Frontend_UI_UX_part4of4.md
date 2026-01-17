Loaded cached credentials.
## 🎨 UI/UX 코드 리뷰

### ⚠️ 심각도 높음 (High Priority)
런타임 오류 가능성 및 잠재적 버그를 포함합니다.

[src/theme/colors.ts:25] 3자리 Hex 코드(Shorthand) 미지원 → 정규식 수정
현재 `hexToRgb` 함수는 6자리 Hex 코드만 처리하도록 작성되어 있습니다. 만약 `COLOR_VARIANTS`나 추후 사용자 테마 설정에서 `#fff`, `#333` 같은 3자리 단축 코드를 사용할 경우, 정규식 매칭에 실패하여 검정색(`0, 0, 0`)이 반환됩니다.

```typescript
// Before
const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);

// After (3자리/6자리 모두 지원)
const result = /^#?([a-f\d])([a-f\d])([a-f\d])$/i.exec(hex);
const fullHex = result 
  ? "#" + result[1] + result[1] + result[2] + result[2] + result[3] + result[3]
  : hex;
const finalResult = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(fullHex);
// ...이후 로직 동일 혹은 별도 유틸리티 라이브러리 사용 권장
```

### ⚡ 심각도 중간 (Medium Priority)
유지보수성 저하 및 스타일링 일관성 문제를 포함합니다.

[src/styles/components.css:329] 테마 변수 대신 하드코딩된 색상 사용 → 테마 변수 적용
모달 백드롭(`rgba(0, 0, 0, 0.6)`)과 스켈레톤 로딩 애니메이션 등에서 테마 시스템(CSS Variables)을 우회하고 값을 직접 지정했습니다. 다크 모드나 고대비 모드에서 시인성 문제를 일으킬 수 있습니다.

```css
/* src/styles/components.css */
.modal-backdrop {
  /* Before */
  background-color: rgba(0, 0, 0, 0.6);
  
  /* After (schema.ts/colors.ts에 overlay 색상 추가 후 사용 권장) */
  background-color: var(--color-bg-overlay, rgba(0, 0, 0, 0.6));
}
```

[src/styles/components.css:192] Z-Index 매직 넘버 사용 → 변수화
`z-index: 1070` (tooltip), `1050` (modal), `1000` (dropdown) 등이 산발적으로 하드코딩되어 있습니다. 레이어 순서 관리가 어려워지므로 `variables.css` 또는 `tokens.ts`에서 관리해야 합니다.

[src/theme/ThemeProvider.tsx:65] 특정 속성에 대한 하드코딩된 예외 처리 → 데이터 구조 통일
`indentSize`가 `number` 타입인 경우를 처리하기 위해 `ThemeProvider` 내부 로직에 `px` 단위를 붙이는 예외 처리가 있습니다. 이는 테마 처리 로직과 데이터 정의의 결합도를 높입니다. `tokens.ts`에서 단위를 포함한 `string`으로 정의하거나, 처리 로직을 추상화해야 합니다.

### 💡 기존 코드 개선 제안 (Code Improvements)

#### 1. 일관된 색상 투명도 처리 (Modern CSS)
`colors.ts`에서는 JS로 RGB 값을 계산하여 주입하고, `components.css`의 Alert 스타일에서는 `color-mix`를 사용하는 등 방식이 혼재되어 있습니다. `hexToRgb` 유틸리티 의존성을 줄이고 CSS 네이티브 기능인 `color-mix`로 통일하는 것을 제안합니다.

**Before (src/theme/colors.ts)**
```typescript
interactive: {
  selected: `rgba(${hexToRgb(variantColors.accent)}, 0.2)`,
  // ...
}
```

**After (src/theme/colors.ts & CSS)**
```typescript
// colors.ts에서는 원색(Hex)만 넘김
interactive: {
  selected: variantColors.accent, 
}
```
```css
/* 사용하는 곳 (CSS) */
.list-item-active {
  background-color: color-mix(in srgb, var(--color-interactive-selected), transparent 80%);
}
```

#### 2. #root 오버플로우 정책 명확화
`src/styles/base.css`에서 `#root`에 `overflow: visible`을 주고 `body`에 `overflow: hidden`을 준 것은 Tooltip 등의 Popover가 잘리지 않게 하려는 의도(`Float UI`)로 보이나, 이는 메인 레이아웃 스크롤이 예상치 못하게 동작할 위험이 있습니다.

**제안:** Popover나 Tooltip은 React Portal을 사용하여 `#root` 외부(body 직계 자식)로 렌더링하고, `#root`는 `overflow: hidden`으로 앱 컨테이너 역할을 명확히 하는 것이 안전합니다.

### 🚀 새로운 기능 제안 (Feature Suggestions)

#### 1. 사용자 정의 억양 색상 (Custom Accent Color)
- **설명**: 현재 5가지 프리셋(indigo, blue 등)만 제공되지만, 구조상 `colorVariant`만 확장하면 되므로 사용자가 직접 Hex 코드를 입력해 테마를 만들 수 있는 기능 추가가 용이합니다.
- **구현 난이도**: 쉬움
- **예상 효과**: 개인화된 사용자 경험 제공 및 "나만의 노트 앱"이라는 애착 형성.

#### 2. 인터페이스 밀도(Density) 설정
- **설명**: `tokens.ts`의 `SPACING`과 `TYPOGRAPHY`가 분리되어 있어, 'Comfortable', 'Compact' 모드를 쉽게 구현할 수 있습니다.
- **구현 난이도**: 보통 (Spacing 토큰 세트 하나 더 추가 및 Store 연동)
- **예상 효과**: 많은 정보를 한눈에 보고 싶은 파워 유저(개발자 등)의 생산성 향상.

#### 3. 시스템 폰트 연동 옵션
- **설명**: `typography.fontFamily`가 고정되어 있습니다. 사용자 OS에 설치된 폰트를 선택하거나, "시스템 기본 폰트 사용" 옵션을 명시적으로 제공합니다.
- **구현 난이도**: 쉬움
- **예상 효과**: 특히 한글 사용자의 경우, 웹 폰트 로딩 없이 시스템 폰트(Apple SD Gothic Neo 등)를 선호하는 경향이 있어 가독성 개선 효과가 큼.

# 청크 정보
청크 번호: 4/4
파일 목록:
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
