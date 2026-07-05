# 贡献政策

[简体中文](./2-Contributing-Guide.md) | [繁體中文](./2-Contributing-Guide.tw.md) | [English](./2-Contributing-Guide.en.md) | [日本語](./2-Contributing-Guide.ja.md)

**读者**：所有希望参与 BaiShou-Next 的人类贡献者与 AI 助手。

本文说明 **什么类型的贡献我们欢迎**、**什么需要先讨论**，以及功能提议 Issue 应包含哪些信息。  
提交与 CI 流程见 [1-Submit-Rule.md](./1-Submit-Rule.md)；编码规范见 [1-AI-Code-Rule.md](../1-AI-Code/1-AI-Code-Rule.md)。

---

## 1. 我们的立场（请先读）

白守是一款注重隐私的 AI 记忆陪伴产品。**产品方向、交互与数据模型**都需要长期、审慎地规划，而不是由外部 PR 随意叠加功能堆出来的。

为维护可持续性、**减少维护者精力损耗**，我们目前对外部 PR 采取收紧策略——这不是排斥贡献，而是避免双方在无前提沟通上反复消耗。

| 类型                                               | 我们的态度                                                           |
| -------------------------------------------------- | -------------------------------------------------------------------- |
| **Bug 修复 PR**（可复现、有测试、过 CI、动机清晰） | **视情况接受**；小范围、高质量的修复是我们最愿意 Review 的           |
| **文档纠错、错别字、表述不清**                     | **欢迎**                                                             |
| **可复现的 Bug Issue**（含环境、步骤、期望/实际）  | **欢迎**                                                             |
| **新功能 PR**                                      | **暂不接收**；若有功能设计，请先开 Issue 梳理清楚                    |
| **纯 AI 生成、提交者未充分理解的 PR**              | **不审核**；对提交者的算力与维护者的精力都是无效消耗                 |
| **未遵循仓库规范的 PR**                            | **不接受**（见 [1-AI-Code-Rule.md](../1-AI-Code/1-AI-Code-Rule.md)） |
| **引入新 UI 库 / 新依赖 / Schema 变更**            | **必须先开 Issue 并获维护者明确同意**                                |

> **一句话**：请先确认「这件事该不该做、你是否真正理解相关代码」，再考虑「怎么做」。  
> 能用 Issue 把动机和方案说清楚，比直接丢一个大 PR 更有可能被接受。

### 1.1 维护者精力与 PR 审核边界

本项目的维护者数量有限。每一则 PR 都需要阅读、理解、验证与可能的往返修改。**以下 PR 我们不会投入 Review 精力**：

1. **纯 AI 产物**：由 AI 批量生成、提交者未逐行阅读、无法在 PR 或 Issue 中清楚解释设计与改动的 PR。可以用 AI 辅助起草，但 **你对代码与结论负责**。
2. **缺乏代码理解**：无法说明根因、改动影响范围，或与现有架构明显不符的 PR。
3. **未遵循规范**：未跑 `pnpm ci:check`、缺测试、破坏主题与目录约定等（见 [1-Submit-Rule.md](./1-Submit-Rule.md)）。

若你不确定改动是否合适，**请先在 Issue 中讨论**，而不是直接开 PR 碰运气。

### 1.2 PR 目标分支

若有提交 PR 的意向，请将 PR 的**目标分支（base）**设为上游的 **`Baishou-dev`**。

**以 `main` 为目标的 PR 视为无效**，维护者不予审核、不予回复，会直接关闭。

### 1.3 贡献者许可协议（CLA）

向本项目提交**包含代码变更**的 Pull Request 前，须签署 [组织级 CLA](../../legal/CLA-organization.md)（foxletters-hq 下多仓通用）：

1. 打开 PR 后，在评论区找到 **cla-assistant** 的提示
2. 点击 **Sign in with GitHub to agree**，阅读协议后点 **I agree**
3. PR 的 CLA 状态检查变为 ✅ 即完成

**纯文档 PR 通常无需签署。** 企业员工代表公司贡献时，另须签署 [企业 CLA](../../legal/CLA-corporate.md)。

维护者首次配置见 [CLA-GITHUB-SETUP.md](../../legal/CLA-GITHUB-SETUP.md)。许可背景见 [LICENSE-STRATEGY.md](../../legal/LICENSE-STRATEGY.md)。

---

## 2. 我们最欢迎的贡献：修 Bug

### 2.1 提 Bug Issue

