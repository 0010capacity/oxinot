# 단일 CodeMirror 전략 계획서

## 문제 개요

### 현재 구현
- **36개 블록 = 36개 CodeMirror 인스턴스**
- 각 블록마다 완전한 CodeMirror 에디터 생성
- 초기화 비용: 17ms/블록 × 36개 = 610ms
- 결과: 페이지 로드 시 사용자 경험 저하

### 병목 분석
```
[BlockEditor:timing] Rendering 36 blocks with .map()
↓ 딜레이 발생 (610ms)
[BlockEditor:timing] BlockComponent .map() rendered in 610.00ms
```

각 CodeMirror 초기화에 포함되는 비용:
1. `@lezer/markdown` 파서 초기화
2. Syntax highlighting
3. Keymaps 등록
4. Autocomplete (wiki links, block refs)
5. Hybrid rendering plugin
6. DOM 조작 (EditorView 생성)
7. Event listeners 설정

---

## Logseq의 접근 방식

### 아키텍처
```
┌──────────────────────────────────┐
│  단일 CodeMirror 인스턴스    │
│  (전체 페이지를 감쌈)         │
│                              │
│  ┌────┬────┬────┬────┬───┐  │
│  │블록1│블록2│블록3│... │  │
│  │     │     │     │    │  │
│  │ div │ div │ div │... │  │
│  └────┴────┴────┴────┴───┘  │
└──────────────────────────────────┘
```

### 포커스 핸들링
```typescript
// 읽기 모드 (isFocused=false)
- 모든 블록: 정적 HTML 렌더링
- 마크다운 파싱 → HTML 변환
- CSS 하이라이팅 적용
- 클릭 핸들러로 포커스 전환

// 편집 모드 (isFocused=true)
- 포커스된 블록만: CodeMirror 활성화
- 해당 블록의 위치로 스크롤
- CodeMirror로 에디팅 시작
```

---

## 제안 전략: 단일 CodeMirror + 포커스 기반 렌더링

### 기본 아이디어
1. **포커스되지 않은 블록**: 정적 HTML 렌더링
2. **포커스된 블록**: CodeMirror 에디터 활성화
3. **포커스 변경**: 정적 HTML ↔ CodeMirror 전환

### 아키텍처 다이어그램
```
BlockEditor
  │
  ├─ BlockComponent (블록 1)
  │   ├─ !isFocused → <StaticMarkdownRenderer />
  │   └─ isFocused → <Editor />
  │
  ├─ BlockComponent (블록 2)
  │   ├─ !isFocused → <StaticMarkdownRenderer />
  │   └─ isFocused → <Editor />
  │
  └─ BlockComponent (블록 3)
      ├─ !isFocused → <StaticMarkdownRenderer />
      └─ isFocused → <Editor />
```

---

## 구현 방법

### 1. StaticMarkdownRenderer 컴포넌트

**목적**: 읽기 모드에서 마크다운을 정적 HTML로 렌더링

**기술 스택**:
- `@lezer/markdown`: 마크다운 파싱
- `markdown-it`: HTML 변환 (이미 설치됨)

```typescript
// src/components/StaticMarkdownRenderer.tsx
interface StaticMarkdownRendererProps {
  content: string;
  onClick?: () => void;
  onWikiLinkClick?: (pageId: string) => void;
  onBlockRefClick?: (blockId: string) => void;
  // 커서 위치 전달 (포커스 전환 시)
  cursorOffset?: number;
}

export const StaticMarkdownRenderer: React.FC<StaticMarkdownRendererProps> = ({
  content,
  onClick,
  onWikiLinkClick,
  onBlockRefClick,
  cursorOffset,
}) => {
  const html = useMemo(() => {
    // markdown-it으로 마크다운 → HTML 변환
    const md = new MarkdownIt({
      html: true,
      linkify: true,
    });
    
    // 커스텀 syntax 플러그인 추가
    md.use(calloutSyntax);
    md.use(wikiLinkSyntax);
    md.use(blockRefSyntax);
    md.use(embedSyntax);
    
    return md.render(content);
  }, [content]);

  return (
    <div
      className="markdown-content"
      onClick={onClick}
      dangerouslySetInnerHTML={{ __html: html }}
      style={{
        minHeight: "24px",
        fontSize: "14px",
        cursor: "text",
        whiteSpace: "pre-wrap",
        wordBreak: "break-word",
        lineHeight: "1.5",
      }}
    />
  );
};
```

