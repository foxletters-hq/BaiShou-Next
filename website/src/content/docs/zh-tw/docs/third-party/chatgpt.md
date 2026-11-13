---
title: 接到 ChatGPT
description: 在 ChatGPT 裡新增白守為自訂 MCP，用對話讀取日記。
---

先在白守裡 [開啟 MCP](/zh-tw/docs/third-party/enable-mcp/)，複製以 `/mcp` 結尾的連線位址。白守保持執行。

## 1. 打開設定

左下角頭像選單點 **設定**（快捷鍵 `Ctrl+,`）。

![打開設定](/assets/images/docs/third-party/chatgpt/01.png)

## 2. 新增 MCP 伺服器

左側進 **插件**，切到 **MCP** 標籤，點右上角 **添加**，選 **添加 MCP 服务器**。

![插件 → MCP → 添加 MCP 服务器](/assets/images/docs/third-party/chatgpt/02.png)

## 3. 填名稱、類型和位址

1. **名称** 填 `白守`。
2. **类型** 選 **流式 HTTP**，不要選 STDIO。
3. **URL** 貼白守 MCP 頁上的連線位址，以 `/mcp` 結尾。
4. 點 **保存**。

白守若開了鑑權，再填 Bearer 權杖或請求頭；截圖裡鑑權是關的，這兩項可以空著。

![連接至自訂 MCP](/assets/images/docs/third-party/chatgpt/03.png)

## 4. 問一句日記裡的事

回到對話，直接說「用白守 mcp，看看我最近吃了什麼」。能列出日記裡的紀錄，就表示已經接通。

![用白守 MCP 查到飲食紀錄](/assets/images/docs/third-party/chatgpt/04.png)
