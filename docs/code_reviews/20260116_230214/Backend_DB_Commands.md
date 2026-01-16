Loaded cached credentials.
Attempt 1 failed with status 429. Retrying with backoff... GaxiosError: [{
  "error": {
    "code": 429,
    "message": "No capacity available for model gemini-3-pro-preview on the server",
    "errors": [
      {
        "message": "No capacity available for model gemini-3-pro-preview on the server",
        "domain": "global",
        "reason": "rateLimitExceeded"
      }
    ],
    "status": "RESOURCE_EXHAUSTED",
    "details": [
      {
        "@type": "type.googleapis.com/google.rpc.ErrorInfo",
        "reason": "MODEL_CAPACITY_EXHAUSTED",
        "domain": "cloudcode-pa.googleapis.com",
        "metadata": {
          "model": "gemini-3-pro-preview"
        }
      }
    ]
  }
}
]
    at Gaxios._request (/opt/homebrew/Cellar/gemini-cli/0.24.0/libexec/lib/node_modules/@google/gemini-cli/node_modules/gaxios/build/src/gaxios.js:142:23)
    at process.processTicksAndRejections (node:internal/process/task_queues:103:5)
    at async OAuth2Client.requestAsync (/opt/homebrew/Cellar/gemini-cli/0.24.0/libexec/lib/node_modules/@google/gemini-cli/node_modules/google-auth-library/build/src/auth/oauth2client.js:429:18)
    at async CodeAssistServer.requestStreamingPost (file:///opt/homebrew/Cellar/gemini-cli/0.24.0/libexec/lib/node_modules/@google/gemini-cli/node_modules/@google/gemini-cli-core/dist/src/code_assist/server.js:166:21)
    at async CodeAssistServer.generateContentStream (file:///opt/homebrew/Cellar/gemini-cli/0.24.0/libexec/lib/node_modules/@google/gemini-cli/node_modules/@google/gemini-cli-core/dist/src/code_assist/server.js:27:27)
    at async file:///opt/homebrew/Cellar/gemini-cli/0.24.0/libexec/lib/node_modules/@google/gemini-cli/node_modules/@google/gemini-cli-core/dist/src/core/loggingContentGenerator.js:127:26
    at async retryWithBackoff (file:///opt/homebrew/Cellar/gemini-cli/0.24.0/libexec/lib/node_modules/@google/gemini-cli/node_modules/@google/gemini-cli-core/dist/src/utils/retry.js:108:28)
    at async GeminiChat.makeApiCallAndProcessStream (file:///opt/homebrew/Cellar/gemini-cli/0.24.0/libexec/lib/node_modules/@google/gemini-cli/node_modules/@google/gemini-cli-core/dist/src/core/geminiChat.js:364:32)
    at async GeminiChat.streamWithRetries (file:///opt/homebrew/Cellar/gemini-cli/0.24.0/libexec/lib/node_modules/@google/gemini-cli/node_modules/@google/gemini-cli-core/dist/src/core/geminiChat.js:225:40)
    at async Turn.run (file:///opt/homebrew/Cellar/gemini-cli/0.24.0/libexec/lib/node_modules/@google/gemini-cli/node_modules/@google/gemini-cli-core/dist/src/core/turn.js:64:30) {
  config: {
    url: 'https://cloudcode-pa.googleapis.com/v1internal:streamGenerateContent?alt=sse',
    method: 'POST',
    params: { alt: 'sse' },
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'GeminiCLI/0.24.0/gemini-3-pro-preview (darwin; arm64) google-api-nodejs-client/9.15.1',
      Authorization: '<<REDACTED> - See `errorRedactor` option in `gaxios` for configuration>.',
      'x-goog-api-client': 'gl-node/25.2.1'
    },
    responseType: 'stream',
    body: '<<REDACTED> - See `errorRedactor` option in `gaxios` for configuration>.',
    signal: AbortSignal { aborted: false },
    paramsSerializer: [Function: paramsSerializer],
    validateStatus: [Function: validateStatus],
    errorRedactor: [Function: defaultErrorRedactor]
  },
  response: {
    config: {
      url: 'https://cloudcode-pa.googleapis.com/v1internal:streamGenerateContent?alt=sse',
      method: 'POST',
      params: [Object],
      headers: [Object],
      responseType: 'stream',
      body: '<<REDACTED> - See `errorRedactor` option in `gaxios` for configuration>.',
      signal: [AbortSignal],
      paramsSerializer: [Function: paramsSerializer],
      validateStatus: [Function: validateStatus],
      errorRedactor: [Function: defaultErrorRedactor]
    },
    data: '[{\n' +
      '  "error": {\n' +
      '    "code": 429,\n' +
      '    "message": "No capacity available for model gemini-3-pro-preview on the server",\n' +
      '    "errors": [\n' +
      '      {\n' +
      '        "message": "No capacity available for model gemini-3-pro-preview on the server",\n' +
      '        "domain": "global",\n' +
      '        "reason": "rateLimitExceeded"\n' +
      '      }\n' +
      '    ],\n' +
      '    "status": "RESOURCE_EXHAUSTED",\n' +
      '    "details": [\n' +
      '      {\n' +
      '        "@type": "type.googleapis.com/google.rpc.ErrorInfo",\n' +
      '        "reason": "MODEL_CAPACITY_EXHAUSTED",\n' +
      '        "domain": "cloudcode-pa.googleapis.com",\n' +
      '        "metadata": {\n' +
      '          "model": "gemini-3-pro-preview"\n' +
      '        }\n' +
      '      }\n' +
      '    ]\n' +
      '  }\n' +
      '}\n' +
      ']',
    headers: {
      'alt-svc': 'h3=":443"; ma=2592000,h3-29=":443"; ma=2592000',
      'content-length': '624',
      'content-type': 'application/json; charset=UTF-8',
      date: 'Fri, 16 Jan 2026 14:04:46 GMT',
      server: 'ESF',
      'server-timing': 'gfet4t7; dur=8051',
      vary: 'Origin, X-Origin, Referer',
      'x-cloudaicompanion-trace-id': '80a1c355600211da',
      'x-content-type-options': 'nosniff',
      'x-frame-options': 'SAMEORIGIN',
      'x-xss-protection': '0'
    },
    status: 429,
    statusText: 'Too Many Requests',
    request: {
      responseURL: 'https://cloudcode-pa.googleapis.com/v1internal:streamGenerateContent?alt=sse'
    }
  },
  error: undefined,
  status: 429,
  Symbol(gaxios-gaxios-error): '6.7.1'
}
## 💾 데이터베이스 & API 리뷰

### ⚠️ 심각도 높음 (High Priority)

**[src-tauri/src/commands/search.rs:24, 67] 전체 텍스트 검색 성능 저하 (Full Table Scan)**
*   **문제 설명**: `search_content` 함수와 `src-tauri/src/commands/block.rs`의 `search_blocks` 함수가 `LIKE %query%` 패턴을 사용하고 있습니다. 이는 인덱스를 타지 못하고 `blocks` 테이블 전체를 스캔(Full Table Scan)하게 만듭니다. 데이터가 많아질수록(블록 수 1만 개 이상) 검색 속도가 급격히 느려지고 UI 프리징을 유발합니다. 스키마에는 `blocks_fts` 테이블이 정의되어 있으나 활용되지 않고 있습니다.
*   **해결 방법**: SQLite의 FTS5(Full-Text Search) 기능을 활용하여 쿼리를 작성해야 합니다. `blocks` 테이블 조회 대신 `blocks_fts` 가상 테이블을 조회하여 고속 검색을 구현하세요.

**[src-tauri/src/commands/block.rs:248, 284] N+1 쿼리 문제 (Block Metadata Loading)**
*   **문제 설명**: `get_block_subtree`와 `get_page_blocks` 함수 내부에서 조회된 블록 리스트를 순회하며 `load_block_metadata`를 반복 호출하고 있습니다. 만약 한 페이지에 100개의 블록이 있다면, 1번의 블록 조회 쿼리 후 100번의 메타데이터 조회 쿼리가 추가로 실행됩니다(1+N). 이는 로딩 성능을 심각하게 저하시킵니다.
*   **해결 방법**:
    1.  `LEFT JOIN`을 사용하여 블록 조회 시 메타데이터를 함께 가져오거나,
    2.  블록 ID 목록을 수집하여 `WHERE block_id IN (...)` 구문으로 메타데이터를 한 번에 조회한 후 메모리에서 매핑해야 합니다.

### ⚡ 심각도 중간 (Medium Priority)

**[src-tauri/src/db/schema.rs:136] 취약한 마이그레이션 전략**
*   **문제 설명**: 현재 `migrate_schema` 함수는 `PRAGMA table_info`를 통해 컬럼 존재 여부를 하나씩 확인하고 `ALTER TABLE`을 수행합니다. 이는 스키마 변경 이력을 추적하기 어렵고, 복잡한 스키마 변경(예: 데이터 변환이 필요한 경우) 시 관리가 불가능해집니다.
*   **해결 방법**: `user_version` PRAGMA를 사용하여 DB 버전을 관리하고, 버전별로 마이그레이션 스크립트를 순차 실행하는 구조로 변경하는 것이 좋습니다.

**[src-tauri/src/commands/page.rs:13] 대용량 페이지 목록 조회 시 성능 이슈**
*   **문제 설명**: `get_pages` 함수가 `SELECT * FROM pages`를 수행하여 모든 페이지를 한 번에 가져옵니다. 페이지 수가 수천 개로 늘어날 경우 메모리 사용량 증가 및 초기 로딩 지연이 발생할 수 있습니다.
*   **해결 방법**: 필요한 필드만 조회(Projection)하거나, 무한 스크롤 등을 위한 `LIMIT/OFFSET` 또는 커서 기반 페이지네이션을 도입해야 합니다. 현재 UI 구조상 전체 트리가 필요하다면, 폴더 구조만 먼저 로딩하고 파일은 지연 로딩(Lazy Loading)하는 방식을 고려하세요.

**[src-tauri/src/commands/page.rs:604] 위키 링크 업데이트 시 비효율적인 탐색**
*   **문제 설명**: `rewrite_wiki_links_for_page_path_change` 함수가 `blocks` 테이블에 대해 여러 번의 `LIKE` 쿼리를 수행합니다. 이는 앞서 언급한 FTS 미사용 문제와 결합되어 페이지 이름 변경 시 시스템 전체에 부하를 줄 수 있습니다.
*   **해결 방법**: `block_refs` 또는 `wiki_links` 테이블을 활용하여 해당 페이지를 참조하는 블록 ID를 먼저 찾은(Index Scan) 후, 해당 블록들만 업데이트하도록 로직을 변경해야 합니다.

### 💡 기존 코드 개선 제안 (Code Improvements)

**1. N+1 문제 해결을 위한 쿼리 최적화 (Block Metadata)**

*   **Before** (현재 코드 패턴):
```rust
// Loop 내에서 쿼리 실행
for block in &mut blocks {
    block.metadata = load_block_metadata(&conn, &block.id)?;
}
```

*   **After** (개선안 - 한 번의 쿼리로 처리):
```rust
// Block ID 목록 수집
let block_ids: Vec<String> = blocks.iter().map(|b| b.id.clone()).collect();
// 파라미터 바인딩 생성 (?, ?, ?)
let placeholders = vec!["?"; block_ids.len()].join(",");
let sql = format!(
    "SELECT block_id, key, value FROM block_metadata WHERE block_id IN ({})",
    placeholders
);

// 쿼리 실행 및 맵으로 변환
let mut metadata_map: HashMap<String, HashMap<String, String>> = HashMap::new();
// ... (쿼리 실행 및 매핑 로직) ...

// 메모리에서 할당
for block in &mut blocks {
    if let Some(meta) = metadata_map.remove(&block.id) {
        block.metadata = meta;
    }
}
```

**2. FTS5를 활용한 검색 최적화**

*   **Before** (`src-tauri/src/commands/search.rs`):
```rust
// LIKE 연산자 사용 (느림)
"SELECT ... FROM blocks WHERE content LIKE ?1"
```

*   **After** (FTS 활용):
```rust
// blocks_fts 가상 테이블 사용 (빠름)
// snippet 함수를 사용하여 하이라이팅 처리도 DB 레벨에서 가능
"SELECT block_id, snippet(blocks_fts, 2, '<b>', '</b>', '...', 64) 
 FROM blocks_fts 
 WHERE blocks_fts MATCH ?1 
 ORDER BY rank"
```

### 🚀 새로운 기능 제안 (Feature Suggestions)

**1. 데이터베이스 최적화 및 유지보수 명령 (Vacuum & Optimize)**
*   **기능 설명**: SQLite는 데이터를 삭제해도 파일 크기가 즉시 줄어들지 않습니다. 사용자가 수동으로 또는 주기적으로 DB를 최적화할 수 있는 기능을 제공합니다.
*   **구현 난이도**: 쉬움 (SQL: `VACUUM; ANALYZE;`)
*   **예상 효과**: DB 파일 크기 감소, 쿼리 플래너 최적화를 통한 성능 향상.

**2. 트랜잭션 기반의 배치(Batch) 작업 API**
*   **기능 설명**: 현재 `sync_workspace` 등에서 많은 쿼리가 개별적으로 실행될 수 있습니다. 대량의 데이터 변경(예: 폴더 이동으로 인한 수백 개 파일 경로 변경) 시 이를 하나의 트랜잭션으로 묶어 처리하는 API 구조가 필요합니다.
*   **구현 난이도**: 보통
*   **예상 효과**: 데이터 무결성 보장(중간에 실패 시 롤백), 파일 시스템 I/O와 DB 작업 간의 원자성 확보 노력.


# 청크 정보
청크 번호: 1/1
파일 목록:
- src-tauri/src/db/mod.rs
- src-tauri/src/db/schema.rs
- src-tauri/src/db/connection.rs
- src-tauri/src/commands/page.rs
- src-tauri/src/commands/git.rs
- src-tauri/src/commands/mod.rs
- src-tauri/src/commands/wiki_link.rs
- src-tauri/src/commands/block.rs
- src-tauri/src/commands/workspace.rs
- src-tauri/src/commands/search.rs
- src-tauri/src/models/page.rs
- src-tauri/src/models/mod.rs
- src-tauri/src/models/wiki_link.rs
- src-tauri/src/models/block.rs
