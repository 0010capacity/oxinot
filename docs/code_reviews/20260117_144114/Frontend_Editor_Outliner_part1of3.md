Loaded cached credentials.
## ✍️ 에디터 엔진 코드 리뷰

### ⚠️ 심각도 높음 (High Priority)

**1. [src/outliner/BlockEditor.tsx:112] 대량 블록 렌더링 시 성능 저하 (가상화 부재)**
- **문제 설명:** `blocksToShow.map(...)`을 통해 모든 블록을 즉시 렌더링하고 있습니다. 루트 레벨에 블록이 수백/수천 개가 되거나, 모든 노드를 펼쳤을 때 DOM 노드 개수가 급증하여 초기 로딩 속도와 스크롤 성능이 심각하게 저하됩니다. 에디터가 느려지는 가장 주된 원인이 될 것입니다.
- **해결 방법:** `react-window` 또는 `virtua` 같은 가상화(Virtualization) 라이브러리를 도입하여 현재 뷰포트에 보이는 블록만 렌더링하도록 구조를 변경해야 합니다. Outliner 구조상 높이가 가변적이므로 가변 높이를 지원하는 가상화 전략이 필수적입니다.

**2. [src/outliner/BlockComponent.tsx:216-297] IME(한글) 입력과 블록 생성 간의 충돌 위험**
- **문제 설명:** `handleKeyDown` 내부에서 `Enter` 키 입력 시 `isImeRelated` 상태를 확인하고 `createBlock`이나 `splitBlockAtCursor`를 호출합니다. 한글 입력 중 `Enter`는 "조합 완료(Composition End)"를 의미하는 경우가 많은데, 이 로직은 조합 완료와 동시에 "블록 분할"을 수행해버릴 위험이 있습니다. 이로 인해 마지막 글자가 누락되거나 의도치 않은 줄바꿈이 발생할 수 있습니다.
- **해결 방법:** `compositionend` 이벤트가 발생한 직후의 `Enter` 키 이벤트를 무시하거나, `isComposing` 상태일 때는 `Enter` 동작을 막고 조합만 완료시키도록 명확한 분기 처리가 필요합니다. 현재 로직은 `preventDefault`를 호출하므로 조합 완료 동작까지 막힐 수 있는지 브라우저별(Chrome/Safari) 크로스 체크가 필요합니다.

### ⚡ 심각도 중간 (Medium Priority)

**1. [src/outliner/BlockComponent.tsx:437] 키 바인딩 로직의 중복 및 파편화**
- **문제 설명:** `BlockComponent.tsx` 내부의 `keybindings` useMemo 정의와 `src/outliner/blockKeybindings.ts` 파일이 별도로 존재합니다. 코드를 보면 `BlockComponent`는 내부 정의된 `keybindings`를 우선 사용하는 것으로 보이나, 로직이 두 곳으로 분산되어 있어 유지보수 시 한쪽만 수정될 경우 동작 불일치가 발생할 수 있습니다.
- **해결 방법:** `BlockComponent.tsx` 내부의 키 바인딩 로직을 `blockKeybindings.ts`로 완전히 위임하거나, 커스텀 훅(`useBlockKeybindings`)으로 추출하여 단일 진실 공급원(Single Source of Truth)을 유지하세요.

**2. [src/outliner/BlockComponent.tsx:206] 복잡한 useEffect와 상태 관리 (God Component)**
- **문제 설명:** 하나의 `useEffect` 안에서 IME 상태 추적, `compositionstart/end`, `beforeinput`, `keydown` 이벤트를 모두 처리하고 있습니다. 코드가 길고 복잡하여 버그 발생 시 추적이 어렵고 가독성이 떨어집니다.
- **해결 방법:** IME 및 입력 처리 로직을 `useBlockInputHandler`와 같은 별도 커스텀 훅으로 분리하여 `BlockComponent`의 복잡도를 낮추세요.

