---
title: 接到 Cursor
description: 在 Cursor 里添加白守 MCP，用对话读取日记。
---

先在白守里 [开启 MCP](/docs/third-party/enable-mcp/)，复制以 `/mcp` 结尾的连接地址。白守保持运行。

## 1. 打开 MCP 列表

左侧点 **Customize**，上方标签选 **MCPs**，再点 **New MCP Server**。

![Customize → MCPs → New MCP Server](/assets/images/docs/third-party/cursor/01.png)

## 2. 选 User 范围

弹出范围时选 **User**，不要选某个工作区。这样所有项目都能用。

![选择 User 范围](/assets/images/docs/third-party/cursor/02.png)

## 3. 写入 mcp.json

会打开 `%USERPROFILE%\.cursor\mcp.json`（macOS / Linux 是 `~/.cursor/mcp.json`）。在 `mcpServers` 里加上白守，URL 换成你 MCP 页上的地址：

```json
{
  "mcpServers": {
    "baishou": {
      "url": "http://127.0.0.1:31004/mcp"
    }
  }
}
```

同一台电脑用 `127.0.0.1`。白守若开了鉴权，再加 `headers.Authorization`。保存文件。

![mcp.json 中的白守配置](/assets/images/docs/third-party/cursor/03.png)

## 4. 确认已连上

回到 MCPs 列表，白守应显示为已连接，并写着 **14 tools enabled**。

![白守已连接且 14 个工具可用](/assets/images/docs/third-party/cursor/04.png)

若是 0 个工具：白守是否在运行、URL 是否 `/mcp` 结尾、鉴权令牌是否匹配。对照见 [MCP 服务](/docs/advanced/mcp/)。

## 5. 问一句日记里的事

新开对话，问「我最近吃了什么」。能列出日记里的饮食记录，就说明外部已经在用白守的工具。

![在 Cursor 中检索到日记](/assets/images/docs/third-party/cursor/05.png)
