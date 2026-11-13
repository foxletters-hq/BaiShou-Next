---
title: 安裝與平台
description: 白守支援的平台、下載方式，以及升級注意事項。
---

## 支援哪些平台

| 平台 | 狀態 |
|------|------|
| Windows | 有官方安裝包 |
| Android | 有官方 APK |
| Linux | 可自行從原始碼編譯，沒有官方預編譯包 |
| iOS / macOS | 暫無官方用戶端 |

兩個下載入口：

- 官網 [foxletters.com](/) 的下載按鈕
- GitHub Releases：https://github.com/foxletters-hq/BaiShou-Next/releases

## Windows

1. 從官網或 Releases 下載最新的桌面安裝包。
2. 跟著安裝精靈裝完並啟動。
3. 如果系統攔截未知應用程式，依提示允許安裝（具體以你本機的安全政策為準）。

## Android

1. 下載最新 APK 安裝。
2. 如果提示「未知來源」，去系統設定裡允許該來源後重試。
3. 和舊版 Flutter 白守套件名稱相同時可以覆蓋升級。升級完如果有舊資料，請走 [版本遷移](/zh-tw/docs/migrate/from-legacy/)。

:::caution[儲存權限]
想把資料放到和桌面一致的外部目錄（`BaiShou_Root`），Android 可能需要「所有檔案存取」這類權限。各家廠商（小米、華為、realme 等）的設定入口名字不一樣，詳見 [工作區與資料位置](/zh-tw/docs/configure/workspace/)。
:::

## 版本說明

現行倉庫是 https://github.com/foxletters-hq/BaiShou-Next 。舊的 Flutter 倉庫已經停止維護，新功能和發版都只在 BaiShou-Next 進行。

桌面端和行動端的版本號不一定同步（比如 desktop 1.x 和 mobile 1.x 各走各的），以各端最新 Release 為準。

裝完後走 [首次啟動](/zh-tw/docs/getting-started/first-launch/)，再按 [十分鐘聊起來](/zh-tw/docs/getting-started/quick-start/) 設定模型和 RAG。
