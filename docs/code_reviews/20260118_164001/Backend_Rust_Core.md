Loaded cached credentials.
## 🦀 Rust 코어 시스템 리뷰

### ⚠️ 심각도 높음 (High Priority)

**[src-tauri/src/services/path_validator.rs:27] Async 함수 내 Blocking I/O 사용**
`validate_absolute_path`는 `async` 함수이지만, 내부적으로 `std::fs::canonicalize`를 사용하고 있습니다. 이는 동기(Blocking) 파일 시스템 호출로, Tauri의 비동기 런타임(Tokio worker thread)을 차단하여 애플리케이션의 반응성을 저하시킬 수 있습니다.
**해결 방법:** `std::fs::canonicalize` 대신 `tokio::fs::canonicalize`를 사용하거나, 해당 작업을 `tokio::task::spawn_blocking`으로 감싸야 합니다.

**[src-tauri/src/services/file_sync.rs:35] Async 함수 내 동기 DB 호출 및 Mutex Lock**
`get_page_file_path` 및 기타 함수들은 `async`로 선언되어 있지만, 내부적으로 `rusqlite`를 통한 동기 DB 쿼리와 `std::sync::Mutex`의 블로킹 락(`lock()`)을 사용합니다. 이는 파일 I/O(비동기)와 DB I/O(동기)가 혼재되어 비동기 런타임을 멈추게 하는 주요 원인입니다.
**해결 방법:** DB 작업은 CPU-bound 또는 Blocking I/O로 간주하여 `tokio::task::spawn_blocking` 내부에서 실행하거나, 비동기를 지원하는 `tokio::sync::Mutex`와 `deadpool-sqlite` 같은 비동기 래퍼 사용을 고려해야 합니다. 단기적으로는 무거운 DB 작업 블록을 `spawn_blocking`으로 분리하는 것이 좋습니다.

### ⚡ 심각도 중간 (Medium Priority)

**[src-tauri/src/services/query_service.rs:57, 76, 91, 97, 129, 146] 반복적인 Regex 컴파일**
`parse_from_clause`, `extract_bracketed_paths` 등의 함수가 호출될 때마다 `Regex::new(...)`를 통해 정규표현식을 새로 컴파일하고 있습니다. 이는 쿼리 파싱 성능을 크게 저하시킵니다.
**해결 방법:** `once_cell` 또는 `std::sync::OnceLock`(Rust 1.70+)을 사용하여 정규표현식을 전역 정적 변수로 한 번만 초기화하고 재사용해야 합니다.

**[src-tauri/src/services/fts_service.rs:48] 대량 DB 작업 시 트랜잭션 부재**
`rebuild_index` 함수는 루프를 돌며 `index_block`을 호출하여 `INSERT`를 반복 수행합니다. 명시적인 트랜잭션이 없으면 SQLite는 매 INSERT마다 자동 커밋을 수행하므로 속도가 매우 느려집니다.
**해결 방법:** 전체 루프를 `conn.transaction()`으로 감싸서 한 번의 트랜잭션으로 처리해야 합니다.

**[src-tauri/src/services/page_path_service.rs:25] 마이그레이션 시 트랜잭션 부재**
`migrate_populate_page_paths` 역시 다수의 페이지에 대해 `update_page_path`를 반복 호출하지만 트랜잭션이 없습니다.
**해결 방법:** 루프 실행 전 트랜잭션을 시작하고, 루프가 끝난 후 커밋하도록 변경하세요.

### 💡 기존 코드 개선 제안 (Code Improvements)

**1. Regex 전역 초기화 (QueryService)**
매번 컴파일하는 대신 `OnceLock`을 사용하여 성능을 최적화합니다.

*Before:*
```rust
fn parse_from_clause(input: &str) -> Result<FromClause, QueryError> {
    let re = Regex::new(r"(?i)FROM\s+(\[.*?\](?:\s+\[.*?\])*)")
        .map_err(|_| QueryError::new("Regex error"))?;
    // ...
}
```

