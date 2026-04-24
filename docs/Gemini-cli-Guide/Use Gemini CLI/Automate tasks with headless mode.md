---
title: "Automate tasks with headless mode"
source: "https://geminicli.com/docs/cli/tutorials/automation/"
author:
published: 2026-03-10
created: 2026-04-23
description:
tags:
  - "clippings"
---
Gemini CLI를 사용하여 작업을 자동화하세요. 헤드리스 모드 사용 방법, Gemini CLI로 데이터 파이프 연결 방법, 셸 스크립트를 이용한 워크플로 자동화 방법, 다른 애플리케이션에서 사용할 수 있는 구조화된 JSON 출력 생성 방법을 알아보세요.

## 필수 조건

- Gemini CLI가 설치되고 인증되었습니다.
- 쉘 스크립팅(Bash/Zsh)에 대한 숙련도.

## 헤드리스 모드를 사용하는 이유는 무엇인가요?

헤드리스 모드는 Gemini CLI를 한 번 실행하고 종료합니다. 다음과 같은 경우에 적합합니다.

- **CI/CD:** 풀 리퀘스트를 자동으로 분석합니다.
- **일괄 처리:** 다수의 로그 파일을 요약합니다.
- **도구 개발:** 자신만의 "AI 래퍼" 스크립트 만들기.

## 헤드리스 모드 사용 방법

`-p` Gemini CLI를 헤드리스 모드로 실행하려면 (또는 ) 플래그를 사용하여 프롬프트를 제공하십시오 `--prompt`. 이렇게 하면 대화형 채팅 인터페이스가 건너뛰어지고 응답이 표준 출력(stdout)으로 출력됩니다. 플래그 없이 위치 인수를 사용하면 입력 또는 출력이 파이프되거나 리디렉션되지 않는 한 기본적으로 대화형 모드가 사용됩니다.

단일 명령어를 실행하세요:

```bash
gemini -p "Write a poem about TypeScript"
```

## Gemini CLI로 입력값을 파이프하는 방법

표준 유닉스 파이프를 사용하여 Gemini에 데이터를 입력하십시오 `|`. Gemini는 표준 입력(stdin)을 컨텍스트로 읽고 표준 출력으로 질문에 대한 답변을 제공합니다.

파일을 파이프로 연결하기:

**macOS/리눅스**

```bash
cat error.log | gemini -p "Explain why this failed"
```

**윈도우(파워셸)**

```powershell
Get-Content error.log | gemini -p "Explain why this failed"
```

명령어를 파이프(|)로 연결하세요:

```bash
git diff | gemini -p "Write a commit message for these changes"
```

## 스크립트에서 Gemini CLI 출력 사용

Gemini는 표준 출력으로 출력하기 때문에 다른 도구와 연결하여 사용하거나 결과를 파일로 저장할 수 있습니다.

### 시나리오: 대량 문서 생성기

파이썬 스크립트가 담긴 폴더가 있고, `README.md` 각 스크립트에 대한 파일을 생성하고 싶습니다.

1. 다음 코드를 `generate_docs.sh` ( `generate_docs.ps1` Windows의 경우 또는 )로 저장하세요.
	**macOS/리눅스 ( `generate_docs.sh`)**
	```bash
	#!/bin/bash
	# Loop through all Python files
	for file in *.py; do
	  echo "Generating docs for $file..."
	  # Ask Gemini CLI to generate the documentation and print it to stdout
	  gemini -p "Generate a Markdown documentation summary for @$file. Print the
	  result to standard output." > "${file%.py}.md"
	done
	```
	**윈도우 PowerShell ( `generate_docs.ps1`)**
	```powershell
	# Loop through all Python files
	Get-ChildItem -Filter *.py | ForEach-Object {
	  Write-Host "Generating docs for $($_.Name)..."
	  $newName = $_.Name -replace '\.py$', '.md'
	  # Ask Gemini CLI to generate the documentation and print it to stdout
	  gemini -p "Generate a Markdown documentation summary for @$($_.Name). Print the result to standard output." | Out-File -FilePath $newName -Encoding utf8
	}
	```
2. 스크립트를 실행 가능하게 만든 다음 해당 디렉토리에서 실행하세요.
	**macOS/리눅스**
	```bash
	chmod +x generate_docs.sh
	./generate_docs.sh
	```
	**윈도우(파워셸)**
	```powershell
	.\generate_docs.ps1
	```
	이렇게 하면 폴더 안의 모든 파이썬 파일에 해당하는 마크다운 파일이 생성됩니다.

## 구조화된 JSON 데이터를 추출합니다.

