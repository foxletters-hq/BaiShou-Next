---
title: 常見問題
description: 白守使用中的常見問題：免費、隱私、平台、模型、同步、RAG 與遷移。
---

## 白守是免費的嗎

核心功能免費開源。日記、自建同步、自訂模型 API 都不依賴付費牆。如果之後有官方託管的同步、備份、AI 服務，那屬於可選項。詳見 [隱私與開源](/zh-tw/docs/reference/privacy/)。

## 資料存在哪裡，安全嗎

預設在本地裝置上。同步和備份只會去你自己設定的遠端，AI 請求只會發給你設定的模型商。詳見 [工作區與資料位置](/zh-tw/docs/configure/workspace/) 和 [隱私與開源](/zh-tw/docs/reference/privacy/)。

## 支援哪些平台

官方有 Windows 和 Android。Linux 可以自己編譯，暫時沒有 iOS 和 macOS 用戶端。詳見 [安裝與平台](/zh-tw/docs/getting-started/install/)。

## 和 Notion、Obsidian 有什麼區別

筆記工具側重整理和寫作，白守側重「AI 夥伴 + 回憶年輪 + RAG」這套長期記憶。詳見 [白守是什麼](/zh-tw/docs/getting-started/what-is-baishou/)。

## 模型怎麼設定

跟著介面點一遍見 [十分鐘聊起來](/zh-tw/docs/getting-started/quick-start/)。**設定 → 供應商管理** 新增供應商，再到 **全域預設模型** 分別指定對話、總結、嵌入模型。對照說明見 [設定 AI 供應商與模型](/zh-tw/docs/configure/ai-providers/)。

## 夥伴不記得我寫過的日記

先確認夥伴類型是親密夥伴、嵌入模型設定好了、RAG 沒有未索引提示，然後做一次全量掃描。詳見 [RAG 記憶管理](/zh-tw/docs/configure/rag/)。

## 增量同步和備份能混用嗎

不能當成同一套機制用，雲端路徑和覆蓋範圍都不一樣。詳見 [三種方式怎麼選](/zh-tw/docs/sync/overview/)。

## 回憶、共同回憶、RAG 有什麼區別

| 名詞 | 一句話解釋 |
|------|------------|
| 回憶年輪 | 週記、月報、季報、年鑑，預設每層只讀下一層 |
| 共同回憶 | 把多層總結折疊聚合成可複製、可注入的一段內容 |
| RAG | 對日記做向量化的語意檢索 |

詳見 [回憶與共同回憶](/zh-tw/docs/basics/memories/) 和 [RAG 記憶管理](/zh-tw/docs/configure/rag/)。

## 從舊版怎麼遷

覆蓋安裝後走應用程式內的版本遷移，建議順序見 [從舊版白守遷移](/zh-tw/docs/migrate/from-legacy/)。遷完記得重掃一次 RAG。

## 資料能匯出嗎

可以。Markdown 匯出、全量 ZIP 備份、同步到自建 S3 或 WebDAV 都行，不鎖平台。

## 用戶端顯示的費用準嗎

只能當參考，最終以模型服務商的帳單為準。

## 還有別的問題

- GitHub Issues：https://github.com/foxletters-hq/BaiShou-Next/issues
- 官網社群入口：[foxletters.com](/)
