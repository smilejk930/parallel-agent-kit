# Oh My Scrap — 병렬 Agent 자동화 효용성 데모 시나리오

> **목적:** 팀에게 Gemini CLI 병렬 agent 자동화가 "수동 개발 대비 무엇을 다르게 해주는지" 실제 코드 변경을 통해 눈으로 보여준다. 작은 UI 개선 4건을 한 번의 파이프라인 호출로 동시에 처리한다.

---

## 1. 오늘 데모의 4개 요구사항

| # | 요구사항 | 예상 수동 작업량 |
|---|---------|:---------------:|
| 1 | 목록/카드뷰 토글버튼 크기를 AI 토글, EN/KO 토글과 동일하게 변경 | 30분 |
| 2 | 모바일 하단 오른쪽 메뉴의 `Input` 단어를 `Add`로 변경 | 10분 |
| 3 | 모바일 웹 브라우저에서 Add Scrap URL 입력창을 길게 눌렀을 때 `붙여넣기` 컨텍스트 메뉴가 깜빡이다 사라지는 버그 수정 | 60~90분 (원인 추적 포함) |
| 4 | 복사한 URL을 바로 붙여넣는 `Paste` 버튼 추가 | 30분 |
| — | **수동 합계** | **2~3시간** |
| — | PR 리뷰 대기 + 머지 오버헤드 | **+1~2시간** |

## 2. 이 4개가 "병렬 데모용"으로 이상적인 이유

### 2-1. 겹침 분석

| | #1 | #2 | #3 | #4 |
|---|:-:|:-:|:-:|:-:|
| #1 | — | 독립 | 독립 | 독립 |
| #2 | | — | 독립 | 독립 |
| #3 | | | — | **동일 컴포넌트** (URL 입력창) |
| #4 | | | | — |

- **#1, #2**: 전혀 다른 영역. 완전 병렬 가능.
- **#3, #4**: 같은 `AddScrap URL 입력 컴포넌트`를 건드린다. 순차 처리가 안전.
- 결론: 3개 흐름이 병렬로 굴러감. Planner가 이걸 자동으로 그려준다.

### 2-2. 왜 하나의 `/parallel-dev`로 처리하는가

> 주의: 평소에는 "요구사항당 `/parallel-dev` 1회"가 원칙입니다. 오늘은 **작고 주제가 일관된(UI/UX 마이크로 개선) 요구사항 묶음**이기 때문에 하나의 plan으로 묶어도 Planner가 꼬이지 않습니다. 동시에 이게 **데모에서 병렬성이 가장 극적으로 보이는 선택**이기도 합니다.

규모가 큰 기능 여러 개일 때는 여전히 나눠서 호출하세요.

---

## 3. 데모 진행 순서 (예상 ~35분 + pane 준비 1분)

### ⓪ 발표 환경 세팅 — 4-pane 모니터 레이아웃 (발표 시작 전, 1분)

이 데모의 설득력은 "하나의 명령이 동시에 여러 곳에서 일을 벌인다"를 **청중이 눈으로 보게 만드는 것**에 달렸다. 단일 터미널만 쓰면 출력 스트림이 섞여서 병렬성이 논리적으로만 느껴진다. 그래서 **주 pane 하나(사람의 입력) + 모니터 pane 3개(병렬성의 증거)**로 나눈다.

**pane 구성 (tmux 또는 Warp 4분할):**

```
┌───────────────────────────────────┬──────────────────────────────────┐
│ PANE 1 ★ MAIN (화면 50% 이상)       │ PANE 2  git 활동 실시간          │
│ Gemini CLI 오케스트레이터             │ worktree + branch 모니터          │
│ /parallel-dev 실행 중               │                                   │
├───────────────────────────────────┼──────────────────────────────────┤
│ PANE 3  산출물 디렉터리 실시간        │ PANE 4  최신 Tester 리포트 JSON   │
│ plans / reports / worktrees 성장   │ pass/fail 판정의 객관성 증거       │
└───────────────────────────────────┴──────────────────────────────────┘
```

**pane 2 — worktree/브랜치 모니터**

PowerShell:

