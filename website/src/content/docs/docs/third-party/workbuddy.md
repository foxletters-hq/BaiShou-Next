---
title: 接到 WorkBuddy
description: 在 WorkBuddy 里用自定义连接器写入白守 MCP，用对话读取日记。
---

先在白守里 [开启 MCP](/docs/third-party/enable-mcp/)，复制以 `/mcp` 结尾的连接地址。白守保持运行。

## 1. 打开连接器

左侧点 **专家·技能·连接器**，弹出菜单里选 **连接器**。

![专家·技能·连接器 → 连接器](/assets/images/docs/third-party/workbuddy/01.png)

## 2. 自定义连接器

右上角点 **自定义连接器**。

![自定义连接器](/assets/images/docs/third-party/workbuddy/02.png)

## 3. 进入 MCP 配置

在 **MCP 服务管理** 里点 **配置**。

![MCP 服务管理 → 配置](/assets/images/docs/third-party/workbuddy/03.png)

## 4. 写入 mcp.json 并保存

编辑器打开的是本机 `mcp.json`。写入白守，URL 换成你 MCP 页上的地址，然后点 **保存**：

```json
{
  "mcpServers": {
    "baishou": {
      "url": "http://127.0.0.1:31004/mcp"
    }
  }
}
```

同一台电脑用 `127.0.0.1`。白守若开了鉴权，再加 `headers.Authorization`。

![保存 mcp.json](/assets/images/docs/third-party/workbuddy/04.png)

## 5. 确认工具已启用

回到 MCP 服务管理，白守应显示已启用，工具为 **14/14 个工具已启用**。

![14 个工具已启用](/assets/images/docs/third-party/workbuddy/05.png)

## 6. 问一句日记里的事

回到助理对话，说「从白守看看，我最近吃了什么」。能列出日记里的饮食记录，就说明已经接通。

![从白守读到饮食记录](/assets/images/docs/third-party/workbuddy/06.png)
