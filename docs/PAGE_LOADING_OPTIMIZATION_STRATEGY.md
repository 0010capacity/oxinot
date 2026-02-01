# 페이지 로딩 성능 개선 전략

## 문제 분석

블록이 많아질수록 페이지 로딩 시간이 오래 걸리는 문제의 원인:

### 1. **데이터베이스 쿼리 비효율**
- `get_page_blocks`: 모든 블록을 한 번에 로드
- 블록당 메타데이터 추가 쿼리 (N+1 문제)
- 재귀적 쿼리로 인한 성능 저하

### 2. **프론트엔드 처리**
- normalizeBlocks: O(n²) 복잡도 가능성
- childrenMap 생성 시간
- 대량 블록 수정 시 모든 컴포넌트 리렌더링

### 3. **네트워크 전송**
- 대량의 블록 데이터를 JSON으로 직렬화
- 불필요한 필드까지 전송

### 4. **렌더링**
- 가상 스크롤링 이전: 모든 블록 마운트
- 가상 스크롤링 이후: 초기 렌더링은 빠르지만, 데이터 로드 시간 여전히 문제

---

## 개선 솔루션

### Phase 1: 빠른 개선 (즉시 구현 가능)

#### 1. **모직렬화 메타데이터 제거**
**현재 문제**:
```typescript
// 매번 모든 메타데이터 로드
block.metadata = load_block_metadata(conn, &block.id)?;
```

**개선안**:
```rust
// 메타데이터는 필요할 때만 로드
// openPage에서는 기본 데이터만 로드
pub async fn get_page_blocks_fast(
    workspace_path: String,
    page_id: String,
) -> Result<Vec<Block>, String> {
    // metadata 로드 제거
    // 블록 기본 정보만 반환
}
```

**예상 효과**: 30-50% 개선

#### 2. **배치 메타데이터 로드**
```rust
// 한 번에 모든 메타데이터 로드 (N+1 제거)
fn load_metadata_batch(conn: &Connection, block_ids: Vec<String>) 
    -> Result<HashMap<String, BlockMetadata>, String>
```

**예상 효과**: 추가 20-30% 개선

#### 3. **Rust 쿼리 최적화**
```rust
// 현재: 여러 쿼리
SELECT * FROM blocks WHERE page_id = ?
// + metadata 개별 쿼리

// 개선: JOIN을 통한 한 번 쿼리
SELECT b.*, m.key, m.value
FROM blocks b
LEFT JOIN metadata m ON b.id = m.block_id
WHERE b.page_id = ?
```

**예상 효과**: 추가 10-20% 개선

#### 4. **로딩 상태 UI 개선**
```typescript
// 현재: 블록이 없을 때까지 기다림
// 개선: 페이지 구조를 먼저 표시하고 콘텐츠는 나중에 로드
// - 루트 블록만 먼저 표시
// - 자식 블록은 필요할 때 로드 (virtual scrolling 활용)
```

---

### Phase 2: 고급 개선 (중기 구현)

#### 5. **Progressive Loading 구현**
```typescript
// 1단계: 루트 블록만 로드
const rootBlocks = await loadRootBlocks(pageId);
setBlocks(rootBlocks);

// 2단계: 백그라운드에서 자식 블록 로드
const allBlocks = await loadAllBlocks(pageId);
setBlocks(allBlocks);
```

**예상 효과**: 초기 로딩 시간 80% 개선 (느껴지는 성능)

#### 6. **블록 청크 로딩**
```rust
// 블록을 청크로 나누어 로드
pub async fn get_page_blocks_chunked(
    workspace_path: String,
    page_id: String,
    chunk_size: usize = 100,
) -> Result<Vec<Vec<Block>>, String>
```

**예상 효과**: 대량 데이터 처리 시 메모리 효율성

#### 7. **캐싱 전략**
```typescript
// 로드한 페이지를 메모리 캐시
// 페이지 전환 후 돌아올 때 즉시 표시
const pageCache = new Map<string, BlockData[]>();
```

**예상 효과**: 같은 페이지 재방문 시 99% 개선

---

### Phase 3: 장기 최적화 (아키텍처 개선)

