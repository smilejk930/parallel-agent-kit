---
created: 2026-04-23 13:41
tags:
---
# 기 구축된 SW에 AI 에이전트 활용하여 개발하기

## ✅ 준비

1. IDE: Antigravity or Vscode or Warp or Eclipse 등 Terminal 사용할 수 있는 편집 도구
2. Google 계정
3. 기능개선이 필요한 SW APP Source

## ✅ 실습

- [Gemini CLI 무료 사용자 모델 제한 사항](https://github.com/google-gemini/gemini-cli/discussions/22970) : 2026년 3월 25일부터 Gemini Pro 모델은 유료 구독을 통해서만 이용할 수 있습니다. 무료 사용자는 Gemini Flash 모델만 이용 가능합니다. Gemini Pro 모델을 이용하려면 Pro 또는 Ultra 플랜으로 업그레이드하세요.

1. Terminal을 열어서 Gemini CLI 설치
```bash
npm install -g @google/gemini-cli
```

2. Gemini CLI 접속
	- APP root에서 다음 명령어 입력
```bash
gemini -m gemini-3-flash-preview --yolo
```

3. AI 에이전트가 APP을 잘 이해할 수 있도록 전체 스캔 진행 ➡️ `GEMINI.md` 파일 생성
```bash
/init
```

4. Extentions 설치

https://github.com/gemini-cli-extensions/
https://geminicli.com/extensions/
https://claude.com/plugins
https://smithery.ai/
https://github.com/VoltAgent/awesome-agent-skills
https://stitch.withgoogle.com/
```
gemini extensions install https://github.com/obra/superpowers
gemini extensions install https://github.com/gemini-cli-extensions/firebase
npx playwright install chromium
```

또는 
https://github.com/microsoft/playwright-mcp playwright mcp 설치해줘.

5. 기능 요구사항

```
1. 목록/카드뷰 토글버튼 크기 수정
    - AI 토글, 영문/한글 토글 버튼과 크기를 동일하게 변경
2. 모바일뷰 하단 오른쪽 메뉴에 `Input` 단어를 `Add`로 변경
3. 모바일 웹 브라우저에서 Add Scrap 메뉴의 스크랩 붙여넣기 사라짐 증상 수정
    - 복사한 url을 붙여넣기 위해 url 입력창을 손가락으로 꾹 눌러 `붙여넣기` 컨텍스트 메뉴를 보이게 해야 하는데 새로고침 되듯이 잠깐 보였다가 사라짐
4. 복사한 url을 바로 붙여넣을 수 있게 Past 버튼 추가
5. UX 향상을 위해 add scrap 메뉴 삭제하고 Archive 메뉴로 통합
    - url을 스크랩하고 저장된 스크랩 목록을 보는 메뉴가 분리되어 있어서 번거로운 불편함이 존재함
    - 기존 상단에 `My Archive` 명칭을 `Oh My Scrap`으로 변경
    - add scrap 다이얼로그 추가
        - url 입력창에 url 붙여넣기 기능
        - 화면 전환 없이 url 스크랩 할 수 있게 기능 고도화
    - 모바일 하단 메뉴 수정
        - 왼쪽: 목록뷰/카드뷰 버튼
        - 오른쪽: Add 버튼
    - 상단에 있던 OFF/AI 토글 버튼, EN/KO 토글 버튼 삭제하고 add scrap 다이얼로그 상단에 배치
    - 데스크탑 화면에서 왼쪽 사이드바 제거(로그아웃 버튼을 모바일과 비슷하게 위치 이동)
```

6. AI 에이전트를 병렬로 개발하게끔 셋팅 시작
	- 다음과 같이 에이전트에게 전달
```
Gemini CLI로 SW 개발을 하려고 함.

Gemini CLI로 병렬 개발 하는 방법과 AGENTS가 서로 검증하며 완전 자동화하는 방법 알려주고 이에 해당하는 파일 만들어줘.
sh 스크립트 말고 gemini cli에서 제공하는 기능들을 이용해서 구축하고 싶어.
Gemini CLI 공식 문서 @.docs\Gemini-cli-Guide를 참고해줘.(tmux, warp 사용은 상관 없음)
그리고 `https://github.com/obra/superpowers`와 `https://github.com/microsoft/playwright-mcp`을 같이 사용할 예정이야.
---
Q1)어떤 프로젝트 타입/언어를 기준으로 설정을 구성할까요?
A1)범용 (언어 무관)

Q2)병렬 실행 환경은 어떤 것을 사용하시나요?
A2)git worktree + subagent + tmux or Warp 분할 창

Q3)agent들이 서로 검증할 때 역할 구성은 어떻게 할까요?
A3)Planner → Coder → Reviewer → Tester

Q4)obra/superpowers와 playwright-mcp는 어떤 방식으로 통합할까요?
A4)설치 후 설정 연동
```

7. 설정 완료 후 `gemini` 접속
	- 이후에 `ctrl`+`y`를 눌러 `YOLO` 모드로 전환

| 모드                    | 파이프라인 실제 동작                                                                                                                                                                                        |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **plan**              | ❌ Coder가 파일을 못 씀. Planner만 돌고 멈춥니다. 탐색용이지 실행용이 아님.                                                                                                                                                 |
| **auto-accept edits** | ⚠️ `write_file`은 통과하지만 `run_shell_command`는 매번 승인 프롬프트. Coder가 `npm test`, `git commit` 하나마다 멈춰 있습니다. 병렬로 3개 Coder 돌리면 프롬프트가 겹쳐 쏟아지고, Tester는 Verification Plan 커맨드마다 프롬프트 대기. **실질적으로 "자동"이 아님.** |
| **yolo**              | ✅ 모든 도구 호출이 자동 진행. 파이프라인이 사람 개입 없이 끝까지 돕니다.                                                                                                                                                        |

- 실행 방법
worktree와 함께:
```powershell
gemini --worktree feature-login --yolo
```

## ✅ 시나리오

oh-my-scrap-demo-scenario.md 참고

## ✅ 첨언

하나의 AI 에이전트에 종속되면 안됩니다.
AI 에이전트 유목민이 되야됩니다.
일단 한번 해봐야 합니다.