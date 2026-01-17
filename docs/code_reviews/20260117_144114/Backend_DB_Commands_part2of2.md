Loaded cached credentials.
안녕하세요. Database & API Designer입니다.
제공해주신 Tauri 백엔드 코드(Rust, SQLite)를 분석한 리뷰 리포트입니다.

전반적으로 CTE(Common Table Expressions)를 활용한 계층 구조 처리와 FTS5를 이용한 검색 구현 등 설계 수준이 높습니다. 하지만 **대량 데이터 동기화 시의 성능 병목**과 **트랜잭션 원자성** 측면에서 몇 가지 중요한 개선점이 발견되었습니다.

## 💾 데이터베이스 & API 리뷰

### ⚠️ 심각도 높음 (High Priority)

**1. [src-tauri/src/commands/workspace.rs:566-590] 동기화 로직의 대량 Insert 성능 저하**
*   **문제 설명**: `sync_or_create_file` 함수 내부에서 마크다운을 파싱한 후, `blocks` 벡터를 순회하며 `INSERT` 문을 건건이 실행하고 있습니다. 페이지 내 블록이 수백 개 이상일 경우, 파일 하나를 동기화하는 데 과도한 디스크 I/O가 발생하여 앱이 멈춘 것처럼 보일 수 있습니다. 특히 `index_block_fts`까지 매번 호출되므로 부하가 큽니다.
*   **해결 방법**: 해당 반복문을 **단일 트랜잭션**으로 감싸야 합니다. SQLite는 트랜잭션 외부의 개별 Insert가 매우 느립니다.
    ```rust
    // 예시: 트랜잭션 적용
    let tx = conn.transaction()?;
    for block in &blocks {
        tx.execute("INSERT ...", ...)?;
        // FTS 인덱싱 로직도 내부에서 처리
    }
    tx.commit()?;
    ```

**2. [src-tauri/src/commands/block.rs:188-194] SQL 파라미터 개수 제한 위험**
*   **문제 설명**: `get_blocks`에서 `block_ids`의 길이만큼 `?` 플레이스홀더를 동적으로 생성(`IN (?,?,...)`)하고 있습니다. SQLite의 기본 파라미터 제한(일반적으로 999개 또는 32,766개)을 초과하는 요청이 들어오면 쿼리가 실패하며 앱이 크래시될 수 있습니다. `load_blocks_metadata` 함수도 동일한 문제를 가지고 있습니다.
*   **해결 방법**: `block_ids`를 일정한 크기(예: 500개)로 나누어(Chunking) 여러 번 쿼리하거나, `rusqlite`의 `carray` 확장을 사용하여 배열 바인딩을 처리해야 합니다. 가장 간단한 방법은 Chunking입니다.

### ⚡ 심각도 중간 (Medium Priority)

**1. [src-tauri/src/commands/block.rs:545] 트랜잭션 원자성 부재 (Create/Update Block)**
*   **문제 설명**: `create_block`, `update_block` 등에서 `conn.execute`(DB 반영), `index_block_fts`(검색 인덱스), `wiki_link_index`(링크 인덱스)가 각각 독립적으로 실행됩니다. 만약 중간에 에러가 발생하면 DB에는 데이터가 있는데 검색은 안 되거나, 위키 링크가 깨지는 데이터 불일치가 발생할 수 있습니다.
*   **해결 방법**: 이 작업들을 하나의 `conn.transaction()` 내에서 수행하여 원자성(Atomicity)을 보장해야 합니다.

**2. [src-tauri/src/commands/block.rs:509-536] 경로 탐색 시 N+1 쿼리 발생**
*   **문제 설명**: `resolve_block_path` 함수에서 `request.segments`를 순회하며 매 루프마다 `conn.query_row`를 실행합니다. 경로가 깊어질수록 DB 라운드트립이 선형적으로 증가합니다.
*   **해결 방법**: 재귀적 CTE(Recursive CTE)를 사용하여 한 번의 쿼리로 경로를 해석하거나, 필요한 깊이만큼의 데이터를 한 번에 가져와 애플리케이션 메모리에서 매칭해야 합니다.

