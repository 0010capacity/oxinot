# AI 병렬 코드 리뷰 가이드 (AI Parallel Code Review Guide)

이 문서는 `oxinot` 프로젝트의 규모가 커짐에 따라, 단일 세션에서 모든 코드를 리뷰하는 비효율을 해결하기 위해 작성되었습니다.
코드 리뷰를 요청할 때, 각 AI 에이전트에게 아래 정의된 **Role(역할)** 중 하나를 부여하여 병렬적으로 리뷰를 진행하십시오.

---

## 1. 🎨 UI/UX & Component Specialist (프론트엔드 시각/컴포넌트)

이 역할은 사용자가 보는 화면, 컴포넌트 구조, 스타일링, 접근성에 집중합니다. 로직보다는 "뷰(View)" 계층의 건전성을 확인합니다.

*   **리뷰 대상 경로**:
    *   `src/components/**` (모든 UI 컴포넌트)
    *   `src/styles/**` (CSS 및 스타일 유틸리티)
    *   `src/theme/**` (테마 정의 및 색상)
    *   `src/App.tsx`, `src/main.tsx` (진입점 레이아웃)
*   **중점 체크리스트**:
    *   **재사용성**: 컴포넌트가 불필요하게 중복 정의되지 않았는가? (`components/common` 활용 권장)
    *   **스타일링**: CSS 변수(`var(--...)`)나 테마 토큰을 올바르게 사용하고 있는가? (하드코딩 지양)
    *   **반응형/접근성**: 레이아웃이 깨지거나 키보드 탐색(Tab Index)이 누락되지 않았는가?
    *   **국제화(i18n)**: 텍스트가 하드코딩되지 않고 `t()` 함수를 통해 번역 키를 사용하고 있는가?

**📌 프롬프트 예시:**
> "너는 지금부터 **UI/UX & Component Specialist**야. `src/components`와 `src/styles` 폴더를 중심으로, UI 컴포넌트의 재사용성과 스타일링 일관성, 그리고 i18n 적용 여부를 중점적으로 리뷰해줘."

---

## 2. 🧠 State & Logic Architect (프론트엔드 상태/로직)

이 역할은 데이터의 흐름, 상태 관리, 복잡한 비즈니스 로직, 훅(Hooks)의 최적화에 집중합니다.

*   **리뷰 대상 경로**:
    *   `src/stores/**` (Zustand 스토어 전반)
    *   `src/hooks/**` (커스텀 훅)
    *   `src/contexts/**` (React Context)
    *   `src/outliner/**` (블록 에디터 코어 로직 - **매우 중요**)
    *   `src/utils/**` (유틸리티 함수)
*   **중점 체크리스트**:
    *   **성능 최적화**: `useMemo`, `useCallback`이 적절히 사용되었는가? 불필요한 리렌더링 유발 요소는 없는가?
    *   **상태 관리**: 스토어의 상태 변경 로직이 원자적(Atomic)이고 예측 가능한가? (특히 `blockStore`, `pageStore`)
    *   **복잡도 관리**: `outliner` 로직에서 순환 참조나 지나치게 복잡한 조건문이 없는가?
    *   **데이터 무결성**: 데이터 변환(`blockConversion.ts` 등) 시 데이터 손실 가능성은 없는가?

**📌 프롬프트 예시:**
> "너는 지금부터 **State & Logic Architect**야. `src/stores`, `src/hooks`, 그리고 `src/outliner`의 핵심 로직을 분석해줘. 특히 상태 관리의 효율성과 렌더링 성능, 데이터 무결성 측면에서 잠재적인 버그를 찾아줘."

---

## 3. 🦀 System & Rust Backend Engineer (백엔드 시스템)

이 역할은 Tauri 백엔드, Rust 코드, 파일 시스템 조작, 성능 및 안정성에 집중합니다.

*   **리뷰 대상 경로**:
    *   `src-tauri/src/**` (Rust 소스 코드 전반)
    *   `src-tauri/Cargo.toml` (의존성 관리)
*   **중점 체크리스트**:
    *   **Safety**: `unwrap()`을 남발하여 패닉(Panic)이 발생할 가능성은 없는가? (`Result/Option` 처리 적절성)
    *   **Concurrency**: 비동기 작업(`async/await`, Mutex 등)에서 데드락이나 레이스 컨디션 위험은 없는가?
    *   **File I/O**: 파일 읽기/쓰기 작업 시 예외 처리 및 성능 이슈가 없는가?
    *   **Error Handling**: 프론트엔드로 전달되는 에러 메시지가 명확하고 체계적인가?

**📌 프롬프트 예시:**
> "너는 지금부터 **System & Rust Backend Engineer**야. `src-tauri/src` 내부의 Rust 코드를 리뷰해줘. 특히 `unwrap()` 사용으로 인한 런타임 패닉 가능성과 파일 시스템 조작 시의 에러 처리, 비동기 안전성을 엄격하게 점검해줘."

---

## 4. 🛡️ Security & IPC Inspector (보안 및 인터페이스)

이 역할은 프론트엔드와 백엔드 간의 통신(IPC), 권한 관리, 보안 취약점에 집중합니다.

*   **리뷰 대상 경로**:
    *   `src/tauri-api.ts` (프론트엔드 API 호출 래퍼)
    *   `src-tauri/tauri.conf.json` (Tauri 설정 및 권한)
    *   `src-tauri/capabilities/**` (기능별 권한 설정)
    *   `src-tauri/src/commands/**` (노출된 커맨드 핸들러)
*   **중점 체크리스트**:
    *   **Input Validation**: 프론트엔드에서 넘어온 인자값을 백엔드에서 검증하고 있는가? (Injection 방지)
    *   **Scope & Permissions**: `tauri.conf.json`의 `allowlist`나 `capabilities`가 필요 이상으로 넓게 열려있지 않은가?
    *   **Sensitive Data**: 로그나 에러 메시지에 민감한 경로/정보가 노출되지 않는가?

**📌 프롬프트 예시:**
> "너는 지금부터 **Security & IPC Inspector**야. `src/tauri-api.ts`와 백엔드의 `commands`, 그리고 `tauri.conf.json`을 중심으로 리뷰해줘. IPC 통신 간의 보안 취약점, 입력값 검증 부재, 과도한 권한 허용 여부를 중점적으로 확인해줘."
