# 코파일럿 블록 생성 수정 - 최종 요약

## 🎯 문제 정의

### 당신의 설명
> "마크다운 문법은 지원하지. 헤딩 써도 되는데. **우리 인간이 문서를 쓸 때에는 엔터를 눌러 개행하면 밑에 새로운 블록이 분할되는거지** 해당 블록 안에서 개행되는게 아니야."

### 즉:
- 마크다운은 OK ✅
- 마크다운이 **한 블록 안에 \n으로 여러 줄**이 들어가는 게 문제 ❌
- 각 **의미 있는 줄**이 별도의 블록이어야 함 ✅

---

## 📊 수정 전 vs 수정 후

### 수정 전 (현재 문제)
```
코파일럿: "다음 내용으로 페이지 만들게요"
↓
AI: create_page_with_blocks({
  blocks: [{
    content: "# Project: Oxinot Documentation\n\nOverview\nOxinot is a block-based outliner...\n\nKey Features\n- Local-first architecture\n- Block-based editing\n\nTech Stack\n- Frontend: React...\n- Backend: Tauri..."
  }]
})
↓
결과 화면:
[한 개의 불렛 포인트]
- Project: Oxinot Documentation
  (이 한 블록 안에 모든 내용이 \n으로 연결됨)

사용자 경험:
- 이 블록을 클릭하고 엔터 누르기 → 줄만 바뀜
- 새로운 블록이 안 만들어짐 → 아웃라이너 같지 않음
```

### 수정 후 (기대되는 동작)
```
AI: create_page_with_blocks({
  blocks: [
    { content: "Project: Oxinot Documentation", indent: 0 },
    { content: "Overview", indent: 1 },
    { content: "Oxinot is a block-based outliner...", indent: 2 },
    { content: "Key Features", indent: 1 },
    { content: "Local-first architecture", indent: 2 },
    { content: "Block-based editing", indent: 2 },
    { content: "Tech Stack", indent: 1 },
    { content: "Frontend: React + TypeScript + TailwindCSS", indent: 2 },
    { content: "Backend: Tauri + Rust", indent: 2 }
  ]
})
↓
결과 화면:
- Project: Oxinot Documentation        [블록 1]
  - Overview                           [블록 2]
    - Oxinot is a block-based...       [블록 3]
  - Key Features                       [블록 4]
    - Local-first architecture         [블록 5]
    - Block-based editing              [블록 6]
  - Tech Stack                         [블록 7]
    - Frontend: React + TypeScript...  [블록 8]
    - Backend: Tauri + Rust            [블록 9]

사용자 경험:
- 각 항목이 개별 블록
- "Features" 블록에서 엔터 누르기 → 새로운 블록 생성
- Logseq/Roam 스타일 ✅
```

---

## ✅ 수정 사항

### 파일
`src/services/ai/agent/orchestrator.ts`

### 메서드
`buildSystemPrompt()` 라인 273-327

### 변경 내용
시스템 프롬프트의 "⭐ CRITICAL" 섹션을 다음과 같이 수정:

**핵심 개념**:
```
❌ WRONG: blocks: [{ content: "Line1\nLine2\nLine3" }]
✅ RIGHT: blocks: [
  { content: "Line1", indent: 0 },
  { content: "Line2", indent: 0 },
  { content: "Line3", indent: 0 }
]
```

**구체적 지침**:
1. 마크다운을 파싱할 때 **줄 단위로 분리**
2. 각 줄을 **별도의 블록**으로 생성
3. **indent 값으로 계층 구조** 표현
4. 블록 content에는 **\n을 포함하지 말 것**
5. 생성 전에 **체크리스트 확인**

---

## 🔧 적용 방법

### Step 1: 파일 열기
```bash
src/services/ai/agent/orchestrator.ts
```