```powershell
while ($true) {
  Clear-Host
  Write-Host "## worktrees"; git worktree list
  Write-Host "`n## agent branches"; git branch --list 'agent/*' -v
  Start-Sleep 1
}
```

bash (WSL / Git Bash / macOS):

```bash
watch -n 1 "git worktree list && echo --- && git branch --list 'agent/*' -v"
```

**pane 3 — 산출물 디렉터리 실시간**

PowerShell:

```powershell
while ($true) {
  Clear-Host
  Write-Host "## plans";     Get-ChildItem .gemini\plans    -EA SilentlyContinue | Select Name,LastWriteTime
  Write-Host "`n## reports"; Get-ChildItem .gemini\reports  -Recurse -EA SilentlyContinue | Select FullName,LastWriteTime
  Write-Host "`n## worktrees"; Get-ChildItem .gemini\worktrees -EA SilentlyContinue | Select Name
  Start-Sleep 2
}
```

bash:

```bash
watch -n 2 "echo '## plans'; ls -lt .gemini/plans 2>/dev/null;
            echo; echo '## reports'; find .gemini/reports -type f 2>/dev/null;
            echo; echo '## worktrees'; ls -lt .gemini/worktrees 2>/dev/null"
```

**pane 4 — 최신 Tester 리포트 JSON**

PowerShell (jq 가 없다면 `ConvertFrom-Json | ConvertTo-Json -Depth 8` 로 대체):

```powershell
while ($true) {
  Clear-Host
  $f = Get-ChildItem .gemini\reports -Recurse -Filter '*.json' -EA SilentlyContinue |
       Sort-Object LastWriteTime -Descending | Select-Object -First 1
  if ($f) { Write-Host "## $($f.FullName)"; Get-Content $f.FullName | ConvertFrom-Json | ConvertTo-Json -Depth 8 }
  else    { Write-Host "(waiting for tester reports...)" }
  Start-Sleep 2
}
```

bash:

```bash
watch -n 2 "f=\$(find .gemini/reports -name '*.json' -printf '%T@ %p\n' 2>/dev/null | sort -rn | head -1 | awk '{print \$2}'); \
            [ -n \"\$f\" ] && echo \"## \$f\" && cat \"\$f\" | jq . || echo '(waiting...)'"
```

**발표 중 pane 포커스 이동 대사 (시연자 스크립트):**

- ② Gemini 실행 직후 → "**PANE 2를 보세요.** worktree 4개가 동시에 등장합니다."
- ⑤ Coder 병렬 실행 중 → "**PANE 3를 보세요.** plans 디렉터리, reports 디렉터리가 사람 없이 차오르고 있습니다."
- ⑥ Reviewer+Tester 교차검증 → "**PANE 4를 보세요.** 이건 사람이 쓴 리뷰 코멘트가 아니라 기계가 만든 구조화 데이터입니다."
- ⑧ 머지 직전 → "**PANE 1로 돌아갑니다.** 자동은 여기까지. 결정은 사람이 합니다."

**주의:**

- pane 5개 이상은 청중 시선이 분산됩니다. **4개가 상한.**
- 반드시 리허설해서 `watch`/`while` 루프가 정상 동작하는지 확인. pane 하나가 멈춰 있으면 그 pane으로 시선이 쏠립니다.
- PowerShell에서 `Clear-Host`가 깜빡이면 pane 2/3/4는 WSL로 돌리고 pane 1만 PowerShell로 남기는 편이 시각적으로 부드럽습니다.

---

### ① 세팅 확인 — 30초

```powershell
cd D:\develop\workspace\oh-my-scrap
git status                  # clean이어야 함
git checkout main && git pull
```

청중에게 보여줄 포인트:
> "지금 저장소는 깨끗한 main입니다. 이 상태에서 4개 UI 개선을 동시에 진행시키겠습니다."

### ② Gemini CLI 실행 — 30초

```powershell
gemini -m gemini-3-flash-preview --yolo --worktree oms-ui-polish
```

`--yolo`는 모든 도구 호출을 자동 승인한다는 뜻. 위험 명령(force-push, hard-reset 등)은 `BeforeTool` 훅이 여전히 차단한다. `--worktree`는 main을 건드리지 않는 격리된 작업공간을 만든다.

청중 코멘트:
> "우리 개발자가 main 브랜치를 직접 수정할 일은 이제 없습니다. 모든 작업은 `agent/oms-ui-polish/T-N` 브랜치에서 일어납니다."

### ③ 한 줄 명령 — 30초

```
> /parallel-dev 네 가지 UI 개선을 한 번에 적용한다.
  1) 상단 툴바의 목록/카드뷰 토글버튼 크기를 기존 AI(OFF/AI) 토글과 EN/KO 토글과 동일하게 맞춘다.
  2) 모바일 하단 네비게이션 오른쪽의 "Input" 라벨을 "Add"로 변경한다.
  3) 모바일 웹 브라우저에서 Add Scrap의 URL 입력창을 길게 눌렀을 때 브라우저 기본 "붙여넣기" 컨텍스트 메뉴가 깜빡이다 사라지는 회귀 버그를 수정한다. iOS Safari 17, Android Chrome 125에서 재현 확인.
  4) 같은 URL 입력창 옆에 클립보드의 URL을 한 번에 붙여넣는 "Paste" 버튼을 추가한다. 클립보드 API 권한 거부 시에도 UX가 깨지지 않도록 fallback 처리.
