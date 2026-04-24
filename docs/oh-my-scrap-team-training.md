# Oh My Scrap — Gemini CLI 병렬 Agent 자동화 실습 시나리오

> 팀 교육용 실전 가이드. 실제 5개 기능개발 요구사항을 가지고 Planner → Coder → Reviewer → Tester 파이프라인을 한 사이클 돌려본다. 핵심은 **사람이 판단해야 할 지점과 AI에게 넘겨도 되는 지점을 구분하는 것**이다.

---

## 0. 이 문서로 교육할 때의 목표

- `/parallel-dev` 한 줄로 feature 하나를 끝까지(계획 → 구현 → 교차검증 → 머지 준비) 자동 진행시킬 수 있다.
- 여러 요구사항이 있을 때 **무엇을 병렬로, 무엇을 순차로** 돌릴지 스스로 판단할 수 있다.
- Reviewer/Tester가 교차 검증하는 자동 루프가 왜 필요한지 설명할 수 있다.
- `BLOCKED` 같은 실패 상황에서 언제 개입하고 언제 그냥 재시도할지 안다.

---

## 1. 오늘 다룰 요구사항 (Oh My Scrap 5건)

| # | 요구사항 | 영향 영역 | 크기 |
|---|---------|-----------|------|
| 1 | 목록/카드뷰 토글버튼 크기를 AI/EN-KO 토글과 동일하게 | 상단 툴바 | XS |
| 2 | 모바일 하단 오른쪽 메뉴 `Input` → `Add` | 모바일 하단 네비 | XS |
| 3 | 모바일 웹에서 Add Scrap의 URL 붙여넣기 컨텍스트 메뉴가 사라지는 버그 | Add Scrap 다이얼로그/페이지 | S |
| 4 | 복사된 URL을 바로 붙여넣는 `Paste` 버튼 추가 | Add Scrap UI | S |
| 5 | Add Scrap 메뉴 삭제 → Archive로 통합 (상단 타이틀 "Oh My Scrap", 다이얼로그화, 상·하·사이드바 재배치) | 전체 레이아웃 + Archive + Add Scrap + 네비 | **L (여러 T-N)** |

---

## 2. 분석 단계 — AI에게 넘기기 전에 사람이 먼저

**교육 포인트 #1.** 요구사항을 그대로 5번 `/parallel-dev` 던지면 망합니다. 먼저 두 가지 관점으로 목록을 훑습니다.

### 2-1. 파일/영역 겹침 매트릭스

| | #1 토글 사이즈 | #2 Input→Add | #3 paste 버그 | #4 Paste 버튼 | #5 통합 리팩터 |
|-|:-:|:-:|:-:|:-:|:-:|
| #1 | — | ✕ | ✕ | ✕ | **⚠ 충돌** (#5가 토글 위치/존재 자체를 바꿈) |
| #2 | ✕ | — | ✕ | ✕ | **⚠ 충돌** (#5가 모바일 하단 메뉴를 재정의) |
| #3 | ✕ | ✕ | — | 약함 | **⚠ 충돌** (#5가 Add Scrap을 다이얼로그로 교체) |
| #4 | ✕ | ✕ | 약함 | — | **⚠ 흡수** (#5 요구사항에 Paste 기능이 포함됨) |
| #5 | ⚠ | ⚠ | ⚠ | ⚠ | — |

### 2-2. 결론

- **#5는 슈퍼피처**다. 혼자서 기존 Add Scrap · Archive · 상단 툴바 · 모바일 하단 네비 · 데스크탑 사이드바까지 재작성한다.
- **#1, #2, #4는 #5에 포함**된다. #5의 요구사항 안에 "토글 버튼 삭제/이동", "하단 메뉴 Add 버튼 배치", "url 붙여넣기 기능"이 명시되어 있다.
- **#3은 #5가 구 Add Scrap을 없애버리므로 자연 해소**된다. 새 다이얼로그에서 같은 버그가 재발하는지는 별도 검증 필요.

> 🎓 **교육 포인트 #2.** "5개 요구사항 = 5번 실행"이 아니다. **실제 실행 단위는 1~2개로 줄어든다.** 이 판단이 `/parallel-dev` 앞에서 항상 선행되어야 한다.

