#!/bin/bash

# ==============================================================================
# AI 병렬 코드 리뷰 실행 스크립트 (Progress Display)
# ==============================================================================

# 1. 설정
GEMINI_CMD="gemini"
OUTPUT_DIR="docs/code_reviews"
mkdir -p "$OUTPUT_DIR"
CURRENT_DATE=$(date +"%Y-%m-%d")

# 상태 아이콘
ICON_WAIT="⏳"
ICON_DONE="✅"
ICON_FAIL="❌"

# 역할 및 프롬프트 정의
ROLES=("UI_UX" "State_Logic" "Backend_Rust" "Security_IPC")
declare -A PIDS
declare -A STATUS
declare -A LOGS

# 프롬프트 정의
PROMPTS[0]="당신은 'UI/UX & Component Specialist'입니다. src/components, src/styles를 리뷰하세요. 1.재사용성 2.스타일링 3.i18n 4.접근성 위주로."
PROMPTS[1]="당신은 'State & Logic Architect'입니다. src/stores, src/hooks, src/outliner를 리뷰하세요. 1.Hooks최적화 2.Store복잡도 3.데이터무결성 위주로."
PROMPTS[2]="당신은 'System & Rust Backend Engineer'입니다. src-tauri/src를 리뷰하세요. 1.Safety(unwrap) 2.비동기/IO에러 3.Rust관용구 위주로."
PROMPTS[3]="당신은 'Security & IPC Inspector'입니다. src/tauri-api.ts, tauri.conf.json를 리뷰하세요. 1.입력값검증 2.권한최소화 3.민감정보 위주로."

# 초기 상태 설정
for role in "${ROLES[@]}"; do
    STATUS[$role]="$ICON_WAIT Pending..."
done

# 화면 지우기 및 커서 숨기기
tput civis
clear

echo "🚀 [Start] $CURRENT_DATE 코드 리뷰를 시작합니다..."
echo "📂 저장 경로: $OUTPUT_DIR"
echo ""

# ------------------------------------------------------------------------------
# 2. 작업 실행 (백그라운드)
# ------------------------------------------------------------------------------
for i in "${!ROLES[@]}"; do
    role="${ROLES[$i]}"
    prompt="${PROMPTS[$i]}"
    filename="${OUTPUT_DIR}/${CURRENT_DATE}_${role}.md"
    
    # 실제 명령어 실행 (백그라운드)
    # 2>&1 출력을 /dev/null로 보내거나 로그 파일로 보냅니다.
    ($GEMINI_CMD "$prompt" > "$filename" 2>&1) &
    pid=$!
    PIDS[$role]=$pid
    STATUS[$role]="$ICON_WAIT Processing..."
done

# ------------------------------------------------------------------------------
# 3. 모니터링 루프 (프로그레스 바)
# ------------------------------------------------------------------------------
draw_status() {
    # 커서를 위로 4줄 이동 (역할 개수만큼)
    tput cuu 4
    for role in "${ROLES[@]}"; do
        # 라인 전체 지우기 후 출력
        tput el
        printf "  %-20s : %s\n" "$role" "${STATUS[$role]}"
    done
}

# 최초 출력 공간 확보
for role in "${ROLES[@]}"; do echo ""; done

while true; do
    all_done=true
    
    for role in "${ROLES[@]}"; do
        pid=${PIDS[$role]}
        
        # 프로세스가 실행 중인지 확인 (kill -0)
        if kill -0 "$pid" 2>/dev/null; then
            all_done=false
            # 심심하지 않게 애니메이션 효과를 줄 수도 있음
        else
            # 프로세스 종료됨 -> 종료 코드 확인
            wait "$pid"
            exit_code=$?
            
            if [ $exit_code -eq 0 ]; then
                STATUS[$role]="$ICON_DONE Completed"
            else
                STATUS[$role]="$ICON_FAIL Failed (Code: $exit_code)"
            fi
        fi
    done
    
    draw_status
    
    if [ "$all_done" = true ]; then
        break
    fi
    
    sleep 0.5
done

# ------------------------------------------------------------------------------
# 4. 마무리
# ------------------------------------------------------------------------------
tput cnorm # 커서 다시 보이기
echo ""
echo "🎉 모든 리뷰가 완료되었습니다!"