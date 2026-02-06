# 블록 렌더링 딜레이 성능 분석

## 문제 개요

페이지 클릭 시 약 1초의 렌더링 딜레이 발생. 36개 블록이 있는 페이지를 열 때 성능 문제가 관찰됨.

## 로그 분석

### 묶음 1: 클릭 직후
```
[PageTreeItem:timing] Click started for page {pageId}
[blockStore:timing] Page load started
[blockStore cache] Cache hit - Hit rate: 80.0%
[blockStore] Cache hit: Using cached blocks
[blockStore:timing] Cache hit complete: normalize=0.00ms, setState=0.00ms, total=0.00ms
[PageTreeItem:timing] CLICK HANDLER COMPLETE: select=0.00ms, load=0.00ms, open=0.00ms, total=0.00ms
[BlockEditor:timing] Rendering 36 blocks with .map()
```

### 묶음 2: 1초 정적 후
```
[BlockEditor:timing] Component rendering started for page {pageId}
[blockStore:timing] Page load started (다시 호출됨)
[blockStore cache] Cache hit - Hit rate: 81.8%
[blockStore] Cache hit: Using cached blocks
[blockStore:timing] Cache hit complete: normalize=0.00ms, setState=1.00ms, total=1.00ms
[BlockEditor:timing] BlockComponent .map() rendered in 657.00ms  // 핵심 병목
[BlockEditor:timing] Component render completed in 103.00ms
```

## 핵심 발견 사항

### 1. openPage 중복 호출
- 첫 번째 호출: PageTreeItem의 handlePageClick에서 loadPage 실행
- 두 번째 호출: BlockEditor의 useEffect에서 openPage 실행
- 결과: React 렌더링 사이클이 두 번 발생

### 2. 1초 정적의 원인
- openNote가 viewStore.mode를 변경하여 BlockEditor 마운트
- BlockEditor의 useEffect가 다시 openPage 호출
- 두 번의 상태 업데이트 사이에 딜레이 발생

### 3. 657ms 렌더링 시간의 원인
- 36개 BlockComponent 각각이 5개의 selector 호출
- Selector가 shallow comparison을 사용하지 않아 불필요한 리렌더링 유발
- CodeMirror 인스턴스 초기화 오버헤드

## 원인 분석

### 원인 1: Selector 최적화 부족 (우선순위: 높음)

**문제 코드**
```typescript
// src/stores/blockStore.ts
export const useBlock = (id: string) =>
  useBlockStore((state) => state.blocksById[id]);

export const useBlockContent = (id: string) =>
  useBlockStore((state) => state.blocksById[id]?.content);

export const useBlockMetadata = (id: string) =>
  useBlockStore((state) => state.blocksById[id]?.metadata);
```

**영향**
- 각 selector가 객체를 반환할 때마다 새 참조 생성
- 36개 블록 × 3개 객체 selector = 108개의 불필요한 리렌더링 가능성

### 원인 2: openPage 중복 호출 (우선순위: 높음)

**문제 코드**
```typescript
// src/components/fileTree/PageTreeItem.tsx
const handlePageClick = async (e: React.MouseEvent) => {
  await selectPage(page.id);
  await loadPage(page.id);  // 첫 번째 호출
  openNote(page.id, page.title, parentNames, pagePathIds);  // viewStore.mode 변경
};

// src/outliner/BlockEditor.tsx
useEffect(() => {
  if (pageId) {
    openPage(pageId);  // 두 번째 호출
  }
}, [pageId, openPage]);
```

**영향**
- 첫 호출로 데이터 로드 완료
- openNote로 viewStore.mode 변경 → BlockEditor 마운트
- BlockEditor의 useEffect에서 다시 openPage 호출 → 불필요한 연산

### 원인 3: React 렌더링 사이클 두 번 (우선순위: 높음)

**실행 순서**
```
클릭 → loadPage → blockStore 상태 변경 → 렌더링 1 (FileTreeIndex)
                ↓
            openNote → viewStore.mode 변경 → 렌더링 2 (BlockEditor 마운트)
                                          ↓
                                  BlockEditor의 useEffect → 다시 openPage → 렌더링 3
```

**영향**
- 두 번의 상태 업데이트 사이에 batching이 발생하지 않음
- 렌더링 사이클 사이에서 1초 정적 발생

### 원인 4: CodeMirror 초기화 오버헤드 (우선순위: 중간)

**문제**
- 36개의 BlockComponent 각각이 CodeMirror 인스턴스 생성
- 각 인스턴스 초기화는 DOM 구조와 이벤트 핸들러 설정 필요
- 초기화 과정에서 상당한 오버헤드 발생

### 원인 5: memo 효과성 부족 (우선순위: 낮음)

**문제 코드**
```typescript
export const BlockComponent: React.FC<BlockComponentProps> = memo(
  ({ blockId, depth, blockOrder = [] }: BlockComponentProps) => {
    // ...
  }
);
```

**영향**
- blockOrder가 매번 새 배열로 생성됨
- useBlockStore selector들이 새 객체를 반환하면 memo 무효화
- 36개 블록이 전부 리렌더링됨

