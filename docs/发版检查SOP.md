# 发版检查 SOP（Android / Windows）

> **适用**：白守 Next 正式版（Android APK + Windows 安装包）  
> **配套文档**：[发版流程.md](./发版流程.md)、[打包须知.md](./打包须知.md)、[.cursor/skills/baishou-release/SKILL.md](../.cursor/skills/baishou-release/SKILL.md)  
> **原则**：tag 必须指向 `main`；版本号不得复用；Android `versionCode` 必须递增；任何一项未通过都不得发版。

---

## 0. 一页版（发版当天照着勾）

### 发版前

- [ ] 所有功能 PR 已合入 `main`，当前分支为 `main` 且与 `origin/main` 同步
- [ ] 工作区干净（`git status --short` 无输出）
- [ ] 已确认发版平台（Android / Windows / 两端）和新版本号
- [ ] `version.json` 已更新；Android `versionCode` 已 +1
- [ ] `node scripts/sync-app-version.mjs` 已执行，`--check` 通过
- [ ] `pnpm sync` 已执行，`pnpm sync:check` 通过
- [ ] `pnpm ci:check` 全绿（或已按豁免流程书面批准）
- [ ] 数据库迁移、旧版升级、跨端同步路径已验证
- [ ] 若有内置技能变更，`bundledHash` / 技能迁移已验证
- [ ] `releases/notes/{platform}-{version}.md` 已撰写并 review
- [ ] Android 签名 secrets / Windows 证书变量已配置且未过期
- [ ] 已用上一正式版做覆盖安装冒烟测试
- [ ] Release Manager + QA 已签字

### 发版

- [ ] 在 `main` 上预览 tag：`pnpm release:tag <platform>`
- [ ] 推送 tag：`pnpm release:tag <platform> --push`
- [ ] GitHub Actions `Build & Release` 全部 job 成功
- [ ] Release 附件含「版本化文件名 + 固定别名」
- [ ] Release 说明包含下载表、更新摘要、PR / Contributors
- [ ] `releases/channel.json` 已由 CI 自动更新并 commit 回 `main`

### 发版后

- [ ] 从公网 Release 下载 APK / Setup.exe 并安装成功
- [ ] 旧版本覆盖升级成功，数据、登录、同步均正常
- [ ] 应用内「检查更新」能提示新版本
- [ ] 官网下载按钮指向新包
- [ ] 核心路径冒烟通过（见 §4.3）
- [ ] 24 小时内无新增崩溃 / 数据损坏报告
- [ ] 发版记录、SHA256、CI 链接已归档

---

## 1. 角色与签字

| 角色                  | 职责                                            | 签字 |
| --------------------- | ----------------------------------------------- | ---- |
| Release Manager（RM） | 执行本 SOP、版本号、tag、Release 说明、频道清单 |      |
| Code Owner            | 确认范围、版本号、已知风险与豁免                |      |
| QA                    | 安装/升级/核心路径冒烟、回归结论                |      |
| Infra / 签名负责人    | Android keystore、Windows 证书、CI secrets      |      |

**Go / No-Go 规则**

- 必须有 **RM + QA** 两人确认。
- 任一强制项失败 → **No-Go**。
- 临时豁免必须由 Code Owner 书面同意，并在发版记录中写明原因、影响范围、补救计划。

---

## 2. 发版前检查（T-1 ~ T-0）

### 2.1 代码与分支

```powershell
git switch main
git pull --ff-only origin main
git status --short
git log --oneline -10
```

通过标准：

- 当前分支是 `main`，且 `git status -sb` 不显示 ahead / behind。
- 工作区干净；没有未提交的 `version.json`、release notes、生成物。
- 发版范围内的 PR 全部已合并；没有依赖未合并分支的代码。
- 确认 `main` 上最新 CI 通过（GitHub Actions → `CI`）。

> 发版 tag 只能打在 `main` 的 commit 上；CI 会校验，打在功能分支会被拒绝。

