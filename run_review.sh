#!/bin/bash

# ==============================================================================
# AI Code Review System (oxinot)
# ==============================================================================

# 1. 설정
GEMINI_CMD="gemini"
BASE_OUTPUT_DIR="docs/code_reviews"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
OUTPUT_DIR="${BASE_OUTPUT_DIR}/${TIMESTAMP}"
mkdir -p "$OUTPUT_DIR"

# 상태 아이콘
ICON_WAIT="⏳"
ICON_DONE="✅"
ICON_FAIL="❌"

# 2. 역할 및 세부 프롬프트 정의
ROLES=(
    "Frontend_UI_UX"
    "Frontend_Editor_Outliner"
    "Frontend_State_Logic"
    "Backend_Rust_Core"
    "Backend_DB_Commands"
    "Security_Infra"
)

# 역할별 타겟 디렉토리 및 확장자 정의
declare -A TARGETS
declare -A EXTS

# UI/UX: 컴포넌트, 스타일, 테마
TARGETS["Frontend_UI_UX"]="src/components src/styles src/theme"
EXTS["Frontend_UI_UX"]="tsx css ts"

# Editor: 아웃라이너, 에디터 코어, 마크다운 처리
TARGETS["Frontend_Editor_Outliner"]="src/outliner src/editor src/markdown"
EXTS["Frontend_Editor_Outliner"]="tsx ts css"

# State: 스토어, 훅, 컨텍스트
TARGETS["Frontend_State_Logic"]="src/stores src/hooks src/contexts"
EXTS["Frontend_State_Logic"]="ts tsx"

# Rust Core: 메인 로직, 서비스, 유틸리티
TARGETS["Backend_Rust_Core"]="src-tauri/src/services src-tauri/src"
EXTS["Backend_Rust_Core"]="rs"

# DB & Commands: 데이터베이스, IPC 커맨드, 모델
TARGETS["Backend_DB_Commands"]="src-tauri/src/db src-tauri/src/commands src-tauri/src/models"
EXTS["Backend_DB_Commands"]="rs"

# Security: 설정 파일, API 정의
# 주의: 전체 디렉토리 스캔을 피하기 위해 구체적인 파일이나 폴더 지정 필요
TARGETS["Security_Infra"]="."
EXTS["Security_Infra"]="json ts" # tauri.conf.json, src/tauri-api.ts 등

declare -A PROMPTS
PROMPTS["Frontend_UI_UX"]="
당신은 'UI/UX & Design System Specialist'입니다.
다음 코드를 분석하고 한국어로 리뷰 리포트를 작성해주세요.

[리뷰 체크리스트]
1. UI 구조 안정성: 컴포넌트의 레이아웃이 깨지거나 틀어질 가능성이 있는 구조적 결함(flex/grid 오용, 고정 크기 등)을 찾아내세요.
2. 스타일링: 하드코딩된 색상이나 간격(Magic Numbers) 대신 테마 변수(Theme Tokens)를 사용하고 있는지 확인하세요.
3. 반응형 및 엣지 케이스: 다양한 화면 크기나 긴 텍스트 입력 시 UI가 어떻게 반응하는지 검토하세요.
4. 접근성: 버튼, 입력 폼 등에 적절한 라벨링(aria-label)과 포커스링 처리가 되어 있는지 확인하세요.
5. 기능 제안: 사용자 경험을 획기적으로 개선할 수 있는 새로운 UI 요소나 인터랙션을 제안하세요.
"

PROMPTS["Frontend_Editor_Outliner"]="
당신은 'Editor Engine Engineer'입니다.
다음 코드를 분석하고 한국어로 리뷰 리포트를 작성해주세요.

[리뷰 체크리스트]
1. 성능 최적화: 블록이 많아질 때를 대비한 가상화(Virtualization) 처리와 렌더링 병목 지점을 찾으세요.
2. CodeMirror 연동: 에디터 상태와 React 상태 간의 불일치(Desync)가 발생할 수 있는 로직을 검토하세요.
3. 안정성: IME 입력(한글), 드래그 앤 드롭 등 복잡한 편집 동작에서 상태가 꼬이는 지점을 찾으세요.
4. 메모리 관리: 이벤트 리스너가 적절히 해제되고 있는지, 좀비 리스너가 없는지 확인하세요.
5. 기능 제안: 아웃라이너의 생산성을 높일 수 있는 새로운 단축키, 시각적 보조 도구, 또는 마크다운 확장 기능을 제안하세요.
"

