# GitHub Issues-Based Development Workflow

이 문서는 Oxinot의 완전한 개발 워크플로우를 설명합니다.
GitHub Issues + Feature Branches + PRs + Changesets를 활용합니다.

## 전체 흐름 (한눈에 보기)

```
사용자가 아이디어 제시
        ↓
GitHub Issue 생성 (#123)
        ↓
Feature 브랜치 생성 (issue-123-feature-name)
        ↓
AI가 여러 커밋 수행
(각 커밋마다 changeset 자동 생성)
        ↓
Pull Request 생성
(자동으로 issue와 연결)
        ↓
사용자가 변경사항 검토 (자신의 코드)
        ↓
PR 병합 → main에 통합
        ↓
Changesets 누적
(여러 PR의 changeset이 모임)
        ↓
사용자가 npm run release
        ↓
버전 업데이트 + GitHub Release + 자동 빌드
```

## 단계별 상세 설명

### 1단계: GitHub Issue 생성

**사용자가 수행**

GitHub Web에서 Issue 생성:

```
Title: "Add block templates dropdown"

Description:
사용자가 블록 템플릿을 빠르게 삽입할 수 있는 드롭다운 메뉴 추가

## 요구사항
- 드롭다운 메뉴에 미리 정의된 템플릿들 표시
- 코드, 인용구, 리스트 템플릿 포함
- 자주 사용하는 템플릿은 커스터마이징 가능

## 관련 이슈
Improves #42

Labels: enhancement, good first issue
```

**왜 Issue를 먼저 만드나?**
- 작업의 의도와 요구사항을 명확히 함
- PR이 자동으로 Issue와 연결됨
- 나중에 이력 추적 가능
- 프로젝트 진행 상황을 한눈에 볼 수 있음

### 2단계: Feature 브랜치 생성

**AI 에이전트가 수행**

```bash
# 최신 main 브랜치에서 시작
git checkout main
git pull origin main

# Feature 브랜치 생성 (Issue 번호 포함)
git checkout -b issue-123-add-block-templates

# 또는 더 명확하게:
git checkout -b feat/block-templates-#123

# 브랜치 푸시 (원격 추적)
git push -u origin issue-123-add-block-templates
```

**브랜치 이름 컨벤션**
```
issue-123-short-description     # 권장
feat/description-#123
feature/description
fix/issue-#456-description
```

### 3단계: AI가 기능 구현 (여러 커밋)

**AI 에이전트가 수행**

Feature 브랜치에서 여러 커밋을 수행합니다. **Changeset은 자동으로 생성되지 않습니다** (feature 브랜치이므로).

```bash
# 커밋 1: UI 컴포넌트 추가
git commit -m "feat(editor): add block templates dropdown component

Create BlockTemplatesDropdown component with:
- Dropdown menu with predefined templates
- Click handler to insert selected template
- Styled with Mantine components"

# → 그냥 일반 커밋 (changeset 없음)

# 커밋 2: 템플릿 데이터 추가
git commit -m "feat(editor): add default block templates

Add predefined templates:
- Code blocks (JavaScript, TypeScript, Python, etc)
- Quote blocks
- List blocks (ordered, unordered, checklist)

Store in editorStore for easy access"

# → 그냥 일반 커밋 (changeset 없음)

# 커밋 3: 기능 통합
git commit -m "feat(editor): integrate templates with editor

Add button to toolbar to open templates dropdown.
Clicking template inserts it at current cursor position.
Tests included for template insertion."

# → 그냥 일반 커밋 (changeset 없음)

# 모든 커밋을 푸시 (changeset 파일 없음)
git push origin issue-123-add-block-templates
```

**여기서 중요한 점:**
- Feature 브랜치에서는 changeset이 생성되지 않음
- PR이 깔끔함 (코드 파일만)
- 3개의 커밋이 모두 main으로 전달됨

### 4단계: Pull Request 생성

**AI 에이전트 또는 사용자가 수행**

```bash
# GitHub CLI를 사용하면 자동 연결 가능:
gh pr create --title "Add block templates dropdown" \
  --body "
Implements #123 - Add block templates dropdown

## Changes
- BlockTemplatesDropdown component
- Default block templates (code, quote, list)
- Toolbar button integration

## Testing
- Dropdown opens on button click
- Templates insert correctly
- Styling matches design system

Closes #123
" \
  --base main
```