### 2.2 版本号

| 平台    | 文件                            | 规则                                           |
| ------- | ------------------------------- | ---------------------------------------------- |
| Android | `apps/mobile/src/version.json`  | `version` 用 semver；`versionCode` **必须 +1** |
| Windows | `apps/desktop/src/version.json` | `version` 用 semver                            |

```powershell
# 查看当前版本
node -p "require('./apps/mobile/src/version.json')"
node -p "require('./apps/desktop/src/version.json').version"
```

示例：

```json
{ "version": "1.2.26", "versionCode": 103 }
```

修改后同步到 `package.json` / `app.json`：

```powershell
node scripts/sync-app-version.mjs
node scripts/sync-app-version.mjs --check
```

通过标准：

- `--check` 输出「各端版本字段已同步」。
- `apps/mobile/app.json` 的 `expo.version` / `expo.android.versionCode` 与 `version.json` 一致。
- 待发版本的 tag 尚不存在：

```powershell
git tag -l "mobile/v1.2.26"
git tag -l "desktop/v1.2.18"
```

> `versionCode` 只增不减；不要只改版本名。否则 Android 会提示「无法降级」。

### 2.3 生成物同步

```powershell
pnpm sync
pnpm sync:check
```

`pnpm sync` 覆盖：应用图标、版本号、供应商图标、视觉模型快照、思考强度快照、UI 组件索引。  
若本版改了图标、模型能力或 UI 组件清单，必须把生成的 diff 一起提交，不能只跑不提交。

通过标准：`pnpm sync:check` 全部通过，且工作区没有未提交的生成物。

### 2.4 CI 门禁

完整门禁：

```powershell
pnpm ci:check
```

等价的关键步骤：

| 检查         | 命令                                                   | 通过标准                    |
| ------------ | ------------------------------------------------------ | --------------------------- |
| 格式         | `pnpm format:check`                                    | 无差异                      |
| 生成物       | `pnpm sync:check`                                      | 全部通过                    |
| 缓存审计     | `pnpm audit:cache-invalidation`                        | 无违规                      |
| ESLint       | `pnpm lint`                                            | 0 error，warning 不超过基线 |
| CSS          | `pnpm lint:css`                                        | 0 error                     |
| 类型         | `pnpm typecheck`                                       | 全部包通过                  |
| 单测         | `pnpm test`                                            | 全部通过                    |
| WebView 产物 | `pnpm --filter @baishou/mobile run build:diary-editor` | 构建成功                    |

通过标准：

- `pnpm ci:check` 退出码为 0。
- 不允许用 `--no-verify`、跳过测试、删除断言等方式「压绿」。
- 已知失败必须记录在发版单中；是否允许发版由 Code Owner 书面确认。

### 2.5 数据库、迁移与跨端兼容

本版若涉及 schema / migration / 同步协议变更，逐项确认：

- [ ] Drizzle 迁移已生成并提交：

  ```powershell
  pnpm --filter @baishou/database db:generate
  pnpm --filter @baishou/database db:sync-embedded
  ```

- [ ] `packages/database/src/embedded-agent-migrations.ts` 与迁移 SQL 已同步。
- [ ] 迁移测试通过：`pnpm --filter @baishou/database test`。
- [ ] **旧版 → 新版**覆盖安装后数据库可正常打开；必要时先在测试机备份。
- [ ] 移动端与桌面端同步协议兼容：至少验证一次双向增量同步 / 局域网互传。
- [ ] 如涉及不可逆迁移，已准备备份与回滚说明。

### 2.6 内置技能与提示词

若本版修改了 `apps/desktop/AI/skills/**` 或内置技能清单：

- [ ] 新增/修改的 `SKILL.md` 已带正确的 `bundledHash`。
- [ ] 桌面端技能迁移逻辑（`agent-skills-migrate`）不会覆盖用户改过的技能。
- [ ] 技能列表、`skill_read`、技能启用/禁用路径已手工验证。
- [ ] 相关测试通过：`pnpm --filter @baishou/ai test`、`pnpm --filter @baishou/desktop test`。

