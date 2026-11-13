---
title: Turn on MCP
description: Enable BaiShou’s MCP service, copy the URL, then connect it from another client.
---

BaiShou can run an MCP server on your machine and hand diary, memory, and retrieval tools to other MCP-capable apps.

Get the direction straight: **BaiShou is the server**. You turn the service on in BaiShou and copy the URL; you paste that URL in the other app. There is nowhere in BaiShou to fill in `mcpServers`.

This section is hands-on. For what diary, memories, and companions *are*, see [Concepts](/en/docs/basics/diary/). Finish [Chat in ten minutes](/en/docs/getting-started/quick-start/) first, or the other app will have nothing to search.

Keep BaiShou running. Desktop and Android both work; Android needs the official package.

## Turn it on in BaiShou

**Settings → MCP Service**, then switch on **Enable MCP Server**. You should see “Running” and the current port.

![MCP service enabled](/assets/images/docs/third-party/mcp-1.png)

*After the switch is on, copy the **Connection address** line. The path must end with `/mcp`.*

Use the values on *your* screen. Do not copy the IP or port from the screenshot:

| Item | How to use it |
|------|----------------|
| Port | Often 31004. Dev builds may use 31005. The screenshot shows 31006 — use whatever your page shows |
| Connection address | Prefer this one; it must end with `/mcp` |
| Local access | Clients on the same computer use `127.0.0.1` |
| LAN address | Phones or other PCs use the LAN IP shown on the page |
| Authentication | Off in the screenshot, which is enough on the same machine. If you turn it on, the client must send a token |

:::caution[Use /mcp, not /sse]
BaiShou uses Streamable HTTP at `/mcp`. `/sse` is a desktop-only legacy path, not recommended, and mobile does not have it. A wrong path usually means no connection or zero tools.
:::

## What to paste in the other app

Open the in-app help, or just copy the connection address. The other app needs:

1. A URL ending in `/mcp`
2. If authentication is on, `Authorization: Bearer <token>`

The help page looks like this. Replace the URL with yours.

![MCP connection help](/assets/images/docs/third-party/mcp-2.png)

```json
{
  "mcpServers": {
    "baishou": {
      "url": "http://127.0.0.1:31004/mcp"
    }
  }
}
```

Same machine: `127.0.0.1`. The screenshot uses a LAN IP for another device.

If authentication is on, add inside `baishou`:

```json
"headers": {
  "Authorization": "Bearer YOUR_ACCESS_TOKEN"
}
```

Copy the token from the MCP page. If you refresh it, update the other app too.

## Which app next

Pick the page for the app you actually use:

- [Cursor](/en/docs/third-party/cursor/)
- [ChatGPT](/en/docs/third-party/chatgpt/)
- [Cherry Studio](/en/docs/third-party/cherry-studio/)
- [WorkBuddy](/en/docs/third-party/workbuddy/)

Then ask something like “what have I eaten lately?” If it can read your diary, you are done.

Tool list, missing tools, 401, and LAN failures: [MCP server](/en/docs/advanced/mcp/).

:::caution[URL plus token can read and write diaries]
Do not post the URL or token in public, and do not expose LAN access on an untrusted network. MCP config is stored per device and does not follow workspace sync.
:::
