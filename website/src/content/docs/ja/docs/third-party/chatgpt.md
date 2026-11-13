---
title: ChatGPT に接続する
description: ChatGPT に白守をカスタム MCP として追加し、会話から日記を読む。
---

先に白守で [MCP をオン](/ja/docs/third-party/enable-mcp/) にし、`/mcp` で終わる URL をコピーします。白守は起動したままにします。

## 1. 設定を開く

左下のアバターメニューから **設定**（`Ctrl+,`）を開きます。

![設定を開く](/assets/images/docs/third-party/chatgpt/01.png)

## 2. MCP サーバーを追加する

左の **プラグイン** へ入り、**MCP** タブ、右上の **追加**、**MCP サーバーを追加** です。

![プラグイン → MCP → MCP サーバーを追加](/assets/images/docs/third-party/chatgpt/02.png)

## 3. 名前・種類・URL

1. **名称** に `白守`。
2. **类型** は **流式 HTTP**。STDIO は選ばない。
3. **URL** に白守 MCP ページの接続アドレス（末尾 `/mcp`）。
4. **保存**。

白守で認証をオンにしている場合は Bearer トークンかヘッダーを足します。図では認証オフなので空で構いません。

![カスタム MCP に接続](/assets/images/docs/third-party/chatgpt/03.png)

## 4. 日記のことを尋ねる

会話に戻り、「白守 mcp で、最近なに食べたか見て」と伝えます。日記の記録が出ればつながっています。

![白守 MCP で食事記録](/assets/images/docs/third-party/chatgpt/04.png)
