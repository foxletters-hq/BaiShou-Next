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
| 本机集成测被 skip                      | 见 `apps/desktop/.../better-sqlite3-available.ts`；GitHub CI（Linux + Node 22）仍会跑完整集成测 |
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
5. 在 GitHub 向上游 **创建 Pull Request**，说明改动与本地检查结果。

本地检查通过可减少 PR 上等待 CI 失败的时间，但不保证一定合并。