> 技能文件是用户可见能力，发版后无法「撤回已写入用户目录」；变更前务必确认迁移策略。

### 2.7 Release 说明

先生成素材：

```powershell
pnpm release:notes -- --platform mobile --version 1.2.26
# 或
pnpm release:notes -- --platform desktop --version 1.2.18
```

写入：

- Android：`releases/notes/mobile-1.2.26.md`
- Windows：`releases/notes/desktop-1.2.18.md`

要求：

- 3～6 条**用户能听懂**的更新亮点，合并相近改动。
- 不写 commit hash、不写贡献者 @、不写「各平台下载表」（CI 自动生成）。
- 下载表、官网入口、PR / Contributors 由 CI 自动追加。

通过标准：

- [ ] 文件存在并已 review。
- [ ] 内容与本次实际改动一致，没有把未发布功能写进去。
- [ ] 没有泄露内部链接、密钥、用户数据。

### 2.8 签名与发布凭据

**Android**（GitHub Secrets）：

| Secret                    | 用途                      |
| ------------------------- | ------------------------- |
| `ANDROID_KEYSTORE_BASE64` | upload keystore 的 Base64 |
| `ANDROID_KEY_ALIAS`       | 通常为 `upload`           |
| `ANDROID_KEY_PASSWORD`    | key 密码                  |
| `ANDROID_STORE_PASSWORD`  | keystore 密码             |

**Windows**（GitHub Secrets / Variables）：

| 名称                                | 用途                               |
| ----------------------------------- | ---------------------------------- |
| `WINDOWS_CERT_PFX_BASE64`           | PFX 的 Base64                      |
| `WINDOWS_CERT_PASSWORD`             | PFX 密码                           |
| `WINDOWS_CERT_TIMESTAMP_URL`        | 可选，时间戳服务                   |
| `WINDOWS_SIGN_REQUIRED`（Variable） | 正式发版建议设为 `1`，未签名即失败 |

检查：

- [ ] Secrets 未过期、未泄露；`key.properties` / `.jks` / `.pfx` 没有被提交。
- [ ] Windows runner 可安装 Inno Setup 6（workflow 已自动处理）。
- [ ] 本机打包时已退出所有白守窗口，避免文件占用。

### 2.9 预打包与安装冒烟（强烈建议）

```powershell
# Android（需已配置 key.properties）
pnpm release:android

# Windows（需 Windows 本机 + Inno Setup 6）
pnpm release:desktop:win
```

在**干净测试机 / 虚拟机**上验证：

- [ ] 安装成功，版本号正确。
- [ ] 从上一正式版**覆盖升级**成功，数据不丢。
- [ ] Android `versionCode` 大于旧版；签名不是 Debug。
- [ ] Windows `Get-AuthenticodeSignature` 为 `Valid`（若启用签名）。
- [ ] 冷启动、登录/引导、发消息、工具调用、日记、总结、图谱、知识库、同步、局域网互传各走一遍。

### 2.10 冻结与通知

- [ ] 发版窗口内冻结 `main` 的非必要合并（或明确只允许 release 相关 commit）。
- [ ] 通知相关同学：版本号、平台、预计 tag 时间、回滚联系人。
- [ ] 确认发版记录模板已建（见 §8）。

---

## 3. 发版执行

### 3.1 最终确认

```powershell
git switch main
git pull --ff-only origin main
git status --short
node scripts/sync-app-version.mjs --check
pnpm sync:check
```

确认：

- HEAD 就是准备发版的 commit。
- 工作区干净。
- 版本号 / notes / 生成物都已提交并推送。

### 3.2 打 tag 并推送

```powershell
# 先预览（不会创建 tag）
pnpm release:tag mobile
# 或
pnpm release:tag desktop
# 两端 version 相同时
pnpm release:tag all
```

确认预览中的版本、tag、当前分支无误后：

