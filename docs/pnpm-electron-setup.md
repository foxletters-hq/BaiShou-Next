# pnpm 清理缓存与 Electron 安装指南

## 清理所有缓存

```powershell
# 清理 pnpm store 缓存
pnpm store prune

# 查看缓存路径（方便手动清理）
pnpm store path
```

## 删除 node_modules 并重新安装

```powershell
# 删除 node_modules 和 lock 文件（可选）
Remove-Item -Recurse -Force node_modules
Remove-Item pnpm-lock.yaml  # 如果需要完全重置

# 重新安装
pnpm install
```

或者强制重装（忽略缓存）：

```powershell
pnpm install --force
```

---

## 确保 Electron 正确安装

Electron 在 pnpm 下安装时有个常见问题：**二进制文件下载可能失败**。

### 方法 1：设置 Electron 镜像源（推荐国内用户）

在项目根目录创建或编辑 `.npmrc` 文件：

```ini
electron_mirror=https://npmmirror.com/mirrors/electron/
electron_builder_binaries_mirror=https://npmmirror.com/mirrors/electron-builder-binaries/
```

然后重新安装：

```powershell
pnpm install
```

### 方法 2：手动触发 Electron 下载

```powershell
# 安装后验证 electron 二进制是否存在
npx electron --version
# 或
node node_modules/.bin/electron --version
```

### 方法 3：pnpm 特有配置（解决 hoisting 问题）

Electron 项目通常需要在 `.npmrc` 中配置：

```ini
public-hoist-pattern[]=electron
shamefully-hoist=true
```

或在 `package.json` 中添加：

```json
{
  "pnpm": {
    "shamefullyHoist": true
  }
}
```

---

## 完整重置流程

```powershell
# 1. 清理 pnpm 缓存
pnpm store prune

# 2. 删除 node_modules
Remove-Item -Recurse -Force node_modules

# 3. 确认 .npmrc 已配置镜像后重装
pnpm install

# 4. 验证 electron 是否正常
.\node_modules\.bin\electron --version
```

> **💡 提示**：如果 Electron 下载总是失败，可以先手动下载对应版本的 zip 包，
> 放到 `%LOCALAPPDATA%\electron\Cache` 目录，pnpm 会自动识别缓存跳过下载。
