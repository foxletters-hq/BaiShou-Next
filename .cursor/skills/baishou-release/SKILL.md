---
name: baishou-release
description: Runs BaiShou-Next local CI, bumps desktop or mobile version, writes release notes with contributor credits, commits, pushes tags to trigger GitHub Actions release, and builds the release artifact locally. Use when the user asks to release, ship, bump version, tag, or run the full desktop/mobile publish workflow.
---

# 白守 Next 发版

端到端发版：本地 CI → 升版本 → **撰写 Release 说明** → 提交推送 → 打 tag → 本地打包。

详细背景见 [reference.md](reference.md) 与 `docs/发版流程.md`。

## 前置条件

- 在仓库根目录执行（`git rev-parse --show-toplevel`）
- 功能已合并到 **main**；当前分支应为 `main` 且与 `origin/main` 同步
- 发版前无未提交的无关改动；若有，先处理或向用户确认
- **仅当用户明确要求**时才 `git commit` / `git push` / 打 tag

## 工作流

复制进度清单并逐项完成：

```
发版进度：
- [ ] 1. 本地 CI 通过
- [ ] 2. 确认发版平台与新版本号
- [ ] 3. 更新 version.json 并同步
- [ ] 4. 撰写 Release 更新说明（releases/notes/）
- [ ] 5. 提交并推送 main
- [ ] 6. 打 tag 并推送
- [ ] 7. 本地打包
```

### 1. 本地 CI

```powershell
cd <repo-root>
pnpm ci:check
```

失败则修复后重跑，直到通过。常见修复：

| 失败项       | 处理                                                |
| ------------ | --------------------------------------------------- |
| typecheck    | 修类型错误后重跑                                    |
| test         | 修测试或实现                                        |
| eslint       | `pnpm lint` 定位；可 `pnpm format` 后单独提交格式化 |
| format:check | `pnpm format`，若仅格式化可一批次提交               |
| sync:check   | `pnpm sync`                                         |
| audit        | 修 `audit:cache-invalidation` 违规                  |

**不要**用 `--no-verify` 跳过 hook，除非用户明确要求。

### 2. 确认平台与版本号

**必须**用 AskQuestion（或明确追问）确认：

1. **发版平台**：`desktop`（Windows）或 `mobile`（Android）
2. **新版本号**（semver，如 `1.2.6`）

读取当前版本：

```powershell
# desktop
node -p "require('./apps/desktop/src/version.json').version"
# mobile
node -p "JSON.stringify(require('./apps/mobile/src/version.json'))"
```

**版本规则**：

| 平台    | 文件                            | 字段                                                   |
| ------- | ------------------------------- | ------------------------------------------------------ |
| desktop | `apps/desktop/src/version.json` | `version`                                              |
| mobile  | `apps/mobile/src/version.json`  | `version` + `versionCode`（**必须 +1**，覆盖安装依据） |

两端版本号**独立**，可不同。不要用 `release:tag all`，除非两端 `version` 已相同且用户确认同时发两端。

### 3. 更新版本并同步

只改选定平台对应的 `version.json`，然后：

```powershell
node scripts/sync-app-version.mjs
```

校验同步（release-tag 也会跑）：

```powershell
node scripts/sync-app-version.mjs --check
```

再跑一次 `pnpm ci:check` 确保仍通过。

### 4. 撰写 Release 更新说明

**Agent 必须执行本步**：在打 tag 前生成通俗易懂的更新日志，并写入仓库供 CI 发布。

#### 4.1 提取提交与贡献者

```powershell
pnpm release:notes -- --platform mobile --version 1.2.9
# 或 desktop
pnpm release:notes -- --platform desktop --version 1.2.6
```

脚本会对比**上一分端 tag**（如 `mobile/v1.2.8`）到 `HEAD` 的有效提交，并列出贡献者 GitHub 账号（若可解析）。

#### 4.2 写入说明文件

路径：`releases/notes/{platform}-{version}.md`

