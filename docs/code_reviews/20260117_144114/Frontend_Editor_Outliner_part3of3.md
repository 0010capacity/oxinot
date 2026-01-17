Loaded cached credentials.
## ✍️ 에디터 엔진 코드 리뷰

### ⚠️ 심각도 높음 (High Priority)
데이터 손실, 크래시, 심각한 성능 저하 등 즉시 수정이 필요한 문제들입니다.

**[src/editor/extensions/handlers/BlockRefHandler.ts:114] 및 [WikiLinkHandler.ts:87] Widget 내 React Root 반복 생성**
- **문제 설명:** CodeMirror의 `WidgetType.toDOM`은 위젯이 뷰포트에 나타날 때마다 호출됩니다. 현재 `EmbedSubtreeWidget`과 `EmbedPageWidget`은 매번 `createRoot`를 호출하여 새로운 React 루트를 생성합니다. 스크롤을 빠르게 이동하거나 문서가 길어질 경우, DOM 조작 비용과 메모리 사용량이 급증하여 심각한 성능 저하(Jank)를 유발합니다.
- **해결 방법:**
  1. **Portal 사용:** 에디터 외부에 단일 React Root를 두고, 위젯 내부에서는 `ReactDOM.createPortal`을 사용하여 렌더링하도록 구조를 변경해야 합니다.
  2. **React 렌더러 분리:** CodeMirror 위젯과 React 생명주기를 연결해주는 브릿지(예: 별도의 ViewPlugin이 관리하는 포탈 컨테이너)를 도입하여 Root 생성을 최소화하세요.

**[src/editor/extensions/handlers/BlockRefHandler.ts:167] toDOM 내부의 비제어 비동기 로직**
- **문제 설명:** `BlockRefPreviewWidget`의 `toDOM` 메서드 내부에서 `void (async () => { ... })()` 패턴으로 비동기 데이터 페칭을 수행하고 있습니다. 위젯이 스크롤에 의해 화면 밖으로 나가 파괴(`destroy`)된 후에도 비동기 응답이 돌아오면 DOM 업데이트를 시도하게 됩니다(Memory Leak 가능성 및 불필요한 연산). 또한, 동일한 블록 참조가 여러 번 렌더링될 때 중복 요청이 발생할 수 있습니다.
- **해결 방법:**
  1. **상태 분리:** 데이터 페칭 로직을 위젯에서 분리하여 `ViewPlugin`이나 상위 `Store`가 관리하게 하세요.
  2. **Decoration 갱신:** 데이터가 로드되면 `EditorView`에 신호를 보내 해당 위젯을 갱신(새 데이터가 주입된 위젯으로 교체)하도록 변경해야 합니다. 위젯은 항상 "현재 상태"를 동기적으로 렌더링하는 순수 함수에 가까워야 합니다.

### ⚡ 심각도 중간 (Medium Priority)
메모리 누수, 동기화 이슈, 사용성 저하 등 개선이 권장되는 문제입니다.

