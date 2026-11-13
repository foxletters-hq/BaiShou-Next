---
title: 接到 WorkBuddy
description: 在 WorkBuddy 裡用自訂連接器寫入白守 MCP，用對話讀取日記。
---

先在白守裡 [開啟 MCP](/zh-tw/docs/third-party/enable-mcp/)，複製以 `/mcp` 結尾的連線位址。白守保持執行。

## 1. 打開連接器

左側點 **专家·技能·连接器**，彈出選單裡選 **连接器**。

![专家·技能·连接器 → 连接器](/assets/images/docs/third-party/workbuddy/01.png)

## 2. 自訂連接器

右上角點 **自定义连接器**。

![自定义连接器](/assets/images/docs/third-party/workbuddy/02.png)

## 3. 進入 MCP 設定

在 **MCP 服务管理** 裡點 **配置**。

![MCP 服务管理 → 配置](/assets/images/docs/third-party/workbuddy/03.png)

## 4. 寫入 mcp.json 並儲存

編輯器打開的是本機 `mcp.json`。寫入白守，URL 換成你 MCP 頁上的位址，然後點 **保存**：

```json
{
  "mcpServers": {
    "baishou": {
      "url": "http://127.0.0.1:31004/mcp"
    }
  }
}
```

同一台電腦用 `127.0.0.1`。白守若開了鑑權，再加 `headers.Authorization`。

![儲存 mcp.json](/assets/images/docs/third-party/workbuddy/04.png)

## 5. 確認工具已啟用

回到 MCP 服務管理，白守應顯示已啟用，工具為 **14/14 个工具已启用**。

![14 個工具已啟用](/assets/images/docs/third-party/workbuddy/05.png)

## 6. 問一句日記裡的事

回到助理對話，說「從白守看看，我最近吃了什麼」。能列出日記裡的飲食紀錄，就表示已經接通。

![從白守讀到飲食紀錄](/assets/images/docs/third-party/workbuddy/06.png)