```powershell
pnpm release:tag mobile --push
# 或
pnpm release:tag desktop --push
# 或
pnpm release:tag all --push
```

Tag 规则：

| 平台       | Tag 示例                             | 触发构建   |
| ---------- | ------------------------------------ | ---------- |
| Android    | `mobile/v1.2.26`                     | 仅 Android |
| Windows    | `desktop/v1.2.18`                    | 仅 Windows |
| 两端同版本 | `mobile/v1.2.26` + `desktop/v1.2.26` | 两端       |

CI 会校验：

- tag 指向 `main` 上的 commit；
- tag 版本与对应 `version.json` 一致；
- `sync-app-version --check` 通过。

### 3.3 监控 GitHub Actions

打开 GitHub → Actions → **Build & Release**，确认以下 job：

| Job                               | 通过标准                                    |
| --------------------------------- | ------------------------------------------- |
| `Prepare release`                 | tag / 版本 / main 校验通过                  |
| `Build Android APK`               | APK 构建成功，非 Debug 签名                 |
| `Build Windows Installer`         | Setup.exe 构建成功；签名状态符合预期        |
| `Release Android`                 | Release 附件上传成功                        |
| `Release Windows`                 | Release 附件上传成功                        |
| `Update release channel manifest` | `releases/channel.json` 已更新并推送回 main |

任一 job 失败：

- 先看日志定位；不要急着重打 tag。
- 未创建 Release 前可删除本地/远端 tag，修复后重新打**同一版本** tag。
- 已创建 Release 后不要删除/重用 tag；走热修流程（§6）。

### 3.4 检查 Release 页面

- [ ] Release 标题为 `白守 v{max(mobile, desktop)}`。
- [ ] 不是 Draft，不是 Pre-release（除非明确要预发布）。
- [ ] Android 附件：
  - `BaiShou-v{version}-Android.apk`
  - `BaiShou-Android.apk`
- [ ] Windows 附件：
  - `BaiShou-v{version}-Windows-Setup.exe`
  - `BaiShou-Windows-Setup.exe`
- [ ] 正文有下载表、官网入口、本版本更新说明、PR / Contributors。
- [ ] 文件大小合理（不是 0 字节、不是旧版本大小）。

### 3.5 检查 channel.json

```powershell
Invoke-RestMethod "https://raw.githubusercontent.com/foxletters-hq/BaiShou-Next/main/releases/channel.json"
```

确认：

- `android.version` / `android.versionCode` 是新版本。
- `windows.version` 是新版本。
- `tag` 指向本次 Release tag。
- `downloadUrl` 可访问。
- `updatedAt` 是本次发版时间。

> `channel.json` 由 CI 自动 commit 回 `main`；不要手动改版本号或下载链接。

---

## 4. 发版后验证（T+0）

### 4.1 公网下载与安装

从 Release 页面（不是本地构建产物）下载：

- Android APK → 安装到干净设备 / 模拟器。
- Windows Setup.exe → 安装到干净 Windows 虚拟机。

检查：

- [ ] 安装包能正常下载，大小与 Release 页面一致。
- [ ] 安装成功，应用名称/图标/版本正确。
- [ ] Android 签名不是 Debug；`versionCode` 正确。
- [ ] Windows 签名状态符合预期（`Get-AuthenticodeSignature`）。
- [ ] 首次启动无白屏、无缺失原生模块、无数据库报错。

### 4.2 覆盖升级

在**已安装上一正式版**的设备上覆盖安装：

- [ ] Android 可直接覆盖，数据保留。
- [ ] Windows 可覆盖安装，数据保留。
- [ ] 升级后数据库迁移成功，历史会话/日记/总结可读。
- [ ] 旧版「检查更新」能发现新版本并跳转下载。

### 4.3 核心路径冒烟

至少覆盖：

