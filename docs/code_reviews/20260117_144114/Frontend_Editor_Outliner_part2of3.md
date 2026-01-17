Loaded cached credentials.
## ✍️ 에디터 엔진 코드 리뷰

전반적으로 CodeMirror 6의 API를 능숙하게 활용하여 하이브리드 렌더링(Live Preview) 시스템을 구축했습니다. 특히 `ViewPlugin`과 `Extension`의 분리, `isFocused` 상태에 따른 마커 숨김 처리, 그리고 IME 입력(한글) 안정성을 위한 `composition` 이벤트 처리는 매우 훌륭합니다.

다만, 렌더링 파이프라인의 효율성과 유지보수성 측면에서 개선할 점들이 발견되었습니다.

### ⚡ 심각도 중간 (Medium Priority)

**1. 렌더링 루프의 중복 순회로 인한 성능 저하 우려**
*   **파일명:라인**: `src/editor/extensions/hybridRendering.ts:280, 316, 436, 472`
*   **문제 설명**: `buildDecorations` 함수 내부에서 `visibleLineRanges`를 대상으로 총 4번의 별도 루프를 돌고 있습니다.
    1. WikiLink/BlockRef/Tag 등 처리
    2. Table 처리
    3. Strikethrough 처리
    4. Footnote 처리
    뷰포트 내의 라인이라 할지라도, 스크롤이나 타이핑 시마다 동일한 라인 텍스트를 4번씩 중복 조회하고 정규식을 실행하는 것은 성능 낭비입니다.
*   **해결 방법**: 모든 라인 기반 처리를 단일 루프(`for (const lr of visibleLineRanges)`) 안으로 통합하고, 라인 텍스트를 한 번만 추출하여 각 핸들러에 전달하도록 리팩토링해야 합니다.

**2. 테이블 렌더링 로직의 강결합**
*   **파일명:라인**: `src/editor/extensions/hybridRendering.ts:316`
*   **문제 설명**: 다른 마크다운 요소들은 `Handler` 클래스로 잘 분리되어 있으나, 테이블 렌더링 로직만 `buildDecorations` 함수 내부에 100줄 넘게 하드코딩되어 있습니다. 이는 `hybridRendering.ts`의 복잡도를 높이고 유지보수를 어렵게 만듭니다.
*   **해결 방법**: `src/editor/extensions/handlers/TableHandler.ts`를 생성하고 `BaseHandler`를 상속받아 로직을 이관하세요.

**3. Autocomplete 트리거 로직의 취약성**
*   **파일명:라인**: `src/editor/createEditor.ts:553` (`getWikiLinkQueryAtPos`)
*   **문제 설명**: `lastIndexOf`와 문자열 슬라이싱을 사용하여 `[[` 또는 `((` 패턴을 찾고 있습니다. 이는 커서 위치나 예외적인 텍스트 상황에서 CodeMirror의 토크나이저 문맥을 활용하는 것보다 불안정할 수 있습니다.
*   **해결 방법**: CodeMirror의 `CompletionContext.matchBefore` 메서드를 활용하세요. 정규식을 통해 더 안전하고 효율적으로 트리거 문맥을 파악할 수 있습니다.

### 💡 기존 코드 개선 제안 (Code Improvements)

**1. Autocomplete 트리거 로직 개선 (matchBefore 사용)**
수동 파싱 대신 CodeMirror API를 활용하여 코드를 간소화하고 안정성을 높입니다.

*   **Before:**
```typescript
// src/editor/createEditor.ts
function getWikiLinkQueryAtPos(doc: string, cursorPos: number) {
  const before = doc.slice(0, cursorPos);
  const open = before.lastIndexOf("[[");
  // ... 수동 인덱스 계산 로직
}
```

*   **After:**
```typescript
// src/editor/createEditor.ts
function wikiSource(context: CompletionContext) {
  // [[ 로 시작하고 ] 가 없는 패턴 매칭
  const match = context.matchBefore(/\[\[[^\]]*$/);
  if (!match) return null;
  
  const query = match.text.slice(2); // '[[' 제거
  // ... 이후 로직
}
```

**2. CSS-in-JS 스타일 상수 최적화**
현재 `src/editor/extensions/theme/styles.ts`에서 스타일 문자열을 매번 생성하고 있습니다. 자주 사용되는 스타일은 `EditorView.theme`를 통해 클래스로 정의하고, 동적 스타일(예: 사용자 폰트 크기 설정 등)만 인라인 스타일로 적용하는 것이 DOM 무게를 줄이는 데 유리합니다.

*   **제안**: `CODE_STYLES`, `BLOCKQUOTE_STYLES` 등을 `hybridRenderingTheme` (`hybridRendering.ts`) 내부의 CSS 클래스로 완전히 이동시키고, `Decoration.mark` 생성 시 `attributes: { style: ... }` 대신 `class`만 사용하도록 변경.

### 🚀 새로운 기능 제안 (Feature Suggestions)

**1. 슬래시 커맨드 (Slash Commands) 메뉴**
*   **기능 설명**: `/` 키를 입력했을 때 헤딩, 할 일 목록, 테이블, 콜아웃 등을 삽입할 수 있는 팝업 메뉴를 제공합니다.
*   **구현 난이도**: 보통 (Autocompletion 확장 활용)
*   **예상 효과**: 마크다운 문법을 모르는 사용자도 쉽게 서식을 지정할 수 있어 UX가 크게 향상됩니다. 현재 `createUnifiedLinkAutocomplete` 구조를 확장하여 쉽게 구현 가능합니다.

**2. 이미지 붙여넣기 및 업로드 처리 (Paste Handling)**
*   **기능 설명**: 클립보드에서 이미지를 붙여넣었을 때, 로컬 파일 시스템에 저장하고 마크다운 이미지 문법(`![img](...)`)으로 자동 변환합니다.
*   **구현 난이도**: 보통 (`EditorView.domEventHandlers`의 `paste` 이벤트 활용)
*   **예상 효과**: 로컬 기반 에디터에서 필수적인 기능입니다. 현재 코드에는 텍스트 편집 기능만 집중되어 있어 멀티미디어 지원이 부족합니다.

**3. 접기/펼치기 (Folding)**
*   **기능 설명**: 헤딩이나 들여쓰기 된 블록을 접고 펼칠 수 있는 기능.
*   **구현 난이도**: 쉬움 (CodeMirror 기본 `foldGutter`, `foldKeymap` 활용)
*   **예상 효과**: 긴 문서를 작성할 때 가독성을 높여줍니다. 아웃라이너(`Outliner`) 성격이 있는 앱이므로 필수적입니다.

# 청크 정보
청크 번호: 2/3
파일 목록:
- src/editor/createEditor.ts
- src/editor/extensions/utils/decorationHelpers.ts
- src/editor/extensions/utils/nodeHelpers.ts
- src/editor/extensions/theme/styles.ts
- src/editor/extensions/hybridRendering.ts
- src/editor/extensions/handlers/InlineCodeHandler.ts
- src/editor/extensions/handlers/LinkHandler.ts
