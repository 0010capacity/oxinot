Loaded cached credentials.
`src-tauri/src` 디렉터리 내의 코드 베이스를 분석하여 **Safety(안전성), Async/IO(비동기 입출력), Rust Idioms(관용구)** 관점에서 리뷰를 시작하겠습니다.

먼저 파일 구조를 파악하고, 잠재적 위험 요소인 `unwrap`과 `expect` 사용 지점을 검색하겠습니다.

`commands/block.rs`와 `utils/markdown.rs`에서 발견된 `unwrap` 사용이 안전한지, 그리고 테스트 코드 내에 존재하는지 확인하기 위해 해당 파일들의 내용을 읽어보겠습니다.

`commands/block.rs`와 `utils/markdown.rs`의 `unwrap`은 대부분 테스트 코드 내에 있거나 사전에 검증된 안전한 코드임을 확인했습니다.

이제 **실제 프로덕션 코드**에서의 파일 입출력(IO) 처리와 데이터베이스 처리 방식을 점검하겠습니다. `fs::` 사용 패턴을 검색하고, 워크스페이스 초기화 로직이 담긴 `commands/workspace.rs`를 분석하겠습니다.

`std::fs`와 같은 동기(blocking) 파일 입출력 함수가 `async fn` 내부에서 사용되고 있는지 확인하겠습니다. `async` 함수 내에서 동기 IO를 사용하면 런타임 스레드를 차단하여 성능 저하를 유발할 수 있습니다. `lib.rs`와 `commands/workspace.rs`의 코드를 자세히 검토하겠습니다.

`sync_workspace_incremental` 함수가 실제로 `async`로 선언되어 있는지, 그리고 내부적으로 동기 함수인 `sync_directory`를 호출하여 비동기 런타임을 차단하는 문제가 있는지 확인하겠습니다. `commands/workspace.rs` 파일에서 해당 함수의 정의를 찾아 분석한 후 최종 리포트를 작성하겠습니다.

Rust Backend 엔지니어 관점에서 `src-tauri/src` 코드를 리뷰한 결과입니다.

### 요약
전반적으로 안전성을 고려한 방어적 코딩(`unwrap_or`, `Result` 처리)이 잘 되어 있습니다. 그러나 **Async 함수 내에서 동기(Blocking) IO를 사용하는 패턴**이 발견되어, 파일이 많아질 경우 성능 저하(UI 프리징)를 유발할 수 있는 중요한 이슈가 있습니다.

---

### 1. Safety (안전성)
`unwrap`과 `expect` 사용을 중점적으로 점검했습니다.

*   **진단 결과: 양호 (Safe)**
    *   **테스트 코드:** 발견된 대부분의 `unwrap()`(약 100건 이상)은 `commands/block.rs` 하단의 `#[test]` 모듈과 `utils/markdown.rs`의 테스트 코드에 집중되어 있습니다. 이는 정상적인 패턴입니다.
    *   **프로덕션 코드:** 실제 로직에서는 `unwrap_or`, `unwrap_or_else`, `unwrap_or_default`를 사용하여 `None` 케이스를 안전하게 처리하고 있습니다.
    *   **예외:** `services/wiki_link_parser.rs`에서 `Regex::new(...).unwrap()`이 사용되나, 정적 패턴(`r"..."`)을 컴파일 타임에 가까운 시점에 초기화하는 것이므로 런타임 패닉 위험은 거의 없습니다.

### 2. Async/IO (비동기 및 입출력) - ⚠️ 개선 필요
비동기 런타임(Tokio) 위에서 동작하는 `async fn` 내부에서 동기식(Blocking) `std::fs` 함수를 호출하는 **Anti-pattern**이 발견되었습니다.

*   **문제 지점:**
    1.  **`src-tauri/src/lib.rs`**: `read_directory` 함수는 `async fn`이지만 내부적으로 `fs::read_dir`(동기 함수)를 사용합니다.
    2.  **`src-tauri/src/commands/workspace.rs`**: `sync_workspace_incremental` 및 `reindex_workspace`는 `async` 함수입니다. 이들은 내부적으로 `sync_directory`를 호출하는데, 이 함수는 `fs::read_dir`을 재귀적으로 수행하는 동기 함수입니다.
*   **위험성:** 워크스페이스 내 파일이 많을 경우, 이 작업이 Tokio 런타임의 스레드를 점유(Block)하여 다른 비동기 작업(이벤트 처리, UI 통신 등)을 지연시킬 수 있습니다.
*   **해결 제안:**
    *   **Option A (권장 - 간단):** 해당 Tauri 커맨드에서 `async` 키워드를 제거합니다. Tauri는 `async`가 아닌 커맨드를 자동으로 별도의 Blocking Thread Pool(`spawn_blocking`)에서 실행하므로 안전합니다. (단, 내부에서 다른 `.await`를 호출하지 않는 경우)
    *   **Option B (권장 - 성능):** `std::fs` 대신 `tokio::fs`를 사용하여 진정한 비동기 IO로 리팩토링합니다.
    *   **Option C:** `tokio::task::spawn_blocking(|| { ... })`으로 동기 코드를 감쌉니다.

### 3. Rust Idioms (관용구)
*   **에러 처리:** `.map_err(|e| e.to_string())?` 패턴이 매우 빈번하게 사용됩니다. 이는 Tauri 프론트엔드로 에러 메시지를 보내기엔 편리하지만, Rust 내부적으로는 에러 타입을 소거해버립니다. 장기적으로는 `thiserror` 크레이트를 도입하여 커스텀 에러 열거형(Enum)을 정의하고, 구조적인 에러 처리를 하는 것이 좋습니다.
*   **경로 처리:** `compute_rel_path` 등에서 문자열 조작으로 경로를 처리하는 부분이 보입니다. `Path`나 `PathBuf`의 메서드(`components()`, `strip_prefix()`)를 최대한 활용하는 것이 크로스 플랫폼 호환성에 더 유리합니다.

### 종합 제안
가장 시급한 작업은 **`lib.rs`와 `commands/workspace.rs`의 Async/Sync 혼용 문제 해결**입니다. `async` 키워드를 제거하여 Tauri의 스레드 풀을 활용하거나, `tokio::fs`로 전환하는 것을 추천합니다.