PROMPTS["Frontend_State_Logic"]="
당신은 'Frontend Architect'입니다.
다음 코드를 분석하고 한국어로 리뷰 리포트를 작성해주세요.

[리뷰 체크리스트]
1. 상태 관리 최적화: Zustand Selector를 사용하여 불필요한 리렌더링을 방지하고 있는지, Immer 사용이 효율적인지 검토하세요.
2. 커스텀 훅: 비즈니스 로직 분리가 적절하며, 메모이제이션(useMemo, useCallback)이 필요한 곳에 적용되었는지 확인하세요.
3. 데이터 무결성: 비동기 데이터 페칭 시 경쟁 상태(Race Condition) 처리와 에러 핸들링을 확인하세요.
4. 구조 개선: 좀비 차일드(Zombie Child) 문제나 순환 참조가 발생할 수 있는 구조를 찾으세요.
5. 기능 제안: 상태 관리 구조를 단순화하거나, 개발자 경험(DX)을 개선할 수 있는 아키텍처적 개선안을 제안하세요.
"

PROMPTS["Backend_Rust_Core"]="
당신은 'Rust Systems Programmer'입니다.
다음 코드를 분석하고 한국어로 리뷰 리포트를 작성해주세요.

[리뷰 체크리스트]
1. 안전성(Safety): unwrap()이나 expect()를 남발하여 런타임 패닉을 유발할 수 있는 코드를 찾아 안전한 에러 처리로 바꾸세요.
2. 성능(Performance): 비동기 함수(async) 내에서 스레드를 차단하는(Blocking) I/O 작업이 있는지 검토하세요.
3. 동시성: Mutex나 RwLock 사용 시 데드락이 발생할 가능성이 있는 락 획득 순서를 분석하세요.
4. Rust 관용구: 불필요한 clone()이나 비효율적인 메모리 사용을 지적하고 Idiomatic Rust 패턴을 제안하세요.
5. 기능 제안: 백엔드 안정성을 높이기 위한 로깅(Tracing), 원격 측정, 혹은 자동 복구 메커니즘을 제안하세요.
"

PROMPTS["Backend_DB_Commands"]="
당신은 'Database & API Designer'입니다.
다음 코드를 분석하고 한국어로 리뷰 리포트를 작성해주세요.

[리뷰 체크리스트]
1. 쿼리 최적화: N+1 문제가 발생할 수 있는 쿼리 패턴이나 인덱스가 누락된 검색 로직을 찾으세요.
2. 트랜잭션: 데이터 수정 시 원자성이 보장되어야 하는 작업(예: 블록 이동)이 트랜잭션으로 묶여 있는지 확인하세요.
3. IPC 인터페이스: Tauri Command의 입력값 검증(Validation)이 철저한지, 타입 안전성이 보장되는지 확인하세요.
4. 확장성: 향후 스키마 변경이 어렵게 설계된 부분이 있는지 검토하세요.
5. 기능 제안: 데이터 분석, 검색 엔진 고도화, 또는 플러그인 시스템을 위한 DB 확장을 제안하세요.
"

PROMPTS["Security_Infra"]="
당신은 'Security & Infrastructure Engineer'입니다.
다음 코드를 분석하고 한국어로 리뷰 리포트를 작성해주세요.

[리뷰 체크리스트]
1. 보안 설정: Tauri capabilities 설정이 최소 권한 원칙을 따르는지, 과도한 권한(예: fs:allow-all)이 없는지 확인하세요.
2. 입력값 검증: 마크다운 렌더링 시 XSS 취약점이 발생할 수 있는 부분을 점검하세요.
3. 설정 최적화: tauri.conf.json 및 빌드 설정에서 보안적으로 취약하거나 최적화가 필요한 부분을 찾으세요.
4. 민감 정보: 코드 내에 하드코딩된 비밀 키나 경로가 없는지 확인하세요.
5. 기능 제안: 애플리케이션 보안을 강화하거나 배포 프로세스(CI/CD)를 개선할 수 있는 방안을 제안하세요.
"

