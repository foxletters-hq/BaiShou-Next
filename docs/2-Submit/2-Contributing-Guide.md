# 贡献政策

[简体中文](./2-Contributing-Guide.md) | [繁體中文](./2-Contributing-Guide.tw.md) | [English](./2-Contributing-Guide.en.md) | [日本語](./2-Contributing-Guide.ja.md)

**读者**：所有希望参与 BaiShou-Next 的人类贡献者与 AI 助手。

本文说明 **什么类型的贡献我们欢迎**、**什么需要先讨论**，以及功能提议 Issue 应包含哪些信息。  
提交与 CI 流程见 [1-Submit-Rule.md](./1-Submit-Rule.md)；编码规范见 [1-AI-Code-Rule.md](../1-AI-Code/1-AI-Code-Rule.md)。

---

## 1. 我们的立场（请先读）

白守是一款注重隐私的 AI 记忆陪伴产品。**产品方向、交互与数据模型**都需要长期、审慎地规划，而不是由外部 PR 随意叠加功能堆出来的。

因此：

| 类型 | 我们的态度 |
| ---- | ---------- |
| **Bug 修复**（可复现、有测试、过 CI） | **欢迎** |
| **文档纠错、错别字、表述不清** | **欢迎** |
| **可复现的 Bug Issue**（含环境、步骤、期望/实际） | **欢迎** |
| **未经讨论的新功能 PR** | **请先开 Issue 讨论；未事先沟通时合并可能性较低** |
| **引入新 UI 库 / 新依赖 / Schema 变更** | **必须先开 Issue 并获维护者明确同意** |

> **一句话**：请先确认「这件事该不该做」，再考虑「怎么做」。  
> 能用 Issue 把动机和方案说清楚，比直接丢一个大 PR 更有可能被接受。

---

## 2. 我们最欢迎的贡献：修 Bug

### 2.1 提 Bug Issue

请使用 [Bug 反馈](https://github.com/Anson-Trio/BaiShou-Next/issues/new?template=01-bug.yml) 模板，尽量包含：

- 白守版本 / 分支、桌面端或移动端、操作系统
- **复现步骤**（从干净状态开始）
- **期望行为** vs **实际行为**
- 相关日志、截图（注意打码隐私与 API Key）

### 2.2 提 Bug 修复 PR

1. 最好在对应 Issue 下讨论，或 PR 描述中链接 Issue。
2. 遵循 [1-AI-Code-Rule.md](../1-AI-Code/1-AI-Code-Rule.md)：**除单行热修外，须有测试**。
3. PR 前运行 `pnpm ci:check`（见 [1-Submit-Rule.md](./1-Submit-Rule.md)）。
4. 说明根因、修复思路、你如何验证。

小范围、动机清晰、测试完备的 Bug PR 是我们最愿意 Review 和合并的。

---

## 3. 新功能：先 Issue，后代码（且请三思）

### 3.1 为什么新功能要先讨论

- 白守的核心是「记忆陪伴」与本地隐私，功能会牵动 **数据模型、AI 工具链、多端一致性、备份兼容** 等，不是 UI 上多一个按钮那么简单。
- 本 monorepo 同时维护 **Electron 桌面端** 与 **Expo 移动端**，许多改动需要双端对齐或明确说明「仅一端」的理由。

**在未与维护者达成一致前提交的 Feature PR，维护者有权直接关闭，且不保证 Review。**

### 3.2 若你仍希望提议新功能

请 **只开 Issue**（使用 [功能提议](https://github.com/Anson-Trio/BaiShou-Next/issues/new?template=02-enhancement.yml) 模板），**不要先写几百行 PR**。

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

维护者会在 Issue 中回复：**接受 / 需要修改 / 婉拒 / 暂缓**。  
**只有明确「可以接受」或「欢迎 PR」后**，再 Fork 开发并提 PR。

### 3.3 monorepo 地图（写「涉及哪些东西」时参考）

| 路径 | 职责 |
| ---- | ---- |
| `apps/desktop` | Electron 桌面客户端（React + electron-vite） |
| `apps/mobile` | Expo / React Native 移动端 |
| `packages/core` | 跨端核心业务逻辑 |
| `packages/core-desktop` / `core-mobile` | 平台特化核心 |
| `packages/ai` | AI Provider、Agent、工具调用 |
| `packages/database` / `database-desktop` | libSQL/SQLite + Drizzle |
| `packages/ui` | 共享 UI 组件、主题、日记编辑器等 |
| `packages/shared` / `store` | 通用工具、状态 |

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
- **想法与讨论**：可在 Issue 中讨论（如 [创意想法](https://github.com/Anson-Trio/BaiShou-Next/issues/new?template=03-interesting.yml) 模板），但不等于会纳入路线图。
- **Fork 自用**：AGPLv3 允许；若修改后对外提供服务，请遵守协议开源修改版。

---

## 5. PR 会被关闭的常见原因

- 未关联事先同意的 Feature Issue
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
- [文档索引](../0-README.md)
