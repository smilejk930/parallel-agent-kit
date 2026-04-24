# Parallel Agent Kit — project context for Gemini CLI

이 저장소는 **Planner → Coder → Reviewer → Tester** 4-역할 파이프라인을 Gemini CLI
빌트인 기능(subagents + worktrees + hooks + custom commands)만으로 구성한 범용 자동화
키트입니다. 별도 shell 스크립트 실행 없이 `/parallel-dev` 슬래시 커맨드 하나로
계획 수립부터 교차 검증까지 자동 진행합니다.

## 역할 구성과 책임 분담

| 역할 | 파일 | 주 책임 | 출력 |
|------|------|---------|------|
| Planner | `.gemini/agents/planner.md` | 요구 분해, 파일별 task 설계 | `.gemini/plans/<slug>.md` |
| Coder | `.gemini/agents/coder.md` | 한 task = 한 worktree에서 구현 | 브랜치 커밋 |
| Reviewer | `.gemini/agents/reviewer.md` | 읽기 전용 품질/계약 검증 | pass/fail + findings |
| Tester | `.gemini/agents/tester.md` | 계획의 검증 커맨드 실행 | pass/fail + report json |

Reviewer와 Tester는 **서로 독립 컨텍스트**에서 **동시에** 실행됩니다. 의도(intent)와
동작(behaviour)을 따로 검증하기 때문에 한 쪽만으로 놓칠 결함을 상호 보완합니다.
둘 중 하나라도 `fail`이면 Coder에게 피드백을 묶어 재작업 turn이 내려갑니다 (최대 3회).

## 주요 슬래시 커맨드

- `/parallel-dev <자연어 요청>` — 전체 파이프라인 실행.
- `/worktree:spawn <slug> <task-id>` — 특정 task용 worktree+브랜치 준비.
- `/worktree:cleanup [slug]` — 끝난 worktree/브랜치 정리.
- `/pipeline:verify <T-id> <plan-path> <branch>` — Reviewer+Tester 재실행.
- `/pipeline:status` — 현재 모든 worktree/브랜치/리포트 스냅샷.

## 병렬화 원칙

1. Planner는 `Work Breakdown`에서 task의 `files:` 집합이 **겹치지 않도록** 설계합니다.
2. 파일이 겹치지 않는 task끼리는 Gemini CLI의 **parallel subagents** 기능으로 동시에
   dispatch됩니다 ("Run @coder on T-1, T-2, T-3 in parallel"이 말 그대로 됩니다).
3. `depends_on`이 있는 task는 orchestrator가 의존성 완료 후 순차 실행합니다.
4. 검증 단계에서 Reviewer와 Tester는 **항상** 병렬입니다 (두 agent는 서로 다른 영역을
   검증하므로 서로 간섭하지 않습니다).

## 자동 검증 루프 (self-verification)

```
Planner ──► Plan file
             │
             ▼
  ┌──►  Coder (worktree per task)  ──► commit
  │          │
  │          ▼
  │    Reviewer  ─┐
  │    Tester    ─┴──► merge verdicts
  │                       │
  │       fail (max 3x) ──┘
  └───────────────────────── retry with combined feedback
                          │
                         pass
                          ▼
                    READY-TO-MERGE
```

이 루프의 안전장치는 다음과 같이 배치됩니다.

- **각 agent 시스템 프롬프트의 `## Handoff contract`** — 서브에이전트가 턴의 마지막
  라인을 단일 줄 JSON으로 반환하도록 강제. Gemini CLI sub-agent는 자기 시스템
  프롬프트를 따르므로 이 지점에서 일차 보장이 이루어집니다.
- **`/parallel-dev` 오케스트레이터 로직** — 반환된 JSON을 파싱하고 포맷이 깨지면
  같은 턴에서 sub-agent에게 재요청. 파싱 실패는 오케스트레이터의 결정 영역입니다.
- **BeforeTool / guard-destructive-git.mjs** — force-push, hard-reset, `git add -A`
  등 병렬 worktree 환경을 깰 수 있는 git 명령을 차단합니다.

## obra/superpowers 연동

superpowers는 **Gemini CLI extension**으로 설치됩니다 (Claude Code skills
디렉터리가 아닙니다). 설치 명령:

```bash
gemini extensions install https://github.com/obra/superpowers
```

설치되면 14개 skill + extension GEMINI.md + **`SessionStart` hook 1개**가
등록됩니다 (2026-04 기준 `gemini-extension.json`은 `contextFileName: "GEMINI.md"`
만 선언하고, `hooks/hooks.json`이 `SessionStart` 하나만 등록). extension은
Gemini CLI용 subagent나 slash command를 제공하지 않으므로 본 키트의
`planner/coder/reviewer/tester` agent 및 `/parallel-dev` 커맨드와 이름 충돌이
없습니다. extension의 `SessionStart` 훅과 본 키트의 `session-start` 훅은 둘 다
병행 실행되며, 본 키트의 `BeforeTool` 훅은 extension이 건드리지 않는 이벤트라
독립적으로 작동합니다.

