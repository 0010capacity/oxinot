Loaded cached credentials.
State & Logic Architect로서 임무를 수락합니다. `src/stores`, `src/hooks`, `src/outliner` 디렉토리를 중심으로 **Hooks 최적화**, **Store 복잡도**, **데이터 무결성**을 분석하겠습니다.

먼저, 애플리케이션의 핵심 상태 관리와 로직을 파악하기 위해 주요 파일들의 내용을 읽어보겠습니다.

1.  **Store 분석**: 가장 복잡할 것으로 예상되는 `blockStore.ts`, `syncStore.ts` 및 구조를 잡는 `pageStore.ts` 확인.
2.  **Logic/Reducer 분석**: 아웃라이너의 핵심 로직인 `blockReducer.ts` 확인.
3.  **Hooks 분석**: 성능에 민감한 `useDebouncedBlockUpdate.ts` 및 데이터 흐름과 관련된 `useGitManagement.ts` 확인.

분석을 위해 파일들을 읽어오겠습니다.
`src/outliner/blockReducer.ts`가 `blockStore`와 별개로 존재하는 것으로 보아 로직 중복이나 사용되지 않는 코드일 가능성이 있습니다. 확인을 위해 해당 리듀서의 사용처를 검색합니다.
분석을 완료했습니다. State & Logic Architect로서의 리포트는 다음과 같습니다.

# 🏗️ State & Logic Architecture Report

## 1. 🚨 Critical Issue: 데이터 손실 위험 (Data Integrity)
**대상:** `src/hooks/useDebouncedBlockUpdate.ts`

현재 구현에서 컴포넌트 언마운트 시(페이지 이동, 닫기 등) 보류 중인(pending) 업데이트가 저장되지 않고 버려집니다. 타이머만 `clearTimeout`으로 해제하고, `flush`를 하지 않습니다.

**문제 코드:**
```typescript
// Current
useEffect(() => {
  return () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
  };
}, []);
```

**수정 제안:**
언마운트 시점에 `flushUpdate()`를 호출하여 마지막 변경사항을 확실히 저장해야 합니다.

```typescript
// Recommended
useEffect(() => {
  return () => {
    // 언마운트 시 보류 중인 변경사항 즉시 저장
    if (pendingContentRef.current !== undefined) {
      updateBlockContent(blockId, pendingContentRef.current);
    }
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
  };
}, [blockId, updateBlockContent]); // 의존성 추가 필요
```

## 2. 📉 Dead Code & Redundancy
**대상:** `src/outliner/blockReducer.ts`

**분석 결과:**
`blockReducer` 함수는 코드베이스 어디에서도 import되거나 사용되지 않고 있습니다. `blockStore.ts`가 `createBlock`, `updatePartialBlocks` 등을 통해 독자적인 상태 변경 로직을 구현하고 있어, 이 파일은 이전 아키텍처(useReducer 등)의 잔재로 보입니다.

**권장 사항:**
혼란을 방지하기 위해 `src/outliner/blockReducer.ts` 파일을 **삭제**하십시오. 로직이 이원화되어 유지보수 시 잘못된 파일을 수정할 위험이 있습니다.

## 3. 🧩 Store Complexity (Zustand)
**대상:** `src/stores/blockStore.ts`

**분석 결과:**
`BlockStore`가 너무 많은 책임을 지고 있습니다. ("God Store" 패턴)
1.  **데이터 정규화/캐싱**: `blocksById`, `childrenMap`
2.  **UI 상태**: `focusedBlockId`, `mergingBlockId`, `isLoading`
3.  **API 통신 & 낙관적 업데이트**: 복잡한 `createBlock`, `mergeWithPrevious` 로직

**위험 요소:**
*   단순한 UI 상태 변경(예: 포커스 이동)이 Store 전체 구독자에게 영향을 줄 수 있음.
*   `updatePartialBlocks` 내부의 수동 `childrenMap` 재구성 로직은 복잡도가 높아 버그 발생 가능성이 큼.

**권장 사항:**
장기적으로 UI 상태(`focusedBlockId` 등)를 별도의 `useBlockUIStore` 등으로 분리하거나, React Context를 사용하여 리렌더링 범위를 지역화하는 리팩토링이 필요합니다.

## 4. ⚡ Performance Optimization
**대상:** `src/hooks/useGitManagement.ts`

**분석 결과:**
3초마다 `checkGitStatus`를 실행하는 폴링(Polling) 방식은 Tauri IPC 비용과 파일 시스템 I/O를 지속적으로 발생시킵니다.

```typescript
// 매 3초마다 실행
const intervalId = setInterval(() => {
  checkGitStatus(workspacePath)...
}, 3000);
```

**권장 사항:**
*   폴링 주기를 늘리거나(예: 10초 이상),
*   창이 포커스되었을 때(`window.onfocus`)만 체크하도록 변경,
*   또는 파일 변경 이벤트가 발생했을 때만 체크하는 방식으로 개선이 필요합니다.

---

**다음 단계 제안:**
가장 시급한 **1번(데이터 손실 방지)** 수정을 먼저 진행하고, **2번(Dead Code 삭제)**를 수행하여 코드베이스를 정리하는 것을 권장합니다. 승인하시면 바로 진행하겠습니다.
