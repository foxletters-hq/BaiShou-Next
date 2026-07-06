---
name: baishou-release
description: Runs BaiShou-Next local CI, bumps desktop or mobile version, commits, pushes tags to trigger GitHub Actions release, and builds the release artifact locally. Use when the user asks to release, ship, bump version, tag, or run the full desktop/mobile publish workflow.
---

# 白守 Next 发版

端到端发版：本地 CI → 升版本 → 提交推送 → 打 tag → 本地打包。

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
- [ ] 4. 提交并推送 main
- [ ] 5. 打 tag 并推送
- [ ] 6. 本地打包
```

### 1. 本地 CI

```powershell
cd <repo-root>
pnpm ci:check
```

失败则修复后重跑，直到通过。常见修复：

| 失败项 | 处理 |
|--------|------|
| typecheck | 修类型错误后重跑 |
| test | 修测试或实现 |
| eslint | `pnpm lint` 定位；可 `pnpm format` 后单独提交格式化 |
| format:check | `pnpm format`，若仅格式化可一批次提交 |
| sync:check | `pnpm sync` |

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

| 平台 | 文件 | 字段 |
|------|------|------|
| desktop | `apps/desktop/src/version.json` | `version` |
| mobile | `apps/mobile/src/version.json` | `version` + `versionCode`（**必须 +1**，覆盖安装依据） |

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

### 4. 提交并推送 main

提交 message **用中文**。版本 bump 通常 1 个 commit：

```
chore(release): 升级 desktop 版本至 1.2.6
```

或

```
chore(release): 升级 mobile 版本至 1.2.9（versionCode 86）
```

```powershell
git add apps/<platform>/src/version.json apps/<platform>/package.json
# mobile 还需 apps/mobile/app.json
git commit -m "..."
git push origin main
```

文件超过 10 个时按用户规则分批提交；纯 prettier 格式化可一批次。

### 5. 打 tag 并推送

在 **main** 上、版本已推送后：

```powershell
# 预览
pnpm release:tag desktop
# 或 pnpm release:tag mobile

# 创建并推送（触发 GitHub Actions）
pnpm release:tag desktop --push
# 或 pnpm release:tag mobile --push
```

Tag 格式：

| 平台 | Tag 示例 |
|------|----------|
| desktop | `desktop/v1.2.6` |
| mobile | `mobile/v1.2.9` |

CI 会校验：tag 指向 main 上的 commit，且与对应 `version.json` 一致。

推送 tag 后告知用户可在 GitHub Actions 查看 `Build & Release` 工作流。

### 6. 本地打包

仅打包**本次升版本的平台**：

| 平台 | 命令 | 产物 |
|------|------|------|
| desktop | `pnpm release:desktop:win` | `apps/desktop/dist/BaiShou-v{版本}-Windows-Setup.exe` |
| mobile | `pnpm release:android` | `release/BaiShou-v{版本}-Android.apk` |

**注意**：

- Windows 打包需在 **Windows 本机**；打包前关闭所有白守窗口
- Android 首次需 `pnpm release:setup-signing`（`key.properties` 不入库）
- `pnpm release:all` 会打两端，本 skill 默认**不要**用，除非用户明确要求

## 发版后自检（告知用户）

- [ ] GitHub Release 附件含版本化文件名 + 固定别名
- [ ] `main` 上 `releases/channel.json` 由 CI 自动更新
- [ ] 对应平台客户端「检查更新」能识别新版本

## 禁止事项

- 不要在未通过 `pnpm ci:check` 时升版本或打 tag
- 不要 force push `main`
- 不要跳过 mobile 的 `versionCode` 递增
- 不要未经用户确认就提交、推送或打 tag
