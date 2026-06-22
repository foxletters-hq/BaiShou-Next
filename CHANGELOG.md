# Changelog

## [Unreleased]

### 移动端日记编辑器

- 日记编辑改用 WebView + CodeMirror 6 Live Preview，与桌面共用 `shared/diary-codemirror` 层
- **无需数据迁移**：磁盘仍为 `![file](attachment/xxx | width)` Markdown
- 移除 TextInput + overlay 手搓方案
- 新增 `pnpm run build:diary-editor` 构建 WebView bundle
- **Expo Go 不支持**，需 dev client 或正式/开发版 APK

### 已知限制

- 触摸调整图片宽度：二期
- 复制附件 / 打开文件夹：二期
- 真机键盘与性能：待回归
