Loaded cached credentials.
당신은 'Database & API Designer'로서 요청하신 코드를 분석했습니다.
전반적으로 Tauri와 SQLite(rusqlite)를 사용한 로컬 우선(Local-first) 아키텍처가 잘 잡혀 있으며, 파일시스템과 DB 간의 동기화 전략(Sync Strategy)도 구체적으로 구현되어 있습니다. 하지만 `query` 커맨드에서 심각한 성능 병목이 발생할 수 있는 패턴이 발견되어 이에 대한 최적화가 필요합니다.

다음은 상세 리뷰 리포트입니다.

## 💾 데이터베이스 & API 리뷰

### ⚡ 심각도 중간 (Medium Priority)

**[src-tauri/src/commands/query.rs:85-117] 심각한 N+1 문제 및 루프 내 재귀 쿼리 실행**
`execute_query` 함수 내에서 검색된 각 블록에 대해 루프를 돌며 `load_block_metadata`와 `get_block_depth`를 호출하고 있습니다.
1. `load_block_metadata`: 각 행마다 메타데이터 조회를 위한 쿼리가 발생합니다.
2. `get_block_depth`: 각 행마다 부모를 찾기 위해 루프를 도는 쿼리가 발생합니다. (N+1 문제보다 더 심각한 N * M 쿼리 발생)
데이터가 많아질 경우(블록 수천 개 이상) 쿼리 매크로 실행 속도가 극도로 느려질 것입니다.

*   **해결 방법:**
    *   메타데이터는 `LEFT JOIN`을 사용하거나, IDs를 수집하여 한 번의 쿼리로 가져오는 Batch 로딩(`load_blocks_metadata`)을 사용해야 합니다.
    *   `depth` 필터링은 CTE(Common Table Expression)를 사용하여 SQL 레벨에서 계산하고 필터링해야 합니다.

**[src-tauri/src/commands/query.rs:104, 110] 애플리케이션 레벨 필터링 및 정렬**
`LIKE` 검색과 `sort` 로직이 DB 쿼리 결과 전체를 메모리로 가져온 후 Rust 코드에서 수행됩니다.
`LIMIT`이 적용되어 있어도, 필터링 전의 모든 데이터를 가져와야 하므로 메모리 사용량과 I/O 비용이 낭비됩니다.

*   **해결 방법:** `LIKE` 조건과 `ORDER BY`, `LIMIT`을 SQL 쿼리 자체에 포함시켜 DB 엔진이 최적화하게 만들어야 합니다.

**[src-tauri/src/db/schema.rs:29] Fractional Indexing 정밀도 한계**
`order_weight REAL`을 사용하여 순서를 관리하고 있습니다. `REAL`은 64-bit float(f64)이지만, 요소 사이에 반복적으로 삽입이 일어나면 정밀도 한계(machine epsilon)에 도달하여 더 이상 사이값을 생성할 수 없게 됩니다.

*   **해결 방법:**
    *   단기: 클라이언트나 서버 로직에서 정밀도 한계에 도달했을 때 해당 부모 아래의 모든 자식 `order_weight`를 재분배(Rebalancing)하는 로직이 필요합니다.
    *   장기: String 기반의 Lexicographical indexing (예: "a", "an", "b"...) 사용을 고려해볼 수 있습니다.

### 💡 기존 코드 개선 제안 (Code Improvements)

**1. Query Service 최적화 (N+1 제거 및 SQL 필터링)**

현재 `execute_query`는 데이터를 모두 가져와서 Rust에서 처리합니다. 이를 SQL로 밀어넣는 구조로 변경해야 합니다.

**Before:**
```rust
// src-tauri/src/commands/query.rs

// 1. 모든 블록 가져오기 (필터 없음)
let rows = stmt.query_map(...) ...;

for row in rows {
    // 2. N+1 쿼리 발생
    block.metadata = load_block_metadata(conn, &block.id)?;
    
    // 3. 메모리 필터링
    if let Some(ref like_text) = filter.like {
        if !block.content.contains(like_text) { continue; }
    }
    // ... depth 계산 및 필터링 (쿼리 발생)
}
```

