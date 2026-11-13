---
title: 開啟 MCP
description: 在白守裡打開 MCP 服務，複製連線位址，再接到其他客戶端。
---

白守可以在本機開一個 MCP 服務，把日記、回憶、記憶檢索這些工具交給其他支援 MCP 的軟體用。

方向先分清：**白守是服務端**。你在白守裡打開服務、複製位址；在對方軟體裡填這個位址。白守裡沒有填 `mcpServers` 的地方。

這一節是實操。日記、回憶、夥伴分別是什麼，見 [概念講解](/zh-tw/docs/basics/diary/)。建議先走完 [十分鐘聊起來](/zh-tw/docs/getting-started/quick-start/)，外部才能搜到你寫過的內容。

白守要保持執行。桌面端和 Android 都可以開，Android 需要正式安裝包。

## 在白守裡打開

**設定 → MCP 服務**，打開 **啟用 MCP 服務**。打開後應顯示「執行中」和目前連接埠。

![MCP 服務已啟用](/assets/images/docs/third-party/mcp-1.png)

*開關打開後，複製「連接地址」那一條，路徑以 `/mcp` 結尾。*

頁面上這幾項以你螢幕為準，不要照抄截圖裡的 IP 和連接埠：

| 項目 | 怎麼用 |
|------|--------|
| 連接埠 | 預設常見是 31004。開發版可能是 31005。截圖裡是 31006，以你頁面上的數字為準 |
| 連接地址 | 建議用這一條，必須是 `/mcp` 結尾 |
| 本機存取 | 同一台電腦上的客戶端用 `127.0.0.1` |
| 區域網路位址 | 手機或其他電腦來連，用設定頁給出的區域網路 IP |
| 啟用鑑權 | 截圖裡是關的，本機這樣就能連。打開之後，對方必須帶存取權杖 |

:::caution[用 /mcp，不要用 /sse]
白守走 Streamable HTTP，路徑是 `/mcp`。`/sse` 只是桌面端舊相容，不建議，行動端沒有。填錯通常就是連不上，或者一個工具都看不到。
:::

## 複製給對方軟體的內容

點頁面上的說明，或直接複製連接地址。對方軟體要填的就是：

1. 以 `/mcp` 結尾的 URL
2. 若開了鑑權，再加 `Authorization: Bearer <存取權杖>`

下面是說明頁裡的示例。位址請換成你自己頁面上的。

![MCP 連線說明](/assets/images/docs/third-party/mcp-2.png)

```json
{
  "mcpServers": {
    "baishou": {
      "url": "http://127.0.0.1:31004/mcp"
    }
  }
}
```

同一台機器用 `127.0.0.1`。截圖裡是區域網路 IP，那是給別的裝置連的。

開了鑑權時，在 `baishou` 裡再加：

```json
"headers": {
  "Authorization": "Bearer 你的存取權杖"
}
```

權杖在 MCP 頁複製。重新整理過權杖，對方軟體裡也要改。

## 接到哪

按你實際在用的軟體選一頁跟著點：

- [Cursor](/zh-tw/docs/third-party/cursor/)
- [ChatGPT](/zh-tw/docs/third-party/chatgpt/)
- [Cherry Studio](/zh-tw/docs/third-party/cherry-studio/)
- [WorkBuddy](/zh-tw/docs/third-party/workbuddy/)

連上之後，用「我最近吃了什麼」這類問題試。能讀到日記，這一步就完成了。

工具清單、少工具、401、區域網路連不上，見 [MCP 服務](/zh-tw/docs/advanced/mcp/) 對照頁。

:::caution[位址加權杖就能讀寫日記]
不要把連線位址和權杖發到公開地方，也不要在不可信的網路裡開放區域網路存取。MCP 設定依裝置保存在本地，不會跟著工作區同步。
:::