#### 8. **SQLite 인덱싱 최적화**
```sql
-- 현재: 기본 인덱스
CREATE INDEX IF NOT EXISTS idx_page_id ON blocks(page_id);

-- 개선: 복합 인덱스
CREATE INDEX IF NOT EXISTS idx_page_parent ON blocks(page_id, parent_id);
CREATE INDEX IF NOT EXISTS idx_page_order ON blocks(page_id, order_weight);
```

#### 9. **메타데이터 분리**
```rust
// 블록과 메타데이터를 별도 구조로 분리
// 필요할 때만 메타데이터 로드
pub struct BlockLight {
    id, pageId, parentId, content, orderWeight, isCollapsed, blockType
}

pub struct BlockMetadata {
    id, created_at, updated_at, metadata
}
```

#### 10. **백그라운드 프리페칭**
```typescript
// 다음 페이지를 미리 로드
const prefetchNextPage = async (pageId: string) => {
    // 사용자가 다른 페이지로 이동하기 전에 미리 로드
};
```

---

## 추천 우선순위

### 즉시 구현 (1순위)
1. ✅ **메타데이터 제거** - 가장 큰 효과, 가장 빠른 구현 (30-50%)
2. ✅ **배치 메타데이터** - 추가 개선 (20-30%)
3. ✅ **로딩 UI** - 사용자 경험 개선

### 단기 (2순위)
4. 🔄 **쿼리 최적화** - 데이터베이스 성능 (10-20%)
5. 🔄 **Progressive Loading** - 느껴지는 성능 (80% 체감)

### 중기 (3순위)
6. 📋 **캐싱 전략** - 반복 접근 최적화
7. 📋 **청크 로딩** - 메모리 효율성

---

## 예상 성능 개선

### Before (블록 500개 기준)
- 데이터베이스 쿼리: 200-300ms
- 프론트엔드 처리: 50-100ms
- 렌더링: 100-150ms (가상 스크롤링 적용)
- **총 시간: 350-550ms**

### After (Phase 1 적용)
- 데이터베이스 쿼리: 80-120ms (60% 개선)
- 프론트엔드 처리: 30-50ms (40% 개선)
- 렌더링: 50-80ms (가상 스크롤링)
- **총 시간: 160-250ms (55% 개선)**

### After (Phase 1 + Phase 2 적용)
- 초기 로딩: 50-80ms (루트만 로드)
- 백그라운드 로드: 100-150ms (비동기)
- **체감 시간: 50-80ms (80% 개선)**

---

## 구현 단계

### Step 1: 메타데이터 로드 제거
```rust
// src-tauri/src/commands/block.rs에서
// load_block_metadata 호출 제거
// openPage에서만 필요하면 별도 로드
```

### Step 2: 배치 메타데이터 로드
```rust
// metadata 한 번에 로드하는 함수 작성
fn load_all_metadata_batch(conn: &Connection, block_ids: Vec<String>) {}
```

### Step 3: 프로그레시브 로딩
```typescript
// BlockEditor.tsx에서
// 1. 루트 블록 로드 및 표시
// 2. 전체 블록 비동기 로드
```

### Step 4: 캐싱 추가
```typescript
// useBlockStore에 캐싱 로직 추가
const pageCache = useMemo(() => ...);
```

---

## 다음 단계

빠른 개선을 위해 다음과 같은 순서로 진행하는 것을 추천합니다:

1. 📊 **성능 프로파일링**: 정확한 병목 지점 파악
2. 🔧 **메타데이터 최적화**: 가장 큰 효과
3. 🚀 **Progressive Loading**: 사용자 경험 개선
4. 💾 **캐싱**: 반복 접근 최적화
5. 🧪 **성능 테스트**: 개선 확인

---

## 요약

페이지 로딩 성능 개선을 위해:

✅ **단기 (Phase 1)**: 메타데이터 최적화로 50% 개선 가능  
✅ **중기 (Phase 2)**: Progressive Loading으로 체감 성능 80% 개선  
✅ **장기 (Phase 3)**: 캐싱과 인덱싱으로 지속적 최적화  

가장 빠른 효과를 위해 **메타데이터 로드 최적화**부터 시작하는 것을 강력히 추천합니다.
