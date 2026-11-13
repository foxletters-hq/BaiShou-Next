---
title: Cursor に接続する
description: Cursor に白守 MCP を追加し、会話から日記を読む。
---

先に白守で [MCP をオン](/ja/docs/third-party/enable-mcp/) にし、`/mcp` で終わる URL をコピーします。白守は起動したままにします。

## 1. MCP 一覧を開く

左の **Customize** を押し、上の **MCPs** タブ、それから **New MCP Server** です。

![Customize → MCPs → New MCP Server](/assets/images/docs/third-party/cursor/01.png)

## 2. User スコープを選ぶ

範囲のメニューでは **User** を選びます。特定のワークスペースにしないでください。どのプロジェクトからでも使えます。

![User スコープを選ぶ](/assets/images/docs/third-party/cursor/02.png)

## 3. mcp.json を書く

`%USERPROFILE%\.cursor\mcp.json` が開きます（macOS / Linux は `~/.cursor/mcp.json`）。`mcpServers` に白守を足し、URL は自分の MCP ページの値にします。

```json
{
  "mcpServers": {
    "baishou": {
      "url": "http://127.0.0.1:31004/mcp"
    }
  }
}
```

同じ PC では `127.0.0.1`。白守で認証をオンにしている場合は `headers.Authorization` を足します。保存します。

![mcp.json の白守設定](/assets/images/docs/third-party/cursor/03.png)

## 4. 接続を確認する

MCPs 一覧に戻り、白守が接続済みで **14 tools enabled** と出ていれば成功です。

![14 ツールで接続済み](/assets/images/docs/third-party/cursor/04.png)

ツールが 0 個なら、白守が起動しているか、URL が `/mcp` か、トークンが合っているかを見てください。対照は [MCP サーバー](/ja/docs/advanced/mcp/) です。

## 5. 日記のことを尋ねる

新しい会話で「最近なに食べた？」と聞きます。日記の食事が出れば、外部から白守のツールが使えています。

![Cursor で日記を検索](/assets/images/docs/third-party/cursor/05.png)