### 2. 커서 위치 일관성 보장 (⭐ 중요)

**문제**: 포커스 전환 시 느낌이 발생하지 않아야 함

**해결 방안**:

#### 방안 A: 클릭 이벤트로 커서 위치 전달
```typescript
// BlockComponent
const handleStaticClick = (e: React.MouseEvent) => {
  // 클릭된 위치 계산 (문자 offset)
  const clickTarget = e.target as HTMLElement;
  const textContent = clickTarget.textContent || "";
  
  // 클릭 위치에 가까운 문자 수로 커서 offset 계산
  let cursorOffset = 0;
  if (textContent) {
    const range = document.createRange();
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      range.setStart(clickTarget, 0);
      range.setEnd(selection.focusNode, selection.focusOffset);
      cursorOffset = range.toString().length;
    }
  }
  
  // 커서 위치 전달하면서 포커스 전환
  setFocusedBlock(blockId, cursorOffset);
};
```

#### 방안 B (미사용): 블록 전체에 data-cursor-offset 추가

> 이 방안은 렌더링 사이클 문제가 있어서 추천하지 않음

```typescript
// StaticMarkdownRenderer
<div
  className="markdown-content"
  data-cursor-offset={cursorOffset}  // ← 클릭된 위치 저장
  dangerouslySetInnerHTML={{ __html: html }}
/>

// BlockComponent
const handleClick = () => {
  const blockEl = blockComponentRef.current;
  const cursorOffset = parseInt(
    blockEl?.dataset.cursorOffset || "0"
  );
  
  setFocusedBlock(blockId, cursorOffset);
};
```

**문제점**:
- ❌ 렌더링 사이클: 클릭 → dataset 설정 → 렌더링 → dataset 읽기
- ❌ 복잡도: dataset 업데이트를 useEffect로 관리해야 함
- ❌ 정확도: dataset이 지워질 수 있음 (다른 클릭 발생 시)

#### 방안 C: 마우스 위치 기반 계산
```typescript
const handleClick = (e: React.MouseEvent) => {
  // 클릭 위치 기반으로 가장 가까운 텍스트 위치 계산
  const rect = blockComponentRef.current?.getBoundingClientRect();
  if (!rect) return;
  
  const clickX = e.clientX - rect.left;
  const clickY = e.clientY - rect.top;
  
  // 텍스트 길이와 폰트/줄간격으로 커서 위치 추정
  const estimatedOffset = estimateCursorOffset(
    blockContent,
    clickX,
    clickY
  );
  
  setFocusedBlock(blockId, estimatedOffset);
};
```

**추천**: **방안 A (클릭 이벤트로 커서 위치 전달)** 사용

이유:
- ✅ **렌더링 사이클 문제 없음**: 즉시 계산해서 전달
- ✅ **부작용 방지**: selection이 이미 있으면 그걸 그대로 사용
- ✅ **코드 간단**: setFocusedBlock에 바로 전달, dataset 관리 복잡도 없음
- ✅ **더 정확**: 클릭된 시점에서 바로 계산, dataset이 지워질 위험 없음
- ✅ **롤백 용이**: 문제 발생 시 기존 방식으로 쉬게 복귀

**방안 B의 문제**:
- ❌ 렌더링 사이클 발생: dataset 업데이트를 위해 StaticMarkdownRenderer 재렌더링 필요
- ❌ 정확도 낮음: dataset이 다른 클릭으로 지워질 수 있음
- ❌ 복잡도 높음: useEffect로 dataset 상태 관리 필요