```

청중 코멘트:
> "여기까지가 사람이 치는 전부입니다. 이후 모든 단계가 자동입니다."

### ④ Planner 결과 감상 — 3~5분 ★ 핵심 장면

2~3분 후 `.gemini/plans/oms-ui-polish.md`가 생성된다. **같이 열어서 읽는다.**

```powershell
code .gemini/plans/oms-ui-polish.md
```

청중에게 보여줄 것:

- `Acceptance Criteria`가 관찰 가능한 형태로 쓰여 있다 ("토글 3종의 높이가 모두 32px")
- `Work Breakdown`이 4개 T-N으로 쪼개져 있다
- `depends_on` 필드로 T-3와 T-4는 순차, T-1/T-2는 병렬 가능이 표시된다
- `files:` 집합이 실제 저장소의 경로를 가리킨다 (Planner가 저장소를 실제로 탐색했다는 증거)
- `Verification Plan`에 실제 실행 가능한 커맨드가 있다 (`npm test`, `npm run e2e:mobile` 등)
- `Review Checklist`가 프로젝트 스타일 가이드 항목까지 반영되어 있다

청중 코멘트:
> "이 plan은 사람이 작성한 게 아닙니다. 요구사항 한 문단과 저장소 분석만으로 Planner가 3분 만에 만들었습니다. 팀 리드가 PR 설명에 쓸 만한 완성도입니다."

### ⑤ 병렬 Coder 실행 장면 — 10~15분

Planner 완료 직후 3개 Coder가 **동시에** 별개의 worktree에서 돈다.

화면에 이런 로그가 찍힌다:

```
spawning worktrees…
  .gemini/worktrees/oms-ui-polish-T-1  (branch: agent/oms-ui-polish/T-1)
  .gemini/worktrees/oms-ui-polish-T-2  (branch: agent/oms-ui-polish/T-2)
  .gemini/worktrees/oms-ui-polish-T-3  (branch: agent/oms-ui-polish/T-3)

dispatching in parallel:
  @coder T-1   <세로 1번>
  @coder T-2   <세로 2번>
  @coder T-3   <세로 3번>

(T-4는 T-3의 구현이 끝난 뒤 순차 실행 — 같은 파일 편집)
```

**이 장면이 데모의 Money Shot입니다.** 청중에게:

> "지금 이 순간, Gemini CLI 안에서 세 명의 개발자가 각자 다른 worktree에서 동시에 코드를 쓰고 있습니다. 수동이었다면 1명 개발자가 30 + 10 + 90 = 130분을 순차로 보냈을 겁니다. 지금은 약 15분이면 끝납니다."

Coder가 각자 커밋하면서 활성화된 superpowers 스킬을 보여줄 수도 있다.

```
T-1: activate_skill(executing-plans, test-driven-development)
T-3: activate_skill(systematic-debugging)  ← 버그 재현 단계부터 시작
```

### ⑥ Reviewer + Tester 교차검증 — 5~10분 ★ 두 번째 핵심 장면

Coder가 커밋을 떨어뜨릴 때마다 **같은 T-N에 대해 Reviewer와 Tester가 동시에 dispatch된다.**

```
@reviewer T-1 | @tester T-1   (parallel)
  reviewer → pass (checklist 4/4, findings 0)
  tester   → pass (npm run test:ui exit 0, 12 tests)
  → T-1 READY