### 역할 ↔ 스킬 매핑

**모든 역할은 턴 시작 시 가장 먼저 `using-superpowers` 메타-스킬을 활성화합니다.**
이 스킬의 명시적 규칙이 "어떤 응답 전에라도 Skill tool 호출이 선행되어야 한다"
이기 때문에, 생략하면 나머지 스킬의 자동 라우팅이 무력화됩니다.

| 역할 | 필수 activate 시점 | 사용하는 skill |
|------|-------------------|----------------|
| (공통) | 턴 시작 최초 1회 | `using-superpowers` |
| Orchestrator (`/parallel-dev`) | Phase 1 직전 | `subagent-driven-development`, `dispatching-parallel-agents`, `finishing-a-development-branch` |
| Planner | 턴 시작 | `brainstorming` (모호한 요구시), `writing-plans` |
| Coder | 턴 시작 | `executing-plans` |
| Coder | 코드 작성 전 | `test-driven-development` |
| Coder | worktree 작업 전 | `using-git-worktrees` |
| Coder | 재시도 턴 | `systematic-debugging`, `receiving-code-review` |
| Coder | handoff 직전 | `requesting-code-review`, `verification-before-completion` |
| Reviewer | 턴 시작 | `verification-before-completion`, `requesting-code-review` |
| Tester | 턴 시작 | `test-driven-development`, `verification-before-completion` |

### MCP 도구 접근 권한

| 역할 | MCP 도구 | 용도 |
|------|----------|------|
| Planner | `mcp_playwright_*` (read-only 연구) | 현재 UI 측정해 관찰 가능한 Acceptance Criteria 작성 |
| Coder | 없음 | 브라우저 접근 금지 — 테스트 코드는 작성하되 실행은 Tester에게 위임 |
| Reviewer | 없음 | 읽기 전용 코드 리뷰, 브라우저 불필요 |
| Tester | `mcp_playwright_*` (전담) | Verification Plan의 `tool:` 엔트리 실제 실행, 증거 스크린샷 캡처 |

## 실행 환경 — tmux / Warp / worktree 조합

Gemini CLI 자체가 worktree + subagent로 병렬을 처리하지만, **사람이 동시에 여러
오케스트레이터 세션을 띄우고 싶다면** 다음 패턴을 권장합니다.

- **tmux**: 각 pane에서 `gemini --worktree <name>`. pane별로 별개 feature가 진행됩니다.
- **Warp**: Warp Drive의 Workflow에 `/parallel-dev ...`를 커맨드로 등록해두면
  Agent Mode에서 동일 파이프라인을 터미널마다 다른 요청으로 실행 가능.
- 내부 agent 단위 병렬은 **이 프로젝트가** 관리합니다. 사람은 "feature 단위"로만
  외부 병렬을 생각하면 됩니다.

## 최소 전제 조건

- Gemini CLI v0.3 이상 (`experimental.enableAgents`, `experimental.worktrees` 지원).
- 프로젝트 루트가 git 저장소여야 합니다 (worktree가 필요하므로).
- Node 18+ (훅 스크립트가 `.mjs` 이므로).
- obra/superpowers extension이 `gemini extensions install` 로 설치되어
  `/skills list`에 노출되어야 합니다.
- (선택) Playwright MCP 사용 시: Chromium 바이너리 ~300MB, 프로젝트에
  `npm run preview` 또는 동등한 정적 프리뷰 커맨드가 있어야 브라우저
  검증용 dev server를 Tester가 띄울 수 있습니다.

## Do / Don't 요약

Do
- Planner에게 모호한 요구를 그대로 던집니다 — 질문은 Planner가 Open Questions로 적습니다.
- 검증 실패는 항상 Coder에게 되돌립니다. 사람은 3회 재시도 실패 후에만 개입합니다.
- 새 task 유형은 우선 Planner의 Review Checklist로 추가하고, 필요 시 별도 agent를
  `.gemini/agents/` 에 추가합니다 (예: `security-auditor.md`).

Don't
- Gemini CLI 외부에서 shell 오케스트레이션 스크립트를 만들지 않습니다 — 이 키트의
  설계 원칙에 어긋납니다.
- Reviewer/Tester가 코드를 수정하도록 허용하지 않습니다. 두 agent의 tools 목록에는
  `write_file`/`replace`가 의도적으로 빠져 있습니다.
- 보호 브랜치(`main`/`master`/`release/*`)를 agent가 만지지 못하게 합니다 — 훅이
  차단합니다.
