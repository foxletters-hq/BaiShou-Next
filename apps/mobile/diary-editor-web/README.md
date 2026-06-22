# 日记 CodeMirror WebView Bundle

移动端日记编辑器在 WebView 内运行 CodeMirror 6 Live Preview，与桌面共用 `packages/ui/src/shared/diary-codemirror/`。

## 构建

```bash
cd apps/mobile
pnpm run build:diary-editor
```

产物：

- `assets/diary-editor/index.html` — 小体积 shell（~1KB），引用同目录 `diary-editor.bundle`
- `assets/diary-editor/diary-editor.bundle` — vite IIFE（~540KB）

**运行时**：RN 将 shell 与 bundle **复制到同一 `documentDirectory/diary-editor-web/`**，WebView 用 `file://` 加载 shell，由外部 `<script src>` 拉取 bundle。避免 Expo 把 HTML/JS 拆到不同 cache 目录，也避免 Android 不执行内联 script / `injectJavaScript` 体积上限。

若 `index.html` 被内联成 500KB+，或缺少 `diary-editor.bundle`，请重跑 `build:diary-editor` 并 `dev:mobile:clear`（Metro 需识别 `.bundle` 资源扩展名）。

**架构与排查全过程**见 [docs/4-技术分享/移动端/mobile-diary-codemirror-webview.md](../../docs/4-技术分享/移动端/mobile-diary-codemirror-webview.md)。

`pnpm dev` / `export:android` 会自动执行构建（`predev` / `export:android` script）。

## 开发热更新（W-9）

| 模式 | 说明 |
|------|------|
| **默认** | Metro 打包 `assets/diary-editor/` 静态资源；改 TS 后需重跑 `build:diary-editor` |
| **localhost** | 本地 serve bundle + WebView 加载 `http://localhost:...`；设 `DIARY_CM_WEBVIEW_CLEARTEXT=1` 开启 Android cleartext |

## 运行要求

- **Expo Go 不支持**（依赖 `react-native-webview` + 本地 asset bundle）
- 需 **dev client** 或 release APK：`pnpm dev:mobile:clear` 首次全量安装

## RN ↔ WebView 桥接

协议定义：`packages/ui/src/shared/diary-codemirror/types.ts`（方案第 7 节）

| 方向 | 主要消息 |
|------|----------|
| RN → WebView | `init`, `setContent`, `insertAtCursor`, `setEditable`, `resolveUrlResponse`, `requestReady` |
| WebView → RN | `ready`, `change`, `resolveUrlRequest`, `imageAction`, `imagePreview`, `contentHeight` |

竞态：`ready` 前命令入队；`setContent` 回声抑制；URL 解析 10s 超时。

## 已知限制

- touch 宽度拖拽：二期
- 粘贴多张图片：二期
- iOS 键盘遮挡：需真机回归
- 大图优先 `data:` URI，超限降级 `file://`（见 `diary-cm-attachment-url.service.ts`）