@reviewer T-3 | @tester T-3   (parallel)
  reviewer → fail (src/AddScrap/UrlInput.tsx:44 – 터치 이벤트 preventDefault 누락)
  tester   → fail (e2e:mobile scenario "paste menu stays" failed)
  → @coder T-3 retry  (Reviewer findings + Tester excerpt 합쳐서 단일 retry 프롬프트)

  (1회 재시도 후)
  reviewer → pass
  tester   → pass
  → T-3 READY (1/3 retries used)
```

청중에게 강조할 것:

- Reviewer와 Tester는 **서로의 결과를 보지 않는다** (격리 컨텍스트). 두 관점이 독립적으로 같은 코드를 판단하는 것.
- 한쪽만 fail이어도 자동 재시도. 사람은 아무것도 안 한다.
- 재시도가 3회 실패하면 `BLOCKED`로 남고 사람에게 패스. 무한 루프가 아니다.
- `guard-destructive-git` 훅이 실제로 일하는 걸 보려면 plan에 "force-push" 같은 단어를 넣어보면 된다 — 훅이 즉시 deny.

### ⑦ 최종 리포트 — 1분

```
## Parallel pipeline run
- Plan: .gemini/plans/oms-ui-polish.md
- Ready to merge: [T-1, T-2, T-3, T-4]
- Blocked after retries: []
- Worktrees still live:
    .gemini/worktrees/oms-ui-polish-T-1  (agent/oms-ui-polish/T-1)
    .gemini/worktrees/oms-ui-polish-T-2  (agent/oms-ui-polish/T-2)
    .gemini/worktrees/oms-ui-polish-T-3  (agent/oms-ui-polish/T-3)
    .gemini/worktrees/oms-ui-polish-T-4  (agent/oms-ui-polish/T-4)
- Next action for human: review & merge 4 branches, then /worktree:cleanup
```

### ⑧ 사람이 하는 유일한 결정 — 5분

```powershell
# 1) 사람 눈으로 diff 훑기 (이것만 진짜 사람이 봐야 함)
git log --oneline main..agent/oms-ui-polish/T-4 agent/oms-ui-polish/T-3 agent/oms-ui-polish/T-2 agent/oms-ui-polish/T-1
git diff main..agent/oms-ui-polish/T-3 -- src/AddScrap/

# 2) 머지 — 오케스트레이터는 의도적으로 머지를 안 한다
git checkout main
git merge --no-ff agent/oms-ui-polish/T-1 agent/oms-ui-polish/T-2 agent/oms-ui-polish/T-3 agent/oms-ui-polish/T-4
git push origin main

# 3) 정리
```

```
> /worktree:cleanup oms-ui-polish
```

청중 코멘트:
> "제가 키보드로 친 건 `gemini -m gemini-3-flash-preview --yolo --worktree`, `/parallel-dev` 한 줄, 그리고 `git merge` 한 줄. 세 번입니다. 4개 UI 개선이 하나의 커밋 시리즈로 main에 들어갔습니다."

---

## 4. 데모 전후 비교 (청중에게 보여줄 슬라이드)

### 4-1. 월-클락 시간

```
[수동 방식]
 ├─ #1 구현 (30m) ──────
 │                      ├─ #2 구현 (10m) ──
 │                                           ├─ #3 원인 추적 + 수정 (90m) ───────
 │                                                                                ├─ #4 구현 (30m) ─
 │                                                                                                  ├─ PR 리뷰 대기 (1~2h)
 └─ 실제 소요: 3~4시간+  ─────────────────────────────────────────────────────────────────────►