### 2-3. 실행 순서 결정

두 가지 옵션이 있다.

**옵션 A (권장)**: 먼저 #5를 돌린다 → 머지된 상태에서 #1, #2, #3, #4를 한 번 더 점검 → 잔여 이슈가 있으면 그것만 작은 `/parallel-dev`로 처리.

**옵션 B (비추)**: #1, #2 같은 XS 건 먼저 빨리 머지 → 이후 #5 진행. 하지만 #5가 #1, #2 작업 영역을 대부분 갈아엎기 때문에 커밋 히스토리만 지저분해지고 실질 이득이 없다.

**오늘은 옵션 A로 진행한다.**

---

## 3. 사전 준비 (최초 1회)

```powershell
# 1) 프로젝트 루트로 이동 — 반드시 여기서 gemini 실행
cd D:\develop\workspace\oh-my-scrap

# 2) 워킹트리 clean 확인 (worktree는 clean base를 전제)
git status
git checkout main
git pull

# 3) parallel-agent-kit 복사 (이미 했으면 스킵)
#    .gemini 폴더 + GEMINI.md 를 프로젝트 루트에 둔 상태여야 함

# 4) superpowers extension 설치 (이미 했으면 스킵)
gemini extensions install https://github.com/obra/superpowers

# 5) Gemini CLI 실행 — 반드시 YOLO 모드
gemini --yolo
```

> 🎓 **교육 포인트 #3.** `--yolo`가 무서운 게 아니다. 우리 `BeforeTool` 훅이 `git push --force`, `reset --hard`, `add -A` 같은 위험 명령을 이미 막는다. YOLO 없이 `auto_edit`으로 돌리면 Coder가 `npm test` 같은 shell 호출마다 프롬프트로 멈춰 병렬이 무력화된다.

실행 후 첫 화면에서 확인할 것:

- [ ] `Parallel Agent Kit — orchestration primer` 컨텍스트가 주입되었는가
- [ ] `/agents list`에 `planner / coder / reviewer / tester` 4개가 보이는가
- [ ] `/skills list`에 superpowers 14개 skill이 보이는가 (`using-superpowers`, `writing-plans`, `executing-plans`, `test-driven-development` 등)
- [ ] SessionStart 훅 에러 메시지가 없는가

하나라도 빠지면 실습 진행 전에 `.gemini/settings.json`을 다시 확인한다.

---

## 4. Day 1 — 슈퍼피처 #5 실행

### 4-1. 세션 시작

```
gemini --yolo --worktree oms-unify
```

`oms-unify`는 feature 슬러그다. 이후 `.gemini/worktrees/oms-unify-*`, `agent/oms-unify/T-N` 이름이 자동으로 붙는다.

### 4-2. 단 한 줄의 명령

```
> /parallel-dev Add Scrap 메뉴를 삭제하고 Archive 메뉴로 통합한다. 상단 타이틀은 "My Archive"에서 "Oh My Scrap"으로 변경한다. Add Scrap은 다이얼로그로 제공하며 url 입력창에 Paste 버튼과 붙여넣기 기능을 포함한다. 모바일 하단 네비는 왼쪽=목록/카드뷰, 오른쪽=Add 버튼. 상단에 있던 OFF/AI와 EN/KO 토글은 Add Scrap 다이얼로그 상단으로 이동하며 원래 자리에서는 삭제한다. 데스크탑 왼쪽 사이드바는 제거하고 로그아웃 버튼은 모바일과 유사한 위치로 옮긴다. 모바일 브라우저에서 url 입력창에 붙여넣기 컨텍스트 메뉴가 안정적으로 동작하는지 회귀 테스트를 포함한다.
```

> 🎓 **교육 포인트 #4.** 한 줄 안에 **측정 가능한 조건을 최대한 많이** 담는다. "상단 타이틀 Oh My Scrap", "하단 왼쪽=목록/카드뷰, 오른쪽=Add" 같은 구체적 명시는 Planner의 Acceptance Criteria 품질을 좌우한다. 애매하면 Planner가 Open Questions에 남기고 지나간다.