**After (Proposed):**
```rust
// CTE를 활용하여 Depth 계산, 필터링, 정렬, 페이징을 한 번에 수행
fn execute_query_optimized(
    conn: &rusqlite::Connection,
    query_macro: QueryMacro,
) -> Result<Vec<QueryResultBlock>, String> {
    let filter = &query_macro.query_filter;
    
    // 동적 쿼리 구성을 위한 기본 SQL
    let mut sql = r#"
    WITH RECURSIVE block_tree AS (
        SELECT id, parent_id, 0 as depth FROM blocks WHERE parent_id IS NULL
        UNION ALL
        SELECT b.id, b.parent_id, bt.depth + 1 
        FROM blocks b JOIN block_tree bt ON b.parent_id = bt.id
    )
    SELECT b.id, b.page_id, b.content, b.order_weight, b.created_at, bt.depth, pp.path_text
    FROM blocks b
    JOIN block_tree bt ON b.id = bt.id
    JOIN pages p ON b.page_id = p.id
    LEFT JOIN page_paths pp ON p.id = pp.page_id
    WHERE 1=1
    "#.to_string();

    let mut params: Vec<Box<dyn rusqlite::ToSql>> = Vec::new();

    // LIKE 필터 (SQL 레벨)
    if let Some(like) = &filter.like {
        sql.push_str(" AND b.content LIKE ?");
        params.push(Box::new(format!("%{}%", like)));
    }

    // Depth 필터 (SQL 레벨)
    if let Some(depth) = &filter.depth {
        sql.push_str(" AND bt.depth BETWEEN ? AND ?");
        params.push(Box::new(depth.min));
        params.push(Box::new(depth.max));
    }

    // 정렬
    if let Some(sort) = &filter.sort {
        sql.push_str(match sort {
            SortType::Numeric123 => " ORDER BY b.created_at ASC",
            SortType::Numeric321 => " ORDER BY b.created_at DESC",
            SortType::Abc => " ORDER BY b.content ASC",
            SortType::Cba => " ORDER BY b.content DESC",
            SortType::Random => " ORDER BY RANDOM()",
        });
    }

    // Limit
    if let Some(limit) = filter.limit {
        sql.push_str(" LIMIT ?");
        params.push(Box::new(limit));
    }

    let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;
    
    // 쿼리 실행 후 결과 매핑...
    // 메타데이터는 수집된 block_ids를 이용해 `load_blocks_metadata`로 한 번에 조회 (Batching)
    Ok(vec![]) // 실제 구현 생략
}
```

**2. 트랜잭션 범위 내 파일 조작 안전성 확보**

`src-tauri/src/commands/page.rs`의 `create_page` 함수에서 트랜잭션이 커밋되기 *전에* 파일을 생성하고, 실패 시 파일을 삭제하는 보상 트랜잭션(Compensating Transaction) 로직이 있습니다. 이는 좋은 접근이지만, 파일 시스템 조작은 가능한 트랜잭션 커밋 *직후*에 수행하거나, 파일 시스템이 'Source of Truth'라면 파일 생성 후 DB를 맞추는 순서가 더 안전할 수 있습니다. 현재 구조(DB 우선 + 롤백 시 파일 삭제)는 DB 락이 걸린 상태에서 I/O를 수행하므로 동시성 처리에 불리할 수 있습니다.

### 🚀 새로운 기능 제안 (Feature Suggestions)

**1. 고급 검색을 위한 Trigram 인덱스 (FTS5 Extension)**
*   **설명:** 현재 FTS5 `unicode61` 토크나이저를 사용 중입니다. 한국어나 코드 스니펫 같은 경우, 부분 문자열 검색(substring search) 성능을 높이기 위해 SQLite의 Trigram 확장을 사용하는 것이 좋습니다.
*   **구현 난이도:** 쉬움 (스키마 변경 및 컴파일 옵션 확인 필요)
*   **예상 효과:** `LIKE '%query%'`보다 훨씬 빠르고 정확한 중간 글자 검색 지원.

**2. 그래프 시각화 데이터 API (Graph View API)**
*   **설명:** 현재 `block_refs`, `wiki_links` 테이블이 잘 구성되어 있습니다. 이를 활용해 페이지 간, 블록 간의 연결 관계를 D3.js나 Cytoscape.js로 시각화할 수 있는 노드/엣지 리스트 반환 API를 추가하세요.
*   **구현 난이도:** 보통
*   **예상 효과:** 옵시디언(Obsidian)과 같은 그래프 뷰 기능을 제공하여 사용자 경험 향상.

**3. 휴지통 및 복구 기능 (Trash & Restore)**
*   **설명:** 현재 `delete_page`는 `CASCADE`로 영구 삭제하거나 `is_deleted` 플래그를 사용합니다. `delete_block`은 즉시 삭제됩니다. 실수로 인한 삭제를 방지하기 위해 블록 단위의 Soft Delete 및 복구 API가 필요합니다.
*   **구현 난이도:** 보통 (모든 쿼리에 `WHERE is_deleted = 0` 추가 필요)
*   **예상 효과:** 데이터 안전성 확보.

# 청크 정보
청크 번호: 1/1
파일 목록:
- src-tauri/src/db/mod.rs
- src-tauri/src/db/schema.rs
- src-tauri/src/db/connection.rs
- src-tauri/src/commands/page.rs
- src-tauri/src/commands/query.rs
- src-tauri/src/commands/git.rs
- src-tauri/src/commands/db.rs
- src-tauri/src/commands/mod.rs
- src-tauri/src/commands/wiki_link.rs
- src-tauri/src/commands/block.rs
- src-tauri/src/commands/workspace.rs
- src-tauri/src/commands/search.rs
- src-tauri/src/models/page.rs
- src-tauri/src/models/query.rs
- src-tauri/src/models/mod.rs
- src-tauri/src/models/wiki_link.rs
- src-tauri/src/models/block.rs