**[src/editor/extensions/handlers/*.ts] 과도한 Regex 라인 스캔**
- **문제 설명:** `BlockRefHandler`, `WikiLinkHandler`, `CalloutHandler` 등이 `canHandle`에서 `false`를 반환하고, 외부 루프(아마도 `hybridRendering` 플러그인)에서 `processLine`을 호출하여 정규식으로 라인을 스캔하는 구조로 보입니다. 이는 문서가 커질수록 매 트랜잭션마다 전체 뷰포트 라인에 대해 정규식을 다시 실행하므로 비효율적입니다.
- **해결 방법:** CodeMirror의 [`MatchDecorator`](https://codemirror.net/docs/ref/#view.MatchDecorator)를 사용하세요. 변경된 범위에 대해서만 효율적으로 데코레이션을 갱신하도록 최적화되어 있습니다.

**[src/editor/extensions/handlers/CodeBlockHandler.ts:133] 코드 블록 편집 시 불필요한 리렌더링**
- **문제 설명:** 코드 블록 내부에 커서가 있을 때(`isInCodeBlock`) `createStyledText` 등을 매번 생성합니다. 사용자가 타이핑할 때마다 전체 코드 블록 데코레이션을 다시 계산하는 것은 입력 레이턴시를 증가시킬 수 있습니다.
- **해결 방법:** 커서 위치 변경과 문서 변경을 구분하여, 단순 커서 이동 시에는 데코레이션 갱신을 최소화하거나 CodeMirror의 기본 하이라이팅 시스템을 더 적극적으로 활용해야 합니다.

### 💡 기존 코드 개선 제안 (Code Improvements)

**1. Lezer 파서와 정규식 파서의 역할 명확화**
현재 구조는 Lezer AST(`syntaxTree`)와 정규식(`processLine`)이 혼재되어 있습니다. Obsidian 스타일 문법(Callout, BlockRef)도 가능하면 Lezer 확장을 작성하거나, `MarkdownExtension`을 통해 GFM 파서를 확장하는 것이 가장 성능이 좋습니다.

**Before (현재 패턴):**
```typescript
// HandlerRegistry 등을 통해 라인 단위 텍스트 스캔
static processLine(lineText: string, ...) {
  const match = regex.exec(lineText);
  // ...
}
```

**After (MatchDecorator 활용):**
```typescript
// ViewPlugin 내에서
const calloutDecorator = new MatchDecorator({
  regexp: /^>\s*\[!([a-z]+)\]/g,
  decoration: (match) => Decoration.mark({ class: "cm-callout-..." })
});
// ViewPlugin.fromClass로 등록하여 자동 관리
```

**2. Widget 비동기 로딩 패턴 개선**
위젯이 데이터를 스스로 가져오는 대신, "데이터가 준비되지 않은 상태"와 "준비된 상태"를 명확히 구분합니다.

**After:**
```typescript
class BlockRefPreviewWidget extends WidgetType {
  constructor(readonly id: string, readonly content: string | null) { super(); }
  
  toDOM() {
    const el = document.createElement("span");
    if (this.content === null) {
       el.className = "cm-loading";
       // ViewPlugin에 "이 ID의 데이터가 필요해"라고 요청(dispatch/signal)
       requestBlockLoad(this.id); 
    } else {
       el.textContent = this.content;
    }
    return el;
  }
}
```

### 🚀 새로운 기능 제안 (Feature Suggestions)

**1. 수식(Math/LaTeX) 지원**
- **설명:** `$E=mc^2$` 형태의 인라인 수식 및 `$$` 블록 수식 렌더링 지원. 개발자/과학 노트 앱에 필수적입니다.
- **난이도:** 보통 (CodeMirror용 `katex` 익스텐션 활용 가능)
- **예상 효과:** 기술적 문서 작성 능력 강화.

**2. 테이블(Tables) 편집 개선**
- **설명:** 현재 Markdown 테이블은 원시 텍스트로만 보일 가능성이 높습니다. GFM Table을 파싱하여 셀 단위로 정렬된 위젯으로 보여주는 기능.
- **난이도:** 어려움 (가변 너비 계산 및 DOM 구조 복잡)
- **예상 효과:** 데이터 정리 및 가독성 대폭 향상.

**3. 이미지 붙여넣기 및 드래그 앤 드롭**
- **설명:** 에디터에 이미지를 붙여넣거나 드래그했을 때 자동으로 로컬/서버에 저장하고 Markdown 링크 `![image](url)`를 삽입하는 핸들러.
- **난이도:** 쉬움 (CodeMirror `domEventHandlers` 활용)
- **예상 효과:** 사용자 경험(UX)의 획기적 개선.

# 청크 정보
청크 번호: 3/3
파일 목록:
- src/editor/extensions/handlers/BlockRefHandler.ts
- src/editor/extensions/handlers/CommentHandler.ts
- src/editor/extensions/handlers/TagHandler.ts
- src/editor/extensions/handlers/HandlerRegistry.ts
- src/editor/extensions/handlers/CalloutHandler.ts
- src/editor/extensions/handlers/SetextHeadingHandler.ts
- src/editor/extensions/handlers/types.ts
- src/editor/extensions/handlers/CodeBlockHandler.ts
- src/editor/extensions/handlers/BlockquoteHandler.ts
- src/editor/extensions/handlers/WikiLinkHandler.ts
- src/editor/extensions/handlers/TaskListHandler.ts
- src/editor/extensions/handlers/HeadingHandler.ts
- src/editor/extensions/handlers/EmphasisHandler.ts
- src/editor/extensions/handlers/StrongHandler.ts
- src/editor/extensions/handlers/HighlightHandler.ts
- src/editor/extensions/widgets/CheckboxWidget.ts
- src/markdown/parser.ts
