Loaded cached credentials.
제공해주신 에디터 엔진 코드를 심층 분석하였습니다.
이 프로젝트는 **React + CodeMirror 6**를 기반으로 한 **Outliner(블록 기반 에디터)** 구조를 가지고 있으며, Notion이나 Logseq과 유사한 UX를 제공하고 있습니다. CodeMirror의 ViewPlugin을 활용한 하이브리드 렌더링(Live Preview) 구현 방식은 매우 세련되었습니다.

하지만, 대규모 문서 처리 시 발생할 수 있는 **렌더링 병목**과 **CodeMirror 인스턴스 관리** 측면에서 몇 가지 중요한 개선점이 발견되었습니다.

아래는 **Editor Engine Engineer** 관점에서의 리뷰 리포트입니다.

---

## ✍️ 에디터 엔진 코드 리뷰

### ⚠️ 심각도 높음 (High Priority)

**[src/outliner/BlockEditor.tsx:75] 재귀적 렌더링에 의한 성능 병목 (DOM 폭발)**
현재 `BlockEditor`는 `blocksToShow.map`을 통해 `BlockComponent`를 렌더링하고, 각 `BlockComponent`는 다시 자식 블록들을 재귀적으로 렌더링합니다.
- **문제:** 문서 내 블록이 수천 개 이상(예: 2,000+ 블록)일 경우, 화면에 보이지 않는 블록까지 모두 DOM 노드로 생성합니다. 이는 초기 로딩 속도를 늦추고 브라우저 메모리 사용량을 급증시킵니다. 또한 각 블록마다 CodeMirror 인스턴스가 생성되므로 오버헤드가 큽니다.
- **해결 방법:** **가상화(Virtualization)** 도입이 필수적입니다.
  - `react-virtuoso` 또는 `react-window` 같은 라이브러리를 사용하여 현재 뷰포트에 보이는 블록만 렌더링하도록 변경해야 합니다.
  - Outliner 구조(계층형 데이터)를 평탄화(Flattening)하여 가상 리스트로 처리하고, `depth`에 따라 `padding-left`를 조절하는 방식으로 렌더링 구조를 변경하는 것이 일반적인 해결책입니다.

**[src/outliner/BlockComponent.tsx:288] 비동기 상태 불일치 가능성 (Race Condition)**
`Enter` 키 처리 로직에서 `commitDraft()`(비동기) 호출 직후 `createBlock()`을 호출합니다.
```typescript
if (cursor === contentLength) {
  commitDraft(); // await 하지 않음 (fire and forget 형태이나, 실행 순서 보장 안 됨)
  createBlock(blockId);
}
```
- **문제:** `commitDraft`는 `useBlockStore.getState().updateBlockContent`를 호출하여 전역 스토어를 업데이트합니다. 만약 네트워크 지연이나 스토어 업데이트 지연이 발생하면, `createBlock`이 실행되는 시점에 부모 블록의 상태가 최신이 아닐 수 있습니다. 특히 빠르게 엔터를 연타할 때 데이터 정합성이 깨질 수 있습니다.
- **해결 방법:** `commitDraft`가 완료된 후 블록 생성을 수행하거나, `await`를 사용하여 순서를 보장해야 합니다.
  ```typescript
  await commitDraft();
  createBlock(blockId);
  ```

### ⚡ 심각도 중간 (Medium Priority)

**[src/editor/extensions/hybridRendering.ts:511] 언마운트된 뷰에 대한 접근 위험**
`HybridRenderingViewPlugin`의 `onCompositionEnd` 메서드에서 `requestAnimationFrame`을 사용합니다.
- **문제:** 컴포지션이 끝난 직후 프레임이 실행되기 전에, 사용자가 페이지를 이동하여 EditorView가 파괴(destroy)된 경우 `this.view`에 접근하거나 `buildDecorations`를 실행하면 에러가 발생할 수 있습니다. 현재 `try-catch`로 감싸져 있으나, 근본적으로 뷰의 생존 여부를 체크하는 것이 안전합니다.
- **해결 방법:** 플러그인 내에 `destroyed` 플래그를 두거나 CodeMirror의 라이프사이클을 확인해야 합니다.

