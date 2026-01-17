Loaded cached credentials.
## 🦀 Rust 코어 시스템 리뷰

### ⚠️ 심각도 높음 (High Priority)
패닉 가능성, 데드락, 데이터 경쟁 등 즉시 수정이 필요한 문제만 이곳에 작성하세요.

[src-tauri/src/services/file_sync.rs:229, 261] 논리적 오류로 인한 파일 이동 실패 → `std::fs::canonicalize` 제거 또는 부모 디렉토리 검증으로 변경
`move_page_file` 함수에서 이동 대상 경로(`new_dir` 또는 `new_path`)에 대해 `validate_absolute_path`를 호출합니다.
이 검증 함수는 내부적으로 `std::fs::canonicalize`를 사용하는데, 이는 **파일이 실제로 존재해야만 성공**합니다.
파일 이동(`fs::rename`)을 수행하기 *직전*에 이 검증을 수행하므로, 대상 경로가 아직 존재하지 않아 무조건 에러가 발생하고 파일 이동이 실패하게 됩니다.

**해결 방법:**
대상 경로 자체가 아니라, **대상 경로의 부모 디렉토리**를 `canonicalize`하여 워크스페이스 내부에 있는지 확인하는 방식으로 변경해야 합니다.

```rust
// 수정 제안 (PathValidator에 새로운 메서드 추가 권장)
pub fn validate_target_path(&self, target_path: &Path) -> Result<(), String> {
    let parent = target_path.parent().ok_or("Cannot get parent")?;
    self.validate_absolute_path(parent)?; // 부모 디렉토리가 워크스페이스 내에 있는지 확인
    // 추가로 target_path의 파일명에 경로 조작 문자(..)가 없는지 문자열 검사
    Ok(())
}
```

### ⚡ 심각도 중간 (Medium Priority)
비효율적인 메모리 사용, blocking I/O, 개선 가능한 패턴 등 개선이 권장되는 문제를 작성하세요.

[src-tauri/src/lib.rs:81] 디렉토리 목록 조회 실패 가능성 → `filter_map` 사용
`read_directory` 함수에서 `entry.metadata()?`를 사용하여 파일 메타데이터를 가져옵니다.
디렉토리 내에 **접근 권한이 없거나 깨진 심볼릭 링크**가 하나라도 있으면 전체 디렉토리 목록 조회가 에러를 반환하며 실패합니다.
탐색기 기능은 일부 파일에 문제가 있어도 나머지 파일 목록은 보여주어야 합니다.

**해결 방법:**
```rust
let items: Vec<FileSystemItem> = entries
    .filter_map(|entry| {
        let entry = entry.ok()?;
        let path = entry.path();
        let metadata = entry.metadata().ok()?; // 에러 발생 시 해당 항목 건너뜀
        // ... 항목 생성 로직 ...
        Some(item)
    })
    .collect();
```

[src-tauri/src/lib.rs:260-316] 수동 트랜잭션 관리의 위험성 → `rusqlite::Transaction` 사용
`delete_path_with_db`에서 `BEGIN TRANSACTION`, `ROLLBACK`, `COMMIT` SQL을 직접 실행하여 트랜잭션을 관리합니다.
Rust 로직 내에서 패닉이 발생하거나 에러 처리 분기가 복잡해질 경우, 명시적인 `ROLLBACK`이 누락되거나 트랜잭션 상태가 꼬일 위험이 있습니다.
`rusqlite`의 `Transaction` 객체는 Drop 시 자동으로 롤백을 수행하므로 훨씬 안전합니다.

**해결 방법:**
```rust
let tx = conn.transaction().map_err(|e| e.to_string())?;
// ... DB 작업 ...
tx.commit().map_err(|e| e.to_string())?;
```

### 💡 기존 코드 개선 제안 (Code Improvements)
현재 Rust 코드의 리팩토링, 최적화, idiomatic 패턴 적용 등을 제안하세요.

1. **[src-tauri/src/services/wiki_link_index.rs:133] 반복문 내 Statement 준비 최적화**
   `reindex_all_links` 함수 내의 `loop` 안에서 `INSERT` 구문을 매번 `prepare` 하고 있습니다. SQLite가 캐싱을 하긴 하지만, 루프 밖에서 한 번만 준비하는 것이 정석입니다.

   **Before:**
   ```rust
   loop {
       // ...
       let mut stmt_insert = tx.prepare("INSERT ...")?;
       for ... { stmt_insert.execute(...) }
   }
   ```

   **After:**
   ```rust
   let mut stmt_insert = tx.prepare("INSERT ...")?; // 루프 밖으로 이동
   loop {
       // ... SELECT 로직 ...
       for ... { stmt_insert.execute(...) }
   }
   ```

2. **[src-tauri/src/services/wiki_link_parser.rs:85] `mask_code_blocks` 메모리 최적화**
   현재 문자열을 `Vec<char>`로 변환하고, 이를 다시 `String`으로 수집(collect)합니다. 이는 메모리 할당을 두 번 발생시킵니다. 바이트 단위로 처리하거나, `String`을 한 번만 할당하도록 개선할 수 있습니다.

### 🚀 새로운 기능 제안 (Feature Suggestions)
현재 백엔드 구조를 분석한 결과, 시스템 안정성이나 운영 효율성을 높일 수 있는 기능을 제안하세요.

1. **SQLite WAL (Write-Ahead Logging) 모드 활성화**
    *   **기능 설명:** SQLite 연결 시 `PRAGMA journal_mode=WAL;`을 실행합니다.
    *   **구현 난이도:** 쉬움
    *   **예상 효과:** 동시성 향상. 읽기 작업과 쓰기 작업이 서로를 차단하지 않게 되어, 파일 동기화(`file_sync`)와 UI의 데이터 조회(읽기)가 동시에 발생할 때의 성능과 반응성이 좋아집니다.

2. **파일 시스템 감지 (File Watcher) 통합**
    *   **기능 설명:** `notify` 크레이트 등을 사용하여 워크스페이스 내 파일 변경 사항(외부 편집기 사용 등)을 감지하고 DB와 동기화합니다.
    *   **구현 난이도:** 보통
    *   **예상 효과:** 현재 구조는 앱 내부 명령으로만 파일 변경을 추적하는 것으로 보입니다. 사용자가 외부에서 파일을 수정할 경우 DB와 파일 시스템 간의 불일치가 발생할 수 있습니다. Watcher가 있으면 데이터 무결성을 유지할 수 있습니다.

# 청크 정보
청크 번호: 1/1
파일 목록:
- src-tauri/src/services/wiki_link_parser.rs
- src-tauri/src/services/file_sync.rs
- src-tauri/src/services/mod.rs
- src-tauri/src/services/path_validator.rs
- src-tauri/src/services/wiki_link_index.rs
- src-tauri/src/services/page_path_service.rs
- src-tauri/src/main.rs
- src-tauri/src/lib.rs
