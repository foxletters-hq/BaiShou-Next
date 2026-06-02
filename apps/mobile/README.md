# 白守移动端 (Expo)

需使用 **开发版安装包**（含 `expo-baishou-server` 等原生模块），**不能用 Expo Go**。

在仓库根目录执行 **`pnpm commands`** 或 **`pnpm commands:mobile`** 可查看命令说明。

## 两条主命令（根目录）

| 命令 | 何时用 |
|------|--------|
| **`pnpm dev:mobile`** | 日常开发：只改 JS/TS，启动 Metro |
| **`pnpm dev:mobile:clear`** | 全量重装：清 Metro / Gradle 缓存，重编并安装 APK |

升级 Expo、新增原生模块、闪退、连不上 bundler 时 → **`pnpm dev:mobile:clear`**，然后 **`pnpm dev:mobile`**。

建议全量重装前在手机上**卸载**旧版 `com.anonymous.mobile`。

### WSL2 + 真机提示 `localhost:8081` 连不上

Metro 跑在 **WSL** 里，而 Windows 上的 `adb reverse` 只会把手机的 `localhost:8081` 转到 **Windows 本机**，通常**到不了** WSL 里的 Metro。

1. 终端里看 `pnpm dev:mobile` 打印的 **局域网地址**（如 `http://192.168.1.59:8081`），手机与电脑同一 Wi‑Fi，在开发菜单里填这个地址（**不要用 localhost**）。
2. 开 Clash/VPN 时把 `apps/mobile/.env.example` 复制为 `.env`，设置 `REACT_NATIVE_PACKAGER_HOSTNAME=你的局域网 IP`。
3. 同 Wi‑Fi 仍失败：在**管理员 PowerShell** 做端口转发（脚本启动时会打印 `netsh portproxy` 命令），或在 WSL 内用 usbipd 绑定 USB 后使用 WSL 内的 adb。

USB 调试且非 WSL：可用 `pnpm mobile:connect`（依赖 `adb reverse` + localhost）。

## 首次克隆

```bash
pnpm mobile:setup
```

等价于：`pnpm install` → `pnpm mobile:fix` → `pnpm dev:mobile:clear`。

## 其它

| 命令 | 说明 |
|------|------|
| `pnpm mobile:connect` | adb reverse + 打开开发版（Metro 需已在跑） |
| `pnpm mobile:fix` | 对齐 Expo SDK 依赖版本 |
| `pnpm mobile:export` | 导出 Android 离线包 |

## UI 与文案（AI / 协作者必读）

- **颜色**：禁止写死 `#hex`；用 `useNativeTheme().colors`。详见 [`docs/1-AI-Code/2-UI-Theme-Rule.md`](../../docs/1-AI-Code/2-UI-Theme-Rule.md)。
- **文案**：`useTranslation` 只写 `t('i18n.key')`，键在 `packages/shared/src/i18n`。
- **栈内全屏页顶栏**：`StackScreenLayout` + `getStackScreenChrome(colors)`。