请使用 [Bug 反馈](https://github.com/foxletters-hq/BaiShou-Next/issues/new?template=01-bug.yml) 模板，尽量包含：

- 白守版本 / 分支、桌面端或移动端、操作系统
- **复现步骤**（从干净状态开始）
- **期望行为** vs **实际行为**
- 相关日志、截图（注意打码隐私与 API Key）

### 2.2 提 Bug 修复 PR

1. 最好在对应 Issue 下讨论，或 PR 描述中链接 Issue。
2. 遵循 [1-AI-Code-Rule.md](../1-AI-Code/1-AI-Code-Rule.md)：**除单行热修外，须有测试**。
3. PR 前运行 `pnpm ci:check`（见 [1-Submit-Rule.md](./1-Submit-Rule.md)）。
4. 说明根因、修复思路、你如何验证。

小范围、动机清晰、测试完备的 Bug PR 是我们最愿意 Review 的。**并非所有 Bug 修复 PR 都会合并**——维护者会按影响范围、风险与当前优先级综合判断。

---

## 3. 新功能：当前仅通过 Issue 讨论（暂不接收功能 PR）

### 3.1 为什么暂不接收新功能 PR

- 白守的核心是「记忆陪伴」与本地隐私，功能会牵动 **数据模型、AI 工具链、多端一致性、备份兼容** 等，不是 UI 上多一个按钮那么简单。
- 本 monorepo 同时维护 **Electron 桌面端** 与 **Expo 移动端**，许多改动需要双端对齐或明确说明「仅一端」的理由。
- 维护者精力有限，**当前阶段不接受新功能 PR**，以免大量未对齐方向的代码进入 Review 队列。

**若有功能设计想法，请仅通过 Issue 与维护者梳理清楚；未经事先沟通直接提交的功能 PR，维护者有权直接关闭，且不保证 Review。**

### 3.2 若你仍希望提议新功能

请 **只开 Issue**（使用 [功能提议](https://github.com/foxletters-hq/BaiShou-Next/issues/new?template=02-enhancement.yml) 模板），**不要提交功能 PR**。

你可以用 AI 辅助起草 Issue，但 **发布前你必须亲自读过**，确保技术描述准确、范围合理。维护者需要的是你的判断，不是未经核对的 AI 流水账。

#### Issue 必填清单

```markdown
## 功能提议

### 1. 要解决什么问题？

（用户场景、痛点；与白守「记忆陪伴 / 本地隐私」定位的关系）

### 2. 提议的方案（用户可见行为）

（交互草图、入口位置、与现有功能是否重复）

### 3. 技术方案概要

- **拟改动的包/目录**（见下方 monorepo 地图）
- **是否涉及数据库 Schema**（是 / 否；若是有迁移计划）
- **桌面端 / 移动端 / 双端** 范围
- **新增依赖**（包名、体积、为何不能用现有栈）

### 4. UI 与组件

- 是否新增 UI？复用 `packages/ui` 现有组件还是新写？
- **若引入第三方组件库**：库名、版本、许可证、与 [UI 主题规范](../1-AI-Code/2-UI-Theme-Rule.md) 的适配方式（本仓库 **禁止** 硬编码颜色，须走主题变量）
- 深浅模式、多语言（简中/繁中/英/日）是否考虑

### 5. 实施步骤（你打算怎么做）

1. …
2. …
3. …

### 6. 测试与验证计划

- 拟增加的单元/集成测试
- 手动验证路径

### 7. 风险与替代方案

- 对现有用户数据、备份、同步的影响
- 若不做此功能，有无更轻量的替代

### 8. 你是否愿意在 Issue 被接受后实现？

（是 / 否 / 仅能提供思路）
```

维护者会在 Issue 中回复：**接受纳入讨论 / 需要修改 / 婉拒 / 暂缓**。  
**即便 Issue 被接受，也不等于当前即可开功能 PR**——请等待维护者明确表示「欢迎 PR」且项目阶段允许时，再 Fork 开发并提交。

### 3.3 monorepo 地图（写「涉及哪些东西」时参考）

| 路径                                     | 职责                                         |
| ---------------------------------------- | -------------------------------------------- |
| `apps/desktop`                           | Electron 桌面客户端（React + electron-vite） |
| `apps/mobile`                            | Expo / React Native 移动端                   |
| `packages/core`                          | 跨端核心业务逻辑                             |
| `packages/core-desktop` / `core-mobile`  | 平台特化核心                                 |
| `packages/ai`                            | AI Provider、Agent、工具调用                 |
| `packages/database` / `database-desktop` | libSQL/SQLite + Drizzle                      |
| `packages/ui`                            | 共享 UI 组件、主题、日记编辑器等             |
| `packages/shared` / `store`              | 通用工具、状态                               |

功能改动往往同时触及 **UI + core + database + 双端 app**；Issue 里应诚实列出范围，而不是只改一个文件。

### 3.4 通常需要维护者事前批准的事项

（与 [1-AI-Code-Rule.md §6](../1-AI-Code/1-AI-Code-Rule.md) 一致）

- 新 npm 依赖（尤其 Native addon、>500KB、新构建链）
- 数据库 Schema 或迁移
- 公共 API / IPC 的 Breaking Change
- 新第三方 UI 组件库
- CI / 发布流水线变更

---

## 4. 其他贡献

- **文档**：修正错误、补充开发说明 — 欢迎 PR。
- **想法与讨论**：可在 Issue 中讨论（如 [创意想法](https://github.com/foxletters-hq/BaiShou-Next/issues/new?template=03-interesting.yml) 模板），但不等于会纳入路线图。
- **Fork 自用**：AGPLv3 允许；若修改后对外提供服务，请遵守协议开源修改版。
- **提交代码 PR**：须签署 [组织级 CLA](../../legal/CLA-organization.md)（纯文档 PR 除外）。

---

## 5. PR 会被关闭的常见原因

- **当前阶段提交的新功能 PR**（请先开 Issue 讨论设计）
- **纯 AI 生成、提交者无法解释改动动机与影响的 PR**
- **对相关代码缺乏理解、未遵循仓库规范的 PR**
- **目标分支为 `main` 的 PR**（应提交到 `Baishou-dev`）
- 未关联事先同意的 Feature Issue（若维护者已表示欢迎 PR）
- 未跑或未通过 `pnpm ci:check`
- 缺少测试（非 trivial fix）
- 引入未经批准的依赖或 UI 库
- 破坏主题规范（硬编码颜色等）
- 范围过大、一次 PR 混合多个无关主题

---

## 6. 相关文档

- [提交规范](./1-Submit-Rule.md)
- [AI 编码规范](../1-AI-Code/1-AI-Code-Rule.md)
- [UI 主题规范](../1-AI-Code/2-UI-Theme-Rule.md)
- [LICENSE-STRATEGY.md](../../legal/LICENSE-STRATEGY.md)
- [CLA-GITHUB-SETUP.md](../../legal/CLA-GITHUB-SETUP.md)
- [CLA-organization.md](../../legal/CLA-organization.md)
- [文档索引](../0-README.md)
