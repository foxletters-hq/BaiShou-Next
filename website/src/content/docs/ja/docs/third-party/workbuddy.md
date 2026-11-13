---
title: WorkBuddy に接続する
description: WorkBuddy のカスタムコネクタで白守 MCP を書き、会話から日記を読む。
---

先に白守で [MCP をオン](/ja/docs/third-party/enable-mcp/) にし、`/mcp` で終わる URL をコピーします。白守は起動したままにします。

## 1. コネクタを開く

左の **专家·技能·连接器** を押し、メニューから **连接器** を選びます。

![专家·技能·连接器 → 连接器](/assets/images/docs/third-party/workbuddy/01.png)

## 2. カスタムコネクタ

右上の **自定义连接器** をクリックします。

![自定义连接器](/assets/images/docs/third-party/workbuddy/02.png)

## 3. MCP 設定を開く

**MCP 服务管理** で **配置** を押します。

![MCP 服务管理 → 配置](/assets/images/docs/third-party/workbuddy/03.png)

## 4. mcp.json を書いて保存

エディタは本機の `mcp.json` を開きます。白守を書き、URL は自分の MCP ページの値にして **保存** します。

```json
{
  "mcpServers": {
    "baishou": {
      "url": "http://127.0.0.1:31004/mcp"
    }
  }
}
```

同じ PC では `127.0.0.1`。白守で認証をオンにしている場合は `headers.Authorization` を足します。

![mcp.json を保存](/assets/images/docs/third-party/workbuddy/04.png)

## 5. ツールが有効か確認する

MCP 服务管理に戻ると、白守が有効で **14/14 个工具已启用** と出ます。

![14 ツールが有効](/assets/images/docs/third-party/workbuddy/05.png)

## 6. 日記のことを尋ねる

アシスタントの会話で「白守から、最近なに食べたか見て」と伝えます。日記の食事が出ればつながっています。

![白守から食事記録](/assets/images/docs/third-party/workbuddy/06.png)
