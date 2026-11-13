---
title: MCP 服務
description: 開啟白守的 MCP 服務，讓 Cursor、Claude Desktop 等外部用戶端呼叫你的日記與記憶工具。
---

白守可以在本機啟動一個 MCP 服務，把日記、回憶、記憶檢索這些工具暴露出去，讓支援 MCP 的外部用戶端直接呼叫。

跟著介面點一遍見 [開啟 MCP](/zh-tw/docs/third-party/enable-mcp/)。本頁是位址、工具清單和排查對照。

方向要先搞清：**白守是 MCP 服務端**。它把自己的能力提供給外部 AI，不是用來接入別人的 MCP 伺服器。所以你在白守裡找不到填 `mcpServers` 的地方，那是用戶端側的事。

桌面端和 Android 都支援，兩邊都需要保持白守應用程式在執行。

## 開啟

進 **設定 → MCP 服務**，打開 **啟用 MCP 服務**。

| 項目 | 說明 |
|------|------|
| 連接埠 | 預設 31004，可改成 1000 到 65535 之間任意連接埠。開發版預設用 31005 避免和正式版撞 |
| 連線位址 | `http://127.0.0.1:31004/mcp` |
| 存取權杖 | 首次啟用時自動產生，可以隨時點重新整理重新產生 |

設定頁裡會同時顯示本機位址和區域網路位址。同一台機器上的用戶端用 `127.0.0.1`，別的裝置連過來就用區域網路 IP。

:::caution[用 /mcp，不要用 /sse]
白守走的是 Streamable HTTP 傳輸，路徑是 `/mcp`。桌面端還留了一個 `/sse` 的舊版相容端點，已經不推薦用了，行動端根本沒有。填錯路徑的表現通常就是連不上或者拿不到工具。
:::

## 在用戶端裡設定

以 Cursor 為例，編輯 `~/.cursor/mcp.json`（Windows 是 `%USERPROFILE%\.cursor\mcp.json`）。完整點擊步驟見 [接到 Cursor](/zh-tw/docs/third-party/cursor/)。

```json
{
  "mcpServers": {
    "baishou": {
      "url": "http://127.0.0.1:31004/mcp",
      "headers": {
        "Authorization": "Bearer 你的存取權杖"
      }
    }
  }
}
```

權杖從白守設定頁複製。改了連接埠就同步改 URL；連手機上的白守就把 host 換成手機 IP。

其他 MCP 用戶端的設定檔位置不同，但要填的東西就這兩樣：`/mcp` 結尾的 URL，加一個 `Authorization: Bearer` 標頭。

## 會暴露哪些工具

一共 14 個，對外的名字統一帶 `baishou_` 前綴。

| 工具名 | 做什麼 | 主要參數 |
|--------|--------|----------|
| `baishou_diary_read` | 按日期讀日記全文，一次最多 20 篇 | `dates` |
| `baishou_diary_write` | 在指定日期新建日記 | `date`, `content`, `tags` |
| `baishou_diary_edit` | 追加或整篇覆蓋已有日記 | `date`, `content`, `mode` |
| `baishou_diary_delete` | 刪除指定日期的日記 | `date` |
| `baishou_diary_list` | 列出某段日期內有日記的日子和預覽 | `start_date`, `end_date` |
| `baishou_diary_search` | 全文關鍵字搜日記 | `query`, `limit` |
| `baishou_summary_read` | 讀週記、月報、季報、年鑑 | `type`, `start_date` |
| `baishou_message_search` | 跨會話關鍵字搜歷史訊息 | `query`, `limit` |
| `baishou_vector_search` | 語意或混合檢索記憶 | `query`, `mode`, `min_score` |
| `baishou_memory_store` | 寫入長期記憶 | `content`, `tags` |
| `baishou_memory_delete` | 搜到後刪除記憶 | `query` |
| `baishou_web_search` | 連網搜尋，一次 1 到 3 條查詢 | `queries` |
| `baishou_url_read` | 抓取指定網頁正文 | `url`, `query` |
| `baishou_current_time` | 取得目前真實時間 | 無 |

外部用戶端和白守內部的夥伴用的是同一套工具，所以行為完全一致。

表情包傳送和上下文壓縮屬於內部工具，不會暴露出去。

## 工具列表比預期少？

外部看到的工具是動態過濾的，和你在白守裡的設定直接相關：

- 在 **設定 → 工具管理** 裡關掉的工具，MCP 這邊也不會出現。
- 關了 RAG 或者沒設定嵌入模型，`baishou_vector_search` 和 `baishou_memory_store` 會消失。
- 會話工具列的連網搜尋沒開，`baishou_web_search` 不會暴露。
- `baishou_current_time` 不能被關閉，永遠在。

另外 MCP 操作的始終是**目前活躍的工作空間**。切了工作區，外部用戶端讀到的資料也跟著變。

## 排障

| 現象 | 檢查什麼 |
|------|----------|
| 連不上 | 白守在執行嗎；位址是不是 `/mcp` 結尾；連接埠有沒有被別的程式占用或被防火牆攔 |
| 401 | 權杖對不對。重新產生過權杖的話，用戶端那邊也要同步更新 |
| 一個工具都沒有 | MCP 開關是不是沒打開 |
| 少了幾個工具 | 見上一節的動態過濾規則 |
| 區域網路連不上 | 用區域網路 IP 而不是 `127.0.0.1`，並確認兩台裝置在同一網路 |
| 手機上沒有 MCP 選項 | 需要包含原生模組的正式 APK，Expo Go 裡用不了 |

## 安全

:::caution[權杖就是你日記的鑰匙]
拿到權杖加位址，對方就能讀寫你的日記和記憶。所以別把權杖貼到公開地方，也別在不可信的網路裡開放區域網路存取。

MCP 設定按裝置本地保存，不會跟著工作區同步，各台裝置的權杖是獨立的。
:::