스크립트를 작성할 때, 종종 특정 도구에 전달할 구조화된 데이터(JSON)가 필요합니다 `jq`. 모델에서 순수한 JSON 데이터를 얻으려면, \`response field\`를 파싱하는 `--output-format json` 플래그를 함께 사용하세요.`jq`

### 시나리오: 구조화된 데이터를 추출하여 반환합니다.

1. 다음 스크립트를 `generate_json.sh` ( `generate_json.ps1` Windows의 경우 또는 )으로 저장하십시오.
	**macOS/리눅스 ( `generate_json.sh`)**
	```bash
	#!/bin/bash
	# Ensure we are in a project root
	if [ ! -f "package.json" ]; then
	  echo "Error: package.json not found."
	  exit 1
	fi
	# Extract data
	gemini --output-format json "Return a raw JSON object with keys 'version' and 'deps' from @package.json" | jq -r '.response' > data.json
	```
	**윈도우 PowerShell ( `generate_json.ps1`)**
	```powershell
	# Ensure we are in a project root
	if (-not (Test-Path "package.json")) {
	  Write-Error "Error: package.json not found."
	  exit 1
	}
	# Extract data (requires jq installed, or you can use ConvertFrom-Json)
	$output = gemini --output-format json "Return a raw JSON object with keys 'version' and 'deps' from @package.json" | ConvertFrom-Json
	$output.response | Out-File -FilePath data.json -Encoding utf8
	```
2. 스크립트를 실행하세요:
	**macOS/리눅스**
	```bash
	chmod +x generate_json.sh
	./generate_json.sh
	```
	**윈도우(파워셸)**
	```powershell
	.\generate_json.ps1
	```
3. 확인해 보세요 `data.json`. 파일은 다음과 같아야 합니다.
	```json
	{
	  "version": "1.0.0",
	  "deps": {
	    "react": "^18.2.0"
	  }
	}
	```

## 나만의 맞춤형 AI 도구를 만들어보세요

헤드리스 모드를 사용하여 사용자 지정 자동화 AI 작업을 수행하세요.

### 시나리오: "스마트 커밋" 별칭 생성

셸 설정에 함수를 추가하여 `git commit` 메시지를 자동으로 출력하는 래퍼를 생성할 수 있습니다.

**macOS/리눅스(Bash/Zsh)**

1. `.zshrc` ( `.bashrc` Bash를 사용하는 경우) 원하는 텍스트 편집기에서 파일을 엽니다.
	```bash
	nano ~/.zshrc
	```
	**참고**: VS Code를 사용하는 경우 다음 명령을 실행할 수 있습니다 `code ~/.zshrc`.
2. 파일의 맨 아래로 스크롤하여 다음 코드를 붙여넣으세요.
	```bash
	function gcommit() {
	  # Get the diff of staged changes
	  diff=$(git diff --staged)
	  if [ -z "$diff" ]; then
	    echo "No staged changes to commit."
	    return 1
	  fi
	  # Ask Gemini to write the message
	  echo "Generating commit message..."
	  msg=$(echo "$diff" | gemini -p "Write a concise Conventional Commit message for this diff. Output ONLY the message.")
	  # Commit with the generated message
	  git commit -m "$msg"
	}
	```
	파일을 저장하고 종료하세요.
3. 이 명령어를 실행하면 해당 기능을 즉시 사용할 수 있습니다.
	```bash
	source ~/.zshrc
	```

**윈도우(파워셸)**

1. 원하는 텍스트 편집기로 PowerShell 프로필을 엽니다.
	```powershell
	notepad $PROFILE
	```
2. 파일의 맨 아래로 스크롤하여 다음 코드를 붙여넣으세요.
	```powershell
	function gcommit {
	  # Get the diff of staged changes
	  $diff = git diff --staged
	  if (-not $diff) {
	    Write-Host "No staged changes to commit."
	    return
	  }
	  # Ask Gemini to write the message
	  Write-Host "Generating commit message..."
	  $msg = $diff | gemini -p "Write a concise Conventional Commit message for this diff. Output ONLY the message."
	  # Commit with the generated message
	  git commit -m "$msg"
	}
	```
	파일을 저장하고 종료하세요.
3. 이 명령어를 실행하면 해당 기능을 즉시 사용할 수 있습니다.
	```powershell
	. $PROFILE
	```
4. 새로운 명령어를 사용하세요:
	```bash
	gcommit
	```
	Gemini CLI는 스테이징된 변경 사항을 분석하고 생성된 메시지와 함께 커밋합니다.

## 다음 단계

- 자세한 JSON 스키마 내용은 [헤드리스 모드 참조 문서를](https://geminicli.com/docs/cli/headless) 확인하세요.
- 에이전트가 스크립트를 작성하는 대신 실행할 수 있도록 [셸 명령](https://geminicli.com/docs/cli/tutorials/shell-commands) 에 대해 알아보세요.