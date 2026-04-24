# Playwright MCP 첫 실험 — T-3 paste 버그 재검증

> **목적:** 이미 "pass" 판정을 받은 T-3(모바일 paste 컨텍스트 메뉴 버그 수정)을 **Playwright MCP로 다시 검증**한다. v1 Tester의 "exit code 0 → pass"가 실제 브라우저 거동과 일치하는지, 혹은 단위 테스트가 놓친 문제가 있는지를 **실측**한다. v2 파이프라인 도입의 첫 증거 수집 실험.

---

## 1. 사전 조건

- v1 실행으로 `agent/ui-polish-collection/T-3` 브랜치가 존재하고 커밋이 올라와 있음 (이미 완료)
- `.gemini/settings.json`의 `mcpServers.playwright` 블록이 활성화됨 (이번 업데이트로 반영됨)
- Tester 에이전트 정의에 `mcp_playwright_*` 권한이 있고, Verification Plan의 `tool:` / `background:` 엔트리를 처리할 수 있음
- 프로젝트에 `npm run preview` 또는 이에 준하는 정적 프리뷰 커맨드가 있음 (Vite/Next/기타)
- Chromium 바이너리가 Playwright에 의해 다운로드되어 있음 — 없다면 최초 1회 `npx playwright install chromium` 실행

## 2. 실험 설계

### 2-1. 가설

**H0 (귀무가설)**: v1에서 "pass" 판정된 T-3는 Playwright MCP 실측에서도 pass 한다.  
**H1 (대립가설)**: 단위 테스트는 통과했지만 실제 모바일 뷰포트의 터치 이벤트에서 **컨텍스트 메뉴가 여전히 깜빡이다 사라지는 회귀가 남아 있다**.

H1이 증명되면 v1 Tester가 놓친 결함을 v2 Tester가 잡았다는 **Playwright MCP 도입 근거**가 된다.
H0로 확정되어도 "스크린샷 증거 생성 흐름"을 실제 작동시킨 첫 실행이 된다.

### 2-2. 측정할 것

1. iPhone 14 프로필에서 `input[name='scrap-url']`을 **800ms long-press** 한 후 500ms 시점
2. `.browser-context-menu`(또는 대응 DOM 셀렉터)의 **visibility**
3. 같은 동작을 Android Chrome(Pixel 7) 프로필로 반복
4. before/after 스크린샷 2장 (`T-3-ios-paste.png`, `T-3-android-paste.png`)

### 2-3. 성공 기준

- Playwright가 붙은 Tester가 verdict 산출 완료 (pass 또는 fail 모두 유효)
- `.gemini/reports/t3-replay/T-3.json`에 `screenshots: []` 배열이 파일 경로와 함께 기록됨
- 스크린샷 파일이 실제로 존재하고 열 수 있음
- Tester가 마지막에 `mcp_playwright_close`를 호출해 프로세스 leak이 없음

## 3. 실행 스크립트

### 3-1. 선행 준비 (5분)

```powershell
cd D:\develop\workspace\oh-my-scrap

# 키트 업데이트본 적용
Copy-Item "<키트경로>\.gemini\settings.json" .gemini\settings.json -Force
Copy-Item "<키트경로>\.gemini\agents\planner.md" .gemini\agents\planner.md -Force
Copy-Item "<키트경로>\.gemini\agents\coder.md" .gemini\agents\coder.md -Force
Copy-Item "<키트경로>\.gemini\agents\tester.md" .gemini\agents\tester.md -Force

git add .gemini/
git commit -m "chore: enable Playwright MCP for Tester + Planner"

# Chromium 바이너리 확인 (없으면 받음)
npx playwright install chromium

# 브랜치 상태 확인 — agent/ui-polish-collection/T-3 존재해야 함
git branch --list 'agent/ui-polish-collection/T-3'
```

### 3-2. Gemini CLI 기동

```powershell
gemini -m gemini-3-flash-preview --yolo --worktree t3-replay
```

기동 시 `/skills list`에 playwright 관련 MCP 도구가 `mcp_playwright_*` 로 노출되는지 확인. 없으면 `npx -y @playwright/mcp@latest` 실행 권한을 첫 호출 시 허용해야 함.

### 3-3. 한 줄 명령

```
> /parallel-dev agent/ui-polish-collection/T-3 브랜치의 모바일 paste 컨텍스트 메뉴 버그 수정을 Playwright MCP로 재검증한다.

  Verification Plan은 다음을 반드시 포함한다:
  - iPhone 14 프로필로 뷰포트 설정
  - URL 입력창에 800ms long-press 시뮬레이션
  - 0.5초 대기 후 .browser-context-menu (또는 프로젝트의 실제 컨텍스트 메뉴 셀렉터) 가시성 확인
  - 스크린샷 저장 .gemini/reports/t3-replay/T-3-ios-paste.png
  - 같은 검증을 Pixel 7 프로필로 반복, 스크린샷 .gemini/reports/t3-replay/T-3-android-paste.png
  - 마지막에 mcp_playwright_close 호출

  이 plan에는 코드 변경 task(T-N)가 없다. 검증만 실행하는 "재검증 전용" 플랜.
  따라서 Coder 단계는 건너뛰고 Tester만 실행한다.
```