따라서 **방안 A를 강력히 추천합니다**.
- ✅ CodeMirror의 cursorOffset API와 호환

**구현 시점**: Phase 2 (BlockComponent 수정)에서 적용

### 2. 마크다운 Syntax 플러그인

**목적**: 커스텀 문법 (wiki link, block ref, embed, callout) 지원

```typescript
// src/utils/markdownSyntaxPlugins.ts

// Wiki Link [[page]]
export const wikiLinkSyntax: MarkdownIt.PluginSimple = (md) => {
  md.inline.ruler.push({
    name: "wiki_link",
    level: 0,
    start: (src) => src.indexOf("[["),
    tokenizer: (src, tokens) => {
      const match = src.match(/\[\[(.+?)\]\]/);
      if (match) {
        tokens.push({
          type: "wiki_link_open",
          nesting: 1,
          markup: match[0],
        });
      }
    },
  });
};

// Block Reference ((block_id))
export const blockRefSyntax: MarkdownIt.PluginSimple = (md) => {
  md.inline.ruler.push({
    name: "block_ref",
    level: 0,
    tokenizer: (src, tokens) => {
      const match = src.match(/\(\((.+?)\)\)/);
      if (match) {
        tokens.push({
          type: "block_ref_open",
          nesting: 1,
          markup: match[0],
        });
      }
    },
  });
};
```

### 3. BlockComponent 수정

**변경 내용**: 포커스 상태에 따라 조건부 렌더링

```typescript
// src/outliner/BlockComponent.tsx

export const BlockComponent: React.FC<BlockComponentProps> = memo(
  ({ blockId, depth, blockOrder = [] }: BlockComponentProps) => {
    // ... 기존 selector 호출들 ...
    
    const isFocused = useIsBlockFocused(blockId);

    return (
      <div className="block-component">
        {/* 포커스 상태에 따라 다른 렌더러 사용 */}
        {isFocused ? (
          <Editor
            ref={editorRef}
            value={draft}
            onChange={handleContentChangeWithTrigger}
            // ... 기존 Editor props ...
          />
        ) : (
          <StaticMarkdownRenderer
            content={blockContent || ""}
            onClick={() => setFocusedBlock(blockId)}
            onWikiLinkClick={handleWikiLinkClick}
            onBlockRefClick={handleBlockRefClick}
          />
        )}
        
        {/* 나머지 UI 요소들 (bullet, collapse toggle, etc.) */}
        {/* ... 기존 코드 ... */}
      </div>
    );
  }
);
```

### 4. 스타일 일관성 보장

**목적**: CodeMirror와 정적 HTML이 동일하게 보이도록 CSS 재사용

```css
/* src/styles/markdown.css */

/* CodeMirror의 하이라이팅 스타일 재사용 */
.wiki-link {
  color: var(--color-accent);
  text-decoration: none;
  cursor: pointer;
}

.wiki-link:hover {
  text-decoration: underline;
}

.block-ref {
  color: var(--color-text-secondary);
  cursor: pointer;
}

.callout {
  border-left: 3px solid;
  padding-left: 12px;
  margin: 8px 0;
  border-radius: var(--radius-sm);
}

.callout-note {
  border-color: var(--color-info);
  background-color: var(--color-info-bg);
}

.callout-tip {
  border-color: var(--color-success);
  background-color: var(--color-success-bg);
}

/* 하이라이팅 */
.cm-strong {
  font-weight: bold;
}

.cm-emphasis {
  font-style: italic;
}

.cm-inline-code {
  background-color: var(--color-bg-tertiary);
  padding: 2px 4px;
  border-radius: 2px;
  font-family: var(--font-family-mono);
}
```

---

### 3. BlockComponent 수정

**변경 내용**: 포커스 상태에 따라 조건부 렌더링

