---
title: Connect Cherry Studio
description: Quick-create BaiShou MCP in Cherry Studio and read diaries from chat.
---

First [turn on MCP](/en/docs/third-party/enable-mcp/) in BaiShou and copy the URL that ends with `/mcp`. Keep BaiShou running.

## 1. Open Settings

Click the gear in the top-right corner.

![Open Settings](/assets/images/docs/third-party/cherry-studio/01.png)

## 2. Add an MCP server

Select **MCP Servers** on the left, click **+ Add**, then **Quick Create**.

![MCP Servers → Add → Quick Create](/assets/images/docs/third-party/cherry-studio/02.png)

![Choose Quick Create](/assets/images/docs/third-party/cherry-studio/03.png)

## 3. Streamable HTTP and URL

On the General tab:

| Field | Value |
|-------|--------|
| Name | `白守` |
| Type | **Streamable HTTP (streamableHttp)** |
| URL | the connection address from BaiShou, ending in `/mcp` |

Turn the switch on and save. If BaiShou authentication is on, add `Authorization=Bearer <token>` under **Request headers**.

A **(14)** on the Tools tab means it connected.

![BaiShou MCP general settings](/assets/images/docs/third-party/cherry-studio/04.png)

## 4. Ask about a diary

Go back to chat and ask “what have I eaten lately?” Several tool calls plus diary content means it is working.

![Diary retrieved in chat](/assets/images/docs/third-party/cherry-studio/05.png)