[병렬 Agent 자동화]
 ├─ Planner (3m) ─
 │                ├─ Coder T-1 (15m) ─┐
 │                ├─ Coder T-2  (5m) ─┤ 병렬
 │                └─ Coder T-3 (15m) ─┘
 │                                    └─ Coder T-4 (10m, T-3 의존) ─
 │                                                                    ├─ Review+Test 병렬 (5m)
 │                                                                                                └─ 머지 (3m)
 └─ 실제 소요: ~35~40분 ─────────────────────────────────────────────────────►
```

### 4-2. 사람 관여 시간

| 단계 | 수동 | 병렬 Agent |
|------|:----:|:-----------:|
| 요구사항 작성/분배 | 20분 | 2분 (한 줄) |
| 구현 중 개발자 집중 | 160분 | 0분 (방치) |
| 리뷰 작성 | 30분 | 0분 (자동) |
| 재작업 요청 반영 | 30분 | 0분 (자동) |
| 최종 머지 확인 | 15분 | 5~10분 |
| **합계** | **4시간+** | **~15분** |

### 4-3. 품질 보증

| | 수동 PR | 병렬 Agent |
|---|--------|-----------|
| 리뷰 1차 | 리뷰어 1명 (주관적) | Reviewer(의도) + Tester(동작) 동시 |
| 재작업 피드백 | 자연어 코멘트 → 개발자 해석 | 구조화된 findings JSON → Coder에게 그대로 전달 |
| 실수 방지 | 리뷰어 경험 | 훅이 강제 차단 (force-push, reset --hard, add -A, 보호 브랜치 머지 등) |
| 테스트 실행 | 로컬 → CI | Tester가 항상 실행. CI는 보조 |
| 완료 판정 | "lgtm" | 관찰 가능한 criteria + exit code 0 + findings 0 |

---

## 5. 데모 중 청중이 자주 하는 질문 (미리 준비)

**Q1. AI가 작성한 코드를 진짜 믿을 수 있나요?**
A. 믿지 않기 때문에 Reviewer와 Tester 두 개가 동시에 붙습니다. Reviewer는 코드의 의도·스타일·리뷰 체크리스트를, Tester는 실제 exit code를 본다. 둘 다 통과해야 READY. 그리고 최종 머지는 여전히 사람이. AI를 **체크리스트 있는 인턴 3명**으로 생각하시면 됩니다.

**Q2. 요구사항이 모호하면 어떻게 되나요?**
A. Planner가 `## Open Questions` 섹션에 명시합니다. plan 파일이 이 섹션으로 시작하면 "사람이 답해야 진행된다"는 신호. 즉 엉망인 코드가 나올 가능성이 사람 단계에서 1차 차단됩니다.

**Q3. 결과물을 CI에 자동 머지해버리면 되지 않나요?**
A. 의도적으로 안 합니다. 파이프라인이 "pass"를 선언해도 최종 `git merge`는 사람이. 이게 뚫리면 나쁜 코드가 소리없이 main에 들어갈 수 있다. 우리 키트의 설계 원칙: **AI는 작업자, 사람은 결정권자.**

**Q4. Gemini 토큰 비용은 얼마나 듭니까?**
A. 4개 UI 개선 시연 기준 대략 Planner 1회 + Coder 3~4회(+재시도) + Reviewer 4회 + Tester 4회. 가격은 모델/토큰에 따라 다르지만, **이걸 개발자 시간 4시간으로 환산**하면 거의 언제나 AI가 싸다. 그리고 코더가 "병렬 3명"으로 뛰므로 프로젝트 리드타임이 줄어드는 가치가 훨씬 큼.

**Q5. 기존 Claude Code로 하던 거랑 뭐가 다른가요?**
A. Gemini CLI의 native parallel subagents + worktrees + hooks를 조합했다는 게 차이. superpowers extension 하나로 14개 스킬이 공통 활성화된다. **같은 skillset으로 다른 agent 도구(Claude Code, Cursor, Codex, Copilot)에서도 똑같이 동작**한다는 점이 장기 이득. 팀이 언젠가 도구를 바꿔도 skills는 그대로 쓸 수 있음.

