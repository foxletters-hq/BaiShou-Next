# Contributing Policy

[简体中文](./2-Contributing-Guide.md) | [繁體中文](./2-Contributing-Guide.tw.md) | [English](./2-Contributing-Guide.en.md) | [日本語](./2-Contributing-Guide.ja.md)

**Audience**: All human contributors and AI assistants who wish to participate in BaiShou-Next.

This document explains **what kinds of contributions we welcome**, **what must be discussed first**, and what a feature proposal Issue should include.  
For submission and CI, see [1-Submit-Rule.md](./1-Submit-Rule.md). For coding rules, see [1-AI-Code-Rule.md](../1-AI-Code/1-AI-Code-Rule.md) (Chinese).

---

## 1. Our stance (read this first)

BaiShou is a privacy-focused AI memory companion. **Product direction, interaction design, and data models** require long-term, careful planning—not ad-hoc feature stacking via external PRs.

To stay sustainable and **reduce maintainer overhead**, we currently take a tighter stance on external PRs. This is not about rejecting contributors—it is about avoiding wasted effort on both sides when there has been no prior alignment.

| Type                                                                 | Our stance                                                                                 |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| **Bug-fix PRs** (reproducible, tested, CI green, clear motivation)   | **Accepted selectively**; small, high-quality fixes are what we are most willing to review |
| **Documentation fixes** (typos, unclear wording)                     | **Welcome**                                                                                |
| **Reproducible Bug Issues** (environment, steps, expected vs actual) | **Welcome**                                                                                |
| **New feature PRs**                                                  | **Not accepted for now**; if you have a feature design, open an Issue first                |
| **Purely AI-generated PRs the submitter does not understand**        | **No review**; a waste of the submitter's compute and the maintainer's time                |
| **PRs that do not follow repo conventions**                          | **Not accepted** (see [1-AI-Code-Rule.md](../1-AI-Code/1-AI-Code-Rule.md))                 |
| **New UI libraries / dependencies / Schema changes**                 | **Issue first; maintainer approval required**                                              |

> **In short**: Decide whether something _should_ be done and whether you _truly understand the relevant code_ before worrying about _how_.  
> A clear Issue is more likely to succeed than a large surprise PR.

### 1.1 Maintainer capacity and review boundaries

Maintainer time is limited. Every PR requires reading, understanding, verification, and possibly back-and-forth. **We will not spend review effort on**:

1. **Pure AI output**: PRs generated in bulk by AI that the submitter has not read line by line and cannot explain clearly in the PR or Issue. AI may assist drafting, but **you are responsible for the code and conclusions**.
2. **Lack of code understanding**: PRs that cannot explain root cause, impact scope, or that clearly mismatch existing architecture.
3. **Convention violations**: e.g. `pnpm ci:check` not run, missing tests, theme or directory rule violations (see [1-Submit-Rule.md](./1-Submit-Rule.md)).

If you are unsure whether a change fits, **discuss in an Issue first**—do not open a PR and hope for the best.

### 1.2 PR target branch

If you intend to open a PR, set the **base branch** to upstream **`Baishou-dev`**.

**PRs targeting `main` are invalid.** Maintainers will not review or respond to them and will close them directly.

### 1.3 Contributor License Agreement (CLA)

Before opening a **code** Pull Request, sign the [Organization CLA](../../legal/CLA-organization.md) (valid across foxletters-hq repos):

1. Find the **cla-assistant** comment on your PR
2. Click **Sign in with GitHub to agree**, then **I agree**
3. The CLA status check turns green when done

**Documentation-only PRs are usually exempt.** Corporate contributors must also sign the [Corporate CLA](../../legal/CLA-corporate.md).

Maintainers: one-time setup at [CLA-GITHUB-SETUP.md](../../legal/CLA-GITHUB-SETUP.md).

---

## 2. What we welcome most: bug fixes

### 2.1 Filing a Bug Issue

