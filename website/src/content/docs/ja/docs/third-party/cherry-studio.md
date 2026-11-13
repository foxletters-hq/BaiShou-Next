---
title: Cherry Studio に接続する
description: Cherry Studio で白守 MCP をクイック作成し、会話から日記を読む。
---

先に白守で [MCP をオン](/ja/docs/third-party/enable-mcp/) にし、`/mcp` で終わる URL をコピーします。白守は起動したままにします。

## 1. 設定を開く

ウィンドウ右上の歯車をクリックします。

![右上の設定](/assets/images/docs/third-party/cherry-studio/01.png)

## 2. MCP サーバーを追加する

左で **MCP 服务器**、右上 **+ 添加**、**快速创建** です。

![MCP 服务器 → 添加 → 快速创建](/assets/images/docs/third-party/cherry-studio/02.png)

![快速创建を選ぶ](/assets/images/docs/third-party/cherry-studio/03.png)

## 3. Streamable HTTP と URL

通用タブで次を入れます。

| 項目 | 値 |
|------|-----|
| 名称 | `白守` |
| 类型 | **可流式传输的 HTTP (streamableHttp)** |
| URL | 白守 MCP ページの接続アドレス。末尾 `/mcp` |

右上のスイッチをオンにして保存します。白守で認証をオンにしている場合は、**请求头** に `Authorization=Bearer <トークン>` を足します。

ツールタブが **(14)** なら接続できています。

![白守 MCP の通用設定](/assets/images/docs/third-party/cherry-studio/04.png)

## 4. 日記のことを尋ねる

会話に戻り「最近なに食べた？」と聞きます。ツール呼び出しが複数あり、日記の内容が出れば成功です。

![会話で日記を検索](/assets/images/docs/third-party/cherry-studio/05.png)