**Q6. 저희 프로젝트에도 바로 적용할 수 있나요?**
A. 전제 세 가지. (1) git 저장소일 것, (2) `npm test` / `pytest` 같은 **표준화된 테스트 실행 커맨드**가 있을 것, (3) Gemini CLI 0.3+ 설치. 언어는 무관. README.md의 "설치" 섹션 따라 `.gemini/` + `GEMINI.md` 복사하고 superpowers install 하면 오늘 바로 시작 가능.

---

## 6. 오늘 데모의 한 줄 요약

> **4개 UI 개선, 수동 4시간 → 자동 35분.**
> **사람 집중 4시간 → 15분.**
> **리뷰어 1명 주관 → Reviewer+Tester 객관 교차검증.**
> 키보드로 친 건 `/parallel-dev` 한 줄과 `git merge` 한 줄.

---

## 7. 데모 직전 체크리스트 (시연자용)

**저장소 상태**

- [ ] `git status` clean, main 최신
- [ ] `.gemini/` 디렉터리 + `GEMINI.md` 프로젝트 루트에 배치됨
- [ ] **키트 파일이 git에 커밋되어 있는가** — `git ls-files .gemini/hooks/` 가 3개 파일 반환해야 함 (미커밋이면 worktree에서 훅이 `Cannot find module` 에러로 깨짐)
- [ ] `.gitignore`에 `.gemini/worktrees/`, `.gemini/reports/`, `.gemini/plans/` 만 있고 `.gemini/` 전체를 ignore하지 않음
- [ ] `gemini extensions install https://github.com/obra/superpowers` 완료, `/skills list`에 14개 노출
- [ ] `.gemini/plans/` 는 비어 있어야 (이전 실습 잔여 제거 — `Remove-Item .gemini\plans\*.md`)
- [ ] `.gemini/reports/` 비어 있는지 확인 (`Remove-Item .gemini\reports\* -Recurse -Force` )
- [ ] `git branch --list 'agent/*'` 로 남은 agent 브랜치 확인 → 있으면 삭제
- [ ] `git worktree list`에서 `.gemini/worktrees/*` 잔존 없는지 확인

**환경**

- [ ] 네트워크 연결 상태 확인 (Gemini API 도달)
- [ ] `gemini -m gemini-3-flash-preview --version` 정상 출력 확인 (모델 명 오타 방지)
- [ ] 터미널 폰트 확대해서 뒤에서도 보이게 (15~18pt 권장)

**4-pane 레이아웃 (§3-⓪ 참조)**

- [ ] tmux 또는 Warp에서 4분할 프리셋 저장되어 있음
- [ ] PANE 2 (worktree/branch 모니터) 스크립트 1회 테스트
- [ ] PANE 3 (plans/reports/worktrees 디렉터리 모니터) 스크립트 1회 테스트
- [ ] PANE 4 (Tester JSON 리포트 모니터) 스크립트 1회 테스트 — `jq` 또는 PowerShell `ConvertFrom-Json` 존재 확인
- [ ] 발표 중 포커스 이동 대사 4개(②⑤⑥⑧ 시점) 입에 붙이기

**백업**

- [ ] 프리젠테이션 슬라이드: §4의 "수동 vs 병렬" 비교표 준비
- [ ] 예비 플랜: 시연 중 네트워크/API 문제가 생기면 §3의 각 ①~⑧ 단계 로그 스크린샷 + pane 스크린샷을 대신 보여줄 수 있게 미리 준비
- [ ] 모델 변경 플랜 B: `gemini-3-flash-preview`가 응답 지연/오류를 낼 경우 `gemini -m gemini-2.5-pro` 로 즉시 재시작 가능하도록 대기

---

## 8. v2 — Playwright MCP 통합 후 달라지는 것

v1(오늘)의 파이프라인에서 약점이 하나 있었습니다. **Tester가 단위 테스트 exit code에만 의존**했기 때문에 "#3 모바일 paste 컨텍스트 메뉴 버그"처럼 **실제 터치 이벤트 + 모바일 렌더링 타이밍**에 의존하는 버그는 자신 있게 "pass"라고 말하기 어려웠습니다.