## 해결 방안

### 해결책 1: Selector에 shallow comparison 추가

**대상 파일**
- `src/stores/blockStore.ts`

**변경 내용**
```typescript
import { shallow } from "zustand/shallow";

export const useBlock = (id: string) =>
  useBlockStore(
    (state) => state.blocksById[id],
    shallow,
  );

export const useBlockContent = (id: string) =>
  useBlockStore(
    (state) => state.blocksById[id]?.content,
    shallow,
  );

export const useBlockMetadata = (id: string) =>
  useBlockStore(
    (state) => state.blocksById[id]?.metadata,
    shallow,
  );
```

**기대 효과**
- 657ms 렌더링 시간을 크게 감소
- 불필요한 리렌더링 방지

### 해결책 2: BlockEditor의 useEffect 조건 추가

**대상 파일**
- `src/outliner/BlockEditor.tsx`

**변경 내용**
```typescript
useEffect(() => {
  if (pageId && get().currentPageId !== pageId) {
    openPage(pageId);
  }
}, [pageId, openPage]);
```

**대안: useEffect 제거**
- PageTreeItem에서 이미 loadPage를 호출하므로 BlockEditor에서는 제거 가능
- blockStore에 이미 데이터가 있는지 확인 후에만 로드

**기대 효과**
- openPage 중복 호출 제거
- 1초 정적 문제 해결

### 해결책 3: React 18의 automatic batching 활용

**대상 파일**
- `src/components/fileTree/PageTreeItem.tsx`

**변경 내용**
```typescript
const handlePageClick = async (e: React.MouseEvent) => {
  const clickStartTime = performance.now();
  e.stopPropagation();
  if (isEditing) return;

  // 상태 업데이트 batching
  await Promise.all([
    selectPage(page.id),
    loadPage(page.id),
  ]);

  // 다음 프레임에 viewStore 업데이트
  requestAnimationFrame(() => {
    openNote(page.id, page.title, parentNames, pagePathIds);
  });

  const totalTime = performance.now() - clickStartTime;
  console.log(
    `[PageTreeItem:timing] === CLICK HANDLER COMPLETE: total=${totalTime.toFixed(2)}ms ===`,
  );
};
```

**기대 효과**
- 렌더링 사이클 최소화
- 부드러운 페이지 전환

### 해결책 4: CodeMirror 인스턴스 지연 초기화

**대상 파일**
- `src/outliner/BlockComponent.tsx`

**변경 내용**
- CodeMirror 인스턴스를 실제로 보일 때만 초기화
- Intersection Observer 사용하여 뷰포트 내의 블록만 초기화

**기대 효과**
- 초기 로딩 시간 감소
- 메모리 사용량 최적화

### 해결책 5: blockOrder 메모이제이션 강화

**대상 파일**
- `src/outliner/BlockEditor.tsx`

**변경 내용**
```typescript
const blockOrder = useMemo(() => {
  const getAllVisibleBlocks = (blockIds: string[]): string[] => {
    const result: string[] = [];
    for (const blockId of blockIds) {
      result.push(blockId);
      const block = blocksById[blockId];
      const children = childrenMap[blockId];
      if (block && children && children.length > 0 && !block.isCollapsed) {
        result.push(...getAllVisibleBlocks(children));
      }
    }
    return result;
  };
  return getAllVisibleBlocks(blocksToShow);
}, [blocksToShow, blocksById, childrenMap]);
```

**기대 효과**
- blockOrder 재계산 방지
- BlockComponent의 memo 효과 향상

## 우선순위 정리

| 순위 | 해결책 | 예상 효과 | 난이도 |
|------|--------|-----------|--------|
| 1 | Selector shallow comparison 추가 | 657ms → 100ms 미만 | 낮음 |
| 2 | openPage 중복 호출 제거 | 1초 정적 제거 | 낮음 |
| 3 | React batching 활용 | 렌더링 사이클 최소화 | 중간 |
| 4 | CodeMirror 지연 초기화 | 초기 로딩 시간 감소 | 높음 |
| 5 | blockOrder 메모이제이션 강화 | 불필요한 재계산 방지 | 낮음 |

## 모니터링 지표

### 측정해야 할 메트릭
- 페이지 클릭부터 첫 렌더링까지의 시간
- BlockComponent .map() 렌더링 시간
- React 렌더링 사이클 횟수
- openPage 호출 횟수
- 캐시 히트율

### 기대 개선 효과
- 전체 렌더링 시간: 약 1.5초 → 200ms 미만
- BlockComponent 렌더링: 657ms → 100ms 미만
- openPage 호출: 2회 → 1회

## 관련 파일 목록

- `src/stores/blockStore.ts` - Selector 최적화
- `src/outliner/BlockEditor.tsx` - useEffect 수정
- `src/outliner/BlockComponent.tsx` - CodeMirror 초기화
- `src/components/fileTree/PageTreeItem.tsx` - 클릭 핸들러 수정
- `src/stores/viewStore.ts` - openNote 함수 확인
- `src/App.tsx` - 렌더링 로직 확인