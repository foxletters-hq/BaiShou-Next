---
title: 接到 ChatGPT
description: 在 ChatGPT 里添加白守为自定义 MCP，用对话读取日记。
---

先在白守里 [开启 MCP](/docs/third-party/enable-mcp/)，复制以 `/mcp` 结尾的连接地址。白守保持运行。

## 1. 打开设置

左下角头像菜单点 **设置**（快捷键 `Ctrl+,`）。

![打开设置](/assets/images/docs/third-party/chatgpt/01.png)

## 2. 添加 MCP 服务器

左侧进 **插件**，切到 **MCP** 标签，点右上角 **添加**，选 **添加 MCP 服务器**。

![插件 → MCP → 添加 MCP 服务器](/assets/images/docs/third-party/chatgpt/02.png)

## 3. 填名称、类型和地址

1. **名称** 填 `白守`。
2. **类型** 选 **流式 HTTP**，不要选 STDIO。
3. **URL** 贴白守 MCP 页上的连接地址，以 `/mcp` 结尾。
4. 点 **保存**。

白守若开了鉴权，再填 Bearer 令牌或请求头；截图里鉴权是关的，这两项可以空着。

![连接至自定义 MCP](/assets/images/docs/third-party/chatgpt/03.png)

## 4. 问一句日记里的事

回到对话，直接说「用白守 mcp，看看我最近吃了什么」。能列出日记里的记录，就说明已经接通。

![用白守 MCP 查到饮食记录](/assets/images/docs/third-party/chatgpt/04.png)
