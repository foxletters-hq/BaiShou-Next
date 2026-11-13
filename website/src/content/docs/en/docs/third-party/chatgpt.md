---
title: Connect ChatGPT
description: Add BaiShou as a custom MCP server in ChatGPT and read diaries from chat.
---

First [turn on MCP](/en/docs/third-party/enable-mcp/) in BaiShou and copy the URL that ends with `/mcp`. Keep BaiShou running.

## 1. Open Settings

Open the avatar menu in the bottom left and click **Settings** (`Ctrl+,`).

![Open Settings](/assets/images/docs/third-party/chatgpt/01.png)

## 2. Add an MCP server

Go to **Plugins**, open the **MCP** tab, click **Add**, then **Add MCP server**.

![Plugins → MCP → Add MCP server](/assets/images/docs/third-party/chatgpt/02.png)

## 3. Name, type, and URL

1. **Name:** `白守` (or `BaiShou`).
2. **Type:** **Streaming HTTP**, not STDIO.
3. **URL:** paste the connection address from BaiShou; it must end with `/mcp`.
4. Click **Save**.

If BaiShou authentication is on, fill in the Bearer token or headers. In the screenshot auth is off, so those fields can stay empty.

![Connect to a custom MCP](/assets/images/docs/third-party/chatgpt/03.png)

## 4. Ask about a diary

Back in chat, say “use BaiShou MCP, what have I eaten lately?” If it lists diary entries, you are connected.

![Diet records via BaiShou MCP](/assets/images/docs/third-party/chatgpt/04.png)