### 4-3. 5분 후 — Planner 결과 빠르게 검토 ★

파이프라인이 자동으로 진행되지만 Planner 결과는 **반드시 한 번 훑어야 한다.** 이후는 안 봐도 된다.

```powershell
# 다른 셸에서
code .gemini/plans/oms-unify.md
# 또는
cat .gemini/plans/oms-unify.md
```

체크할 것:

- [ ] Acceptance Criteria가 **관찰 가능**한가 (예: "Archive 화면에 Add Scrap 다이얼로그 트리거 버튼이 존재")
- [ ] Work Breakdown(T-N)의 `files:` 가 **실제 저장소 경로**인가 (가짜 경로면 Planner가 저장소를 못 본 것)
- [ ] `depends_on`이 논리적으로 맞는가 (예: 토글 이동(T-X)은 Add Scrap 다이얼로그(T-Y)에 의존)
- [ ] Verification Plan의 커맨드가 `npm test` 같은 실제로 있는 커맨드인가

**plan이 엉망이면 즉시 Ctrl-C → 요구사항을 더 구체적으로 다시 던진다.** Coder 이후로는 되돌리기 비용이 커진다.

### 4-4. 방치 — 30~60분

Planner 이후는 Coder 병렬 실행 → Reviewer+Tester 교차검증 → 재시도 루프가 자동으로 돈다. 다른 일 하고 온다. 화면에 이런 흐름이 찍힌다.

```
@coder T-1, T-2, T-3  (parallel)           ← 3개 동시 구현
  agent/oms-unify/T-1  ✓ commit abc123
  agent/oms-unify/T-2  ✓ commit def456
  agent/oms-unify/T-3  ✓ commit 7890ab

@reviewer T-1 | @tester T-1  (parallel)    ← 둘 다 병렬
  reviewer: pass  |  tester: pass   → READY

@reviewer T-2 | @tester T-2
  reviewer: fail (src/Archive.tsx:88 missing null guard)
  tester:   fail (expect toggle hidden, got visible)
  → @coder T-2 retry (Reviewer + Tester 피드백 묶어서)

  reviewer: pass | tester: pass → READY (retry 1/3)
```

> 🎓 **교육 포인트 #5.** Reviewer와 Tester는 서로 다른 관점을 본다. Reviewer는 **의도와 품질**(코드 스멜, 체크리스트), Tester는 **동작**(실제 테스트 exit code). 한 쪽만 있으면 둘 중 하나를 놓친다. 이게 "agent가 서로 검증"하는 핵심 메커니즘이다.

### 4-5. 완료 시점 — 사람이 해야 할 두 가지

```
## Parallel pipeline run
- Plan: .gemini/plans/oms-unify.md
- Ready to merge: [T-1, T-2, T-3, T-4, T-5]
- Blocked after retries: []
- Worktrees still live: .gemini/worktrees/oms-unify-T-*
```

이제 사람이 한다.

```powershell
# (1) 최종 diff 훑기 — "pass"라도 사람 눈 한 번
git log --oneline main..agent/oms-unify/T-1 agent/oms-unify/T-2 agent/oms-unify/T-3 agent/oms-unify/T-4 agent/oms-unify/T-5
git diff main..agent/oms-unify/T-5 -- src/

# (2) 머지 — 키트는 의도적으로 머지를 안 한다
git checkout main
git merge --no-ff agent/oms-unify/T-1 agent/oms-unify/T-2 agent/oms-unify/T-3 agent/oms-unify/T-4 agent/oms-unify/T-5
git push origin main

# (3) worktree 정리
# Gemini CLI 안에서
> /worktree:cleanup oms-unify
```

---

## 5. Day 1 후반 — #1~#4 잔여 점검

#5 머지 직후 **원래 요구사항 #1~#4가 이미 해결되었는지 직접 확인**한다. 이게 "5개인데 정말 5번 실행할 필요는 없었다"를 증명하는 단계다.