Playwright MCP를 붙이면 Tester가 **WebKit(iPhone 14 프로필, iOS Safari 근사)**과 **Chromium 모바일(Pixel 7 프로필, Android Chrome 근사)** 두 엔진에서 헤드리스로 long-press를 시뮬레이션하고 DOM 상태를 검증합니다. 원 요구사항이 "iOS Safari 17, Android Chrome 125 둘 다 재현 확인"이므로 두 패스 모두 Verification Plan에 포함합니다.

### 왜 양쪽 엔진 모두 필요한가

이 버그는 **브라우저/OS가 렌더링하는 네이티브 UI**(붙여넣기 컨텍스트 메뉴)라서 엔진 차이가 결정적입니다.

| 구분 | iOS Safari (WebKit) | Android Chrome (Blink) |
|------|---------------------|------------------------|
| `touchstart` 지연/취소 조건 | WebKit 고유 | 표준에 가까움 |
| 컨텍스트 메뉴 형태 | 말풍선 "붙여넣기/자동입력" | 플로팅 바 "붙여넣기/모두 선택" |
| long-press 임계값 | ~500ms | ~400ms |

한쪽에서만 통과해도 다른 쪽이 깨질 수 있어, **두 엔진 모두에서 검증**해야 합니다.

### Verification Plan before / after

```yaml
# v1 (Playwright MCP 없음)
## Verification Plan
- cmd: "npm test -- src/AddScrap"
  expect: exit 0

# v2 (Playwright MCP 추가 — iOS/Android 둘 다 커버)
## Verification Plan
- cmd: "npm test -- src/AddScrap"
  expect: exit 0
- cmd: "npm run preview -- --port <TESTER_PORT> --strictPort"
  background: true
  ready_on_stdout: "Local:.*http"
- tool: "mcp_playwright_navigate"
  args: { url: "http://localhost:<TESTER_PORT>" }

# --- iOS Safari proxy (WebKit) ---
- tool: "mcp_playwright_set_viewport"
  args: { preset: "iPhone 14" }
- tool: "mcp_playwright_tap_and_hold"
  args: { selector: "input[name='scrap-url']", duration_ms: 800 }
- tool: "mcp_playwright_assert_visible"
  args: { selector: ".browser-context-menu" }
- tool: "mcp_playwright_screenshot"
  args: { path: ".gemini/reports/<slug>/T-3-ios-paste.png", full_page: true }

# --- Android Chrome proxy (Chromium mobile) ---
- tool: "mcp_playwright_set_viewport"
  args: { preset: "Pixel 7" }
- tool: "mcp_playwright_tap_and_hold"
  args: { selector: "input[name='scrap-url']", duration_ms: 800 }
- tool: "mcp_playwright_assert_visible"
  args: { selector: ".browser-context-menu" }
- tool: "mcp_playwright_screenshot"
  args: { path: ".gemini/reports/<slug>/T-3-android-paste.png", full_page: true }

- tool: "mcp_playwright_close"
```

> ⚠ **에뮬레이션 주의.** Playwright의 `iPhone 14` 프로필은 WebKit 엔진 + iPhone 14 뷰포트/DPR/UA일 뿐 **진짜 iOS Safari 17이 아닙니다.** 마찬가지로 `Pixel 7`도 Chromium 모바일 + Pixel 7 뷰포트로 **진짜 Android Chrome 125가 아닙니다.** 엔진 계열 버그는 잡히지만 OS 통합 레이어 버그(iOS 클립보드 칩, Android 시스템 IME 이벤트)는 놓칠 수 있어, **실기기 수동 QA를 최종 관문으로 남겨두는 게 원칙**입니다.

### 증거 흐름

v1의 `.gemini/reports/<slug>/T-3.json` 이렇게만 찍혔습니다:

```json
{"task":"T-3","verdict":"pass","exit_code":0}
```

v2에서는 스크린샷 경로 **두 장(iOS/Android)**을 JSON에 박고 실제 이미지 파일이 `reports/` 에 떨어집니다:

