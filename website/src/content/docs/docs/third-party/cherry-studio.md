---
title: 接到 Cherry Studio
description: 在 Cherry Studio 里快速创建白守 MCP，用对话读取日记。
---

先在白守里 [开启 MCP](/docs/third-party/enable-mcp/)，复制以 `/mcp` 结尾的连接地址。白守保持运行。

## 1. 打开设置

窗口右上角点齿轮。

![点右上角设置](/assets/images/docs/third-party/cherry-studio/01.png)

## 2. 进入 MCP 服务器并添加

左侧点 **MCP 服务器**，右上角 **+ 添加**，选 **快速创建**。

![MCP 服务器 → 添加 → 快速创建](/assets/images/docs/third-party/cherry-studio/02.png)

![选择快速创建](/assets/images/docs/third-party/cherry-studio/03.png)

## 3. 填 Streamable HTTP 和地址

在通用页填写：

| 项 | 填什么 |
|----|--------|
| 名称 | `白守` |
| 类型 | **可流式传输的 HTTP (streamableHttp)** |
| URL | 白守 MCP 页上的连接地址，`/mcp` 结尾 |

右上角开关打开，点保存。白守若开了鉴权，在 **请求头** 里加 `Authorization=Bearer 令牌`。

工具标签显示 **(14)** 就说明连上了。

![白守 MCP 通用配置](/assets/images/docs/third-party/cherry-studio/04.png)

## 4. 问一句日记里的事

回到对话，问「我最近吃了什么」。回复里若出现多次工具调用，并能列出日记内容，就说明已经接通。

![在对话中检索到日记](/assets/images/docs/third-party/cherry-studio/05.png)
