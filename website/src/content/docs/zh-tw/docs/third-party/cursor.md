---
title: 接到 Cursor
description: 在 Cursor 裡新增白守 MCP，用對話讀取日記。
---

先在白守裡 [開啟 MCP](/zh-tw/docs/third-party/enable-mcp/)，複製以 `/mcp` 結尾的連線位址。白守保持執行。

## 1. 打開 MCP 列表

左側點 **Customize**，上方標籤選 **MCPs**，再點 **New MCP Server**。

![Customize → MCPs → New MCP Server](/assets/images/docs/third-party/cursor/01.png)

## 2. 選 User 範圍

彈出範圍時選 **User**，不要選某個工作區。這樣所有專案都能用。

![選擇 User 範圍](/assets/images/docs/third-party/cursor/02.png)

## 3. 寫入 mcp.json

會打開 `%USERPROFILE%\.cursor\mcp.json`（macOS / Linux 是 `~/.cursor/mcp.json`）。在 `mcpServers` 裡加上白守，URL 換成你 MCP 頁上的位址：

```json
{
  "mcpServers": {
    "baishou": {
      "url": "http://127.0.0.1:31004/mcp"
    }
  }
}
```

同一台電腦用 `127.0.0.1`。白守若開了鑑權，再加 `headers.Authorization`。儲存檔案。

![mcp.json 中的白守設定](/assets/images/docs/third-party/cursor/03.png)

## 4. 確認已連上

回到 MCPs 列表，白守應顯示為已連線，並寫著 **14 tools enabled**。

![白守已連線且 14 個工具可用](/assets/images/docs/third-party/cursor/04.png)

若是 0 個工具：白守是否在執行、URL 是否 `/mcp` 結尾、鑑權權杖是否相符。對照見 [MCP 服務](/zh-tw/docs/advanced/mcp/)。

## 5. 問一句日記裡的事

新開對話，問「我最近吃了什麼」。能列出日記裡的飲食紀錄，就表示外部已經在用白守的工具。

![在 Cursor 中檢索到日記](/assets/images/docs/third-party/cursor/05.png)
