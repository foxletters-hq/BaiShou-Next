# 发版参考

## 关键路径

| 用途 | 路径 / 命令 |
|------|-------------|
| 桌面版本清单 | `apps/desktop/src/version.json` |
| 移动版本清单 | `apps/mobile/src/version.json`（含 `versionCode`） |
| 版本同步脚本 | `scripts/sync-app-version.mjs` |
| 打 tag 脚本 | `scripts/release-tag.mjs` → `pnpm release:tag` |
| 本地 CI | `pnpm ci:check` → `scripts/ci-check.ps1` / `ci-check.sh` |
| CI 发版工作流 | `.github/workflows/release.yml` |
| 下载清单 | `releases/channel.json` |

## Tag 与 CI

- `mobile/v*` → 仅构建 Android
- `desktop/v*` → 仅构建 Windows
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
