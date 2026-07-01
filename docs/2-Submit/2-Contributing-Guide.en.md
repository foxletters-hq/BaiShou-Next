# Contributing Policy

[简体中文](./2-Contributing-Guide.md) | [繁體中文](./2-Contributing-Guide.tw.md) | [English](./2-Contributing-Guide.en.md) | [日本語](./2-Contributing-Guide.ja.md)

**Audience**: All human contributors and AI assistants who wish to participate in BaiShou-Next.

This document explains **what kinds of contributions we welcome**, **what must be discussed first**, and what a feature proposal Issue should include.  
For submission and CI, see [1-Submit-Rule.md](./1-Submit-Rule.md). For coding rules, see [1-AI-Code-Rule.md](../1-AI-Code/1-AI-Code-Rule.md) (Chinese).

---

## 1. Our stance (read this first)

BaiShou is a privacy-focused AI memory companion. **Product direction, interaction design, and data models** require long-term, careful planning—not ad-hoc feature stacking via external PRs.

| Type | Our stance |
| ---- | ---------- |
| **Bug fixes** (reproducible, tested, CI green) | **Welcome** |
| **Documentation fixes** (typos, unclear wording) | **Welcome** |
| **Reproducible Bug Issues** (environment, steps, expected vs actual) | **Welcome** |
| **New feature PRs without prior discussion** | **Open an Issue first; unlikely to merge without prior agreement** |
| **New UI libraries / dependencies / Schema changes** | **Issue first; maintainer approval required** |

> **In short**: Decide whether something *should* be done before worrying about *how*.  
> A clear Issue is more likely to succeed than a large surprise PR.

---

## 2. What we welcome most: bug fixes

### 2.1 Filing a Bug Issue

Use the [Bug report](https://github.com/Anson-Trio/BaiShou-Next/issues/new?template=01-bug.yml) template. Include when possible:

- BaiShou version / branch, desktop or mobile, OS
- **Steps to reproduce** (from a clean state)
- **Expected** vs **actual** behavior
- Logs or screenshots (redact secrets and API keys)

### 2.2 Submitting a bug-fix PR

1. Prefer discussing on the linked Issue, or link the Issue in the PR description.
2. Follow [1-AI-Code-Rule.md](../1-AI-Code/1-AI-Code-Rule.md): **tests required** except trivial one-line hotfixes.
3. Run `pnpm ci:check` before opening a PR (see [1-Submit-Rule.md](./1-Submit-Rule.md)).
4. Explain root cause, fix approach, and how you verified.

Small, focused, well-tested bug PRs are what we are most willing to review and merge.

---

## 3. New features: Issue first, code later (think twice)

### 3.1 Why new features need discussion first

- BaiShou centers on memory companionship and local privacy. Features touch **data models, AI tooling, cross-platform consistency, backup compatibility**, and more—not just an extra button.
- This monorepo ships **Electron desktop** and **Expo mobile** together. Many changes need both platforms aligned, or a clear reason for single-platform scope.

**Feature PRs opened without maintainer agreement may be closed without review.**

### 3.2 If you still want to propose a feature

**Open an Issue only** (use the [Feature proposal](https://github.com/Anson-Trio/BaiShou-Next/issues/new?template=02-enhancement.yml) template). **Do not open a large PR first.**

You may use AI to draft the Issue, but **you must read and verify it before posting**. We need your judgment, not unchecked AI output.

#### Required Issue outline

```markdown
## Feature proposal

### 1. What problem does this solve?
(User scenario, pain point; fit with BaiShou's "memory companion / local privacy" positioning)

### 2. Proposed solution (user-visible behavior)
(Interaction sketch, entry point, overlap with existing features)

### 3. Technical outline
- **Packages/paths to change** (see monorepo map below)
- **Database Schema impact** (yes/no; migration plan if yes)
- **Desktop / mobile / both**
- **New dependencies** (name, size, why existing stack is insufficient)

### 4. UI and components
- New UI? Reuse `packages/ui` or build new?
- **If adding a third-party UI library**: name, version, license, how it fits [UI theme rules](../1-AI-Code/2-UI-Theme-Rule.md) (**hard-coded colors are forbidden**; use theme variables)
- Light/dark mode and i18n (zh-CN / zh-TW / en / ja) considered?

### 5. Implementation steps (your plan)
1. …
2. …
3. …

### 6. Testing and verification
- Unit/integration tests to add
- Manual verification paths

### 7. Risks and alternatives
- Impact on user data, backups, sync
- Lighter alternatives if we skip this feature

### 8. Will you implement after acceptance?
(yes / no / ideas only)
```

Maintainers will reply: **accepted / needs changes / declined / deferred**.  
**Only after explicit "accepted" or "PR welcome"** should you fork and open a PR.

### 3.3 Monorepo map (for "what would change")

| Path | Role |
| ---- | ---- |
| `apps/desktop` | Electron desktop client (React + electron-vite) |
| `apps/mobile` | Expo / React Native mobile client |
| `packages/core` | Cross-platform business logic |
| `packages/core-desktop` / `core-mobile` | Platform-specific core |
| `packages/ai` | AI providers, Agent, tool calls |
| `packages/database` / `database-desktop` | libSQL/SQLite + Drizzle |
| `packages/ui` | Shared UI, theme, diary editor, etc. |
| `packages/shared` / `store` | Utilities, state |

Feature work often spans **UI + core + database + both apps**. Be honest about scope in the Issue.

### 3.4 Changes that need prior maintainer approval

(Same as [1-AI-Code-Rule.md §6](../1-AI-Code/1-AI-Code-Rule.md))

- New npm dependencies (especially native addons, >500KB packages, new build chains)
- Database Schema or migrations
- Breaking changes to public APIs / IPC
- New third-party UI libraries
- CI / release pipeline changes

---

## 4. Other contributions

- **Documentation**: corrections and developer notes — PRs welcome.
- **Ideas and discussion**: Issues welcome (e.g. [Ideas](https://github.com/Anson-Trio/BaiShou-Next/issues/new?template=03-interesting.yml) template), but that does not imply roadmap commitment.
- **Fork for personal use**: allowed under AGPLv3; network deployments of modified versions must comply with the license.

---

## 5. Common reasons PRs are closed

- No prior accepted Feature Issue
- `pnpm ci:check` not run or failing
- Missing tests (non-trivial fix)
- Unapproved dependencies or UI libraries
- Theme rule violations (hard-coded colors, etc.)
- Oversized scope or unrelated changes mixed in one PR

---

## 6. Related docs

- [Submission guidelines](./1-Submit-Rule.md) (Chinese)
- [AI coding rules](../1-AI-Code/1-AI-Code-Rule.md) (Chinese)
- [UI theme rules](../1-AI-Code/2-UI-Theme-Rule.md) (Chinese)
- [Documentation index](../0-README.md) (Chinese)