```json
{
  "task":"T-3",
  "verdict":"pass",
  "screenshots":[
    ".gemini/reports/ui-polish-collection/T-3-ios-paste.png",
    ".gemini/reports/ui-polish-collection/T-3-android-paste.png"
  ],
  "assertions":[
    {"engine":"webkit","viewport":"iPhone 14","tool":"mcp_playwright_assert_visible","selector":".browser-context-menu","passed":true},
    {"engine":"chromium","viewport":"Pixel 7","tool":"mcp_playwright_assert_visible","selector":".browser-context-menu","passed":true}
  ]
}
```

데모에서 PANE 4에 이 JSON을 띄워두고 청중에게 스크린샷 두 장을 같이 열어주면 **"AI가 만든 pass의 객관적 증거"** 가 시각적으로 확립됩니다. "iPhone 프로필(WebKit)과 Pixel 프로필(Chromium 모바일) 두 엔진에서 각각 long-press 한 결과입니다."

### 역할 분담 (v2에서도 유지)

| 역할 | Playwright MCP 사용 | 이유 |
|------|:-:|------|
| Planner | ✅ (read-only, 연구용) | 기존 UI 측정해서 관찰 가능한 Acceptance Criteria 작성 |
| Coder | ❌ | 브라우저 조작은 턴을 잡아먹음. Playwright **테스트 코드**는 작성하되 실행은 안 함 |
| Reviewer | ❌ | 읽기 전용 리뷰어라 브라우저 불필요 |
| Tester | ✅ (전담) | Verification Plan의 `tool:` 엔트리 실제 실행, 증거 캡처 |

### 비용/리스크 관리

- **스크린샷 예산**: task당 2~4장 원칙 (iOS 1장 + Android 1장 + 실패/증거 1~2장). Tester 정의에 명시. 초과 시 토큰비 폭증.
- **병렬 포트 충돌**: `<TESTER_PORT>` 플레이스홀더를 Planner가 Verification Plan에 심고, Tester가 task 인덱스에 따라 5174, 5175, ... 로 치환. `npm run preview --strictPort`로 중복 시 명확히 실패.
- **dev server 기동 시간**: Verification Plan의 `ready_on_stdout: "Local:.*http"` 매처로 서버 준비될 때까지 대기. 30초 timeout.
- **에뮬레이션 한계**: Playwright는 엔진(WebKit/Chromium)과 모바일 뷰포트/UA만 흉내내는 것이지 **진짜 iOS/Android OS 통합**이 아닙니다. 두 엔진에서 pass 받았다고 "실기기에서도 반드시 된다"를 보증하지 않습니다. 배포 전 실기기 수동 QA 1회 권장.
- **정리**: Tester가 마지막에 `mcp_playwright_close` + 백그라운드 서버 kill. 안 하면 좀비 프로세스 쌓임.

### v2 시연 추가 장면 (§3 본 시나리오와 연결)

v2에서는 §3-⑥(Reviewer+Tester 교차검증) 뒤에 한 장면이 추가됩니다.

> "이제 PANE 4 화면에 Tester가 찍은 스크린샷 두 장을 나란히 띄워보겠습니다. 왼쪽은 WebKit + iPhone 14 뷰포트, 오른쪽은 Chromium 모바일 + Pixel 7 뷰포트에서 URL 입력창을 800ms 길게 누른 결과입니다. 두 엔진 모두 `.browser-context-menu` 가 떠 있는 것을 확인할 수 있습니다. 이게 `verdict: pass`의 근거입니다. 참고로 Playwright는 에뮬레이션이라 실기기 최종 확인은 QA 단계에 남겨두지만, 단위 테스트 exit code만 봤을 때보다 신뢰도는 훨씬 높아졌습니다."

---

## 9. 오늘 이후 할 일 (팀에 남기는 숙제)

- 첫 `/parallel-dev` 실행해볼 나만의 작은 버그/개선 건 1개 선정
- 그걸 한 문장으로 요구사항화해서 동료에게 보여주고 피드백 받기
- 실행 → 결과 리포트를 주간 회고에 공유
- **v2 마이그레이션 — Playwright MCP 활성화 실험** (§10 별도 실험 계획서 참고: `playwright-mcp-experiment.md`)
- 다음 주제: "팀 프로젝트에 GEMINI.md 커스터마이징하기" (코딩 스타일 가이드, 금지 패턴, 테스트 커맨드 등록)