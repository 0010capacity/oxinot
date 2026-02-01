# 성능 프로파일링 가이드: 페이지 로드 딜레이 분석

## 개요

IPC 배칭 최적화를 구현했지만 여전히 딜레이가 있다고 보고했습니다. 이 가이드는 정확히 **어디서** 시간이 소비되는지 파악하는 데 도움이 됩니다.

## 타이밍 로그 구조

### 1️⃣ 클릭부터 블록 로드까지

**콘솔에서 찾기**: `[PageTreeItem:timing]`

```
[PageTreeItem:timing] Click started for page 0b1d8aae-0127-4cd3-87cd-00779f44077b
[PageTreeItem:timing] === CLICK HANDLER COMPLETE: 
  select=XXms, 
  load=YYYms, 
  open=ZZms, 
  total=WWWms ===
```

**시간 분류**:
- `select`: `selectPage()` 호출 시간 (보통 <1ms)
- `load`: **핵심** - `loadPage()` 호출 시간
- `open`: `openNote()` (UI 업데이트) 시간
- `total`: 전체 핸들러 시간

### 2️⃣ 블록 로드 내부 (상세)

**콘솔에서 찾기**: `[blockStore:timing]`

#### 캐시 히트 (이전에 열었던 페이지):
```
[blockStore:timing] Page load started for page abc
[blockStore:timing] Cache hit complete: 
  normalize=2.34ms, 
  setState=0.56ms, 
  total=2.90ms
```

#### 캐시 미스 (새로 로드하는 페이지):
```
[blockStore:timing] Page load started for page abc
[blockStore:timing] IPC call completed in 118.45ms
[blockStore:timing] Normalization completed in 3.45ms
[blockStore:timing] State update (with metadata) completed in 1.23ms
[blockStore:timing] === TOTAL PAGE LOAD TIME: 123.13ms 
  (IPC: 118.45ms, Normalize: 3.45ms, Metadata: 1.23ms) ===
```

**시간 분류**:
- `IPC`: 🔴 **가장 중요** - Rust 백엔드에서 데이터 반환 시간
- `Normalize`: JavaScript에서 데이터 정규화 시간
- `Metadata`: 메타데이터 적용 시간

### 3️⃣ 컴포넌트 렌더링

**콘솔에서 찾기**: `[BlockEditor:timing]`

```
[BlockEditor:timing] Component rendering started for page abc
[BlockEditor:timing] Component render completed in 45.67ms
```

## 병목 지점 찾기

### 시나리오 1: 캐시 히트 시에도 딜레이 (2-3초)

```
Timing breakdown:
- Click → Load: 2000ms ⚠️ 너무 김!
  - select: <1ms ✅
  - load: 5ms (캐시 히트) ✅
  - open: 1995ms ⚠️ 범인!

원인: openNote() 또는 다른 동기 작업이 메인 스레드를 블로킹
```

**해결 방법**:
1. `openNote()` 구현 확인
2. 동기 작업을 비동기로 변경
3. 무거운 DOM 업데이트 최적화

### 시나리오 2: IPC 호출이 느림 (200-300ms)

```
Timing breakdown:
- IPC: 250ms ⚠️ 너무 느림 (목표: 100-150ms)
  - Normalize: 2ms ✅
  - Metadata: 1ms ✅

원인: Rust 백엔드의 DB 쿼리 또는 직렬화가 느림
```

**해결 방법**:
1. Rust 측 로그 추가 (query 시간, 직렬화 시간)
2. DB 인덱스 최적화 (composite index 확인)
3. Tokio 스레드 풀 병목 확인

### 시나리오 3: 데이터 정규화가 느림 (20-50ms)

```
Timing breakdown:
- Normalize: 45ms ⚠️ 너무 느림
- Metadata: 1ms ✅
- Total IPC: 120ms ✅

원인: normalizeBlocks() 함수가 비효율적
```

**해결 방법**:
1. `normalizeBlocks()` 알고리즘 프로파일링
2. 대용량 블록 처리 최적화
3. 메모리 할당 줄이기

### 시나리오 4: 상태 업데이트가 느림 (20-100ms)