# 3. 실행 상태 관리
declare -A PIDS
declare -A STATUS

# 초기 상태 설정
for role in "${ROLES[@]}"; do
    STATUS[$role]="$ICON_WAIT 대기 중..."
done

# 화면 지우기 및 커서 숨기기
tput civis
clear

echo "🚀 [Start] AI 코드 리뷰를 시작합니다..."
echo "📅 실행 시간: $(date '+%Y-%m-%d %H:%M:%S')"
echo "📂 저장 경로: $OUTPUT_DIR"
echo ""

# 4. 작업 실행 (백그라운드)
for role in "${ROLES[@]}"; do
    prompt="${PROMPTS[$role]}"
    targets="${TARGETS[$role]}"
    exts="${EXTS[$role]}"
    filename="${OUTPUT_DIR}/${role}.md"

    # 백그라운드 프로세스 시작
    (
        # 컨텍스트 수집
        full_context=""

        # 타겟 디렉토리 순회
        for dir in $targets; do
            if [ -d "$dir" ] || [ -f "$dir" ]; then
                # 확장자별 파일 검색
                for ext in $exts; do
                    # node_modules, dist, target 제외하고 파일 찾기
                    # Security_Infra의 경우 "." 타겟이므로 특정 파일만 필터링하는 로직 필요할 수 있음
                    found_files=$(find "$dir" -name "*.$ext" -type f \
                        -not -path "*/node_modules/*" \
                        -not -path "*/dist/*" \
                        -not -path "*/target/*" \
                        -not -path "*/.git/*" \
                        2>/dev/null)

                    for file in $found_files; do
                        # Security_Infra 특수 케이스: tauri-api.ts, tauri.conf.json 등 핵심 파일만
                        if [ "$role" == "Security_Infra" ]; then
                             if [[ "$file" != *"tauri.conf.json"* && "$file" != *"tauri-api.ts"* && "$file" != *"capabilities"* ]]; then
                                 continue
                             fi
                        fi

                        full_context+=$'\n'
                        full_context+="--- FILE START: $file ---"
                        full_context+=$'\n'
                        full_context+=$(cat "$file")
                        full_context+=$'\n'
                        full_context+="--- FILE END: $file ---"
                        full_context+=$'\n'
                    done
                done
            fi
        done

        # 최종 프롬프트 조합
        final_prompt="$prompt"$'\n\n'"=== SOURCE CODE CONTEXT ===$full_context"

        # Gemini 실행
        $GEMINI_CMD "$final_prompt" > "$filename" 2>&1

    ) &

    pid=$!
    PIDS[$role]=$pid
    STATUS[$role]="$ICON_WAIT 분석 및 작성 중..."
done

# 5. 모니터링 루프
draw_status() {
    tput cuu ${#ROLES[@]}
    for role in "${ROLES[@]}"; do
        tput el
        printf "  %-25s : %s\n" "$role" "${STATUS[$role]}"
    done
}

# 최초 공간 확보
for role in "${ROLES[@]}"; do echo ""; done

while true; do
    all_done=true
    for role in "${ROLES[@]}"; do
        pid=${PIDS[$role]}
        if kill -0 "$pid" 2>/dev/null; then
            all_done=false
        else
            wait "$pid"
            exit_code=$?
            if [ $exit_code -eq 0 ]; then
                STATUS[$role]="$ICON_DONE 완료"
            else
                STATUS[$role]="$ICON_FAIL 실패 (Code: $exit_code)"
            fi
        fi
    done
    draw_status
    if [ "$all_done" = true ]; then break; fi
    sleep 0.5
done

# 6. 마무리
tput cnorm
echo ""
echo "🎉 모든 리뷰가 완료되었습니다!"
echo "📄 결과 확인: $OUTPUT_DIR"
