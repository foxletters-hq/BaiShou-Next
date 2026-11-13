---
title: Connect WorkBuddy
description: Add BaiShou MCP through a custom connector in WorkBuddy and read diaries from chat.
---

First [turn on MCP](/en/docs/third-party/enable-mcp/) in BaiShou and copy the URL that ends with `/mcp`. Keep BaiShou running.

## 1. Open Connectors

Click **Experts · Skills · Connectors** in the sidebar, then **Connectors**.

![Experts · Skills · Connectors → Connectors](/assets/images/docs/third-party/workbuddy/01.png)

## 2. Custom connector

Click **Custom connector** in the top right.

![Custom connector](/assets/images/docs/third-party/workbuddy/02.png)

## 3. Open MCP config

In **MCP Service Management**, click **Configure**.

![MCP Service Management → Configure](/assets/images/docs/third-party/workbuddy/03.png)

## 4. Edit mcp.json and save

The editor opens the local `mcp.json`. Add BaiShou with the URL from your MCP page, then **Save**:

```json
{
  "mcpServers": {
    "baishou": {
      "url": "http://127.0.0.1:31004/mcp"
    }
  }
}
```

Same computer: `127.0.0.1`. If BaiShou authentication is on, add `headers.Authorization`.

![Save mcp.json](/assets/images/docs/third-party/workbuddy/04.png)

## 5. Confirm tools are on

Back in MCP Service Management, BaiShou should be enabled with **14/14 tools enabled**.

![14 tools enabled](/assets/images/docs/third-party/workbuddy/05.png)

## 6. Ask about a diary

In the assistant chat, say “check BaiShou, what have I eaten lately?” If it lists meals from your diary, you are connected.

![Diet records from BaiShou](/assets/images/docs/third-party/workbuddy/06.png)