> **중요:** 이 실험은 코드를 바꾸지 않는다. Planner는 Acceptance Criteria와 Verification Plan만 작성하고 `Work Breakdown`은 공란으로 두거나 단일 T-N(`title: "Replay T-3 verification on Playwright"`)으로 처리하도록 유도한다. 프롬프트에 이 점을 명시했다.

### 3-4. 관찰 포인트

4-pane 레이아웃을 사용 중이라면:

- **PANE 1**: `/parallel-dev` 진행 로그 (Planner → Tester 순차)
- **PANE 3**: `.gemini/reports/t3-replay/` 디렉터리가 채워지는 모습
- **PANE 4**: `T-3.json` 리포트의 `screenshots` 배열 실시간 갱신

### 3-5. 검증

실행 완료 후:

```powershell
# 리포트 JSON 확인
Get-Content .gemini\reports\t3-replay\T-3.json | ConvertFrom-Json | ConvertTo-Json -Depth 8

# 스크린샷 실제 파일 확인
Get-Item .gemini\reports\t3-replay\T-3-ios-paste.png, .gemini\reports\t3-replay\T-3-android-paste.png

# 스크린샷 열어보기
Start-Process .gemini\reports\t3-replay\T-3-ios-paste.png
```

## 4. 결과 해석

### 케이스 A — Playwright에서도 pass

- 가설 H0 확정
- v1 Tester가 내린 판정이 실제 브라우저 동작과 일치 → v1 자체의 정확성이 이 케이스에서는 충분했다는 증거
- 그래도 **스크린샷이 남았다는 자체가 가치**: 다음에 이 코드가 회귀하면 이 이미지와 비교 가능 (시각적 회귀 테스트 baseline)

### 케이스 B — Playwright에서 fail

- 가설 H1 확정 — v1이 놓친 결함 발견
- 구체적으로 기록:
  - 어느 프로필(iOS/Android)에서 실패했는가
  - 스크린샷에 뭐가 보이는가 (컨텍스트 메뉴 없음? 깜빡임?)
- T-3를 새 `/parallel-dev` 호출로 재작업. 이번엔 Planner가 처음부터 Playwright tool 엔트리를 Verification Plan에 넣으므로 Coder는 단위 테스트 통과가 아니라 **실제 브라우저 거동**까지 책임지는 코드를 작성하게 된다.
- 이게 **"Playwright MCP 도입으로 잡힌 첫 결함"** 사례로 기록되어 팀 내 도입 근거 자료가 됨.

### 케이스 C — 환경 문제로 Tester가 브라우저를 열지 못함

- 가장 흔한 원인: Chromium 바이너리 누락, preview 서버 포트 충돌, 프로젝트에 preview 커맨드 없음
- Tester의 에러 메시지 확인 후 환경 수정
- 수정 후 `/pipeline:verify T-3 .gemini/plans/t3-replay.md agent/ui-polish-collection/T-3` 로 **재검증만** 다시 돌림 (재계획 불필요)

## 5. 팀에 공유할 리포트 템플릿 (실험 후 작성)

```markdown
# Playwright MCP T-3 재검증 — 결과 보고

- **실행 일시:** YYYY-MM-DD HH:MM
- **브랜치:** agent/ui-polish-collection/T-3
- **결과:** [H0 / H1 / 환경 문제]
- **소요 시간:** ~N분
- **생성 증거:** 스크린샷 2장, reports/t3-replay/T-3.json

## 확인된 사실
1. iOS Safari (iPhone 14) 동작: [pass/fail + 한 문장]
2. Android Chrome (Pixel 7) 동작: [pass/fail + 한 문장]

## v1 대비 차이
- v1: `npm test` exit 0 → pass (증거 없음)
- v2: 실제 터치 이벤트 시뮬레이션 후 DOM 검증 + 스크린샷 2장

## 다음 액션
- [ ] 결과가 H1이면 추가 수정 `/parallel-dev` 호출
- [ ] 결과가 H0이면 v2를 기본 파이프라인으로 전환 (팀 리드 승인 필요)
- [ ] 스크린샷을 시각적 회귀 baseline으로 저장소에 커밋
```

## 6. 왜 이 실험이 중요한가 (팀 설득용 한 줄)

> "agent가 내린 pass 판정을 우리가 믿으려면, 그 판정의 **근거가 재현 가능**해야 한다. Playwright MCP는 단위 테스트 exit code 대신 **사람이 눈으로 볼 수 있는 증거**를 만들어낸다. 이 실험은 그 증거 흐름을 실제로 가동하는 첫 회차다."