**[src/outliner/BlockComponent.tsx:69] 과도한 훅 사용 및 컴포넌트 비대화**
- **문제:** `BlockComponent` 하나에 UI 렌더링, 키보드 바인딩, IME 처리, Context Menu, 드래그 앤 드롭(추정), CodeMirror 설정이 모두 포함되어 450줄이 넘습니다. 이는 유지보수를 어렵게 하고 불필요한 리렌더링의 원인이 됩니다.
- **해결 방법:** 로직을 커스텀 훅으로 분리해야 합니다.
  - `useBlockEditorLogic`: CodeMirror 인스턴스 및 텍스트 변경 핸들링
  - `useBlockNavigation`: 키보드 네비게이션 처리
  - `useBlockIME`: IME 상태 관리 (`imeStateRef` 관련 로직)

### 💡 기존 코드 개선 제안 (Code Improvements)

**1. CodeMirror 인스턴스 지연 로딩 (Optimization)**
현재는 모든 블록이 렌더링되자마자 `Editor`(CodeMirror)를 초기화합니다. 수백 개의 CodeMirror 인스턴스가 동시에 생성되는 것은 무겁습니다.

**Before:**
```tsx
// BlockComponent.tsx
<Editor ref={editorRef} value={draft} ... />
```

**After:**
블록이 포커스되거나 마우스가 호버될 때만 CodeMirror를 활성화하고, 평소에는 단순 `div`로 렌더링하여 마크다운 파싱된 결과(HTML)만 보여주는 방식(Lightweight View)을 고려해볼 수 있습니다. 다만, `hybridRendering`이 이미 Live Preview 역할을 하고 있으므로, 가상화가 선행된다면 이 제안의 우선순위는 낮아집니다.

**2. Keyboard Handler 분리 (Refactoring)**
`keybindings` 배열 정의가 `BlockComponent` 내부에 있어 가독성이 떨어집니다.

**Before:**
```typescript
const keybindings = useMemo(() => [ ...긴 코드... ], [...deps]);
```

**After:**
```typescript
// src/outliner/handlers/keybindings.ts
export const getBlockKeybindings = (
  blockId: string,
  actions: BlockActions, // createBlock, indentBlock 등을 포함한 객체
  refs: BlockRefs // editorRef 등
) => {
  return [
    { key: "Enter", run: ... },
    { key: "Tab", run: ... }
  ];
};

// BlockComponent.tsx
const keybindings = useMemo(
  () => getBlockKeybindings(blockId, { createBlock, ... }, { editorRef }),
  [blockId, createBlock, ...]
);
```

### 🚀 새로운 기능 제안 (Feature Suggestions)

**1. 멀티 블록 선택 및 편집 (Multi-Selection)**
- **기능 설명:** Shift + Click 또는 드래그를 통해 여러 블록을 선택하고, 한 번에 들여쓰기/내어쓰기/삭제/이동하는 기능입니다.
- **구현 난이도:** 어려움 (High)
- **예상 효과:** 현재는 단일 블록 작업만 가능하여 대규모 문서 편집 시 사용성이 떨어집니다. 멀티 셀렉션은 Outliner의 핵심 UX입니다. `SelectionStore`를 신설하여 선택된 블록 ID들을 관리하고, 키보드 이벤트가 발생했을 때 선택된 블록들에 일괄 적용하는 로직이 필요합니다.

**2. 슬래시 커맨드 (Slash Commands)**
- **기능 설명:** 블록에서 `/`를 입력했을 때 팝업 메뉴가 뜨고 헤딩 변경, 할 일 목록 전환, 임베드 추가 등을 수행하는 기능입니다.
- **구현 난이도:** 보통 (Medium)
- **예상 효과:** 마크다운 문법을 모르는 사용자도 쉽게 서식을 지정할 수 있어 사용성을 크게 향상시킵니다. CodeMirror의 `Completion` 기능을 커스텀하거나 별도의 React Popover로 구현할 수 있습니다.

---

**총평:**
작성된 코드는 CodeMirror 6의 심층적인 기능(ViewPlugin, Decorator)을 매우 잘 활용하고 있으며, 특히 `hybridRendering.ts`에서 보여준 렌더링 최적화 전략(보이는 범위만 파싱)은 훌륭합니다. 다만, React 컴포넌트 레벨에서의 **리스트 가상화 부재**가 프로덕션 레벨에서의 성능 발목을 잡을 가능성이 가장 큽니다. 이 부분을 최우선으로 해결하시길 권장합니다.

# 청크 정보
청크 번호: 1/1
파일 목록:
- src/outliner/BlockComponent.tsx
- src/outliner/BlockEditor.tsx
- src/outliner/BlockRow.tsx
- src/outliner/MacroContentWrapper.tsx
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
