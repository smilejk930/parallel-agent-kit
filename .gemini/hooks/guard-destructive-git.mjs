#!/usr/bin/env node
// Gemini CLI BeforeTool hook — run_shell_command guard.
// Blocks a small set of destructive git operations that would corrupt the
// parallel worktree layout or a teammate's branch. Everything else is
// allowed by returning decision="allow".
//
// Docs: https://geminicli.com/docs/hooks/reference#beforetool
// Golden rule: stdout must be a single JSON object only.

const input = await new Promise((resolve) => {
  let buf = "";
  process.stdin.on("data", (chunk) => (buf += chunk));
  process.stdin.on("end", () => resolve(buf));
});

let event = {};
try {
  event = JSON.parse(input || "{}");
} catch (err) {
  process.stderr.write(`guard-destructive-git: bad stdin: ${err.message}\n`);
  process.stdout.write(JSON.stringify({ decision: "allow" }));
  process.exit(0);
}

const cmd = (event.tool_input && (event.tool_input.command || event.tool_input.cmd)) || "";

const patterns = [
  {
    re: /\bgit\s+push\b.*\s(-f|--force|--force-with-lease=?\S*)?\s+\S*\s*(main|master|release\/)/,
    reason: "보호된 브랜치로의 push는 파이프라인에서 차단됩니다. agent/<slug>/T-* 브랜치만 푸시하세요.",
  },
  {
    re: /\bgit\s+push\s+.*(-f|--force)\b/,
    reason: "강제 push는 병렬 worktree 환경에서 다른 에이전트의 작업을 덮어쓸 수 있습니다. 금지.",
  },
  {
    re: /\bgit\s+reset\s+--hard\b/,
    reason: "git reset --hard는 병렬 worktree 환경에서 커밋 손실을 유발합니다. Reviewer/Tester가 fail을 돌려주면 Coder가 새 커밋으로 수정하세요.",
  },
  {
    re: /\bgit\s+clean\s+-[a-z]*f/,
    reason: "git clean -f는 다른 에이전트의 미커밋 작업을 날립니다. 금지.",
  },
  {
    re: /\bgit\s+add\s+(-A|--all|\.)\b/,
    reason: "git add -A/./--all은 파이프라인에서 금지입니다. 플랜에 명시된 파일만 명시적으로 stage 하세요.",
  },
  {
    re: /\bgit\s+branch\s+-D\s+(main|master)\b/,
    reason: "보호된 브랜치 삭제 차단.",
  },
  {
    re: /\brm\s+-rf?\s+\.git(\/|$|\s)/,
    reason: "`.git` 디렉터리 삭제 차단.",
  },
];

for (const { re, reason } of patterns) {
  if (re.test(cmd)) {
    process.stderr.write(`guard-destructive-git: BLOCK ${cmd}\n`);
    process.stdout.write(JSON.stringify({
      decision: "deny",
      reason,
    }));
    process.exit(0);
  }
}

process.stdout.write(JSON.stringify({ decision: "allow" }));