- `mobile` → `releases/notes/mobile-1.2.9.md`
- `desktop` → `releases/notes/desktop-1.2.6.md`

**撰写要求**（Agent 用中文写，面向用户）：

1. **3～6 条**更新亮点，用用户能听懂的话，不要堆技术术语
2. **合并相近改动**，不要一条 commit 抄一行
3. 可适当用 emoji，但克制
4. **不要写贡献者 @ 或感谢语**——GitHub 会在 Release 正文末尾自动追加 PR 列表与 Contributors

```markdown
- 日记编辑器支持粘贴图片，分享更方便
- 修复了夜间模式下偶发的闪屏问题
```

**不要**在文件里写「各平台下载」表格——CI 会自动从 `version.json` 拼接各端最新下载链接和官网入口。

#### 4.3 预览完整 Release 正文（可选）

```powershell
node scripts/compose-release-body.mjs --scope mobile --version 1.2.9 --append false
```

### 5. 提交并推送 main

提交 message **用中文**。版本 bump 与 release notes 可同一 commit 或分两 commit：

```
chore(release): 升级 mobile 版本至 1.2.9（versionCode 86）
```

```powershell
git add apps/<platform>/src/version.json apps/<platform>/package.json releases/notes/<platform>-<version>.md
# mobile 还需 apps/mobile/app.json
git commit -m "..."
git push origin main
```

文件超过 10 个时按用户规则分批提交；纯 prettier 格式化可一批次。

### 6. 打 tag 并推送

在 **main** 上、版本与说明已推送后：

```powershell
# 预览
pnpm release:tag desktop
# 或 pnpm release:tag mobile

# 创建并推送（触发 GitHub Actions）
pnpm release:tag desktop --push
# 或 pnpm release:tag mobile --push
```

Tag 格式：

| 平台    | Tag 示例         | GitHub Release                          |
| ------- | ---------------- | --------------------------------------- |
| desktop | `desktop/v1.2.6` | `v1.2.6`（含各端最新下载表 + 本端产物） |
| mobile  | `mobile/v1.2.9`  | `v1.2.9`                                |

CI 会校验：tag 指向 main 上的 commit，且与对应 `version.json` 一致。

**CI 发布的 Release 说明自动包含**：

- 各平台**当前最新版本**与直链（即使两端版本号不同）
- [官网下载](https://baishou.foxletters.com) 入口
- `releases/notes/` 中本端中文更新说明
- **GitHub 自动生成**：合并的 PR 列表、Contributors（见 `.github/release.yml`）
- 本端安装包附件

推送 tag 后告知用户可在 GitHub Actions 查看 `Build & Release` 工作流。

### 7. 本地打包

仅打包**本次升版本的平台**：

| 平台    | 命令                       | 产物                                                  |
| ------- | -------------------------- | ----------------------------------------------------- |
| desktop | `pnpm release:desktop:win` | `apps/desktop/dist/BaiShou-v{版本}-Windows-Setup.exe` |
| mobile  | `pnpm release:android`     | `release/BaiShou-v{版本}-Android.apk`                 |

**注意**：

- Windows 打包需在 **Windows 本机**；打包前关闭所有白守窗口
- Android 首次需 `pnpm release:setup-signing`（`key.properties` 不入库）
- `pnpm release:all` 会打两端，本 skill 默认**不要**用，除非用户明确要求

## 发版后自检（告知用户）

- [ ] GitHub Release 说明含各平台下载表 + 官网链接 + GitHub 自动生成的 PR/Contributors
- [ ] GitHub Release 附件含版本化文件名 + 固定别名
- [ ] `main` 上 `releases/channel.json` 由 CI 自动更新
- [ ] 对应平台客户端「检查更新」能识别新版本

## 禁止事项

- 不要在未通过 `pnpm ci:check` 时升版本或打 tag
- 不要 force push `main`
- 不要跳过 mobile 的 `versionCode` 递增
- 不要未经用户确认就提交、推送或打 tag
- 不要跳过 Release 说明撰写（除非用户明确说「本次不发 changelog」）