**3. [src-tauri/src/commands/search.rs:40] 비효율적인 하이라이팅 처리**
*   **문제 설명**: 검색 결과의 스니펫 생성을 위해 `highlight_match` 함수에서 Rust 문자열 처리를 수행하고 있습니다. 이는 전체 텍스트를 메모리에 로드해야 하므로 비효율적입니다.
*   **해결 방법**: SQLite FTS5의 내장 함수인 `snippet()` 또는 `highlight()`를 쿼리 레벨에서 사용하여 DB 엔진이 최적화된 결과를 반환하도록 수정하는 것이 좋습니다.

### 💡 기존 코드 개선 제안 (Code Improvements)

**트랜잭션을 활용한 대량 Insert 최적화 (Batch Insert)**

`src-tauri/src/commands/workspace.rs`의 동기화 로직 개선 제안입니다.

**Before:**
```rust
// loop 안에서 개별 실행
for block in &blocks {
    conn.execute("INSERT INTO blocks ...", params![...])?; // 매번 디스크 쓰기 발생
    index_block_fts(&conn, ...)?;
}
```

**After:**
```rust
// 트랜잭션을 사용하여 메모리에서 작업 후 한 번에 커밋
{
    let mut tx = conn.transaction().map_err(|e| e.to_string())?;
    
    // 성능을 위해 Prepared Statement 사용 권장
    {
        let mut stmt = tx.prepare("INSERT INTO blocks (id, ...) VALUES (?, ...)")?;
        let mut fts_stmt = tx.prepare("INSERT INTO blocks_fts ...")?;

        for block in &blocks {
            stmt.execute(params![&block.id, ...])?;
            fts_stmt.execute(params![&block.id, ...])?;
        }
    } // statements dropped here
    
    tx.commit().map_err(|e| e.to_string())?;
}
```

### 🚀 새로운 기능 제안 (Feature Suggestions)

**1. FTS5 Snippet 기능을 활용한 검색 고도화**
*   **기능 설명**: 현재 Rust 코드에서 수행 중인 검색어 강조 기능을 SQLite 엔진에 위임합니다.
*   **구현 난이도**: 쉬움
*   **예상 효과**: 검색 속도 향상 및 메모리 사용량 감소. 긴 텍스트에서도 정확한 문맥 추출 가능.
*   **쿼리 예시**:
    ```sql
    SELECT snippet(blocks_fts, 2, '<b>', '</b>', '...', 64) FROM blocks_fts WHERE ...
    ```

**2. Soft Delete 및 휴지통 복구 기능**
*   **기능 설명**: 현재 `delete_block`은 즉시 삭제를 수행합니다. 실수로 인한 데이터 손실을 방지하기 위해 `is_deleted` 플래그를 활용한 논리적 삭제(Soft Delete)를 도입하고 휴지통 API를 추가합니다.
*   **구현 난이도**: 보통
*   **예상 효과**: 사용자 데이터 안전성 강화.

**3. 배치(Batch) API 엔드포인트 추가**
*   **기능 설명**: 프론트엔드에서 여러 블록을 동시에 수정하거나 이동할 때(예: 다중 선택 후 들여쓰기), 개별 API를 여러 번 호출하는 대신 `batch_update_blocks` 커맨드를 제공합니다.
*   **구현 난이도**: 보통
*   **예상 효과**: IPC 통신 오버헤드 감소 및 트랜잭션 처리를 통한 데이터 무결성 보장.

# 청크 정보
청크 번호: 2/2
파일 목록:
- src-tauri/src/commands/block.rs
- src-tauri/src/commands/workspace.rs
- src-tauri/src/commands/search.rs
- src-tauri/src/models/page.rs
- src-tauri/src/models/mod.rs
- src-tauri/src/models/wiki_link.rs
- src-tauri/src/models/block.rs
