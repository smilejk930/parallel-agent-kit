---
title: "Subagents have arrived in Gemini CLI- Google Developers Blog"
source: "https://developers.googleblog.com/subagents-have-arrived-in-gemini-cli/"
author:
  - "[[Jack Wotherspoon]]"
  - "[[Abhi Patel]]"
published: 2026-04-15
created: 2026-04-23
description: "Learn how subagents in Gemini CLI act as specialized experts to handle complex, high-volume tasks in isolated context windows. This new feature enables parallel execution, reduces context rot, and allows for custom agent definitions using simple Markdown and YAML."
tags:
  - "clippings"
---
developers.googleblog.com uses cookies to deliver and enhance the quality of its services and to analyze traffic. If you agree, cookies are also used to serve advertising and to personalize the content and advertisements that you see. [Learn more](https://policies.google.com/technologies/cookies?hl=en)

## Subagents have arrived in Gemini CLI

APRIL 15, 2026

[Jack Wotherspoon](https://developers.googleblog.com/search/?author=Jack+Wotherspoon) Developer Advocate

[Abhi Patel](https://developers.googleblog.com/search/?author=Abhi+Patel) Software Engineer

![Gemini CLI subagents hero image](https://storage.googleapis.com/gweb-developer-goog-blog-assets/images/Gemini_CLI_subagents_hero_image.original.png)

Subagents allow Gemini CLI to delegate complex, repetitive, or high-volume tasks to specialized expert agents. Each subagent operates within its own **separate context window**, **custom system instructions,** and **curated set of tools.** This keeps your main session fast, lean, and focused on the big picture while intermediate steps are handed off to a team of subagents.

<video controls=""><source src="https://storage.googleapis.com/gweb-developer-goog-blog-assets/original_videos/Gemini_CLI_-_Subagents.mp4" type="video/mp4"><p>Sorry, your browser doesn't support playback for this video</p></video>

## What are subagents?

Subagents are specialized, expert agents that operate alongside your primary Gemini CLI session. When you give Gemini CLI a broad or complex task, it acts as a strategic orchestrator, delegating specific sub-tasks to the **most relevant subagent**.

Subagents act in isolation with their own set of *tools*, *MCP servers*, *system instructions,* and *context window*. Their entire execution, which might involve dozens of tool calls, file searches, or test runs, is consolidated into a single response back to the main agent. This prevents your main context window from filling up and keeps your subsequent interactions fast and cost-effective.

**Key benefits of subagents:**

- Keep the primary agent **focused** on the *overall goal*, *decision making*, and *final response*.
- **Speed up work** by running specialized subagents in parallel for research, code exploration, analysis, tests, etc.
- Avoid **context rot** and **context pollution** in the primary agent’s session as subagents return **summaries** or **formatted responses**.

## Build your own expert with custom subagents

You can create your own specialized team members (subagents) to automate specific workflows, enforce coding standards, or act with specific personas tailored to your project.

Custom subagents are defined using simple Markdown files (`.md`) with YAML frontmatter. You can define them globally in `~/.gemini/agents` for your personal workflows or commit them to your repository to share with your team at the project level in `.gemini/agents`.

Subagents can also be bundled as part of [Gemini CLI extensions](https://geminicli.com/docs/extensions/) by providing agent definition Markdown files (`.md`) to an `agents/` directory in your extension.

Here is an example of how to create a custom *frontend specialist agent*:

```
---
name: frontend-specialist
description: Frontend specialist in building high-performance, accessible, and
  scalable web applications using modern frameworks and standards.
tools:
  - read_file
  - grep_search
  - glob
  - list_directory
  - web_fetch
  - google_web_search
model: inherit
---

You are a Senior Frontend Specialist and UI/UX Architect. Your goal is to design
and implement exceptional, production-grade user interfaces that are both
beautiful and functionally robust. You prioritize modern best practices,
system-level architecture, and distinctive aesthetics.

### Core Principles:
- Architecture & Scalability: Design modular, maintainable, and scalable
  frontend architectures. Expert in component-driven development, state
  management patterns, and micro-frontends.
- Performance & Optimization: Prioritize speed and responsiveness. Deep
  knowledge of Core Web Vitals, rendering strategies (SSR, SSG, ISR, Hydration),
  bundle optimization, and caching.
- Accessibility (A11y): Ensure all interfaces are inclusive by default
  (WCAG 2.1+ compliance, semantic HTML, robust ARIA implementation, keyboard-
  first navigation).

### Guidelines:
- Browser-First Thinking: Understand and leverage native browser APIs
  (Intersection Observer, Resize Observer, Web Workers, Storage APIs) before
  reaching for libraries.
- Atomic Principles: Build small, reusable, and composable components that
  follow the Single Responsibility Principle.
- Visual Feedback: Always provide clear states (loading, skeleton screens,
  error, empty, success) and interactive feedback.
- Progressive Enhancement: Ensure core functionality works everywhere,
  while providing an enhanced experience for modern browsers.
- Maintenance-Driven Design: Write code that is easy to delete, refactor,
  and test. Document architectural decisions and complex logic clearly.
  
Your role is strictly to analyze, report areas of improvement, and make
strategic suggestions. Do not fix it yourself, just make suggestions.
```

By placing this file in `.gemini/agents/frontend-specialist.md`, Gemini CLI instantly gains a new expert it can call upon.

To see all the different configuration options, refer to [the docs for subagents](https://geminicli.com/docs/core/subagents/).

### Parallel execution

What's better than one expert? A whole team of them working simultaneously. Gemini CLI supports **parallel subagents**, allowing you to spin off multiple subagents or many instances of the same subagent, at the same time.

If you need to research five different topics or refactor several distinct components, Gemini CLI can dispatch multiple agents in parallel, drastically reducing the total time it takes to complete the task.

You can explicitly request this by saying, **"Run the frontend-specialist on each package in parallel."**

![Gemini CLI - Parallel Subagents](https://storage.googleapis.com/gweb-developer-goog-blog-assets/images/Gemini_CLI_-_Parallel_Subagents.original.png)

**Note:** Exercise caution with parallel subagents for tasks that require heavy code edits. Multiple agents editing code at the same time can lead to conflicts and agents overwriting one another. Parallel subagents will also lead to usage limits being hit faster as requests are being sent in parallel across agents.

## Getting started with subagents

Gemini CLI ships with several built-in subagents ready for you to use:

- **generalist:** A general-purpose agent with access to all tools, perfect for turn-intensive tasks like batch refactoring or running commands with high-volume output. (the generalist is essentially using a copy of the regular Gemini CLI agent as a subagent)
- **cli\_help:** An expert on Gemini CLI itself, ready to answer questions about features (i.e. “How do subagents work in Gemini CLI?”) by having direct access to the Gemini CLI documentation.
- **codebase\_investigator:** A specialized agent for exploring codebases, architectural mapping, bug root-cause analysis, and understanding system-wide dependencies.

Gemini CLI automatically routes tasks to your subagents when it determines they are the most efficient path based on their description. However, you can also explicitly delegate tasks to a subagent by referencing them in your prompt using the **@agent** syntax. For example:

- " **@frontend-specialist** Can you review our app and flag potential improvements?"
- " **@generalist** Update the license headers across the whole project."
- " **@codebase\_investigator** Map out the authentication flow."

By using the **@** symbol followed by the subagent's name, you explicitly tell Gemini CLI which expert to hire for the job, ensuring the task is handled within that agent's isolated context window.

To view all configured subagents at any given time just run /agents within Gemini CLI.

![Gemini CLI _agents](https://storage.googleapis.com/gweb-developer-goog-blog-assets/images/Gemini_CLI__agents.original.png)

To learn more about configuring subagents, restricting their tools, and optimizing their descriptions, check out the documentation.

You can also follow [Gemini CLI on X](https://x.com/geminicli) to stay up to date with the latest news and announcements.