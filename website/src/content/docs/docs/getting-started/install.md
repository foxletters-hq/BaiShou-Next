---
title: 安装与平台
description: 白守支持的平台、下载方式，以及升级注意事项。
---

## 支持哪些平台

| 平台 | 状态 |
|------|------|
| Windows | 有官方安装包 |
| Android | 有官方 APK |
| Linux | 可自行从源码编译，没有官方预编译包 |
| iOS / macOS | 暂无官方客户端 |

两个下载入口：

- 官网 [foxletters.com](/) 的下载按钮
- GitHub Releases：https://github.com/foxletters-hq/BaiShou-Next/releases

## Windows

1. 从官网或 Releases 下载最新的桌面安装包。
2. 跟着安装向导装完并启动。
3. 如果系统拦截未知应用，按提示允许安装（具体以你本机的安全策略为准）。

## Android

1. 下载最新 APK 安装。
2. 如果提示「未知来源」，去系统设置里允许该来源后重试。
3. 和旧版 Flutter 白守包名相同时可以覆盖升级。升级完如果有旧数据，请走 [版本迁移](/docs/migrate/from-legacy/)。

:::caution[存储权限]
想把数据放到和桌面一致的外部目录（`BaiShou_Root`），Android 可能需要「所有文件访问」这类权限。各家厂商（小米、华为、realme 等）的设置入口名字不一样，详见 [工作区与数据位置](/docs/configure/workspace/)。
:::

## 版本说明

现行仓库是 https://github.com/foxletters-hq/BaiShou-Next 。旧的 Flutter 仓库已经停止维护，新功能和发版都只在 BaiShou-Next 进行。

桌面端和移动端的版本号不一定同步（比如 desktop 1.x 和 mobile 1.x 各走各的），以各端最新 Release 为准。

装完后走 [首次启动](/docs/getting-started/first-launch/)，再按 [十分钟聊起来](/docs/getting-started/quick-start/) 配模型和 RAG。
