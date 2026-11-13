---
title: MCP server
description: Turn on BaiShou’s MCP service so external clients like Cursor and Claude Desktop can call your diary and memory tools.
---

BaiShou can start an MCP service on your machine that exposes its diary, memory, and retrieval tools so MCP-capable clients can call them directly.

To click through the UI, see [Turn on MCP](/en/docs/third-party/enable-mcp/). This page is the URL, tool list, and troubleshooting reference.

Get the direction straight first: **BaiShou is the MCP server**. It offers its own capabilities to external AI; it isn’t a way to connect to someone else’s MCP servers. That’s why there’s nowhere in BaiShou to fill in `mcpServers` — that part lives on the client side.

Desktop and Android both support it, and on both the BaiShou app has to stay running.

## Turning it on

Go to **Settings → MCP Service** and switch on **Enable MCP Server**.

| Item | Notes |
|------|-------|
| Port | 31004 by default; you can use any port between 1000 and 65535. The dev build defaults to 31005 so it doesn’t collide with the release build |
| Connection URL | `http://127.0.0.1:31004/mcp` |
| Access Token | Generated automatically the first time you enable it; you can hit refresh to regenerate at any point |

The settings page shows both the local address and the LAN address. Clients on the same machine use `127.0.0.1`; other devices connecting in use the LAN IP.

:::caution[Use /mcp, not /sse]
BaiShou uses Streamable HTTP transport, and the path is `/mcp`. Desktop still keeps a legacy `/sse` endpoint for compatibility, but it’s no longer recommended, and mobile doesn’t have it at all. Getting the path wrong usually looks like a failed connection or an empty tool list.
:::

## Configuring your client

Taking Cursor as the example, edit `~/.cursor/mcp.json` (on Windows, `%USERPROFILE%\.cursor\mcp.json`). For the click-through, see [Connect Cursor](/en/docs/third-party/cursor/).

```json
{
  "mcpServers": {
    "baishou": {
      "url": "http://127.0.0.1:31004/mcp",
      "headers": {
        "Authorization": "Bearer YOUR_ACCESS_TOKEN"
      }
    }
  }
}
```

Copy the token from BaiShou’s settings page. If you changed the port, change the URL to match; to reach BaiShou on your phone, swap the host for the phone’s IP.

Other MCP clients keep their config files elsewhere, but there are only two things to fill in: a URL ending in `/mcp`, plus an `Authorization: Bearer` header.

## Which tools get exposed

There are 14 of them, and their external names all carry the `baishou_` prefix.

| Tool name | What it does | Main parameters |
|-----------|--------------|-----------------|
| `baishou_diary_read` | Reads full diaries by date, up to 20 at a time | `dates` |
| `baishou_diary_write` | Creates a new diary on a given date | `date`, `content`, `tags` |
| `baishou_diary_edit` | Appends to or overwrites an existing diary | `date`, `content`, `mode` |
| `baishou_diary_delete` | Deletes the diary on a given date | `date` |
| `baishou_diary_list` | Lists the days with diaries in a date range, with previews | `start_date`, `end_date` |
| `baishou_diary_search` | Full-text keyword search over diaries | `query`, `limit` |
| `baishou_summary_read` | Reads weekly journals, monthly reports, quarterly reports, and yearbooks | `type`, `start_date` |
| `baishou_message_search` | Keyword search over past messages across sessions | `query`, `limit` |
| `baishou_vector_search` | Semantic or hybrid retrieval over memories | `query`, `mode`, `min_score` |
| `baishou_memory_store` | Writes into long-term memory | `content`, `tags` |
| `baishou_memory_delete` | Finds memories and then deletes them | `query` |
| `baishou_web_search` | Web search, 1 to 3 queries per call | `queries` |
| `baishou_url_read` | Fetches the body text of a given page | `url`, `query` |
| `baishou_current_time` | Gets the real current time | none |

External clients and BaiShou’s own companions use the same set of tools, so the behavior is identical.

Sending stickers and context compression are internal tools and aren’t exposed.

## Fewer tools than you expected?

The tools an external client sees are filtered dynamically, based directly on your settings in BaiShou:

- Anything you turned off under **Settings → Tool management** won’t show up over MCP either.
- With RAG off or no embedding model configured, `baishou_vector_search` and `baishou_memory_store` disappear.
- If the web search toggle in the session toolbar is off, `baishou_web_search` isn’t exposed.
- `baishou_current_time` can’t be turned off, so it’s always there.

Also, MCP always operates on the **currently active workspace**. Switch workspaces and the data your external client reads switches with it.

## Troubleshooting

| Symptom | What to check |
|---------|---------------|
| Can’t connect | Is BaiShou running? Does the address end in `/mcp`? Is the port taken by another program or blocked by the firewall? |
| 401 | Is the token right? If you refreshed it, the client needs updating too |
| No tools at all | Is the MCP switch actually on? |
| A few tools missing | See the dynamic filtering rules in the section above |
| Can’t connect over the LAN | Use the LAN IP rather than `127.0.0.1`, and confirm both devices are on the same network |
| No MCP option on the phone | You need a release APK that includes the native module; it doesn’t work inside Expo Go |

## Security

:::caution[The token is a key to your diary]
With the token and the address, someone can read and write your diaries and memories. So don’t paste the token anywhere public, and don’t open up LAN access on a network you don’t trust.

MCP config is stored per device and doesn’t sync with your workspace, so each device has its own token.
:::
