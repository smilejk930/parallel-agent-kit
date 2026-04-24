# Parallel Agent Kit for Gemini CLI

Gemini CLI 빌트인 기능만으로 구축한 **완전 자동 병렬 개발 파이프라인**입니다.
Planner → Coder → Reviewer → Tester가 각각 독립 컨텍스트에서 동작하며,
Reviewer와 Tester가 **서로 다른 시각으로 동시에** 검증하는 self-healing 루프를
가집니다. 외부 bash 스크립트 없이 `/parallel-dev` 한 번으로 끝까지 진행됩니다.

## 폴더 구조

```
parallel-agent-kit/
├── GEMINI.md                        # 프로젝트 컨텍스트 (오케스트레이션 규칙)
├── README.md                        # 이 문서
└── .gemini/
    ├── settings.json                # worktrees/agents/hooks/mcp 전부 여기서 enable
    ├── agents/                      # 4개 subagent 정의 (YAML frontmatter + 시스템 프롬프트)
    │   ├── planner.md
    │   ├── coder.md
    │   ├── reviewer.md
    │   └── tester.md
    ├── commands/                    # custom slash commands (TOML)
    │   ├── parallel-dev.toml        # /parallel-dev — 전체 파이프라인
    │   ├── worktree/
    │   │   ├── spawn.toml           # /worktree:spawn
    │   │   └── cleanup.toml         # /worktree:cleanup
    │   └── pipeline/
    │       ├── verify.toml          # /pipeline:verify
    │       └── status.toml          # /pipeline:status
    └── hooks/                       # Node hook 스크립트 (JSON in/out)
        ├── session-start.mjs        # 세션 부트스트랩 + primer 주입
        └── guard-destructive-git.mjs# 위험한 git 명령 차단
```

## 설치

```bash
# 1. 이 키트를 대상 프로젝트 루트에 복사
cp -r parallel-agent-kit/.gemini <your-project>/
cp parallel-agent-kit/GEMINI.md <your-project>/
cd <your-project>

# 2. 훅 스크립트 실행 권한 (Linux/macOS)
chmod +x .gemini/hooks/*.mjs
# Windows PowerShell은 권한 설정이 불필요합니다.

# 3. .gitignore 정리 (런타임 산출물만 무시, 키트 자체는 커밋되어야 함)
cat >> .gitignore <<'EOF'

# Gemini CLI runtime artifacts (generated)
.gemini/worktrees/
.gemini/reports/
.gemini/plans/
EOF

# 4. 키트를 저장소에 커밋 — ★ 필수 단계 ★
#    커밋하지 않으면 `gemini --worktree` 로 만든 worktree에 hook/agent/command 가 존재하지 않아
#    "Cannot find module ... .gemini/hooks/session-start.mjs" 에러로 훅이 깨집니다.
git add .gitignore
git add .gemini/settings.json .gemini/hooks .gemini/agents .gemini/commands GEMINI.md
git commit -m "chore: add parallel-agent-kit scaffolding"

# 5. obra/superpowers extension 설치 (14개 skill + GEMINI.md + hook 자동 등록)
gemini extensions install https://github.com/obra/superpowers

# 6. (선택) Playwright MCP 브라우저 드라이버 선다운로드
#    Tester가 첫 번째 브라우저 검증을 돌릴 때 자동으로 설치되지만, 미리 받아두면 데모에서 시간 절약.
npx playwright install chromium

# 7. Gemini CLI 실행 (0.3+ 권장)
gemini -m gemini-3-flash-preview --yolo
```

> **Why commit?** `gemini --worktree <name>` 은 HEAD 커밋을 기준으로 새 checkout을 만듭니다. 커밋 안 된 파일은 worktree에 존재하지 않으므로 hook 경로가 깨집니다. 키트는 **팀 공통 인프라**처럼 커밋해야 worktree + 다른 팀원의 clone 둘 다에서 동작합니다.

최초 실행 시 이 키트의 훅과 superpowers extension의 훅이 각각 한 번씩 신뢰성
프롬프트를 띄웁니다. 허용하면 이후부터는 핑거프린트로 추적됩니다. 각 agent는
처음 사용될 때 `/agents list`, 각 skill은 `/skills list`에 나타납니다.

## 빠른 시작 (`/parallel-dev`)

```text
> /parallel-dev 사용자가 /api/login 에 대해 동일 계정으로 1분에 10회 이상 실패하면 15분간 잠그는 rate limiter를 추가해줘.
```

Gemini CLI는 다음을 **자동으로** 수행합니다.

