# 白守移动端 (Expo)

需使用 **开发版安装包**（含 `expo-baishou-server` 等原生模块），**不能用 Expo Go**。

在仓库根目录执行 **`pnpm commands`** 或 **`pnpm commands:mobile`** 可查看所有命令说明；运行 `mobile:android:clean` 等脚本时终端也会打印对应提示。

## 报错 ExpoBaishouServer / 路由没有 default export

1. 日志里 `Cannot find native module 'ExpoBaishouServer'`：当前 APK **没编入** 自定义原生模块 → 必须 **`pnpm mobile:android:clean`** 重装（不能用 Expo Go）。
2. `Unable to resolve asset icon.png`：`assets/images/icon.png` 不能是指向 Windows 路径的坏符号链接（WSL 下已改为真实文件）。
3. 一堆 `missing default export`：通常是上面原生模块在启动时抛错连带；修好并重装后会消失。

## 连不上 Metro / 闪退「check network connectivity」

多半是 **Metro 地址错了**。开 Clash 时电脑常被识别成 `198.18.x.x`，手机访问不到。

1. 复制 `.env.example` 为 `.env`，写上电脑局域网 IP（如 `192.168.31.59`）：
   `REACT_NATIVE_PACKAGER_HOSTNAME=192.168.31.59`
2. **USB 数据线**（推荐）：`pnpm dev:mobile` 会自动 `adb reverse`；或 Metro 已开时执行 `pnpm mobile:connect`
3. 确认终端里 Metro 显示的是 `192.168.x.x`，不是 `198.18.x.x`

## 日常开发（在仓库根目录执行）

| 命令                        | 说明                                             |
| --------------------------- | ------------------------------------------------ |
| `pnpm dev:mobile`           | 启动 Metro；USB 连手机会自动映射端口             |
| `pnpm mobile:connect`       | 只打开真机 App（需 Metro 已在跑）                |
| `pnpm dev:mobile:clear`     | 清 Metro 缓存后启动                              |
| `pnpm mobile:android`       | 编译并安装 Android 开发版到真机/模拟器           |
| `pnpm mobile:android:clean` | 清原生构建缓存后重装（升级 Expo / 闪退时用这个） |

## 首次或升级原生依赖后

```bash
pnpm mobile:setup
```

等价于：`pnpm install` → `pnpm mobile:fix`（对齐 Expo SDK）→ `pnpm mobile:android:clean`。

手机上请先 **卸载** 旧的 `com.anonymous.mobile`，再执行 setup。

## UI 与文案（AI / 协作者必读）

- **颜色**：禁止在组件里写死 `#hex`、`rgba(...)` 或 `colors.primary + '20'` 拼透明度；一律用 `useNativeTheme().colors` 语义 token（如 `bgApp`、`textPrimary`、`primaryLight`、`bgGlassSurface`）。详见仓库 [`docs/1-AI-Code/2-UI-Theme-Rule.md`](../../docs/1-AI-Code/2-UI-Theme-Rule.md)。
- **文案**：`useTranslation` 只写 `t('i18n.key')`，不要加第二参数中文兜底；键定义在 `packages/shared/src/i18n`。
- **栈内全屏页顶栏**：`StackScreenLayout` + `getStackScreenChrome(colors)`——内容区 `bgApp`，顶栏为 `bgSurface` 白色长条（小箭头 +「返回」+ 居中标题 + 右侧操作）。路由 `headerShown: false`。

## 其它

| 命令                 | 说明                                       |
| -------------------- | ------------------------------------------ |
| `pnpm mobile:fix`    | `expo install --fix`，对齐 SDK 55 依赖版本 |
| `pnpm mobile:cache`  | 仅清 Metro / `.expo` 缓存                  |
| `pnpm mobile:export` | 导出 Android 离线包（`dist/`）             |
| `pnpm build:mobile`  | 同 `mobile:export`                         |

在 `apps/mobile` 目录内也可直接 `pnpm dev`、`pnpm android` 等（与上表对应子包脚本）。
