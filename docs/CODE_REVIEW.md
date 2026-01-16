# 프론트엔드 코드 리뷰 보고서

## 1. 개요 (Overview)

이 문서는 `oxinot` 프로젝트의 프론트엔드 코드베이스에 대한 리뷰 결과를 담고 있습니다. 프로젝트는 **React**, **Vite**, **Mantine UI**를 기반으로 하며, 상태 관리를 위해 **Zustand**를 사용하고 있습니다. **Tauri**를 통해 백엔드(Rust)와 통신하며 로컬 파일 시스템 기반의 아웃라이너(Outliner) 애플리케이션을 구현하고 있습니다.

## 2. 아키텍처 및 구조 분석 (Architecture)

### 2.1 디렉토리 구조
프로젝트는 기능별(components, hooks, stores)로 잘 구조화되어 있습니다. 특히 `src/outliner` 디렉토리에 핵심 에디터 로직이 집중되어 있어, 일반 UI 컴포넌트와 복잡한 에디터 로직이 분리된 점이 긍정적입니다.

### 2.2 상태 관리 (State Management)
**Zustand**와 **Immer**를 사용하여 불변성을 유지하면서 상태를 관리합니다.
*   **Store 패턴**: `blockStore.ts`와 `pageStore.ts` 등에서 데이터와 액션(비즈니스 로직)을 함께 정의하는 패턴을 사용하고 있습니다.
*   **낙관적 업데이트 (Optimistic Updates)**: `blockStore.ts`에서 블록 생성/수정 시 UI를 먼저 업데이트하고 백엔드 요청을 보내는 방식이 잘 구현되어 있어 사용자 경험(UX)이 우수합니다.
*   **백엔드 통신**: `invoke` 함수를 통해 Tauri 백엔드와 직접 통신하며, 에러 발생 시 롤백 로직도 포함되어 있습니다.

### 2.3 에디터 시스템 (Block Editor)
*   **재귀적 렌더링**: `BlockEditor` -> `BlockComponent` -> `BlockComponent` (Children) 형태로 재귀적인 구조를 가집니다. 이는 아웃라이너의 트리 구조를 직관적으로 표현합니다.
*   **CodeMirror 통합**: 각 블록의 텍스트 편집을 위해 CodeMirror(추정)를 래핑한 `Editor` 컴포넌트를 사용하고 있습니다.
*   **IME 처리**: `BlockComponent.tsx` 내에 한글/일본어 등 조합형 문자(IME) 입력을 위한 복잡한 이벤트 핸들링 로직(`compositionstart`, `keydown` 등)이 포함되어 있습니다. 이는 텍스트 에디터로서 완성도를 높이는 중요한 부분입니다.

## 3. 코드 품질 상세 (Code Quality)

### 3.1 강점 (Strengths)
1.  **타입 안전성**: TypeScript 인터페이스(`BlockData`, `PageData` 등)가 명확하게 정의되어 있어 데이터 구조를 파악하기 쉽고 타입 오류를 방지합니다.
2.  **트리 유틸리티 분리**: `src/utils/tree.ts`에 트리 순회, 검색, 평탄화 등의 로직이 순수 함수로 잘 분리되어 있어 테스트와 재사용이 용이합니다.
3.  **Git 통합**: `useGitManagement.ts` 훅을 통해 Git 상태 확인, 자동 커밋 등의 로직이 깔끔하게 캡슐화되어 있습니다.
4.  **사용자 경험 고려**: 에디터 사용 시 커서 위치 보존, 블록 접기/펼치기, 드래그 앤 드롭(추정) 등 디테일한 UX 처리가 코드 곳곳에 녹아있습니다.

### 3.2 개선이 필요한 부분 (Weaknesses)
1.  **거대 컴포넌트 (Monolithic Components)**: `BlockComponent.tsx`가 약 500라인에 달하며 너무 많은 책임을 지고 있습니다.
    *   **책임**: 렌더링, 이벤트 핸들링, IME 로직, 키바인딩, 메타데이터 팝업 관리 등.
    *   **문제**: 유지보수가 어렵고 가독성이 떨어집니다.
2.  **Store의 비대화**: `blockStore.ts`가 단순히 상태만 관리하는 것이 아니라, "어디에 블록을 삽입할지 결정하는 로직(`getInsertBelowTarget`)"이나 복잡한 CRUD 흐름 제어까지 모두 담당하고 있습니다. "God Object"가 될 위험이 있습니다.
3.  **키바인딩 하드코딩**: `BlockComponent` 내부에 키바인딩 로직이 하드코딩되어 있어, 추후 단축키 커스터마이징 기능을 추가하거나 관리하기 어려울 수 있습니다.

## 4. 개선 제안 (Recommendations)

### 4.1 리팩토링 제안
1.  **BlockComponent 분할**:
    *   `BlockContent`: 실제 텍스트 에디터와 불릿 포인트 렌더링 담당.
    *   `BlockControls`: 접기/펼치기 버튼 등 제어 UI 담당.
    *   `useBlockLogic` (Custom Hook): IME 처리, 키보드 이벤트 핸들링 등 로직을 훅으로 분리.
2.  **도메인 로직 분리**:
    *   `blockStore.ts` 내부의 복잡한 로직(예: 블록 이동 시 위치 계산, 병합 로직 등)을 `src/domain/blockService.ts` 또는 유사한 순수 함수 모듈로 추출하여 Store는 상태 갱신과 API 호출 연결만 담당하도록 경량화.
3.  **가상화(Virtualization) 고려**:
    *   문서가 길어질 경우 재귀적 렌더링은 성능 저하를 유발할 수 있습니다. 현재는 전체 트리를 렌더링하는 것으로 보입니다. 향후 성능 이슈 발생 시 `react-window` 등을 활용한 가상화 도입을 고려해야 합니다. (단, 가변 높이 블록과 들여쓰기 구조 때문에 난이도가 높음)

### 4.2 기능적 제안
1.  **에러 경계 (Error Boundary)**: 개별 블록 렌더링 실패가 전체 에디터를 중단시키지 않도록 `BlockComponent` 레벨이나 `BlockEditor` 레벨에 Error Boundary를 적용하는 것이 좋습니다.
2.  **테스트 강화**: 현재 `src/utils/tree.ts` 외에 비즈니스 로직(Store의 액션들)에 대한 단위 테스트가 보강되면 좋겠습니다. 특히 블록 병합/분할 로직은 버그가 발생하기 쉬운 부분이므로 테스트가 필수적입니다.

## 5. 결론
전반적으로 코드는 현대적인 React 패턴을 따르고 있으며, 특히 복잡한 아웃라이너 에디터의 요구사항(IME, 트리 구조, 성능)을 해결하기 위한 고민이 많이 엿보입니다. 현재 단계에서는 **BlockComponent의 컴포넌트 분할**과 **Store 로직의 분리**를 우선적으로 수행하여 코드의 유지보수성을 높이는 것을 권장합니다.