1. `@planner`가 `.gemini/plans/rate-limiter.md`에 task 분해(T-1, T-2, …)를 기록.
2. 파일이 겹치지 않는 task들에 대해 `/worktree:spawn`을 병렬 호출 →
   `.gemini/worktrees/rate-limiter-T-1` 등 worktree가 생성됨.
3. `@coder`가 **병렬로** 각 worktree에서 구현하고 커밋.
4. 커밋되는 즉시 `@reviewer`와 `@tester`가 **동시에** 검증.
5. 둘 다 `pass` → READY-TO-MERGE. 어느 하나라도 `fail` → 두 피드백을 묶어 Coder에게
   재시도 turn (최대 3회).
6. 최종 summary를 출력. 사람은 브랜치를 확인하고 merge만 하면 됩니다.

## 병렬 실행 모드

### A. Gemini CLI 단독 — 권장 기본

Gemini CLI는 **하나의 세션에서도** parallel subagents를 지원합니다. 오케스트레이터가
`@coder T-1`, `@coder T-2`를 동시에 호출하면 각기 다른 worktree에서 동시 실행됩니다.
대부분의 경우 이 모드로 충분합니다.

### B. tmux 분할 + `gemini --worktree`

**여러 개의 feature를 완전히 분리된 세션에서** 동시에 굴리고 싶을 때 사용합니다.

```bash
# pane 1
tmux new -s dev
gemini --worktree feature-login

# pane 2 (Ctrl-b "로 split)
gemini --worktree feature-billing
```

각 pane에서 `/parallel-dev ...`를 실행하면 feature 단위로 완전히 독립된 파이프라인이
동시에 돕니다. 내부 task 단위 병렬은 각 세션이 알아서 처리합니다.

### C. Warp (Agent Mode + Warp Drive)

Warp 사용자는 Warp Drive Workflow에 `/parallel-dev ...`를 즐겨찾기로 등록해
어느 세션에서든 동일하게 실행할 수 있습니다. pane 분할은 Warp의 네이티브 기능으로
처리하고, 각 pane에서 `gemini --worktree <name>`만 띄우면 됩니다.

## Agent 간 교차 검증이 작동하는 방식

한 번의 `/parallel-dev` 호출에서 T-1에 대해 일어나는 일:

1. Orchestrator가 `@coder T-1 .gemini/plans/rate-limiter.md`를 호출.
2. Coder가 작업을 마치고 `{"task":"T-1","status":"ready_for_review",...}` JSON을 반환.
3. Orchestrator가 **같은 턴**에 두 개의 subagent를 병렬로 dispatch:
   - `@reviewer T-1 <plan> agent/rate-limiter/T-1`  ← 정적 검사 + 리뷰 체크리스트
   - `@tester   T-1 <plan> agent/rate-limiter/T-1`  ← plan의 Verification Plan 실행
4. 두 agent는 각자의 **격리된 컨텍스트**에서 돌기 때문에 서로의 결과를 엿볼 수 없습니다.
   두 결과를 orchestrator가 합쳐 gate합니다.
5. 실패가 있으면 orchestrator가 Coder에게 재시도를 요청합니다. 이 재시도 프롬프트는
   **Reviewer의 findings + Tester의 failing excerpt**를 한 번에 담기 때문에 Coder는
   한 번의 turn으로 양쪽 문제를 해결합니다.
6. 3회 재시도 후에도 실패면 해당 task는 `BLOCKED`로 표시되고, 나머지 task는 계속 진행합니다.
   사람 개입은 이 시점에서만 필요합니다.

## obra/superpowers 연동 포인트

superpowers는 `gemini extensions install https://github.com/obra/superpowers`
한 줄로 extension 형태로 설치됩니다. 설치되면 14개 skill, extension GEMINI.md
컨텍스트, extension hook이 자동 등록되고 `/skills list`에 즉시 노출됩니다.

각 agent 정의의 `tools` 리스트에는 `activate_skill`이 포함되어 있어, agent가
필요한 시점에 스킬을 끌어옵니다. **모든 agent는 턴 시작 시 `using-superpowers`
메타-스킬을 먼저 활성화**합니다 (superpowers의 명시적 요구사항).