| 원본 요구사항 | 머지 후 상태 | 추가 실행 필요? |
|---------------|--------------|----------------|
| #1 토글 버튼 크기 | #5에서 토글을 Add Scrap 다이얼로그 내부로 옮기고 디자인 통일 | ❌ 해소 |
| #2 모바일 하단 `Input` → `Add` | #5에서 하단 네비 재정의 (Add 버튼 명시) | ❌ 해소 |
| #3 모바일 paste 컨텍스트 메뉴 버그 | 구 Add Scrap 제거 + 새 다이얼로그에 Paste 버튼 | ⚠ **회귀 확인 필요** |
| #4 Paste 버튼 | #5 다이얼로그 요구사항에 명시 | ❌ 해소 |

**#3만 남았다.** 신 다이얼로그에서 같은 현상이 재발하지 않는지 모바일 실기기 회귀 테스트가 필요하다. 재발이 확인되면:

```
gemini --yolo --worktree oms-paste-fix

> /parallel-dev 모바일 웹 브라우저에서 Add Scrap 다이얼로그의 URL 입력창을 꾹 눌렀을 때 브라우저 기본 "붙여넣기" 컨텍스트 메뉴가 깜빡이다 사라지는 현상을 수정한다. 재현: iOS Safari 17, Android Chrome 125. 회귀 테스트 케이스 포함.
```

재발하지 않으면 여기서 프로젝트 종료. 5개 요구사항이 **2번의 `/parallel-dev` 호출**로 해결된다.

---

## 6. 문제 대응 시나리오

### 6-1. "Blocked after retries: [T-N]"

Reviewer/Tester 3회 재시도 후에도 실패한 task. 구조적 문제 가능성이 높다.

1. `.gemini/reports/oms-unify/T-N.json` 을 열어 Tester의 failing excerpt 확인
2. `.gemini/plans/oms-unify.md`의 해당 T-N 정의 확인 → Acceptance Criteria가 비현실적이었는지 점검
3. 해결 경로 2가지
   - **재검증만 다시**: 환경 문제(환경변수 누락 등)라면 채워주고 `/pipeline:verify T-N .gemini/plans/oms-unify.md agent/oms-unify/T-N`
   - **해당 T-N 제외하고 머지**: 나머지는 정상이면 T-N 브랜치만 남겨두고 이슈 트래커에 옮긴다

### 6-2. Planner가 낸 plan이 엉망일 때

중간에 발견했다면 즉시 `Ctrl-C`. 기존 `.gemini/plans/*.md`와 worktree를 지우고 더 구체적인 요구사항으로 다시 시작한다.

```
> /worktree:cleanup oms-unify
```

파일도 수동 삭제:

```powershell
Remove-Item .gemini\plans\oms-unify.md
```

### 6-3. 같은 파일에 여러 Coder가 동시에 편집하려 할 때

Planner가 task를 쪼갤 때 `files:` 집합이 실수로 겹치면 병렬 Coder 중 나중 것이 merge conflict를 터뜨린다. 이 경우 오케스트레이터가 Coder에게 `needs_replan` 신호를 받고 자동으로 순차 재시도한다. 사람이 할 일은 plan의 `depends_on` 필드가 제대로 쳐졌는지 나중에 확인하는 것.

### 6-4. YOLO인데도 `guard-destructive-git` 훅이 계속 block

파이프라인이 의도치 않게 `git push --force`를 시도한 상황. 이건 **훅이 잘 일하고 있는 증거**다. 화면에 deny 이유가 한국어로 찍혀 있으니 그걸 Coder에게 그대로 붙여 넣어 재시도 요청하면 된다. 훅을 끄지 않는다.

---

## 7. 체크리스트 — 실습 전/중/후

### 실습 전
- [ ] 프로젝트 루트에서 `git status` → clean
- [ ] `.gemini/` 디렉터리와 `GEMINI.md`가 프로젝트 루트에 있음
- [ ] `gemini --yolo` 로 시작 (`--approval-mode=yolo`)
- [ ] superpowers extension 설치됨 (`/skills list`로 확인)
- [ ] 요구사항 5개에 대해 "겹침/의존성 매트릭스" 작성 완료