### Step 2: 라인 273 ~ 327 교체
기존 "⭐ CRITICAL: STRUCTURED CONTENT..." 섹션을 새 "⭐ CRITICAL: MARKDOWN TO BLOCKS CONVERSION..." 섹션으로 교체

### Step 3: 검증
```bash
npm run lint
```

### Step 4: 테스트
코파일럿에게 "데모 노트 작성" 요청 → 각 항목이 별도 블록으로 생성되는지 확인

---

## 📋 체크리스트

수정 완료 후 확인사항:

- [ ] `orchestrator.ts` 라인 273-327 수정됨
- [ ] 새 CRITICAL 섹션이 "MARKDOWN TO BLOCKS CONVERSION" 포함
- [ ] WRONG ❌ 예제와 RIGHT ✅ 예제가 모두 포함됨
- [ ] INDENT CALCULATION RULES 섹션이 있음
- [ ] VERIFICATION CHECKLIST가 있음
- [ ] `npm run lint` 통과
- [ ] 코파일럿 테스트: 구조화된 콘텐츠가 여러 블록으로 생성됨

---

## 💡 AI가 이제 이해할 것

### 문제 인식
> "아, 마크다운으로 여러 줄을 한 블록에 넣으면 안 되겠네"

### 해결책
> "각 줄을 파싱해서 별도 블록으로 만들어야겠다"

### 구체적 처리
```
마크다운:
# Heading 1
Content 1
## Heading 2
Content 2

변환:
blocks: [
  { content: "Heading 1", indent: 0 },
  { content: "Content 1", indent: 1 },
  { content: "Heading 2", indent: 1 },
  { content: "Content 2", indent: 2 }
]
```

---

## 🎯 예상 효과

### 사용자 관점
- ✅ 각 항목이 개별 블록 (아웃라이너처럼 느껴짐)
- ✅ 엔터로 새로운 블록 생성 가능
- ✅ Logseq/Roam 스타일의 계층 구조
- ✅ 블록 단위로 편집/삭제 가능

### 개발자 관점
- ✅ AI가 **마크다운-블록 변환**을 명확히 이해
- ✅ 새로운 기능 추가 시 동일한 패턴 적용 가능
- ✅ 사용자 경험 일관성 향상

---

## ⚠️ 주의사항

### 코드 블록은 예외
```python
def hello():
    print("Hello, world!")
```

이런 **코드 블록은 그대로** 한 블록에 넣기 (triple backtick으로 감싸기)

### 긴 문단도 OK
한 개의 의미 있는 문단은 한 블록에 넣어도 됨:
```
{ content: "This is a long paragraph about the project. It spans multiple sentences but is still one semantic unit.", indent: 1 }
```

문제는 **구조적 요소들(헤딩, 리스트, 섹션)**을 한 블록에 넣는 것

---

## 📚 참고

### 블록 구조의 이점
```
Logseq/Roam 식 (당신이 원하는):
- 각 블록이 독립적
- 접기/펼치기 가능
- 블록 단위로 편집
- 블록 간 관계 표현 가능

일반 마크다운 (현재 문제):
- 모든 게 한 문서
- 계층은 시각적일 뿐
- 실제로는 평탄함
```

---

## ✨ 최종 정리

### 근본 원인
AI가 마크다운의 **"줄"과 "블록"의 관계**를 이해하지 못함

### 해결책
시스템 프롬프트에 **명시적 변환 알고리즘** 추가

### 결과
- ✅ 구조화된 콘텐츠가 자동으로 여러 블록으로 생성
- ✅ 사용자 경험이 Logseq/Roam처럼 개선
- ✅ 아웃라이너로서의 완성도 향상

---

**수정 파일**: `src/services/ai/agent/orchestrator.ts`  
**변경 라인**: 273-327  
**변경 난이도**: ⭐⭐ (간단한 텍스트 교체)  
**예상 테스트**: 수동 테스트 (코파일럿에 "데모 작성" 요청)

이제 실제로 수정 코드를 적용한 상태입니다. ✅