*After:*
```rust
use std::sync::OnceLock;

static FROM_CLAUSE_REGEX: OnceLock<Regex> = OnceLock::new();

fn parse_from_clause(input: &str) -> Result<FromClause, QueryError> {
    let re = FROM_CLAUSE_REGEX.get_or_init(|| {
        Regex::new(r"(?i)FROM\s+(\[.*?\](?:\s+\[.*?\])*)").unwrap()
    });
    // ...
}
```

**2. DB 트랜잭션 적용 (FtsService)**
인덱스 재구축 속도를 수십 배 향상시킬 수 있습니다.

*Before:*
```rust
pub fn rebuild_index(conn: &Connection) -> Result<usize, String> {
    conn.execute("DELETE FROM blocks_fts", [])...;
    // ... select loop ...
    for result in block_iter {
        // ...
        Self::index_block(conn, &block_id, &page_id, &content)?;
    }
    Ok(count)
}
```

*After:*
```rust
pub fn rebuild_index(conn: &mut Connection) -> Result<usize, String> { // &mut Connection 필요
    let tx = conn.transaction().map_err(|e| e.to_string())?;
    
    tx.execute("DELETE FROM blocks_fts", []).map_err(|e| e.to_string())?;
    
    // ... 쿼리 및 데이터 수집 ...
    // Borrow check 문제 회피를 위해 데이터를 먼저 Vec으로 수집하거나, 
    // index_block 내부 쿼리를 tx.execute로 변경하여 호출해야 함.
    
    {
        let mut stmt = tx.prepare("INSERT OR REPLACE INTO blocks_fts ...")...;
        for (block_id, page_id, content) in blocks {
             stmt.execute(params![...])...;
        }
    }

    tx.commit().map_err(|e| e.to_string())?;
    Ok(count)
}
```

### 🚀 새로운 기능 제안 (Feature Suggestions)

**1. 비동기 DB 커넥션 풀링 (Async Database Pooling)**
*   **기능 설명**: 현재 `Mutex<Connection>`을 사용하여 동기식 SQLite 연결을 공유하고 있습니다. 이는 동시성 처리에 병목이 됩니다. `sqlx` 혹은 `deadpool-sqlite`와 `tokio-rusqlite`를 도입하여 DB 접근을 완전한 비동기로 전환합니다.
*   **구현 난이도**: 어려움 (기존 `rusqlite` 코드를 모두 비동기 패턴으로 리팩토링해야 함)
*   **예상 효과**: I/O가 많은 작업(파일 동기화, 검색 인덱싱) 중에도 UI 스레드가 멈추지 않으며, 여러 읽기 작업의 동시 처리 능력이 향상됩니다.

**2. 백그라운드 인덱싱 작업 큐 (Background Indexing Queue)**
*   **기능 설명**: 파일 변경이나 위키 링크 파싱과 같은 무거운 작업은 즉시 실행하지 않고, 메모리 내 큐(Channel)에 넣은 뒤 별도의 백그라운드 스레드(또는 Task)에서 순차적으로 처리합니다.
*   **구현 난이도**: 보통
*   **예상 효과**: 사용자가 빠르게 타이핑하거나 파일을 조작할 때 UI 반응성을 최대로 유지할 수 있습니다. 특히 `reindex_all_links`와 같은 작업이 UI를 차단하는 것을 방지합니다.

# 청크 정보
청크 번호: 1/1
파일 목록:
- src-tauri/src/services/wiki_link_parser.rs
- src-tauri/src/services/file_sync.rs
- src-tauri/src/services/fts_service.rs
- src-tauri/src/services/mod.rs
- src-tauri/src/services/query_service.rs
- src-tauri/src/services/path_validator.rs
- src-tauri/src/services/wiki_link_index.rs
- src-tauri/src/services/page_path_service.rs
- src-tauri/src/main.rs
- src-tauri/src/lib.rs
