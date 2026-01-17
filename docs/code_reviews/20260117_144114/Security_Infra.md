Loaded cached credentials.
## 🔒 보안 및 인프라 리뷰

### ⚠️ 심각도 높음 (High Priority)

[src-tauri/tauri.conf.json:52] 프로덕션 환경에서 개발자 도구 활성화
*   **문제 설명**: `devtools` 옵션이 `true`로 설정되어 있습니다. 이는 배포된 애플리케이션에서도 사용자가 개발자 도구(F12)를 열 수 있음을 의미합니다. 악의적인 사용자가 이를 통해 프론트엔드 검증 로직을 우회하거나, 메모리 상의 민감한 데이터를 탈취하고, 애플리케이션의 상태를 임의로 조작할 수 있습니다.
*   **해결 방법**: 배포 빌드 시에는 반드시 `false`로 설정해야 합니다. Rust 코드(`main.rs`) 내에서 `#[cfg(debug_assertions)]` 매크로를 사용하여 개발 환경에서만 활성화되도록 로직을 변경하거나, `tauri.conf.json`에서 기본값을 `false`로 변경하세요.

[src/tauri-api.ts:4-47] 보안 경계(Security Boundary) 위반 - 클라이언트 측 검증 의존
*   **문제 설명**: `validatePath`, `validateFileName`, `validateUrl` 함수들이 클라이언트(프론트엔드) 측에 구현되어 있습니다. Tauri의 프론트엔드는 신뢰할 수 없는 환경으로 간주해야 합니다. 개발자 도구가 활성화되어 있거나 XSS 취약점이 발생할 경우, 공격자는 이 검증 함수들을 우회하여 `invoke` 함수를 직접 호출하고 파일 시스템에 접근할 수 있습니다.
*   **해결 방법**: 입력값 검증 로직은 반드시 신뢰할 수 있는 영역인 **Rust 백엔드(Command 핸들러)** 내에서 수행되어야 합니다. 프론트엔드의 검증은 사용자 경험(UX)을 위한 것으로만 남겨두고, 동일하거나 더 강력한 검증 로직을 Rust 측에 구현하세요.

### ⚡ 심각도 중간 (Medium Priority)

[src-tauri/capabilities/default.json:17] 광범위한 Shell 권한 허용
*   **문제 설명**: `shell:allow-open` 권한이 제한 없이 부여되어 있습니다. 이는 `open` 명령어를 통해 시스템의 임의의 파일이나 프로그램을 실행하거나, 피싱 사이트 등 위험한 URL을 열 수 있는 위험이 있습니다.
*   **해결 방법**: `tauri.conf.json`의 `app.security.capabilities` (또는 별도 scope 설정)를 통해 `open`으로 실행 가능한 URL 스킴(예: `http`, `https`, `mailto`만 허용)을 명시적으로 화이트리스팅하여 범위를 제한해야 합니다.

[src-tauri/tauri.conf.json:55] CSP 내 이미지 소스 범위 과다 허용
*   **문제 설명**: `img-src` 정책에 `data:` 스킴이 허용되어 있습니다(`img-src 'self' asset: https: data:;`). 이는 SVG 이미지를 통한 XSS 공격 경로로 활용될 수 있는 잠재적 위험이 있습니다.
*   **해결 방법**: 꼭 필요한 경우가 아니라면 `data:` 스킴을 제거하거나, 외부 이미지가 필요한 도메인만 명시하여 정책을 강화하는 것이 좋습니다.

### 💡 기존 설정 개선 제안 (Configuration Improvements)

**1. Tauri 권한 범위(Scope) 구체화**
현재 `src-tauri/capabilities/default.json`은 기본 권한만 나열하고 파일 시스템 접근 범위를 제한하지 않고 있습니다.

*   **Before:**
    ```json
    // src-tauri/capabilities/default.json
    "permissions": [
      "core:default",
      // ...
    ]
    ```
*   **After:**
    애플리케이션이 접근해야 하는 특정 디렉토리(예: `$DOCUMENT/*`, `$DOWNLOAD/*` 또는 사용자 지정 작업 공간)로 파일 시스템 접근 권한을 제한하는 스코프를 추가해야 합니다.
    ```json
    // src-tauri/capabilities/default.json
    "permissions": [
      // ... 기존 권한
      {
        "identifier": "fs:scope",
        "allow": ["$HOME/OxinotWorkspace/**"]
      }
    ]
    ```

**2. CSP 보안 강화**
*   **Before:** `connect-src 'self' https://github.com;`
*   **After:** 업데이트 확인이나 동기화에 필요한 엔드포인트가 `github.com` 외에 `api.github.com`이나 `objects.githubusercontent.com` (릴리즈 에셋 다운로드 시 리다이렉트됨) 등 구체적인 서브도메인이 필요한지 확인 후, 와일드카드 사용을 최소화하여 적용하세요.
    ```json
    "csp": "default-src 'self'; ... connect-src 'self' https://api.github.com https://objects.githubusercontent.com;"
    ```

### 🚀 새로운 기능 제안 (Feature Suggestions)

**1. 작업 공간(Workspace) 기반 샌드박싱 (Fs Isolation)**
*   **기능 설명**: 사용자가 선택한 '작업 공간' 폴더 이외의 시스템 경로에는 애플리케이션이 접근하지 못하도록 Rust 레벨에서 강제하는 기능입니다.
*   **구현 난이도**: 보통
*   **예상 효과**: 랜섬웨어 감염이나 버그로 인한 파일 시스템 손상 시 피해 범위를 해당 작업 공간으로 한정하여 전체 시스템을 보호합니다. Tauri의 `fs` scope 기능을 동적으로 업데이트하거나, Rust Command 내부에서 경로가 작업 공간 루트 내에 존재하는지 확인하는 미들웨어를 도입하여 구현합니다.

**2. 백엔드 경로 탐색(Path Traversal) 방어 로직 강화**
*   **기능 설명**: 프론트엔드의 `validatePath` 로직을 Rust로 이관하면서, 단순 문자열 검사(`..`)를 넘어 `canonicalize`를 통한 실제 경로 해석을 수행합니다. 심볼릭 링크 등을 이용한 우회 공격을 방지합니다.
*   **구현 난이도**: 쉬움
*   **예상 효과**: 파일 시스템 접근과 관련된 보안 취약점을 원천적으로 차단합니다.

# 청크 정보
청크 번호: 1/1
파일 목록:
- src-tauri/tauri.conf.json
- src-tauri/capabilities/default.json
- src/tauri-api.ts