```typescript
// src/outliner/BlockComponent.tsx

export const BlockComponent: React.FC<BlockComponentProps> = memo(
  ({ blockId, depth, blockOrder = [] }: BlockComponentProps) => {
    // ... 기존 selector 호출들 ...
    
    const isFocused = useIsBlockFocused(blockId);

    // 포커스 전환 시 커서 위치 보장
    const handleStaticClick = useCallback((e: React.MouseEvent) => {
      // 클릭된 위치 계산
      const target = e.target as HTMLElement;
      const textContent = target.textContent || "";
      
      // 클릭 위치에 가까운 문자 offset 계산
      let cursorOffset = 0;
      if (textContent) {
        const selection = window.getSelection();
        if (selection && selection.rangeCount > 0) {
          const range = document.createRange();
          range.setStart(target, 0);
          range.setEnd(selection.focusNode, selection.focusOffset);
          cursorOffset = range.toString().length;
        }
      }
      
      // 커서 위치 전달하면서 포커스 전환
      setFocusedBlock(blockId, cursorOffset);
    }, [blockId, setFocusedBlock]);

    return (
      <div className="block-component">
        {/* 포커스 상태에 따라 다른 렌더러 사용 */}
        {isFocused ? (
          <Editor
            ref={editorRef}
            value={draft}
            onChange={handleContentChangeWithTrigger}
            // ... 기존 Editor props ...
          />
        ) : (
          <StaticMarkdownRenderer
            content={blockContent || ""}
            onClick={handleStaticClick}
            onWikiLinkClick={handleWikiLinkClick}
            onBlockRefClick={handleBlockRefClick}
          />
        )}
        
        {/* 나머지 UI 요소들 (bullet, collapse toggle, etc.) */}
        {/* ... 기존 코드 ... */}
      </div>
    );
  }
);
```

## 기대 효과

### 성능 개선
| 메트릭 | 현재 | 개선 후 | 개선율 |
|--------|--------|-----------|---------|
| 초기 렌더링 시간 | 610ms | ~50ms | **12배** |
| CodeMirror 인스턴스 수 | 36개 | 1개 | 97% 감소 |
| 메모리 사용 | 높음 | 낮음 | 크게 감소 |
| 페이지 전환 체감 | 느림 | 즉시 | ✅ |

### 렌더링 흐름
```
[페이지 클릭] 
→ 데이터 로드 (2ms)
→ BlockEditor 마운트
→ 36개 StaticMarkdownRenderer 렌더링 (~50ms)
→ 사용자가 블록 클릭 (특정 위치 클릭)
→ 클릭 위치 기반으로 커서 offset 계산
→ 해당 블록: StaticMarkdownRenderer → Editor 전환
→ CodeMirror 초기화 (1개만, ~17ms) + 커서 위치 설정
→ 결과: 클릭된 위치에 커서가 정확히 위치 ⭐
```

---

## 장단점

### 장점
✅ **성능**: 초기 렌더링 12배 빨라짐  
✅ **메모리**: CodeMirror 인스턴스 97% 감소  
✅ **사용자 경험**: 페이지 전환 즉시  
✅ **배터리**: 낮은 메모리 = 낮은 배터리 소모  
✅ **CSS 일관성**: CodeMirror와 정적 HTML이 동일하게 보임  
✅ **커스텀 문법**: wiki link, block ref, embed 지원  
✅ **커서 위치 일관성**: 포커스 전환 시 깜빡임 없음 ⭐  

### 단점
⚠️ **구현 복잡도**: 두 가지 렌더러 유지  
⚠️ **마크다운 파싱 중복**: CodeMirror와 markdown-it 두 번 파싱  
⚠️ **하이라이팅 차이 가능**: 완전히 일치하지 않을 수 있음  
⚠️ **커서 위치 정확도**: 클릭 위치 추정은 완벽하지 않을 수 있음 (edge case)  

---

## 구현 순서

### Phase 1: 기반 구축 (1-2일)
1. ✅ `StaticMarkdownRenderer` 컴포넌트 생성
2. ✅ 커스텀 마크다운 syntax 플러그인 구현
3. ✅ CSS 스타일 정의 및 통합

