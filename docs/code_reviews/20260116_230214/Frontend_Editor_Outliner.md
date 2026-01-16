Loaded cached credentials.
## ✍️ 에디터 엔진 코드 리뷰

### ⚠️ 심각도 높음 (High Priority)

**[src/editor/extensions/handlers/BlockRefHandler.ts:167] 과도한 IPC 호출로 인한 성능 저하 및 병목 현상**
`BlockRefPreviewWidget` 클래스의 `toDOM` 메서드(및 내부 IIFE)에서 위젯이 렌더링될 때마다 `invoke("get_block", ...)`을 호출하여 백엔드(Rust)와 통신하고 있습니다.
CodeMirror는 스크롤이나 편집 시 위젯을 빈번하게 생성하고 파괴합니다. 만약 문서에 블록 참조가 수십 개 이상 포함되어 있다면, 에디터 로딩이나 스크롤 시 순간적으로 수백 번의 IPC 호출이 발생하여 UI 프리징이나 백엔드 부하를 일으킬 수 있습니다.

**해결 방법:**
1.  **배치 처리 및 캐싱:** 개별 위젯이 데이터를 직접 요청하는 대신, 화면에 보이는 Block Ref ID들을 수집하여 한 번에 요청(Batching)하거나, React Context/Zustand Store 레벨에서 캐싱된 데이터를 구독하도록 구조를 변경해야 합니다.
2.  **데이터 주입:** 위젯 생성 시점에 데이터를 비동기로 가져오는 대신, CodeMirror의 `StateField`를 사용하여 참조된 블록의 데이터를 미리 계산해두고 위젯에는 결과값만 전달하는 방식이 더 안전합니다.

---

### ⚡ 심각도 중간 (Medium Priority)

**[src/outliner/BlockEditor.tsx:77] 대량 블록 렌더링 시 가상화(Virtualization) 부재**
`blocksToShow.map(...)`을 통해 모든 블록을 직접 렌더링하고 있습니다. `BlockComponent`는 내부에 CodeMirror 인스턴스를 포함하는 무거운 컴포넌트입니다. 블록이 수백 개 이상 늘어날 경우 초기 로딩 속도가 느려지고 DOM 노드 과다로 인한 메모리 사용량이 급증합니다.

**해결 방법:**
`react-virtuoso`나 `react-window` 같은 가상화 라이브러리를 도입하여 뷰포트에 보이는 블록만 렌더링하고, 스크롤에 따라 동적으로 마운트/언마운트 하도록 개선해야 합니다.

**[src/outliner/BlockComponent.tsx:189] React State와 CodeMirror 간의 데이터 경합 가능성 (Race Condition)**
`draft` 상태(State)와 `draftRef`를 사용하여 로컬 편집 상태를 관리하고 `commitDraft`로 스토어에 동기화하는 "Local Draft" 패턴을 사용 중입니다. 이 방식은 IME 입력 시 안전성을 위해 좋지만, 네트워크 지연이나 외부 변경 사항(협업 등)이 발생했을 때 `useEffect` 내의 조건문(`if (focusedBlockId !== blockId...)`)이 외부 업데이트를 무시하거나 덮어쓸 위험이 있습니다.

**해결 방법:**
블록이 포커스된 상태에서도 외부에서 들어온 치명적인 변경사항(예: 다른 세션에서의 삭제)을 감지하고 사용자에게 알리거나 병합하는 로직(Conflict Resolution)이 추가되어야 합니다.

**[src/editor/extensions/hybridRendering.ts:186] 매 업데이트마다 Decoration 객체 재생성**
`buildDecorations` 함수가 `update` 될 때마다 호출되며, `syntaxTree`를 순회하고 모든 핸들러를 실행하여 `RangeSetBuilder`를 새로 만듭니다. 이는 타이핑 지연(Latency)의 원인이 될 수 있습니다.

**해결 방법:**
CodeMirror의 `RangeSet`은 불변 데이터 구조이므로, 변경된 범위(Range)에 대해서만 데코레이션을 다시 계산하고 나머지는 재사용하는 증분 업데이트(Incremental Update) 로직을 적용하거나, `syntaxTree`가 변경되지 않았다면 계산을 건너뛰는 최적화가 필요합니다.

---

### 💡 기존 코드 개선 제안 (Code Improvements)

**1. Keybinding 정의 메모이제이션 최적화**
`BlockComponent` 내에서 `keybindings` 배열이 많은 의존성을 가지고 `useMemo`로 생성됩니다. 이는 블록이 많을 때 리렌더링 비용을 증가시킵니다.

