Loaded cached credentials.
## 🔒 보안 및 인프라 리뷰

### ⚠️ 심각도 높음 (High Priority)

**[src-tauri/tauri.conf.json:44] 프로덕션 빌드 시 DevTools 활성화**
- **문제 설명:** `app.windows` 설정에서 `"devtools": true`로 설정되어 있습니다. 이는 배포된 애플리케이션에서도 개발자 도구(F12)를 열 수 있게 하여, 사용자가 애플리케이션의 메모리, 로컬 스토리지 조작 및 소스 코드 분석을 가능하게 합니다. XSS 취약점과 결합될 경우 치명적입니다.
- **해결 방법:** 프로덕션 빌드 시에는 반드시 `false`로 설정되도록 변경해야 합니다. Tauri는 `tauri.conf.json` 내에서 플랫폼별 또는 환경별 분기 처리를 직접 지원하지 않으므로, 빌드 스크립트에서 이를 제어하거나 별도의 설정 파일을 병합하는 방식, 혹은 Rust 코드(`main.rs`)에서 릴리즈 모드일 때만 비활성화하는 로직을 추가해야 합니다.

**[src-tauri/capabilities/default.json:16] 제한 없는 Shell Open 권한**
- **문제 설명:** `"shell:allow-open"` 권한이 제한 없이 부여되어 있습니다. 이는 앱이 시스템의 기본 브라우저뿐만 아니라 임의의 파일이나 실행 파일도 열 수 있음을 의미합니다. 공격자가 악의적인 링크나 파일 경로를 주입할 경우 시스템 명령 실행 위험이 있습니다.
- **해결 방법:** `shell` 스코프를 구성하여 허용된 URL 스키마(예: `https://`, `mailto:`)만 열 수 있도록 제한해야 합니다. Tauri v2의 capability 설정에서 `scopes`를 정의하여 특정 패턴만 허용하십시오.

### ⚡ 심각도 중간 (Medium Priority)

**[src/tauri-api.ts:8] 불완전한 클라이언트 사이드 경로 검증**
- **문제 설명:** `validatePath` 함수에서 `path.includes("..")`로 상위 디렉토리 접근(Path Traversal)을 막고 있으나, 이는 클라이언트 사이드 검증일 뿐입니다. 공격자가 `tauri-api.ts`를 우회하여 직접 IPC 메시지를 보내거나 DevTools를 통해 함수를 호출하면 이 검증은 무력화됩니다. 또한 `..` 체크는 단순 문자열 매칭이므로 정교한 우회 기법에 취약할 수 있습니다.
- **해결 방법:** 클라이언트 사이드 검증은 UX 용도로만 사용하고, **반드시 Rust 백엔드**에서 경로 정규화(Canonicalization) 및 샌드박스 경로 이탈 여부를 검증해야 합니다.

**[src-tauri/tauri.conf.json:52] CSP 설정 검토 (asset 프로토콜)**
- **문제 설명:** CSP에 `img-src ... asset: ...`이 포함되어 있습니다. Tauri에서 `asset:` 프로토콜은 로컬 파일 시스템의 이미지를 로드할 때 사용되지만, XSS 취약점 발생 시 로컬 파일 탐색에 악용될 소지가 있습니다.
- **해결 방법:** 가능하다면 `asset:` 대신 Tauri의 `scope` 설정을 통해 허용된 디렉토리의 파일만 접근 가능하도록 제한하고, CSP를 더욱 엄격하게 관리하는 것을 권장합니다.

### 💡 기존 설정 개선 제안 (Configuration Improvements)

**Shell Open Scope 적용 제안**
`shell:allow-open`을 무제한 허용하는 대신, 안전한 웹 링크만 허용하도록 설정을 구체화합니다.

*   **Before (src-tauri/capabilities/default.json):**
    ```json
    "permissions": [
      "shell:allow-open"
    ]
    ```

*   **After (src-tauri/capabilities/default.json):**
    ```json
    "permissions": [
      {
        "identifier": "shell:allow-open",
        "allow": [
          { "href": "^https?://"},
          { "href": "^mailto:"}
        ]
      }
    ]
    ```
    *(참고: Tauri 버전에 따라 문법이 다를 수 있으므로 해당 버전 문서를 확인하여 정규식 패턴 적용 필요)*

### 🚀 새로운 기능 제안 (Feature Suggestions)

**1. 보안 감사를 위한 자동화된 CI 워크플로우 (Automated Security Audit)**
- **기능 설명:** CI 파이프라인(Github Actions)에 `cargo-audit` (Rust 의존성 취약점 검사) 및 `npm audit`을 추가하여 빌드 시마다 알려진 보안 취약점을 검사합니다.
- **구현 난이도:** 쉬움
- **예상 효과:** 의존성 패키지의 보안 홀을 조기에 발견하여 공급망 공격 위험 감소.

**2. 백엔드 기반 파일 시스템 샌드박싱 (Backend Check)**
- **기능 설명:** 현재 Frontend(`tauri-api.ts`)에 의존하는 경로 검증 로직을 Rust 백엔드의 Command 핸들러 내부로 이동시키고, 사용자가 지정한 '워크스페이스' 루트 디렉토리 밖으로 파일 접근이 불가능하도록 강제하는 로직을 구현합니다.
- **구현 난이도:** 보통
- **예상 효과:** 클라이언트 변조 공격이 발생하더라도 시스템의 민감한 파일(예: `/etc/passwd`, 윈도우 시스템 파일 등) 보호.

**3. 릴리즈 빌드 시 Context Menu 비활성화**
- **기능 설명:** 프로덕션 빌드에서 사용자가 우클릭을 통해 기본 컨텍스트 메뉴(Reload, Print 등)에 접근하는 것을 막는 스크립트 추가.
- **구현 난이도:** 쉬움
- **예상 효과:** 의도치 않은 UI 동작 방지 및 기본적인 앱 무결성 느낌 강화.

# 청크 정보
청크 번호: 1/1
파일 목록:
- src-tauri/tauri.conf.json
- src-tauri/capabilities/default.json
- src/tauri-api.ts
