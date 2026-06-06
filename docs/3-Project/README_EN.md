# BaiShou Next

[简体中文](../../README.md) | [繁體中文](README_TW.md) | [English](README_EN.md) | [日本語](README_JA.md)

[Quote collection](quotes-collection/quotes-collection.en.md)

> A pure white oath, guarding each other for a lifetime.

**BaiShou** is an open-source, privacy-first **AI memory companion**: record your life and diaries locally, let AI partners truly _remember_ you, and fight forgetting together.

We warmly welcome your contributions—Issues, PRs, documentation, and ideas. BaiShou has come this far thanks to every friend who helped and challenged us along the way; because of you, it keeps getting better. If you would like to carry this promise forward, please read the [Contributing](#contributing) section below.

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

- Node.js ≥ 20
- pnpm 10 (see `packageManager` in the root `package.json`)

##### 1. Clone

```bash
git clone https://github.com/Anson-Trio/BaiShou-Next.git
cd BaiShou-Next
```

##### 2. Install

```bash
pnpm install
```

If Electron fails to download, see [pnpm-electron-setup.md](../pnpm-electron-setup.md) (Chinese).

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

1. **Fork** this repo and work on a feature branch (do not push directly to upstream `main`).
2. Coding conventions: [AI coding rules](../1-AI-Code/1-AI-Code-Rule.md) (Chinese).
3. Before opening a PR, run **`pnpm ci:check`** and follow commit message rules in [submission guidelines](../2-Submit/1-Submit-Rule.md).

Issues and PRs are welcome. Discuss ideas in GitHub Issues.

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
