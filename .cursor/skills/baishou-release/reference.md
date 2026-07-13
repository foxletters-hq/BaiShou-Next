# 发版参考

## 关键路径

| 用途                     | 路径 / 命令                                               |
| ------------------------ | --------------------------------------------------------- |
| 桌面版本清单             | `apps/desktop/src/version.json`                           |
| 移动版本清单             | `apps/mobile/src/version.json`（含 `versionCode`）        |
| Release 说明草稿         | `releases/notes/{mobile\|desktop}-{version}.md`           |
| GitHub 自动 Release 配置 | `.github/release.yml`                                     |
| 提取提交 / 贡献者        | `pnpm release:notes -- --platform mobile --version 1.2.9` |
| 预览 Release 正文        | `node scripts/compose-release-body.mjs`                   |
| 版本同步脚本             | `scripts/sync-app-version.mjs`                            |
| 打 tag 脚本              | `scripts/release-tag.mjs` → `pnpm release:tag`            |
| 本地 CI                  | `pnpm ci:check` → `scripts/ci-check.ps1` / `ci-check.sh`  |
| CI 发版工作流            | `.github/workflows/release.yml`                           |
| 下载清单                 | `releases/channel.json`                                   |
| 官网                     | https://baishou.foxletters.com                            |

## Tag 与 CI

- `mobile/v*` → 仅构建 Android
- `desktop/v*` → 仅构建 Windows
- GitHub Release 统一为 `v{max(mobile.version, desktop.version)}`，多端产物合并到同一条目
- 每条新 Release 说明自动附带**各端当前最新版本**下载直链 + 官网入口（无需版本号统一）
- 贡献者与 PR 列表由 **GitHub `generate_release_notes`** 自动追加（配置见 `.github/release.yml`）；README 另有贡献者徽章与头像墙
- Tag 必须打在 **main** 上的 commit
- CI 成功后自动更新 `releases/channel.json` 并 commit 回 main

## 文档

- 速查：`docs/发版流程.md`
- 详情：`docs/打包须知.md`

## 当前版本号（发版时以文件为准）

执行前读取，勿硬编码：

```bash
node -p "require('./apps/desktop/src/version.json').version"
node -p "require('./apps/mobile/src/version.json').version"
```
