---
title: Connect Cursor
description: Add BaiShou as an MCP server in Cursor and read diaries from chat.
---

First [turn on MCP](/en/docs/third-party/enable-mcp/) in BaiShou and copy the URL that ends with `/mcp`. Keep BaiShou running.

## 1. Open the MCP list

Click **Customize** in the left sidebar, select the **MCPs** tab, then **New MCP Server**.

![Customize → MCPs → New MCP Server](/assets/images/docs/third-party/cursor/01.png)

## 2. Choose the User scope

When the scope menu appears, pick **User**, not a workspace, so every project can use it.

![Choose User scope](/assets/images/docs/third-party/cursor/02.png)

## 3. Edit mcp.json

This opens `%USERPROFILE%\.cursor\mcp.json` (macOS / Linux: `~/.cursor/mcp.json`). Add BaiShou under `mcpServers`, using the URL from your MCP page:

```json
{
  "mcpServers": {
    "baishou": {
      "url": "http://127.0.0.1:31004/mcp"
    }
  }
}
```

Same computer: `127.0.0.1`. If BaiShou authentication is on, add `headers.Authorization`. Save the file.

![BaiShou config in mcp.json](/assets/images/docs/third-party/cursor/03.png)

## 4. Confirm it is connected

Back on the MCPs list, BaiShou should show as connected with **14 tools enabled**.

![BaiShou connected with 14 tools](/assets/images/docs/third-party/cursor/04.png)

If you see 0 tools: is BaiShou running, does the URL end with `/mcp`, and does the token match? See [MCP server](/en/docs/advanced/mcp/).

## 5. Ask about a diary

Start a new chat and ask “what have I eaten lately?” If it lists meals from your diary, the tools are working.

![Diary retrieved in Cursor](/assets/images/docs/third-party/cursor/05.png)