**Playwright MCP (선택 통합)**. `.gemini/settings.json`의 `mcpServers.playwright`
블록이 활성화되어 있어, Tester와 Planner가 헤드리스 브라우저 자동화 도구
(`mcp_playwright_*`)를 사용할 수 있습니다. Tester는 Verification Plan의
`tool:` 엔트리를 실제 브라우저로 실행해 DOM/뷰포트/터치 이벤트 거동을
검증합니다 — 단위 테스트만으론 잡기 어려운 모바일 회귀 버그에 특히 유효.
Planner는 read-only로만 사용해 현재 UI 상태를 측정한 뒤 관찰 가능한
Acceptance Criteria를 작성합니다. Coder와 Reviewer는 의도적으로 제외
(브라우저 접근 없음). 불필요하다면 `mcpServers.playwright` 블록을 삭제하면
agent 정의 수정 없이 그대로 v1 모드로 동작합니다.

| 역할 | 사용 skill (extension 제공) |
|------|------------------------------|
| 공통 (전 역할) | `using-superpowers` (항상 FIRST) |
| Orchestrator | `subagent-driven-development`, `dispatching-parallel-agents`, `finishing-a-development-branch` |
| Planner | `brainstorming`, `writing-plans` |
| Coder | `executing-plans`, `test-driven-development`, `using-git-worktrees`, `systematic-debugging`, `receiving-code-review`, `requesting-code-review`, `verification-before-completion` |
| Reviewer | `verification-before-completion`, `requesting-code-review` |
| Tester | `test-driven-development`, `verification-before-completion` |

extension은 Gemini CLI용으로 **`SessionStart` 훅 1개만** 등록합니다
(`hooks/hooks.json` 확인, 2026-04 기준 v5.0.7). 본 키트의 project-level 훅과
충돌하지 않습니다. Subagent/slash command는 extension이 Gemini CLI에
노출하지 않으므로 `planner/coder/reviewer/tester`, `/parallel-dev` 등 본 키트의
이름들과 충돌할 일이 없습니다.

## 커맨드 레퍼런스

| 커맨드 | 인자 | 설명 |
|--------|------|------|
| `/parallel-dev` | `<자연어 요청>` | 풀 파이프라인 실행 |
| `/worktree:spawn` | `<slug> <T-id>` | 특정 task용 worktree + 브랜치 생성 |
| `/worktree:cleanup` | `[slug]` | worktree/브랜치 일괄 제거 |
| `/pipeline:verify` | `<T-id> <plan-path> <branch>` | Reviewer+Tester 재실행 |
| `/pipeline:status` | — | 현재 파이프라인 상태 스냅샷 |

## 훅 동작 요약

| 이벤트 | 스크립트 | 효과 |
|--------|----------|------|
| `SessionStart` | `session-start.mjs` | `.gemini/{plans,reports,worktrees}` 생성 + primer 주입 |
| `BeforeTool` (`run_shell_command`) | `guard-destructive-git.mjs` | `push --force`, `reset --hard`, `add -A`, `.git` 삭제 등 차단 |

> JSON 핸드오프 강제는 **각 agent 시스템 프롬프트**(`planner.md`, `coder.md`, `reviewer.md`, `tester.md`)의 `## Handoff contract` 섹션과 `/parallel-dev` 커맨드의 파싱 로직이 담당합니다. 초기 버전에는 `AfterAgent` 훅이 있었으나 Gemini CLI의 `AfterAgent`는 메인 세션 턴에만 발동하고 sub-agent 내부 턴은 보지 못해 파이프라인 초입에서 오히려 오케스트레이터를 차단하는 버그가 있어 제거되었습니다. 과거에 배포된 저장소에 `.gemini/hooks/verify-handoff.mjs` 파일이 남아 있다면 **삭제해도 무방합니다** (`settings.json`에서 참조되지 않습니다).

## 확장하기

새 역할(예: 보안 감사)을 추가하려면 단순히 `.gemini/agents/security-auditor.md`를
만들고 `parallel-dev.toml`의 Phase 4에 한 줄 더 dispatch를 추가하면 됩니다. YAML
frontmatter의 `description`에 "언제 호출할지"를 명확히 쓰면 Gemini CLI가 자동 라우팅
정확도를 높여줍니다.

## 알려진 제한

- Subagent 간 **직접 재귀 호출은 차단**되어 있습니다 (Gemini CLI 정책). Orchestrator
  경유로만 체인이 만들어집니다 — 이 키트 구조는 그에 맞춰 설계되어 있습니다.
- 대량 파일을 동시에 수정하는 task가 겹치면 plan의 `files:` 집합을 신중히 잘라야
  병렬 실행이 의미가 있습니다. Planner가 이를 자동으로 체크합니다.
- `--output-format json` 헤드리스 모드를 쓸 경우 훅의 retry 동작은 대화형과 동일하지만,
  retry 프롬프트가 stdout에 섞이지 않도록 터미널 타겟팅 주의.