또는 GitHub Web에서 PR 생성:
- base: main
- compare: issue-123-add-block-templates
- Title: "Add block templates dropdown"
- Description에 "Closes #123" 작성
- 자동으로 #123과 연결됨!

### 5단계: 변경사항 검토

**사용자가 수행**

```bash
# PR 변경사항 확인:
# 1. GitHub Web에서 PR 탭 열기
# 2. "Files changed" 탭에서 변경사항 검토
# 3. Commits 탭에서 커밋 이력 확인
# 4. 각 changeset 파일 확인

# 또는 로컬에서:
git checkout issue-123-add-block-templates
git log main..HEAD --oneline  # main 이후의 커밋 확인
git diff main                  # 모든 변경사항 확인
```

**검토 포인트**
- ✅ 요구사항 모두 충족?
- ✅ 코드 품질 괜찮은가?
- ✅ 버그 없는가?
- ✅ 디자인이 일관적인가?
- (Changeset은 아직 없음 - main 병합 후 자동 생성됨)

### 6단계: PR 병합

**사용자가 수행**

GitHub Web에서:
1. PR 페이지 열기
2. "Merge pull request" 버튼 클릭
3. Merge strategy 선택 (권장: "Create a merge commit")
4. 병합 완료!
5. "Delete branch" 버튼으로 feature 브랜치 삭제

또는 CLI에서:
```bash
gh pr merge 123 --merge
```

**병합 직후 (자동으로!):**

✨ **Main 브랜치의 post-commit hook이 실행됩니다:**

1. 병합된 모든 커밋 분석
2. Conventional commits 파싱
3. 최고 수준의 버전 bump 결정:
   - 모두 `feat` → `minor` 버전
4. **한 번의 changeset 생성:**
   ```
   .changeset/happy-cats-jump.md
   ---
   "oxinot": minor
   ---
   
   - Add block templates dropdown component
   - Add default block templates
   - Integrate templates with editor
   ```
5. Changeset 자동 스테이징

**결과:**
- 깔끔한 feature 브랜치 (changeset 파일 없음)
- 깔끔한 PR (코드 파일만)
- Main에는 하나의 changeset 파일 (모든 변경사항 묶임)
- 모든 커밋 이력 보존

### 7단계: 여러 PR 병합 대기

시간이 지나면서 여러 PR들이 main으로 병합됩니다:

```
PR #123 병합 → 3개 changeset 추가 (minor)
PR #124 병합 → 2개 changeset 추가 (1 feat, 1 fix)
PR #125 병합 → 1개 changeset 추가 (1 fix)

현재 상황: main에 changeset이 6개 쌓여있음
```

### 8단계: 사용자가 Release 실행

**사용자가 수행**

```bash
# 1. 현재 상황 확인
npm run changeset:status --verbose

# 2. 만족하면 release!
npm run release

# 자동으로:
# ✓ 버전 계산: v0.1.0 → v0.2.0
# ✓ 모든 버전 파일 업데이트
# ✓ 릴리즈 커밋 생성
# ✓ Git 태그 생성
# ✓ 모든 changeset 파일 삭제
# ✓ GitHub로 푸시

# 3. GitHub Actions 자동 실행
# → 모든 플랫폼 빌드
# → GitHub Release 생성
# → 바이너리 업로드
```

## 현재 Changesets 설정

**당신의 현재 설정이 이 워크플로우에 완벽하게 맞습니다!**

### 왜 작동하는가?

1. **Feature 브랜치에서는 changeset 생성 안 함**
   - PR이 깔끔함 (코드 파일만)
   - 모든 커밋이 추적됨

2. **Main에 병합되는 순간 자동 생성**
   - Post-commit hook이 병합된 커밋들 분석
   - 하나의 changeset으로 묶음
   - 여러 PR의 changeset이 누적됨

3. **Release 시점에 한 번에 정리**
   - 모든 changeset 처리
   - 버전이 자동으로 계산됨

## Changesets 설정: 변경 필요 없음!

현재 설정 그대로 사용하면 됩니다.

### 현재 워크플로우

```
Feature 브랜치에서 여러 커밋
→ PR 생성 (깔끔함, changeset 없음)
→ PR 병합
→ Main에서 자동 changeset 생성 (한 번!)
→ 여러 PR의 changeset 누적
→ Release 시 모두 처리
```

### 장점

✅ Feature 브랜치가 깔끔함 (changeset 파일 없음)
✅ PR이 간결함 (코드 파일만)
✅ Feature별로 하나의 changeset (명확한 그룹화)
✅ 변경사항이 명확히 분류됨
✅ Main에 모든 이력 보존

