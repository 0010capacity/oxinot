Loaded cached credentials.
안녕하세요. Database & API Designer입니다.
제공해주신 Tauri 애플리케이션의 데이터베이스 스키마와 커맨드(API) 로직을 면밀히 분석했습니다.

전반적으로 **SQLite + File System 하이브리드 아키텍처**를 채택하여 로컬 우선(Local-First) 원칙을 잘 따르고 있습니다. `Recursive CTE`를 활용한 계층 구조 처리와 `FTS5`를 이용한 전문 검색 도입은 매우 적절한 선택입니다.

다만, **동시성 처리(Concurrency)**, **그래프 탐색의 성능**, **데이터 일관성 정책** 측면에서 몇 가지 중요한 개선점이 발견되었습니다.

상세한 리뷰 리포트는 다음과 같습니다.

---

## 💾 데이터베이스 & API 리뷰

### ⚠️ 심각도 높음 (High Priority)

**1. 전역 Mutex 락으로 인한 읽기/쓰기 병목 (Global Mutex Lock)**
*   **파일:** `src-tauri/src/commands/page.rs:24`, `src-tauri/src/commands/mod.rs:16` 등 다수
*   **문제 설명:** DB 연결(`Connection`)을 `Mutex<Connection>`으로 감싸서 사용하고 있습니다. SQLite는 `WAL (Write-Ahead Logging)` 모드를 활성화했음에도 불구하고, 애플리케이션 레벨에서 Mutex를 사용하면 **모든 읽기 작업까지 직렬화(Serialize)** 됩니다. 검색이나 그래프 조회 같은 무거운 읽기 작업이 수행되는 동안 UI가 멈추거나 간단한 쓰기 작업이 블로킹될 수 있습니다.
*   **해결 방법:** `r2d2_sqlite`와 같은 커넥션 풀을 도입하거나, Tauri의 `State` 관리 시 읽기 전용 작업은 Mutex 락을 짧게 가져가고 복제(Clone)하여 사용하는 구조로 변경해야 합니다. SQLite는 멀티 스레드 읽기를 지원합니다.

**2. 그래프 탐색 시 N+1 쿼리 문제 (Graph Traversal N+1)**
*   **파일:** `src-tauri/src/commands/graph.rs:100-143` (`get_page_graph_data` 함수)
*   **문제 설명:** BFS(너비 우선 탐색) 루프 내부에서 `conn.prepare`와 `query_map`을 반복적으로 호출하고 있습니다.
    *   `max_depth`가 깊어지거나 연결된 페이지가 많을수록 쿼리 실행 횟수가 기하급수적으로 증가합니다. 이는 대규모 그래프에서 심각한 성능 저하를 유발합니다.
*   **해결 방법:** SQLite의 `WITH RECURSIVE` CTE 구문을 사용하여 단 한 번의 쿼리로 그래프 데이터를 조회하도록 변경해야 합니다.

### ⚡ 심각도 중간 (Medium Priority)

**1. Soft Delete와 Hard Delete의 정책 불일치**
*   **파일:** `src-tauri/src/db/schema.rs:17` vs `src-tauri/src/commands/page.rs:222`
*   **문제 설명:**
    *   스키마(`pages` 테이블)에는 `is_deleted INTEGER DEFAULT 0` 컬럼이 있어 Soft Delete(휴지통 기능)를 의도한 것으로 보입니다.
    *   그러나 `delete_page` 커맨드는 `DELETE FROM pages WHERE id = ?`를 실행하여 데이터를 물리적으로 삭제(Hard Delete)합니다.
    *   반면 `get_pages` 등 조회 쿼리에서는 `WHERE is_deleted = 0` 조건을 걸고 있어, 정책이 혼재되어 있습니다.
*   **해결 방법:** 정책을 통일해야 합니다. 휴지통 기능이 필요하다면 `delete_page`에서 `UPDATE pages SET is_deleted = 1`을 수행해야 하고, 필요 없다면 스키마와 조회 쿼리에서 `is_deleted` 관련 로직을 제거해야 합니다.

**2. FTS 쿼리 파싱 로직 파편화**
*   **파일:** `src-tauri/src/commands/query.rs:118` vs `src-tauri/src/commands/search.rs:146`
*   **문제 설명:** `search.rs`에는 `validate_fts_query`라는 훌륭한 입력값 검증 로직이 있지만, `query.rs`의 `execute_query` 함수에서는 단순히 따옴표만 이스케이프 처리하여 FTS 쿼리를 조립하고 있습니다. 이는 쿼리 매크로 기능에서 고급 FTS 문법을 사용할 때 오류를 발생시키거나 제한적인 검색만 가능하게 합니다.
*   **해결 방법:** `query.rs`에서도 `search.rs`의 `validate_fts_query` 및 `build_fts_query` 로직을 재사용하도록 리팩토링하여 보안성과 일관성을 확보하세요.