**3. [src/outliner/BlockComponent.tsx:325] Blur 시 비동기 커밋의 안정성**
- **문제 설명:** `handleBlur`에서 `await commitDraft()`를 호출합니다. 사용자가 빠르게 페이지를 이동하여 컴포넌트가 Unmount 된 상태에서 비동기 작업이 완료되면, 메모리 누수 경고나 상태 업데이트 오류가 발생할 수 있습니다.
- **해결 방법:** `commitDraft` 내부 혹은 `handleBlur`에서 컴포넌트의 Mount 상태를 체크(Ref 사용)하거나, 페이지 이동 시 강제로 `flush` 하는 메커니즘을 `PageContainer` 레벨에서 보장해야 합니다.

### 💡 기존 코드 개선 제안 (Code Improvements)

**1. 컴포넌트 구조 분리 (Refactoring)**
`BlockComponent`가 너무 많은 역할을 하고 있습니다 (렌더링, 입력 처리, 상태 동기화, 컨텍스트 메뉴).

*Before:*
```tsx
// src/outliner/BlockComponent.tsx
export const BlockComponent = memo(({ blockId }) => {
  // ... 500 lines of mixed logic
  // IME handling
  // Keybindings
  // Context Menu
  // Render
});
```

*After:*
```tsx
// Logic and UI separation
export const BlockComponent = memo(({ blockId }) => {
  const { draft, handlers, editorRef } = useBlockEditor(blockId); // Hook for logic
  
  return (
    <BlockContextMenu blockId={blockId}> 
      <div className="block-row">
        <BlockControl />
        <BlockInput 
           value={draft} 
           {...handlers} 
        />
      </div>
    </BlockContextMenu>
  );
});
```

**2. CSS `overflow: visible` 주의**
`BlockComponent.css`에서 `overflow: visible`을 사용하고 있습니다. 이는 CodeMirror 툴팁 등을 위한 것으로 보이나, 중첩된 블록 구조에서 예상치 못한 레이아웃 겹침이나 스크롤바 이슈를 만들 수 있습니다. `Portal`을 사용하여 툴팁을 body 레벨로 렌더링하는 것이 더 안전한 방법입니다.

### 🚀 새로운 기능 제안 (Feature Suggestions)

**1. 드래그 앤 드롭 (Drag and Drop) 재정렬**
- **기능 설명:** 블록의 불렛 포인트를 잡고 드래그하여 순서를 변경하거나 다른 블록의 자식으로 이동시키는 기능.
- **구현 난이도:** 어려움 (트리 구조 계산 및 Drop Zone 시각화 필요)
- **예상 효과:** 아웃라이너 에디터의 핵심 UX입니다. 키보드만으로는 대규모 구조 변경이 어렵기 때문에 마우스 조작 효율성을 극대화할 수 있습니다. `dnd-kit` 라이브러리 활용을 권장합니다.

**2. 슬래시 커맨드 (Slash Commands) 메뉴**
- **기능 설명:** `/` 키 입력 시 팝오버 메뉴를 띄워 블록 타입 변경(제목, 할 일, 코드 블록 등)을 지원.
- **구현 난이도:** 보통
- **예상 효과:** 사용자가 마우스 없이 다양한 포맷을 빠르게 적용할 수 있어 편집 속도가 향상됩니다. 현재 `::`로 메타데이터 메뉴를 여는 것과 유사한 패턴으로 구현 가능합니다.

**3. 다중 블록 선택 (Multi-select)**
- **기능 설명:** `Shift + Arrow` 또는 드래그로 여러 블록을 동시에 선택하여 일괄 삭제, 들여쓰기, 이동.
- **구현 난이도:** 어려움 (CodeMirror의 선택 영역과 블록 단위 선택 영역 간의 상태 동기화 필요)
- **예상 효과:** 편집 경험을 네이티브 텍스트 에디터 수준으로 끌어올립니다.

# 청크 정보
청크 번호: 1/3
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
