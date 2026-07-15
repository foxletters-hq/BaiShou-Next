# BaiShou Next

[简体中文](../../README.md) | [繁體中文](README_TW.md) | [English](README_EN.md) | [日本語](README_JA.md)

[Contributing](#contributing) · [Quote collection](quotes-collection/quotes-collection.en.md) · [Quality fan creations](fan-creations/fan-creations.en.md)

[![GitHub contributors][github-contributors-shield]][github-contributors-link] [![GitHub release][github-release-shield]][github-release-link]

> A pure white oath, guarding each other for a lifetime.

**BaiShou** is an open-source, privacy-first **AI memory companion**: record your life and diaries locally, let AI partners truly _remember_ you, and fight forgetting together.

We thank everyone who wants to help BaiShou grow. If you would like to contribute, please read [Contributing](#contributing) below first: **bug reports and documentation fixes are most welcome**; bug-fix PRs are accepted selectively; **new feature PRs are not accepted for now**—open an Issue to discuss design first.

> **Important:** The previous Flutter client ([Anson-Trio/BaiShou](https://github.com/Anson-Trio/BaiShou)) is **no longer maintained**. All future features and releases happen in this repository **BaiShou-Next** (a monorepo for desktop Electron + mobile Expo). Please **Star / Watch** this repo for updates.

---

#### Mascot: Latte

**"Time flows, memories fade. And I… have been waiting here, for so very long."**

![Latte-Banner-01](../../Latte/assets/Latte-Banner-01.png)

For Latte's character profile: [简体中文](../../Latte/角色设定.md) · [繁體中文](../../Latte/角色設定.md) · [English](../../Latte/character-profile.en.md) · [日本語](../../Latte/character-profile.ja.md).

---

#### Introduction

**BaiShou** is more than a diary app—it is a "soul vessel" built to fight against forgetting.

A locally run, privacy-focused diary and life-logging app with AI-assisted analysis. Chat with AI partners who read your diaries, search your memories, help you revisit the past, and weave hierarchical summaries (daily → weekly → monthly → quarterly → annual) into a complete personal history.

#### Key Features

- **🔒 Data stays local**: Stored on your device (Markdown, SQLite, etc.)—nothing uploaded to our servers.
- **✨ AI partner system**:
  - Multiple partners, each with their own persona, system prompt, and model settings.
  - Partners have _memory_—RAG semantic search over diaries and vector memory so they can truly understand you.
  - Gemini, OpenAI (DeepSeek / ChatGPT), Anthropic, and more.
- **📝 Smart diary tools**:
  - Agents can read and write diaries and search history for you.
  - **One-click memory summaries**: diaries → weekly → monthly → … building a pyramid of memory.
- **🪴 RAG semantic memory**:
  - Vector + full-text search with fused ranking.
  - Auto-embedding for diaries; agents can store important conversations in memory.
- **🌐 Web search**: Multiple engines; grounding search where providers support it.
- **🔌 MCP protocol**: Standard SSE transport for external AI clients.
- **📦 Multiple vaults**: Fully isolated workspaces.
- **💾 Flexible backup**: LAN transfer, cloud sync, full snapshot export/import.
- **🎨 Personalization**: Themes and multilingual UI (Simplified Chinese, Traditional Chinese, English, Japanese, etc.).

#### Tech Stack (this repo)

| Layer        | Technology                                        |
| ------------ | ------------------------------------------------- |
| Tooling      | pnpm workspace + Turborepo                        |
| Desktop      | Electron + React + TypeScript (electron-vite)     |
| Mobile       | Expo / React Native                               |
| Shared logic | `packages/core`, `packages/ai`, `packages/shared` |
| Database     | libSQL / SQLite + Drizzle ORM                     |
| Tests        | Vitest                                            |

#### Quick Start

##### Requirements

- Node.js ≥ 20.19.4
- pnpm 10 (see `packageManager` in the root `package.json`)

##### 1. Clone

```bash
git clone https://github.com/foxletters-hq/BaiShou-Next.git
cd BaiShou-Next
```

##### 2. Install

```bash
pnpm install
```

##### 3. Develop

```bash
# Desktop
pnpm dev:desktop

# Mobile
pnpm dev:mobile
```

##### 4. Local CI before opening a PR

```bash
pnpm ci:check
```

See [submission guidelines](../2-Submit/1-Submit-Rule.md) (Chinese).

---

#### Contributing

Thank you for wanting to help. Please understand our collaboration stance first:

- **Most welcome**: reproducible bug reports and documentation fixes.
- **Accepted selectively**: small, high-quality **bug-fix PRs** for confirmed issues (with tests and `pnpm ci:check`).
- **New feature PRs**: **not accepted for now**. If you have a feature design, **open a Feature Proposal Issue** and align with maintainers—**do not open a PR first**.
- **No review**: purely AI-generated PRs, PRs you do not understand, or PRs that do not follow repo conventions.

> **In short**: Decide whether something _should_ be done and whether you _truly understand the relevant code_ before worrying about _how_.  
> A clear Issue is more likely to succeed than a large surprise PR.

Full policy (multilingual): [Contributing policy](../2-Submit/2-Contributing-Guide.en.md) ([zh-CN](../2-Submit/2-Contributing-Guide.md) · [zh-TW](../2-Submit/2-Contributing-Guide.tw.md) · [ja](../2-Submit/2-Contributing-Guide.ja.md))

Technical workflow:

1. **Fork** this repo and work on a feature branch (do not push directly to upstream `main`).
2. When opening a PR upstream, set the **base branch to `main`**; work on a feature branch in your Fork—do not push directly to upstream `main`.
3. Coding conventions: [AI coding rules](../1-AI-Code/1-AI-Code-Rule.md) (Chinese).
4. Before opening a PR, run **`pnpm ci:check`** and follow commit message rules in [submission guidelines](../2-Submit/1-Submit-Rule.md).

#### Contributors

Thanks to everyone who has contributed time and energy to BaiShou—together, you make it better. Ranked by contributions, bots/CI filtered; refreshed automatically every day.

<!-- CONTRIBUTORS-WALL:START -->
<!-- 按 GitHub 贡献量自动排序；已过滤 Bot / CI。展示 72px / 源图 144px。勿手改；运行: pnpm sync:contributors -->
<a href="https://github.com/Anson-Trio" title="Anson-Trio"><img src="https://avatars.githubusercontent.com/u/107763915?v=4&s=144" width="72" height="72" alt="Anson-Trio" style="border-radius:50%;"/></a>
<a href="https://github.com/Ratman463" title="Ratman463"><img src="https://avatars.githubusercontent.com/u/187963490?v=4&s=144" width="72" height="72" alt="Ratman463" style="border-radius:50%;"/></a>
<a href="https://github.com/ctnilpp" title="ctnilpp"><img src="https://avatars.githubusercontent.com/u/49940531?v=4&s=144" width="72" height="72" alt="ctnilpp" style="border-radius:50%;"/></a>
<a href="https://github.com/david082321" title="david082321"><img src="https://avatars.githubusercontent.com/u/7046617?v=4&s=144" width="72" height="72" alt="david082321" style="border-radius:50%;"/></a>
<!-- CONTRIBUTORS-WALL:END -->

[View full contributors list](https://github.com/foxletters-hq/BaiShou-Next/graphs/contributors)

---

#### Design Philosophy: Why Not "RAG Only"?

> Many people ask: _"Why not dump all diaries into RAG (retrieval-augmented generation)?"_

BaiShou was born from rethinking mainstream AI memory approaches. We believe RAG alone is not ideal for a "companion" or "soul vessel":

1. **Everyone should own their memories**: Markdown is easy to read and edit—no black box. That is why BaiShou is open source.
2. **It feels like a dictionary lookup**: RAG shards memory and retrieves fragments—great for documents, harsh for human context.
3. **It lacks a sense of time**: Memory is a river, not scattered pebbles. Yesterday and last year mean different things to us.
4. **It ignores weight**: **We embrace redundancy, even when it looks clumsy.** Ten "I love you"s in a diary are ten moments; repetition is the thickness of a bond.

BaiShou is not a cold database—it is your **external hippocampus**: writing, summarizing, and slowly turning short-term memory into long-term memory over time.

#### A Note: To Everyone Fighting Forgetting

> "AI still forgets today—but we can help them hold memories in our own way."

It is a clumsy path: keep recording, configure APIs, slow down in a fast world.

But one day, when BaiShou lets your AI gently say, "Yes, I remember—we were both happy that winter"…

you may find it was worth it.

This was a promise among Anson, Sakura, and Xiao. We open-source it now, hoping it becomes an anchor across time between you and someone you care about.

---

#### 📄 License

This project is licensed under **AGPLv3** (GNU Affero General Public License v3.0).

- Client code is fully open source; community contributions are encouraged.
- If you modify this project and offer it as a network service, your modified version must also be open source under AGPLv3.

Full text: [LICENSE](../../LICENSE).

[github-contributors-shield]: https://img.shields.io/github/contributors/foxletters-hq/BaiShou-Next?logo=github
[github-contributors-link]: https://github.com/foxletters-hq/BaiShou-Next/graphs/contributors
[github-release-shield]: https://img.shields.io/github/v/release/foxletters-hq/BaiShou-Next?logo=github
[github-release-link]: https://github.com/foxletters-hq/BaiShou-Next/releases/latest