- [ ] 启动 / 引导 / 登录
- [ ] 发消息、流式输出、停止生成
- [ ] 工具调用（含技能调用）
- [ ] 日记新建/编辑/保存
- [ ] 总结生成
- [ ] 图谱打开/搜索/审阅
- [ ] 知识库导入/检索
- [ ] 桌面 ↔ 移动增量同步
- [ ] 局域网互传
- [ ] 设置保存 / 重启后生效
- [ ] TTS（如本版有改动）

### 4.4 官网与更新入口

- [ ] 官网「下载」按钮指向新包。
- [ ] 移动端「检查更新」提示新版本。
- [ ] 桌面端「检查更新」提示新版本。
- [ ] 旧版本不会被错误提示「已是最新」。

### 4.5 监控

发版后 24 小时内：

- [ ] 关注崩溃日志、启动失败、数据库损坏、同步冲突报告。
- [ ] 关注 GitHub Issues / 用户反馈。
- [ ] 记录首个 24h 的关键指标（下载量、启动失败率、崩溃数）。

---

## 5. 回滚与热修

### 5.1 发版前失败（尚未创建 Release）

1. 删除本地和远端 tag：

   ```powershell
   git tag -d mobile/v1.2.26
   git push origin :refs/tags/mobile/v1.2.26
   ```

2. 修复问题，重新跑 `pnpm ci:check`。
3. 用**同一版本号**重新打 tag（前提：没有 Release、没有用户安装到该版本）。
4. 若已经有人安装，必须 bump 新版本 + `versionCode` +1，不得重用。

### 5.2 发版后发现问题（已创建 Release）

**不要删除 tag、不要重用版本号。**

1. 评估影响：是否数据损坏、是否阻塞启动、影响平台/版本范围。
2. 必要时先把 `releases/channel.json` 回退到上一个已知正常版本，并 commit 到 `main`，阻止新用户继续下载问题版本。
3. 在 GitHub Release 标记 `Pre-release` 或补充已知问题说明（不要静默删除）。
4. 修复后发**热修版本**：
   - `version` patch +1；
   - Android `versionCode` 再 +1；
   - 重新走完整 SOP。
5. 如涉及数据库不可逆迁移，先提供备份/恢复指引，再发修复包。

### 5.3 热修检查清单

- [ ] 问题已复现并定位到具体 commit。
- [ ] 修复只包含必要改动，不带无关重构。
- [ ] 回归测试 + 针对性测试通过。
- [ ] 版本号 / versionCode 已递增。
- [ ] Release notes 明确写「修复了什么问题」。
- [ ] 发版后重新做覆盖升级与核心路径冒烟。

---

## 6. 常见失败与处理

| 现象                            | 常见原因                                         | 处理                                                           |
| ------------------------------- | ------------------------------------------------ | -------------------------------------------------------------- |
| CI 提示 tag 不在 main           | tag 打在功能分支                                 | 合并到 main 后重新打 tag                                       |
| tag 与 version.json 不一致      | 忘记 bump 或 bump 错端                           | 修正版本、`sync-app-version`、重新打 tag（未发 Release 前）    |
| Android 提示无法降级            | `versionCode` 没 +1                              | 递增 `versionCode` 后重发                                      |
| Android 安装包是 Debug 签名     | `key.properties` 被 prebuild 清掉 / secrets 缺失 | 检查 `ANDROID_*` secrets，重新构建                             |
| Windows SmartScreen 未知发布者  | 未配置 Authenticode                              | 配置 `WINDOWS_CERT_*`，设 `WINDOWS_SIGN_REQUIRED=1`            |
| Windows 本地打包 Access denied  | 白守仍在运行                                     | 退出所有窗口后重跑 `release:desktop:win`                       |
| 安装包启动崩溃                  | 只重编了 `win-unpacked` 没重跑 Inno              | 完整执行 `pnpm release:desktop:win`                            |
| `sync:check` 失败               | 生成物过期                                       | `pnpm sync`，提交生成物                                        |
| `pnpm lint` 因 warning 预算失败 | warning 超过 baseline                            | 修复 warning；确需调整 baseline 时按规范单独提交，不得静默放宽 |
| `channel.json` 未更新           | `update-channel` job 失败 / 无 main 权限         | 检查 job 日志与 `contents: write` 权限；不要手改版本           |
| Release 附件缺失                | artifact 名称不匹配                              | 检查构建日志与 `Normalize * artifacts` 步骤                    |
| 旧版检查更新无提示              | channel.json 未更新 / 缓存                       | 确认 channel 内容与客户端缓存策略                              |