### 실행 중
- [ ] Planner 결과 plan 파일을 최소 한 번 열어봄
- [ ] 체크 후에는 화면을 계속 볼 필요 없음 — 다른 일 해도 됨
- [ ] `Ready to merge` 리스트를 보고서야 다시 화면 복귀

### 머지 전
- [ ] `git log` 로 브랜치들의 커밋 로그 확인
- [ ] 핵심 영역만 `git diff`로 육안 확인 (전부 볼 필요는 없음)
- [ ] `git merge --no-ff`로 머지 (fast-forward 막아서 브랜치 트레일 보존)

### 실습 후
- [ ] `/worktree:cleanup <slug>` 로 worktree와 브랜치 정리
- [ ] `.gemini/plans/` 의 plan 파일은 **보존** (추후 회고 자료)
- [ ] `.gemini/reports/` 의 Tester report는 원할 때 삭제

---

## 8. 팀원이 자주 틀리는 지점 (FAQ)

**Q. 요구사항 5개를 5개 pane에 한꺼번에 넣으면 더 빠르지 않나요?**
A. 느려지거나 망가집니다. (1) 요구사항들이 같은 영역을 건드리면 머지 충돌이 납니다. (2) Gemini 토큰/요청 한도에 부딪힙니다. (3) 사람이 검토해야 할 diff가 한 번에 쏟아져 사람이 병목이 됩니다. 최대 2~3 pane, 슈퍼피처가 있으면 1 pane.

**Q. `/parallel-dev` 한 번에 여러 요구사항을 동시에 줘도 되나요?**
A. 안 됩니다. Planner가 거대한 단일 plan을 만들어 task 간 의존성이 꼬입니다. 요구사항당 한 번 호출이 원칙. `subagent-driven-development` 스킬이 명시적으로 이 규칙을 강제합니다.

**Q. Reviewer가 pass 했는데 Tester가 fail이면 누구 말이 맞는 건가요?**
A. **둘 다 맞습니다.** Reviewer는 코드의 의도와 품질, Tester는 실제 동작을 본다. 한 쪽만 fail이어도 READY가 아니다. 두 피드백을 묶어 Coder에게 재시도 turn이 자동 발송됨.

**Q. 작업 중에 플랜이 잘못된 걸 깨달았어요. 어떻게 하나요?**
A. `Ctrl-C`로 중단 → `/worktree:cleanup <slug>` → plan 파일 삭제 → 새 `/parallel-dev` 호출. 이미 커밋된 브랜치가 있어도 worktree:cleanup이 정리해준다.

**Q. 머지를 AI가 자동으로 하면 안 되나요?**
A. **의도적으로** 못하게 해놨습니다. 머지는 사람이 결정할 마지막 게이트. YOLO 모드라도 `git merge`는 사람 손으로. 이게 뚫리면 이상한 코드가 main에 합쳐져도 모르게 됨.

**Q. `BLOCKED` 뜨면 바로 포기해야 하나요?**
A. 아니요. 90%는 환경 이슈(`.env` 누락, 의존성 미설치, 포트 충돌)입니다. Tester report의 excerpt 먼저 확인 → 환경 고친 뒤 `/pipeline:verify`로 재검증만 한 번 더 돌려보면 대개 통과한다.

**Q. YOLO 모드가 진짜 안전한가요?**
A. 100% 안전은 아니지만 이 키트에서는 (1) `BeforeTool` 훅이 위험 git 명령 차단 (2) 각 Coder가 자기 worktree에 갇혀 있음 (3) 머지는 사람이 수동. 이 3중 방어막이 있어서 실무 운영에서 사고 난 적 없다. 불안하면 첫 세션만 `--approval-mode=auto_edit`로 돌려서 감 잡고 이후 YOLO.

---

## 9. 오늘 실습의 한 줄 요약

> **5개 요구사항 = 5번 실행이 아니다.** 사람이 10분 투자해서 의존성 분석을 하면, 5개가 1~2번의 `/parallel-dev` 호출로 끝난다. 그 10분을 아끼려다 3시간을 날리지 말 것.

실습 끝. 다음 교육은 "여러 feature 간 완전 독립인 경우의 tmux/Warp 2-3 pane 롤링 패턴"으로 한다.