### 💡 기존 코드 개선 제안 (Code Improvements)

**1. 그래프 탐색 로직을 SQL(Recursive CTE)로 최적화**

Rust 코드(BFS) 대신 DB 엔진의 능력을 활용하면 성능이 대폭 향상됩니다.

*   **Before:** `src-tauri/src/commands/graph.rs` (반복문 내 쿼리 실행)
*   **After:**
```rust
// src-tauri/src/commands/graph.rs

let sql = r#"
WITH RECURSIVE connections(from_page, to_page, depth) AS (
    -- 시작점 (Depth 0)
    SELECT from_page_id, to_page_id, 1
    FROM wiki_links
    WHERE from_page_id = ?1 AND to_page_id IS NOT NULL
    UNION
    SELECT from_page_id, to_page_id, 1
    FROM wiki_links
    WHERE to_page_id = ?1 AND from_page_id IS NOT NULL

    UNION ALL

    -- 재귀 호출 (Depth N+1)
    SELECT w.from_page_id, w.to_page_id, c.depth + 1
    FROM wiki_links w
    JOIN connections c ON w.from_page_id = c.to_page_id OR w.to_page_id = c.from_page
    WHERE c.depth < ?2 AND w.to_page_id IS NOT NULL
)
SELECT DISTINCT from_page, to_page FROM connections;
"#;
// 이 쿼리 결과로 노드와 엣지를 구성
```

**2. Block Order Weight 재조정 로직 최적화**
*   **파일:** `src-tauri/src/commands/block.rs:1185` (`rebalance_siblings`)
*   **제안:** 현재는 형제 노드 전체를 조회하여 Rust에서 새로운 값을 계산한 뒤 하나씩 UPDATE 하고 있습니다. SQLite의 `UPDATE FROM` 구문이나 트랜잭션 내 일괄 처리를 통해 DB IO 횟수를 줄일 수 있습니다.

### 🚀 새로운 기능 제안 (Feature Suggestions)

현재 구조를 분석했을 때 다음 기능 도입이 효과적일 것으로 판단됩니다.

**1. 페이지 별명(Aliases) 및 다국어 제목 지원 테이블**
*   **기능 설명:** 현재 `pages` 테이블은 단일 `title`만 가집니다. 위키 링크의 유연성을 위해 페이지에 여러 별칭(Alias)을 부여하거나, 파일명과 별개로 표시용 제목을 저장하는 기능입니다.
*   **구현 난이도:** 보통
*   **스키마 변경:**
    ```sql
    CREATE TABLE page_aliases (
        page_id TEXT NOT NULL,
        alias TEXT NOT NULL,
        FOREIGN KEY(page_id) REFERENCES pages(id) ON DELETE CASCADE,
        PRIMARY KEY(page_id, alias)
    );
    -- FTS 검색 대상에 page_aliases 추가 필요
    ```
*   **효과:** `[[Jira]]`라고 링크를 걸어도 `지라 사용법` 페이지로 연결되는 등 위키 연결성이 강화됩니다.

**2. 데이터베이스 스냅샷 및 복구 (Time Travel)**
*   **기능 설명:** SQLite는 단일 파일이므로, 특정 시점의 DB 상태를 백업(Snapshot)하거나 복원하는 기능 구현이 매우 쉽습니다. Git과는 별개로 로컬 편집 이력을 보호합니다.
*   **구현 난이도:** 쉬움
*   **효과:** 사용자가 실수로 페이지를 대량 삭제하거나 잘못된 매크로를 실행했을 때 즉시 복구 가능. `VACUUM INTO` 명령어를 사용하면 락 없이 백업 가능합니다.

**총평:**
스키마 설계는 관계형 데이터베이스의 장점(무결성, 조인)과 검색 엔진(FTS)의 장점을 잘 결합했습니다. 다만, **Mutex 락으로 인한 병목 현상** 해결과 **그래프 쿼리 최적화**가 프로덕션 레벨 성능 확보를 위해 가장 시급한 과제입니다.

# 청크 정보
청크 번호: 1/1
파일 목록:
- src-tauri/src/db/mod.rs
- src-tauri/src/db/schema.rs
- src-tauri/src/db/connection.rs
- src-tauri/src/commands/page.rs
- src-tauri/src/commands/graph.rs
- src-tauri/src/commands/query.rs
- src-tauri/src/commands/git.rs
- src-tauri/src/commands/db.rs
- src-tauri/src/commands/mod.rs
- src-tauri/src/commands/wiki_link.rs
- src-tauri/src/commands/block.rs
- src-tauri/src/commands/workspace.rs
- src-tauri/src/commands/search.rs
- src-tauri/src/models/page.rs
- src-tauri/src/models/graph.rs
- src-tauri/src/models/query.rs
- src-tauri/src/models/mod.rs
- src-tauri/src/models/wiki_link.rs
- src-tauri/src/models/block.rs
