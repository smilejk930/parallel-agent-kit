#!/usr/bin/env node
// Gemini CLI SessionStart hook.
// Contract: read JSON from stdin, write ONE JSON object to stdout, logs to stderr.
// Docs: https://geminicli.com/docs/hooks/reference
//
// Responsibility:
//   1. Create the .gemini/{plans,reports,worktrees} scaffolding if missing.
//   2. Inject a short orchestration primer so every new session knows the
//      4-agent pipeline contract without reloading GEMINI.md.
//
// NOTE: stdout must be ONLY the final JSON — no other prints.

import { mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";

const input = await new Promise((resolve) => {
  let buf = "";
  process.stdin.on("data", (chunk) => (buf += chunk));
  process.stdin.on("end", () => resolve(buf));
});

let event = {};
try {
  event = JSON.parse(input || "{}");
} catch (err) {
  process.stderr.write(`session-start: bad stdin: ${err.message}\n`);
}

const projectDir = process.env.GEMINI_PROJECT_DIR || process.env.CLAUDE_PROJECT_DIR || event.cwd || process.cwd();

for (const sub of ["plans", "reports", "worktrees"]) {
  const p = join(projectDir, ".gemini", sub);
  if (!existsSync(p)) {
    try {
      mkdirSync(p, { recursive: true });
      process.stderr.write(`session-start: created ${p}\n`);
    } catch (err) {
      process.stderr.write(`session-start: mkdir failed for ${p}: ${err.message}\n`);
    }
  }
}

const primer = [
  "# Parallel Agent Kit — orchestration primer",
  "",
  "This workspace runs a **Planner → Coder → Reviewer → Tester** pipeline.",
  "",
  "- Entry point: `/parallel-dev <자연어 요청>`",
  "- Re-verify one task: `/pipeline:verify <T-id> <plan-path> <branch>`",
  "- Live snapshot: `/pipeline:status`",
  "- Clean up: `/worktree:cleanup [slug]`",
  "",
  "Each subagent MUST end its turn with a single-line JSON handoff",
  "(defined by each agent's `## Handoff contract`). Never merge a task",
  "whose Reviewer or Tester verdict is `fail` — route feedback back to the Coder.",
  "",
  "obra/superpowers is installed as a Gemini CLI extension and its 14",
  "skills appear in `/skills list`. Required activations per role are",
  "documented in GEMINI.md §\"역할 ↔ 스킬 매핑\" — follow that table.",
].join("\n");

const out = {
  hookSpecificOutput: { additionalContext: primer },
  suppressOutput: true,
};

process.stdout.write(JSON.stringify(out));