Use the [Bug report](https://github.com/foxletters-hq/BaiShou-Next/issues/new?template=01-bug.yml) template. Include when possible:

- BaiShou version / branch, desktop or mobile, OS
- **Steps to reproduce** (from a clean state)
- **Expected** vs **actual** behavior
- Logs or screenshots (redact secrets and API keys)

### 2.2 Submitting a bug-fix PR

1. Prefer discussing on the linked Issue, or link the Issue in the PR description.
2. Follow [1-AI-Code-Rule.md](../1-AI-Code/1-AI-Code-Rule.md): **tests required** except trivial one-line hotfixes.
3. Run `pnpm ci:check` before opening a PR (see [1-Submit-Rule.md](./1-Submit-Rule.md)).
4. Explain root cause, fix approach, and how you verified.

Small, focused, well-tested bug PRs are what we are most willing to review. **Not every bug-fix PR will be merged**—maintainers weigh scope, risk, and current priorities.

---

## 3. New features: Issue discussion only (feature PRs not accepted for now)

### 3.1 Why we are not accepting feature PRs for now

- BaiShou centers on memory companionship and local privacy. Features touch **data models, AI tooling, cross-platform consistency, backup compatibility**, and more—not just an extra button.
- This monorepo ships **Electron desktop** and **Expo mobile** together. Many changes need both platforms aligned, or a clear reason for single-platform scope.
- Maintainer capacity is limited. **We are not accepting new feature PRs at this stage** to avoid a queue of misaligned code.

**If you have a feature design, use an Issue to align with maintainers first. Feature PRs opened without prior discussion may be closed without review.**

### 3.2 If you still want to propose a feature

**Open an Issue only** (use the [Feature proposal](https://github.com/foxletters-hq/BaiShou-Next/issues/new?template=02-enhancement.yml) template). **Do not open a feature PR.**

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

Maintainers will reply: **accepted for discussion / needs changes / declined / deferred**.  
**Even if an Issue is accepted, that does not mean you may open a feature PR right away**—wait until maintainers explicitly say "PR welcome" and the project stage allows it before forking and submitting.

### 3.3 Monorepo map (for "what would change")

| Path                                     | Role                                            |
| ---------------------------------------- | ----------------------------------------------- |
| `apps/desktop`                           | Electron desktop client (React + electron-vite) |
| `apps/mobile`                            | Expo / React Native mobile client               |
| `packages/core`                          | Cross-platform business logic                   |
| `packages/core-desktop` / `core-mobile`  | Platform-specific core                          |
| `packages/ai`                            | AI providers, Agent, tool calls                 |
| `packages/database` / `database-desktop` | libSQL/SQLite + Drizzle                         |
| `packages/ui`                            | Shared UI, theme, diary editor, etc.            |
| `packages/shared` / `store`              | Utilities, state                                |

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
- **Ideas and discussion**: Issues welcome (e.g. [Ideas](https://github.com/foxletters-hq/BaiShou-Next/issues/new?template=03-interesting.yml) template), but that does not imply roadmap commitment.
- **Fork for personal use**: allowed under AGPLv3; network deployments of modified versions must comply with the license.
- **Code PRs**: require signing the [Organization CLA](../../legal/CLA-organization.md) (docs-only PRs exempt).

---

## 5. Common reasons PRs are closed

- **New feature PRs submitted during the current stage** (open an Issue to discuss design first)
- **Purely AI-generated PRs the submitter cannot explain** (motivation, impact)
- **PRs showing lack of code understanding or failure to follow repo conventions**
- **PRs targeting `main`** (submit to `Baishou-dev` instead)
- No prior accepted Feature Issue (when maintainers have said PRs are welcome)
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
- [LICENSE-STRATEGY.md](../../legal/LICENSE-STRATEGY.md)
- [CLA-GITHUB-SETUP.md](../../legal/CLA-GITHUB-SETUP.md)
- [CLA-organization.md](../../legal/CLA-organization.md)
- [Documentation index](../0-README.md) (Chinese)