## 추가 설정 (선택사항)

### GitHub PR 템플릿 추가

`.github/pull_request_template.md` 파일 생성:

```markdown
## Description
이 PR이 해결하는 내용을 설명합니다.

## Type of Change
- [ ] Bug fix (non-breaking)
- [ ] New feature (non-breaking)
- [ ] Breaking change

## Related Issues
Closes #

## Testing
어떻게 테스트했는지 설명합니다.

## Checklist
- [ ] My code follows the style guidelines
- [ ] I have performed a self-review
- [ ] Tests pass locally
```

### GitHub Issue 템플릿 추가

`.github/ISSUE_TEMPLATE/feature_request.md`:

```markdown
---
name: Feature request
about: 새로운 기능 제안
---

## 설명
이 기능이 어떤 문제를 해결하는지 설명합니다.

## 요구사항
- [ ] 요구사항 1
- [ ] 요구사항 2
- [ ] 요구사항 3

## 추가 정보
기타 컨텍스트가 있으면 작성합니다.
```

## 전체 예제: 다크 모드 추가

### 시나리오

```bash
# Step 1: Issue 생성 (GitHub Web)
Title: "Add dark mode support"
Issue #456 생성됨

# Step 2: 브랜치 생성 (AI)
git checkout main
git pull origin main
git checkout -b issue-456-dark-mode
git push -u origin issue-456-dark-mode

# Step 3: 구현 (AI가 여러 커밋)
git commit -m "feat(ui): add dark mode theme colors"
# → 일반 커밋 (changeset 없음)

git commit -m "feat(settings): add dark mode toggle"
# → 일반 커밋 (changeset 없음)

git commit -m "feat(storage): persist dark mode preference"
# → 일반 커밋 (changeset 없음)

git push origin issue-456-dark-mode

# Step 4: PR 생성 (깔끔함!)
gh pr create --title "Add dark mode support" \
  --body "Closes #456" \
  --base main
# → PR 파일 변경: ui, settings, storage (changeset 없음!)

# Step 5: 검토 (사용자)
# GitHub에서 변경사항 확인

# Step 6: PR 병합 (사용자)
gh pr merge 456 --merge

# ✨ Main 병합 직후:
# → Post-commit hook 실행
# → 3개 커밋 분석
# → 하나의 changeset 생성!
# .changeset/lazy-eagles-run.md
# ---
# "oxinot": minor
# ---
# 
# - Add dark mode theme colors
# - Add dark mode toggle
# - Persist dark mode preference

# 결과:
# Main에 1개 changeset 추가 (모든 변경사항 포함)
# Main에 3개 커밋 추가
# Issue #456 자동 closed

# Step 7-8: 다른 PR들도 병합됨...

# Step 9: Release (이후 여러 PR 병합 후)
npm run changeset:status
npm run release
# → v0.2.0으로 릴리즈!
```

## 요약 테이블

| 단계 | 담당 | 작업 |
|------|------|------|
| 1 | 사용자 | GitHub Issue 생성 |
| 2 | AI | Feature 브랜치 생성 |
| 3 | AI | 여러 커밋 (changeset 자동 생성) |
| 4 | AI/사용자 | PR 생성 |
| 5 | 사용자 | 변경사항 검토 |
| 6 | 사용자 | PR 병합 |
| 7 | 반복 | 다른 PR들도 병합 |
| 8 | 사용자 | `npm run release` 실행 |

## AI 에이전트를 위한 지침

### Issue에서 브랜치 생성 시

```bash
# Issue 번호를 브랜치 이름에 포함
git checkout -b issue-123-feature-name

# 또는
git checkout -b feat/feature-name-#123
```

### 여러 커밋을 할 때

```bash
# 각 커밋마다 conventional commits 형식 사용
git commit -m "type(scope): description"

# Changeset은 자동으로 생성되므로 신경쓸 필요 없음
```

### PR 생성할 때

```bash
# PR 설명에 "Closes #123" 포함
gh pr create --title "..." \
  --body "Closes #123" \
  --base main
```

## 추가 정보

- 자세한 커밋 가이드: `AGENTS.md`
- 버전 관리: `VERSION.md`
- 릴리즈 프로세스: `RELEASE.md`
- 전체 워크플로우: `DEVELOPMENT_WORKFLOW.md`
