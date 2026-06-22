# 白守移动端 (Expo)

官方仅维护并发布 **Android** 客户端。受限于团队精力与开发、测试环境，**暂无 iOS / macOS 版本计划**。

需使用 **开发版安装包**（含 `expo-baishou-server` 等原生模块），**不能用 Expo Go**。

在仓库根目录执行 **`pnpm commands`** 或 **`pnpm commands:mobile`** 可查看命令说明。

## 两条主命令（根目录）

| 命令                        | 何时用                                           |
| --------------------------- | ------------------------------------------------ |
| **`pnpm dev:mobile`**       | 日常开发：只改 JS/TS，启动 Metro                 |
| **`pnpm dev:mobile:clear`** | 全量重装：清 Metro / Gradle 缓存，重编并安装 APK |

升级 Expo、新增原生模块、闪退、连不上 bundler 时 → **`pnpm dev:mobile:clear`**，然后 **`pnpm dev:mobile`**。

开发调试安装 **白守 Dev**（`com.baishou.baishou.dev`），与正式包并存。已配置 `key.properties` 时 Dev 包也用**正式签名**，以便读取旧 Flutter/正式包沙盒内的日记并同步到 `/storage/emulated/0/BaiShou_Root`。

### WSL2 + 真机 `Unable to load script`

Metro 跑在 **WSL** 里。手机**无法**直接访问 `192.168.x.x:8081`（该端口在 WSL 内，不经 portproxy 不会暴露到局域网）。

**推荐做法**（WSL 内 adb，与 Metro 同环境）：

1. 终端 A：`pnpm dev:mobile`（会自动 `adb reverse` 并用 `localhost:8081` 打开 App）
2. 若仍报错：另开终端 `pnpm mobile:connect` 重新 reverse 并打开 App
3. 确保用的是 **WSL 内的 adb**（`which adb` 应在 WSL 路径下），不要用 Windows 侧 adb

无 adb 时：在**管理员 PowerShell** 做端口转发（`pnpm dev:mobile` 启动时会打印 `netsh portproxy` 命令），再用局域网 IP。

## 首次克隆

```bash
pnpm mobile:setup
```

等价于：`pnpm install` → `pnpm mobile:fix` → `pnpm dev:mobile:clear`。

## 其它

| 命令                   | 说明                                                 |
| ---------------------- | ---------------------------------------------------- |
| `pnpm mobile:connect`  | adb reverse + 打开开发版（Metro 需已在跑）           |
| `pnpm mobile:fix`      | 对齐 Expo SDK 依赖版本                               |
| `pnpm mobile:export`   | 导出 Android 离线包                                  |
| `pnpm release:android` | 正式签名 Release APK（需先 `release:setup-signing`） |

发布说明见 [`docs/打包须知.md`](../../docs/打包须知.md)。

## UI 与文案（AI / 协作者必读）

- **颜色**：禁止写死 `#hex`；用 `useNativeTheme().colors`。详见 [`docs/1-AI-Code/2-UI-Theme-Rule.md`](../../docs/1-AI-Code/2-UI-Theme-Rule.md)。
- **文案**：`useTranslation` 只写 `t('i18n.key')`，键在 `packages/shared/src/i18n`。
- **栈内全屏页顶栏**：`StackScreenLayout` + `getStackScreenChrome(colors)`。