**Before:**
```typescript
// src/outliner/BlockComponent.tsx
const keybindings: KeyBinding[] = useMemo(() => {
  return [
    { key: "Enter", run: ... }, // 긴 로직 포함
    // ...
  ];
}, [blockId, createBlock, ...]); // 많은 의존성
```

**After:**
키 바인딩 로직을 별도 파일(`blockCommandHandlers.ts`)로 분리하고, 컴포넌트에서는 커링(Currying)된 함수나 안정적인 핸들러 참조만 넘겨주도록 리팩토링합니다.

```typescript
// src/outliner/blockKeybindings.ts (확장)
export const getBlockKeybindings = (blockId: string, actions: BlockActions): KeyBinding[] => [
  {
    key: "Enter",
    run: (view) => handleEnterKey(view, blockId, actions)
  },
  // ...
];

// src/outliner/BlockComponent.tsx
const actions = useBlockActions(blockId); // stable object
const keybindings = useMemo(() => getBlockKeybindings(blockId, actions), [blockId, actions]);
```

**2. 하이브리드 렌더링 테마 상수화**
CSS-in-JS 스타일 문자열이 `src/editor/extensions/theme/styles.ts`에 정의되어 있지만, `handleNode` 내부에서 객체를 매번 생성하는 경우가 있습니다.

**Before:**
```typescript
// src/editor/extensions/handlers/HeadingHandler.ts
decorations.push(
  createStyledText(markerEnd, line.to, {
    className: `cm-heading-text cm-heading-${level}`,
    style: `${getHeadingStyle(level)}; text-decoration: none !important; ...`,
  }),
);
```

**After:**
`EditorView.theme`을 활용하여 정적 클래스로 스타일을 최대한 위임하고, 인라인 스타일(`style` 속성) 사용을 최소화하여 DOM 크기를 줄입니다.

---

### 🚀 새로운 기능 제안 (Feature Suggestions)

현재 구조를 분석했을 때 다음 기능들이 사용자 경험을 크게 향상시킬 수 있습니다.

**1. 슬래시 커맨드 (Slash Commands)**
*   **기능 설명:** `/`를 입력했을 때 팝오버 메뉴가 뜨고, H1/H2/할 일 목록/인용구 등으로 블록 타입을 즉시 변경하거나 임베드를 삽입하는 기능.
*   **구현 난이도:** 보통 (CodeMirror의 Autocomplete Extension 활용 가능)
*   **예상 효과:** 마우스 없이 키보드만으로 빠른 포맷팅이 가능해져 편집 속도 향상.

**2. 블록 다중 선택 및 드래그 (Block Multi-select & Drag)**
*   **기능 설명:** `Shift + Up/Down` 또는 마우스 드래그로 여러 블록을 선택하고, 한꺼번에 이동(Alt + Up/Down)하거나 들여쓰기하는 기능.
*   **구현 난이도:** 어려움 (CodeMirror 인스턴스 간의 선택 상태 공유 및 통합된 Selection Model 필요)
*   **예상 효과:** 아웃라이너 에디터의 핵심 사용성인 '구조 편집' 능력이 대폭 강화됨.

**3. 백링크(Backlink) 카운트 및 인라인 표시**
*   **기능 설명:** 블록 우측이나 하단에 해당 블록을 참조하는 다른 블록의 개수를 표시하고 클릭 시 이동.
*   **구현 난이도:** 보통 (이미 `get_block` IPC가 있으므로 역참조 쿼리 추가 필요)
*   **예상 효과:** 지식 관리(PKM) 도구로서의 연결성 강화.

# 청크 정보
청크 번호: 1/1
파일 목록:
- src/outliner/BlockComponent.tsx
- src/outliner/BlockEditor.tsx
- src/outliner/BlockRow.tsx
- src/outliner/blockKeybindings.ts
- src/outliner/debug.ts
- src/outliner/blockConversion.ts
- src/outliner/useComposition.ts
- src/outliner/types.ts
- src/outliner/blockUtils.ts
- src/outliner/constants.ts
- src/outliner/markdownRenderer.ts
- src/outliner/BlockComponent.css
- src/outliner/BlockEditor.css
- src/editor/createEditor.ts
- src/editor/extensions/utils/decorationHelpers.ts
- src/editor/extensions/utils/nodeHelpers.ts
- src/editor/extensions/theme/styles.ts
- src/editor/extensions/hybridRendering.ts
- src/editor/extensions/handlers/InlineCodeHandler.ts
- src/editor/extensions/handlers/LinkHandler.ts
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
