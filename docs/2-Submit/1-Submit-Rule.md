# 提交规范

**读者**：本仓库的所有 AI 助手（Cursor Agent 等）与人类贡献者。提交或提 PR 前请通读本文。

**协作方式**：不要直接向上游 `main` 推送。请先 **Fork** 仓库，在自己的 Fork 上开发，完成后向上游 **发起 Pull Request**。

编码结构见 [1-AI-Code-Rule.md](../1-AI-Code/1-AI-Code-Rule.md)。Git 命令速查见 [git-commands.md](../git-commands.md)。

---

## 0. 提交前检查清单

在 `git commit` 之后、**打开 PR 之前**，逐项确认（AI 助手与人类均适用）：

- [ ] 已在 **Fork 仓库** 的功能分支上工作，而非误改上游 `main`
- [ ] 已运行 **`pnpm ci:check`** 且全部通过
- [ ] `git status` 无 `.env`、密钥、本地数据库、临时脚本（如 `count-code-lines.mjs`、`split-*.ps1`）
- [ ] 单次 PR / commit 主题清晰；超大改动已拆成多个可读 commit
- [ ] Commit 说明符合 **§2 Commit Message**（类型、scope、一句话说清「为什么」）
- [ ] 若仅改文档或格式化，未混入无关功能代码

---

## 1. 本地 CI 检查（提交 PR 前必跑）

在 **Fork 克隆目录内任意位置** 打开终端，执行：

```bash
pnpm ci:check
```

无需手写 `cd`：命令会自动定位 Git 仓库根目录，再按与 GitHub [`.github/workflows/ci.yml`](../../.github/workflows/ci.yml) 相同的顺序执行下列步骤；任一步失败会立即退出。

| 步骤 | 实际命令                                                                                      |
| ---- | --------------------------------------------------------------------------------------------- |
| 1    | `pnpm install`                                                                                |
| 2    | `pnpm typecheck`                                                                              |
| 3    | `pnpm turbo run test --continue`                                                              |
| 4    | `pnpm --filter @baishou/desktop exec eslint -c ../../eslint.desktop.ci.mjs . --cache --quiet` |
| 5    | `pnpm --filter @baishou/mobile exec eslint -c ../../eslint.mobile.ci.mjs . --cache --quiet`   |
| 6    | `pnpm format:check`                                                                           |

实现入口：`package.json` 的 `ci:check` → `scripts/ci-check-runner.mjs` → `scripts/ci-check.ps1`（Windows）或 `scripts/ci-check.sh`（macOS/Linux）。需要时可打开这些文件核对，不是黑盒。

全部通过后再开 PR。

### 1.1 常见问题

| 现象                                   | 处理                                                                                            |
| -------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `NODE_MODULE_VERSION` / better-sqlite3 | 在仓库根执行：`pnpm rebuild better-sqlite3`                                                     |
| 本机 `archive-export-real-db` 被 skip | 见 `better-sqlite3-available.ts`（Node 与 better-sqlite3 二进制不一致）；GitHub CI（Linux）会跑 |
| `format:check` 失败                    | 在仓库根执行 `pnpm format`，仅将格式化相关文件纳入 commit                                       |
| 不在 Git 仓库里执行                    | 先 `git clone` 你的 Fork，再在克隆目录内运行 `pnpm ci:check`                                    |

---

## 2. Commit Message

```
<type>(<scope>): <简短说明>

[可选正文：说明动机，非罗列文件名]
```

| type       | 用途               |
| ---------- | ------------------ |
| `feat`     | 新功能             |
| `fix`      | 缺陷修复           |
| `refactor` | 重构（行为不变）   |
| `chore`    | 工具链、配置、依赖 |
| `test`     | 测试               |
| `docs`     | 仅文档             |
| `style`    | 仅格式化           |

**示例**

```
fix(ai): 修正 provider 单测与 generateText mock

refactor(ui-web): 拆分 CloudSyncPanel 以符合 300 行规范

docs: 规范目录与文件改为单层序号命名
```

**避免**：整仓格式化与功能混在一个 commit；提交临时脚本；对上游仓库使用 `git push --force`。

---

## 3. 贡献流程（Fork → PR）

1. 在 GitHub **Fork** 上游仓库到你的账号。
2. 克隆 **你的 Fork**，创建功能分支，按 [1-AI-Code-Rule](../1-AI-Code/1-AI-Code-Rule.md) 开发。
3. 完成 **§0** 清单并运行 **`pnpm ci:check`**。
4. 推送到 **你的 Fork**（例如 `git push origin feature/xxx`）。
5. 在 GitHub 向上游 **创建 Pull Request**，说明改动与本地检查结果（建议注明已本地跑过 `pnpm ci:check`）。

### 3.1 GitHub CI 与合并（宽松提交、严格合并）

本仓库 **未** 在 GitHub 设置 Rulesets / 分支保护来「CI 未过则禁止创建 PR」。你可以先开 PR，便于讨论与迭代。

| 阶段 | 要求 |
|------|------|
| **创建 PR** | 不强制 GitHub CI 已绿；仍强烈建议先本地 `pnpm ci:check` 通过再开 PR，减少来回修改。 |
| **合并进 `main`** | **必须** GitHub Actions CI 全部通过；维护者合入前会核对 PR 上的 CI 状态。 |
| **CI 未通过时** | 维护者会在 PR 中说明需修复项（或请你自行查看 Actions 日志），修好并 push 后等待 CI 重新变绿再请求合并。 |

**贡献者**：CI 红了也可以提交 PR，但请主动跟进修复，不要假设「能开 PR 就能合并」。

**维护者 / Reviewer**：合入前确认 [Actions](https://github.com/Anson-Trio/BaiShou-Next/actions) 中与本 PR 相关的 workflow 已全部成功；未通过时留言说明，暂不合入。

本地检查通过可减少 PR 上等待 CI 失败的时间；是否合并由维护者根据 CI 与代码审查决定。