---

## 7. 证据归档

每次发版至少保存：

- 发版 commit SHA、tag、CI run URL
- Android APK / Windows Setup.exe 的 SHA256
- 签名校验结果（`apksigner` / `Get-AuthenticodeSignature`）
- `releases/channel.json` 对应 commit
- 覆盖升级与核心路径冒烟记录（设备/系统版本/结果）
- 发版期间豁免项与批准人

```powershell
Get-FileHash release\BaiShou-v1.2.26-Android.apk -Algorithm SHA256
Get-FileHash apps\desktop\dist\BaiShou-v1.2.18-Windows-Setup.exe -Algorithm SHA256
```

---

## 8. 发版记录模板

```markdown
## 发版记录 vX.Y.Z

- 日期：
- 平台：Android / Windows / 两端
- 版本：mobile x.y.z (code n) / desktop x.y.z
- commit：
- tag：
- CI run：
- Release：
- channel.json commit：
- 签名校验：通过 / 未启用
- 覆盖升级：通过 / 失败（设备/系统：）
- 核心路径冒烟：通过 / 失败
- 已知问题 / 豁免：
- 回滚联系人：
- 复盘：无 / 有（链接）
```

---

## 附录 A：命令速查

```powershell
# 分支与状态
git switch main
git pull --ff-only origin main
git status --short

# 版本
node -p "require('./apps/mobile/src/version.json')"
node -p "require('./apps/desktop/src/version.json').version"
node scripts/sync-app-version.mjs
node scripts/sync-app-version.mjs --check

# 生成物
pnpm sync
pnpm sync:check

# CI
pnpm ci:check
pnpm lint
pnpm lint:css
pnpm typecheck
pnpm test

# Release notes
pnpm release:notes -- --platform mobile --version 1.2.26
pnpm release:notes -- --platform desktop --version 1.2.18

# 本地打包
pnpm release:android
pnpm release:desktop:win
pnpm release:all

# tag
pnpm release:tag mobile
pnpm release:tag mobile --push
pnpm release:tag desktop --push
pnpm release:tag all --push

# 产物校验
Get-AuthenticodeSignature apps\desktop\dist\BaiShou-v*-Windows-Setup.exe
apksigner verify --print-certs release\BaiShou-v*-Android.apk
Get-FileHash release\BaiShou-v*-Android.apk -Algorithm SHA256
```

---

## 附录 B：关键文件地图

| 用途             | 路径                                           |
| ---------------- | ---------------------------------------------- |
| Android 版本     | `apps/mobile/src/version.json`                 |
| Windows 版本     | `apps/desktop/src/version.json`                |
| 版本同步脚本     | `scripts/sync-app-version.mjs`                 |
| Release notes    | `releases/notes/{platform}-{version}.md`       |
| 频道清单         | `releases/channel.json`                        |
| CI 发版流程      | `.github/workflows/release.yml`                |
| 发版 tag 脚本    | `scripts/release-tag.mjs`                      |
| 一键打包         | `scripts/release-all.mjs`                      |
| Android 构建     | `apps/mobile/scripts/build-release-apk.mjs`    |
| Windows 构建校验 | `apps/desktop/scripts/verify-desktop-pack.mjs` |
| 打包详情         | `docs/打包须知.md`                             |
| 发版速查         | `docs/发版流程.md`                             |

---

_维护：BaiShou Next 团队 · 与 `.cursor/skills/baishou-release` 同步更新_
