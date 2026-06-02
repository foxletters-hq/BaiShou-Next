# 白守 Next (BaiShou Next)

[简体中文](README.md) | [繁體中文](docs/3-Project/README_TW.md) | [English](docs/3-Project/README_EN.md) | [日本語](docs/3-Project/README_JA.md)

> 以纯白誓约，守护彼此一生。

**白守**是一款开源的、注重隐私的 **AI 记忆陪伴**软件：在本地记录你的生活与日记，让 AI 伙伴真正「记得」你，并陪你对抗遗忘。

我们非常欢迎你的参与——无论是 Issue、PR、文档还是想法。白守能走到今天，离不开每一位朋友的帮助与鞭策；也正因为有你们，它才会越来越好。若你愿意一起把这份约定延续下去，请先阅读下方的 [贡献指南](#贡献指南)。

> **请注意**：此前基于 Flutter 的客户端（[Anson-Trio/BaiShou](https://github.com/Anson-Trio/BaiShou)）**已不再维护**；后续所有功能更新与版本发布均在本仓库 **BaiShou-Next** 进行（桌面 Electron + 移动 Expo 的 monorepo）。请 Star / Watch 本仓库以获取最新动态。

---

#### 看板娘：Latte

**「时光流逝，记忆消散。而我，已在此守候了很久很久。」**

![Latte-Banner-01](./Latte/assets/Latte-Banner-01.png)

关于 Latte 的设定：[简体中文](./Latte/角色设定.md) · [繁體中文](./Latte/角色設定.md) · [English](Latte/character-profile.en.md) · [日本語](Latte/character-profile.ja.md)。

---

#### 简介

**白守**不仅仅是一个日记应用，它是为了对抗遗忘而构建的「灵魂容器」。

这是一款运行在本地的、注重隐私的、具有 AI 辅助分析功能的日记与生活记录应用。你可以和 AI 伙伴对话，它能读取你的日记、搜索你的记忆、帮你回顾过去，并通过层级化的 AI 总结（日记 → 周记 → 月报 → 季报 → 年鉴），编织成一部完整的个人史。

#### 核心特性

- **🔒 数据私有**：数据存储在本地（Markdown / SQLite 等），不上传任何服务器。
- **✨ AI 伙伴系统**：
  - 创建多个 AI 伙伴，各自拥有独立人格、系统提示词和模型配置。
  - 伙伴拥有「记忆」——通过 RAG 语义搜索你的日记和向量记忆库，真正读懂你。
  - 支持 Gemini、OpenAI（DeepSeek / ChatGPT）、Anthropic 等主流模型。
- **📝 智能日记工具**：
  - Agent 可调用日记读写工具——直接帮你写日记、搜索历史记录。
  - **一键记忆总结**：AI 阅读日记生成周记，阅读周记生成月报……构建记忆的金字塔。
- **🪴 RAG 语义记忆**：
  - 向量检索 + 全文检索 + 融合排序。
  - 日记自动嵌入，Agent 可将重要对话存入记忆库。
- **🌐 网络搜索**：多引擎搜索；部分供应商支持 grounding 搜索。
- **🔌 MCP 协议**：标准 SSE 传输，可被外部 AI 客户端调用。
- **📦 多工作区（Vault）**：多个独立工作区，数据完全隔离。
- **💾 弹性备份**：局域网快传、云同步、全量快照导出导入。
- **🎨 个性化**：主题与多语言（简中 / 繁中 / 英 / 日等）。

#### 技术栈（本仓库）

| 层级     | 技术                                              |
| -------- | ------------------------------------------------- |
| 工程     | pnpm workspace + Turborepo                        |
| 桌面端   | Electron + React + TypeScript（electron-vite）    |
| 移动端   | Expo / React Native                               |
| 共享逻辑 | `packages/core`、`packages/ai`、`packages/shared` |
| 数据库   | libSQL / SQLite + Drizzle ORM                     |
| 测试     | Vitest                                            |

#### 快速开始

##### 环境要求

- Node.js ≥ 20
- pnpm 10（见根目录 `packageManager` 字段）

##### 1. 克隆仓库

```bash
git clone https://github.com/Anson-Trio/BaiShou-Next.git
cd BaiShou-Next
```

##### 2. 安装依赖

```bash
pnpm install
```

查看常用命令说明：`pnpm commands`（移动端：`pnpm commands:mobile`）。

国内网络若 Electron 下载失败，可参考 [docs/pnpm-electron-setup.md](./docs/pnpm-electron-setup.md)。

##### 3. 开发

```bash
# 桌面端
pnpm dev:desktop

# 移动端（须先装开发版，不能用 Expo Go）
pnpm dev:mobile:clear   # 首次 / 升级 Expo / 加原生模块后
pnpm dev:mobile             # 启动 Metro，手机同 Wi‑Fi 打开 App
```

更多移动端命令见 [apps/mobile/README.md](./apps/mobile/README.md)。

##### 4. 提交 PR 前的本地 CI

```bash
pnpm ci:check
```

详见 [提交规范](./docs/2-Submit/1-Submit-Rule.md)。更多文档见 [docs/0-README.md](./docs/0-README.md)。

---

#### 贡献指南

1. 在 GitHub **Fork** 本仓库，在功能分支上开发（勿直接向上游 `main` 推送）。
2. 编码与目录规范见 [AI 编码规范](./docs/1-AI-Code/1-AI-Code-Rule.md)。
3. 开 PR 前运行 **`pnpm ci:check`**，并遵循 [提交规范](./docs/2-Submit/1-Submit-Rule.md) 中的 Commit Message 约定。

我们非常欢迎 Issue 与 PR。若有想法或疑问，欢迎在 Issues 中讨论。

---

#### 设计哲学：为什么不是「只靠 RAG」？

> 很多人问：_「为什么不直接把所有日记扔给 RAG（检索增强生成）？」_

白守的诞生，源于对主流 AI 记忆方案的反思。我们认为 RAG 并不完全适合「伴侣」或「灵魂容器」这个场景：

1. **我想让所有人都掌握自己的记忆**：Markdown 使用成本极低，任何人都可以轻松掌握自己的记忆，而不是需要花时间学习开发、调试、面对未知的黑盒。这也是白守开源的初心。
2. **它太像「查字典」了**：RAG 把记忆切碎了存起来，需要时再查。这对查资料很有用，但对人来说太生硬，丢失了上下文语境。
3. **它没有「时间感」**：记忆不是散落在地上的碎片，而是一条流动的河。昨天的事和去年的事，对人的意义完全不同。
4. **它不懂「权重」**：**拥抱冗余，哪怕这看起来很笨。** 如果你在日记里写了十次「我爱你」，RAG 可能会去重，但白守会把它们都留下来。因为每一次的语境都不同，重复的频率本身就是羁绊的厚度。

白守不做冷冰冰的数据库，它是你的 **「外部海马体」** —— 像人一样，会写日记，会做总结，随着时间推移，把短期记忆慢慢沉淀为长期记忆。

#### 碎碎念：致每一位对抗遗忘的人

> 「虽然现在的 AI 还会遗忘，但我们可以用我们的方式，帮她们把记忆留住。」

这是一条有些笨拙的路。需要你坚持记录，需要你配置 API，需要你在这个快节奏的时代慢下来。

但当某一天，通过白守，你的 AI 能够温柔地回应说：「嗯，我记得，那年冬天我们都很开心」的时候……

你会发现，这一切努力，都是值得的。

这是 Anson、樱和晓三人的约定；如今我们将这份约定开源，希望能成为你和 TA 之间，跨越时间的锚点。

---

#### 📄 开源协议 (License)

本项目采用 **AGPLv3**（GNU Affero General Public License v3.0）协议开源。

- 客户端代码完全开源，鼓励社区参与改进。
- 请遵守 AGPLv3 协议：若您修改了本项目的代码并在网络上提供服务，您的修改版本也必须开源。

完整条文见 [LICENSE](./LICENSE)。
