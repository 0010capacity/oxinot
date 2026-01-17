Loaded cached credentials.
## 🦀 Rust 코어 시스템 리뷰

### ⚡ 심각도 중간 (Medium Priority)

**1. 반복적인 Regex 컴파일에 따른 오버헤드**
형식: [src-tauri/src/services/query_service.rs:37, 56, 70, 77, 96, 113, 131]
`parse_query_macro` 및 하위 파싱 함수들이 호출될 때마다 `Regex::new`를 통해 정규 표현식을 매번 새로 컴파일합니다. 이는 쿼리 처리 성능을 크게 저하시킵니다.

**해결 방법:** `std::sync::OnceLock` 또는 `lazy_static`을 사용하여 Regex 인스턴스를 정적으로 한 번만 컴파일하고 재사용하도록 수정하세요.

**2. 링크 재인덱싱 시 N+1 쿼리 발생**
형식: [src-tauri/src/services/wiki_link_index.rs:114-130]
`reindex_all_links` 함수 내에서 블록을 순회하며 각 링크마다 `resolve_link_target`을 호출합니다. `resolve_link_target`은 내부적으로 DB 조회를 수행하므로, 블록이 많을 경우 DB 부하가 급증합니다.

**해결 방법:** 모든 `target_path`를 수집한 뒤, `IN` 절을 사용해 한 번의 쿼리로 `page_id` 매핑을 가져와 메모리에서 조립하거나, CTE(Common Table Expression)를 활용한 쿼리 최적화가 필요합니다.

**3. 비효율적인 문자열 마스킹 처리**
형식: [src-tauri/src/services/wiki_link_parser.rs:85]
`mask_code_blocks` 함수가 `content.chars().collect()`로 `Vec<char>`를 할당하고, 처리 후 다시 `String`으로 변환합니다. 대용량 마크다운 파일 처리 시 메모리 할당과 복사가 불필요하게 발생합니다.

**해결 방법:** 가능하다면 정규식 자체에서 코드 블록을 제외하도록 패턴을 개선하거나, 마스킹된 새 문자열을 만드는 대신 매칭된 인덱스가 코드 블록 범위 내에 있는지 검사하는 로직으로 변경을 권장합니다.

---

### 💡 기존 코드 개선 제안 (Code Improvements)

**1. 수동 트랜잭션 관리를 `rusqlite::Transaction`으로 대체**
현재 `delete_path_with_db` 함수는 문자열 쿼리로 트랜잭션을 제어하고 있어, 패닉 발생 시 롤백 안전성이 떨어지고 코드가 장황합니다. Rust의 RAII 패턴을 활용한 `Transaction` 객체를 사용하는 것이 안전합니다.

**Before:**
```rust
// src-tauri/src/lib.rs

conn.execute("BEGIN TRANSACTION", []).map_err(|e| e.to_string())?;

// ... 작업 수행 ...

if let Err(e) = perform_file_deletion() {
    let _ = conn.execute("ROLLBACK", []);
    return Err(e);
}

conn.execute("COMMIT", []).map_err(|e| e.to_string())?;
```

**After:**
```rust
// src-tauri/src/lib.rs

let tx = conn.transaction().map_err(|e| e.to_string())?;

// ... tx를 사용하여 DB 업데이트 (is_deleted = 1) ...
// tx.execute(...) 사용

match perform_file_deletion() {
    Ok(_) => {
        // 파일 삭제 성공 시 DB 영구 삭제 및 커밋
        tx.execute("DELETE FROM pages WHERE id = ?", [&page_id])
            .map_err(|e| e.to_string())?;
        tx.commit().map_err(|e| e.to_string())?;
        Ok(true)
    }
    Err(e) => {
        // 파일 삭제 실패 시, tx는 스코프를 벗어나며 자동으로 롤백됨 (또는 명시적 rollback 호출)
        // tx.rollback().ok(); // RAII로 인해 필수는 아니지만 명시적일 수 있음
        Err(format!("Filesystem deletion failed: {}", e))
    }
}
```

**2. Query Service의 Regex 정적 할당 적용 예시**
`OnceLock`을 사용하여 쿼리 파서의 정규식을 최적화합니다.

**Before:**
```rust
// src-tauri/src/services/query_service.rs

fn parse_like_clause(input: &str) -> Option<String> {
    let re = Regex::new(r#"(?i)LIKE\s+"([^"]*)""#).ok()?;
    re.captures(input).map(|cap| cap[1].to_string())
}
```

**After:**
```rust
use std::sync::OnceLock;

static LIKE_REGEX: OnceLock<Regex> = OnceLock::new();

fn parse_like_clause(input: &str) -> Option<String> {
    let re = LIKE_REGEX.get_or_init(|| Regex::new(r#"(?i)LIKE\s+"([^"]*)""#).unwrap());
    re.captures(input).map(|cap| cap[1].to_string())
}
```

---

### 🚀 새로운 기능 제안 (Feature Suggestions)

**1. SQLite FTS5 (Full-Text Search) 도입**
- **기능 설명**: 현재 `LIKE` 기반의 검색이나 쿼리 매크로는 대용량 노트에서 성능 한계가 있고, 정확도가 떨어질 수 있습니다. SQLite의 FTS5 확장 모듈을 활성화하여 고성능 전문 검색을 구현합니다.
- **구현 난이도**: 보통 (DB 스키마 변경 및 쿼리 수정 필요)
- **예상 효과**: 검색 속도가 획기적으로 개선되며(인덱스 활용), 순위 지정(Ranking) 및 복합 검색어 처리 등 고급 검색 기능 제공 가능.

**2. 비동기 파일 I/O (tokio::fs) 마이그레이션**
- **기능 설명**: 현재 Tauri 커맨드 내에서 `std::fs`를 사용하고 있습니다. Tauri가 스레드 풀에서 이를 처리해주긴 하지만, 향후 동시성 처리가 많아질 경우(예: 백그라운드 대량 동기화) `tokio::fs`를 사용하여 논블로킹 방식으로 전환하는 것이 확장성에 유리합니다.
- **구현 난이도**: 보통 (비동기 함수로 변환 및 `.await` 처리)
- **예상 효과**: 스레드 점유율 감소 및 애플리케이션 반응성 향상.

# 청크 정보
청크 번호: 1/1
파일 목록:
- src-tauri/src/services/wiki_link_parser.rs
- src-tauri/src/services/file_sync.rs
- src-tauri/src/services/mod.rs
- src-tauri/src/services/query_service.rs
- src-tauri/src/services/path_validator.rs
- src-tauri/src/services/wiki_link_index.rs
- src-tauri/src/services/page_path_service.rs
- src-tauri/src/main.rs
- src-tauri/src/lib.rs