```
Timing breakdown:
- IPC: 120ms ✅
- Normalize: 3ms ✅
- Metadata: 85ms ⚠️ 너무 느림

원인: Zustand 상태 업데이트 또는 메타데이터 적용 루프
```

**해결 방법**:
1. 메타데이터 루프 최적화
2. Zustand 배치 업데이트 사용
3. 리액트 렌더링 최적화

## 콘솔 로그 수집 방법

### 1. 앱 실행

```bash
npm run tauri:dev
```

### 2. 페이지 클릭

파일 트리에서 페이지를 클릭하고 **콘솔을 열기** (DevTools: F12 또는 Cmd+Option+I)

### 3. 관련 로그만 필터링

```javascript
// 콘솔에서 실행:
console.log = (function(original) {
  return function(...args) {
    if (String(args[0]).includes("timing") || String(args[0]).includes("blockStore")) {
      original.apply(console, args);
    }
  };
})(console.log);
```

또는 DevTools의 필터 사용:
- 필터 입력: `blockStore`
- 또는: `PageTreeItem:timing`
- 또는: `BlockEditor:timing`

### 4. 로그 복사하기

모든 `[blockStore:timing]` 관련 로그를 복사해서 제공하면 됩니다.

## 예상 로그 순서 (캐시 미스 시)

```
[PageTreeItem:timing] Click started for page abc
[PageTreeItem:timing] === CLICK HANDLER COMPLETE: 
  select=0.12ms, load=123.45ms, open=45.67ms, total=169.24ms ===

[blockStore:timing] Page load started for page abc
[blockStore:timing] IPC call completed in 120.45ms
[blockStore:timing] Normalization completed in 2.34ms
[blockStore:timing] State update (with metadata) completed in 0.89ms
[blockStore:timing] === TOTAL PAGE LOAD TIME: 123.68ms 
  (IPC: 120.45ms, Normalize: 2.34ms, Metadata: 0.89ms) ===

[BlockEditor:timing] Component rendering started for page abc
[BlockEditor:timing] Component render completed in 3.45ms
```

## 예상 로그 순서 (캐시 히트 시)

```
[PageTreeItem:timing] Click started for page abc
[PageTreeItem:timing] === CLICK HANDLER COMPLETE: 
  select=0.05ms, load=2.34ms, open=1234.56ms, total=1237.00ms ===

[blockStore:timing] Page load started for page abc
[blockStore:timing] Cache hit complete: normalize=1.23ms, setState=0.56ms, total=1.79ms
```

## 성능 목표

| 단계 | 목표 | 상태 |
|------|------|------|
| IPC 호출 | <150ms | ⏳ 측정 중 |
| 데이터 정규화 | <5ms | ⏳ 측정 중 |
| 메타데이터 적용 | <2ms | ⏳ 측정 중 |
| 상태 업데이트 | <10ms | ⏳ 측정 중 |
| openNote() | <100ms | ⏳ 측정 중 |
| 전체 (캐시 미스) | <300ms | ⏳ 측정 중 |
| 전체 (캐시 히트) | <100ms | ⏳ 측정 중 |

## 진단 체크리스트

다음을 확인하며 로그를 수집하세요:

- [ ] 페이지 클릭 시 [PageTreeItem:timing] 로그 나타나는가?
- [ ] IPC 시간이 100-150ms 범위인가?
- [ ] Normalize 시간이 5ms 이하인가?
- [ ] Metadata 시간이 2ms 이하인가?
- [ ] 캐시 히트 시 전체 시간이 <100ms인가?
- [ ] 캐시 미스 시 전체 시간이 <300ms인가?

## 다음 단계

위의 로그를 수집하고 다음 정보와 함께 공유해주세요:

1. **캐시 미스** (새 페이지 첫 번째 열기): 전체 로그
2. **캐시 히트** (같은 페이지 다시 열기): 전체 로그
3. 페이지의 블록 개수 (로그에 나타남)

이 정보를 바탕으로 다음 최적화 단계를 결정할 수 있습니다.

---

**생성 날짜**: 2024  
**용도**: 페이지 로드 성능 병목 지점 식별  
**상태**: 활성 프로파일링 중
