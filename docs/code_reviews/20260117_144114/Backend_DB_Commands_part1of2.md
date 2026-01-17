Loaded cached credentials.
## 💾 데이터베이스 & API 리뷰

### ⚠️ 심각도 높음 (High Priority)
데이터 일관성 및 성능과 관련된 중요한 문제입니다.

[src-tauri/src/commands/page.rs:88-106] **create_page 함수의 트랜잭션 부재 및 원자성 위반 위험**
`create_page` 함수는 DB Insert -> 파일 생성 -> DB Update 순서로 동작합니다. 파일 생성에 성공했으나 마지막 DB Update나 커밋 과정에서 오류가 발생할 경우, DB와 파일 시스템 간의 상태가 불일치하게 됩니다. 또한 SQLite 트랜잭션이 명시적으로 사용되지 않아 동시성 이슈가 발생할 수 있습니다.
**해결 방법:** DB 작업과 파일 시스템 작업을 아우르는 보상 트랜잭션(Compensating Transaction) 로직이 필요하지만, 최소한 DB 작업이라도 트랜잭션으로 묶어야 합니다. `conn.transaction()`을 사용하여 초기 Insert와 후속 Update를 하나의 단위로 처리하고, 파일 생성 실패 시 롤백되도록 구조를 변경하세요.

[src-tauri/src/db/connection.rs:20] **WAL(Write-Ahead Logging) 모드 미설정**
데스크탑 애플리케이션, 특히 `rusqlite`를 사용하는 경우 기본 저널링 모드는 동시성 처리에 취약하여 "database is locked" 오류를 유발할 수 있습니다. 현재 코드에는 `PRAGMA foreign_keys = ON`만 있고 WAL 설정이 없습니다.
**해결 방법:** 연결 초기화 시 `conn.execute("PRAGMA journal_mode=WAL;", [])?;`를 추가하여 동시 읽기/쓰기 성능과 안정성을 확보하세요.

### ⚡ 심각도 중간 (Medium Priority)
쿼리 효율성 및 최적화가 필요한 부분입니다.

[src-tauri/src/commands/page.rs:460-482] **rewrite_wiki_links_for_page_path_change 함수의 N+1 쿼리 문제**
해당 함수는 `all_candidate_ids`를 순회하며 각 ID마다 `SELECT`로 콘텐츠를 조회하고 업데이트 여부를 결정한 뒤 `UPDATE`를 수행합니다. 대상 블록이 많을 경우 DB Round-trip이 과도하게 발생합니다.
**해결 방법:** ID 리스트를 기반으로 한 번의 쿼리로 필요한 데이터(`id`, `page_id`, `content`)를 모두 가져온 뒤 메모리에서 처리하고, 변경이 필요한 항목만 트랜잭션 내에서 업데이트하세요.

[src-tauri/src/commands/page.rs:431] **LIKE 연산자를 사용한 Full Table Scan**
`SELECT id FROM blocks WHERE content LIKE ...` 쿼리는 인덱스를 타지 못해 `blocks` 테이블 전체를 스캔합니다. 데이터가 쌓일수록 페이지 이름 변경 시 심각한 성능 저하가 발생합니다.
**해결 방법:** 이미 존재하는 `blocks_fts` (FTS5) 가상 테이블을 활용하여 검색하거나, `wiki_links` 테이블의 동기화가 보장된다면 `wiki_links` 테이블 조회만으로 대상을 한정 짓는 것이 바람직합니다. FTS를 사용한다면 `MATCH` 쿼리를 사용해야 합니다.

### 💡 기존 코드 개선 제안 (Code Improvements)

**1. `updated_at` 자동 갱신을 위한 Trigger 도입**
애플리케이션 레벨에서 `updated_at`을 갱신하는 것은 누락될 가능성이 있습니다. DB 레벨에서 처리하는 것이 안전합니다.

*   **Before:** `commands/page.rs` 등에서 `UPDATE ... set updated_at = ?` 수동 처리
*   **After:** `schema.rs`에 트리거 추가
    ```sql
    CREATE TRIGGER IF NOT EXISTS trigger_update_timestamp_pages
    AFTER UPDATE ON pages
    BEGIN
        UPDATE pages SET updated_at = CURRENT_TIMESTAMP WHERE id = OLD.id;
    END;
    -- blocks 테이블 등에도 동일하게 적용
    ```

**2. Rusqlite 파라미터 바인딩 가독성 개선**
인덱스 기반 바인딩(`?`)은 인자 순서가 바뀌면 오류를 범하기 쉽습니다. Named Parameter를 사용하는 것을 권장합니다.

*   **Before:**
    ```rust
    conn.execute(
        "INSERT INTO pages ... VALUES (?, ?, ?, ?, 0, ?, ?)",
        params![&id, &request.title, ...],
    )
    ```
*   **After:**
    ```rust
    conn.execute(
        "INSERT INTO pages ... VALUES (:id, :title, :parent, :path, 0, :created, :updated)",
        rusqlite::named_params! {
            ":id": &id,
            ":title": &request.title,
            // ...
        },
    )
    ```

### 🚀 새로운 기능 제안 (Feature Suggestions)

**1. 그래프 시각화 API (Graph View API)**
*   **기능 설명:** `wiki_links` 테이블을 활용하여 페이지와 블록 간의 연결 관계를 노드(Node)와 엣지(Edge) 형태의 JSON 데이터로 반환하는 API입니다.
*   **구현 난이도:** 쉬움 (이미 `wiki_links` 테이블에 필요한 데이터가 있음)
*   **예상 효과:** 옵시디언(Obsidian)과 같은 그래프 뷰 기능을 제공하여 사용자에게 지식의 연결 구조를 시각적으로 제공할 수 있습니다.

**2. 고급 검색 API (Advanced Search via FTS)**
*   **기능 설명:** 현재 스키마에 정의된 `blocks_fts` 테이블을 활용하여, 단순 텍스트 매칭이 아닌 강력한 전문 검색(Full-Text Search) API를 노출합니다. (단어 단위 하이라이팅, 랭킹 기능 포함)
*   **구현 난이도:** 보통 (FTS5 쿼리 문법 및 `snippet` 함수 활용 필요)
*   **예상 효과:** 대량의 노트 속에서 원하는 정보를 즉시 찾을 수 있어 사용자 경험이 극대화됩니다. 현재 `search.rs` 모듈이 존재하나, FTS 기능을 완전히 활용하는지 확인이 필요합니다.

# 청크 정보
청크 번호: 1/2
파일 목록:
- src-tauri/src/db/mod.rs
- src-tauri/src/db/schema.rs
- src-tauri/src/db/connection.rs
- src-tauri/src/commands/page.rs
- src-tauri/src/commands/git.rs
- src-tauri/src/commands/db.rs
- src-tauri/src/commands/mod.rs
- src-tauri/src/commands/wiki_link.rs