### Phase 2: 통합 (1일)
4. ✅ `BlockComponent` 수정 (조건부 렌더링)
5. ✅ 클릭 핸들러 연결
6. ✅ 테스트 및 디버깅

### Phase 2.5: 깜빡임 방지 전략 (0.5일 추가)
7. ✅ StaticMarkdownRenderer 최소 높이 보장 (24px)
8. ✅ Editor 초기화 전에 레이아웃 적용
9. ✅ 포커스 전환 시 transition 최소화

### Phase 3: 최적화 (1일)
10. ✅ 포커스 전환 애니메이션 추가
11. ✅ 렌더링 로그 추가
12. ✅ 성능 측정 및 튜닝

### Phase 3.5: IME/빈 블록 처리 (0.5일 추가)
13. ✅ IME 조합 중 포커스 전환 방지
14. ✅ 빈 블록 placeholder 처리
15. ✅ IME 조합 완료 후 커서 위치 보장

### Phase 2.5: 깜빡임 방지 전략 (0.5일 추가)
7. ✅ StaticMarkdownRenderer 최소 높이 보장 (24px)
8. ✅ Editor 초기화 전에 레이아웃 적용
9. ✅ 포커스 전환 시 transition 최소화

### Phase 3.5: IME/빈 블록 처리 (0.5일 추가)
13. ✅ IME 조합 중 포커스 전환 방지
14. ✅ 빈 블록 placeholder 처리
15. ✅ IME 조합 완료 후 커서 위치 보장

### Phase 4: 검증 (1일)
16. ✅ 다양한 마크다운 문법 테스트
17. ✅ 경계 케이스 테스트 (빈 블록, 긴 텍스트 등)
18. ✅ 사용자 경험 테스트

### Phase 4.5: Undo/Redo 통합 (1일 추가)
19. ✅ 블록별 history 관리
20. ✅ Editor와 StaticMarkdownRenderer 사이의 Undo 동기화
21. ✅ history 키보드 핸들러 구현

### Phase 5: 성능 측정 및 모니터링 (추가)
22. ✅ 성공 기준 정의 (초기 렌더링 100ms 미만)
23. ✅ 렌더링 시간 측정 로그 추가
24. ✅ 사용자 경험 테스트 스위트 구축

### Phase 4.5: Undo/Redo 통합 (1일 추가)
19. ✅ 블록별 history 관리
20. ✅ Editor와 StaticMarkdownRenderer 사이의 Undo 동기화
21. ✅ history 키보드 핸들러 구현

### Phase 5: 성능 측정 및 모니터링 (추가)
22. ✅ 성공 기준 정의 (초기 렌더링 100ms 미만)
23. ✅ 렌더링 시간 측정 로그 추가
24. ✅ 사용자 경험 테스트 스위트 구축

---

## 위험성 평가

### 낮은 위험 (해결 가능)
- **마크다운 파싱 차이**: 정밀한 테스트로 해결
- **클릭 핸들러 구현**: event delegation으로 간단하게 해결

### 중간 위험 (주의 필요)
- **두 렌더러 유지 비용**: 장점이 크므로 수용 가능
- **하이라이팅 불일치**: CodeMirror 스타일을 CSS로 복사하면 해결

### 높은 위험 (없음)
- ✅ 기술적 난이도: 보통
- ✅ 기존 코드와의 호환성: 높음
- ✅ 롤백 가능성: 쉬움 (isFocused 플래그로 조절)

---

## 결론

단일 CodeMirror 전략은 **가장 효과적이고 현실적인 해결책**입니다:

1. **Logseq 방식과 동일한 아키텍처**로 검증됨
2. **성능 개선 12배**로 사용자 경험 크게 향상
3. **구현 난이도 중간**, 4-5일 내 완료 가능
4. **롤백 쉬움**, 문제 발생 시 기존 방식으로 복귀 가능

**추천**: 즉시 Phase 1부터 구현 시작.