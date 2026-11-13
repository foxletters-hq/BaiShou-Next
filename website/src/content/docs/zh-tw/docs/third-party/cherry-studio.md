---
title: 接到 Cherry Studio
description: 在 Cherry Studio 裡快速建立白守 MCP，用對話讀取日記。
---

先在白守裡 [開啟 MCP](/zh-tw/docs/third-party/enable-mcp/)，複製以 `/mcp` 結尾的連線位址。白守保持執行。

## 1. 打開設定

視窗右上角點齒輪。

![點右上角設定](/assets/images/docs/third-party/cherry-studio/01.png)

## 2. 進入 MCP 伺服器並新增

左側點 **MCP 服务器**，右上角 **+ 添加**，選 **快速创建**。

![MCP 服务器 → 添加 → 快速创建](/assets/images/docs/third-party/cherry-studio/02.png)

![選擇快速创建](/assets/images/docs/third-party/cherry-studio/03.png)

## 3. 填 Streamable HTTP 和位址

在通用頁填寫：

| 項 | 填什麼 |
|----|--------|
| 名称 | `白守` |
| 类型 | **可流式传输的 HTTP (streamableHttp)** |
| URL | 白守 MCP 頁上的連線位址，`/mcp` 結尾 |

右上角開關打開，點儲存。白守若開了鑑權，在 **请求头** 裡加 `Authorization=Bearer 權杖`。

工具標籤顯示 **(14)** 就表示連上了。

![白守 MCP 通用設定](/assets/images/docs/third-party/cherry-studio/04.png)

## 4. 問一句日記裡的事

回到對話，問「我最近吃了什麼」。回覆裡若出現多次工具呼叫，並能列出日記內容，就表示已經接通。

![在對話中檢索到日記](/assets/images/docs/third-party/cherry-studio/05.png)
