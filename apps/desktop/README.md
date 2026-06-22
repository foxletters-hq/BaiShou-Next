# 白守桌面端 (Electron)

官方仅维护并发布 **Windows** 安装包。受限于团队精力与开发、测试环境，**不提供 Linux / macOS 官方安装包与适配**。

## 平台支持

| 平台 | 说明 |
| ---- | ---- |
| **Windows** | 官方发版，`pnpm release:desktop:win` |
| **Linux** | 可自行编译 AppImage（`pnpm release:desktop:linux`），不保证兼容，不在官方支持范围 |
| **macOS** | 暂无计划 |

在仓库根目录执行 **`pnpm commands`** 或 **`pnpm commands:desktop`** 可查看命令说明。打包与发版流程见 [docs/打包须知.md](../../docs/打包须知.md)。

## 开发

```bash
pnpm dev:desktop
```

## 构建

```bash
# Windows 官方安装包（需在 Windows 本机，且已安装 Inno Setup 6）
pnpm release:desktop:win

# Linux 自行编译（非官方发版）
pnpm release:desktop:linux
```

底层脚本亦可通过 `apps/desktop` 目录下的 `npm run build:win` / `build:linux` 调用，日常推荐在仓库根目录使用上述 `pnpm` 命令。
