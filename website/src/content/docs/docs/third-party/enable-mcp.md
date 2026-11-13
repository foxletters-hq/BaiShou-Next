---
title: 开启 MCP
description: 在白守里打开 MCP 服务，复制连接地址，再接到其他客户端。
---

白守可以在本机开一个 MCP 服务，把日记、回忆、记忆检索这些工具交给其他支持 MCP 的软件用。

方向先分清：**白守是服务端**。你在白守里打开服务、复制地址；在对方软件里填这个地址。白守里没有填 `mcpServers` 的地方。

这一节是实操。日记、回忆、伙伴分别是什么，见 [概念讲解](/docs/basics/diary/)。建议先走完 [十分钟聊起来](/docs/getting-started/quick-start/)，外部才能搜到你写过的内容。

白守要保持运行。桌面端和 Android 都可以开，Android 需要正式安装包。

## 在白守里打开

**设置 → MCP 服务**，打开 **启用 MCP 服务**。打开后应显示「运行中」和当前端口。

![MCP 服务已启用](/assets/images/docs/third-party/mcp-1.png)

*开关打开后，复制「连接地址」那一条，路径以 `/mcp` 结尾。*

页面上这几项以你屏幕为准，不要照抄截图里的 IP 和端口：

| 项目 | 怎么用 |
|------|--------|
| 端口 | 默认常见是 31004。开发版可能是 31005。截图里是 31006，以你页面上的数字为准 |
| 连接地址 | 推荐用这一条，必须是 `/mcp` 结尾 |
| 本机访问 | 同一台电脑上的客户端用 `127.0.0.1` |
| 局域网地址 | 手机或其他电脑来连，用设置页给出的局域网 IP |
| 启用鉴权 | 截图里是关的，本机这样就能连。打开之后，对方必须带访问令牌 |

:::caution[用 /mcp，不要用 /sse]
白守走 Streamable HTTP，路径是 `/mcp`。`/sse` 只是桌面端旧兼容，不推荐，移动端没有。填错通常就是连不上，或者一个工具都看不到。
:::

## 复制给对方软件的内容

点页面上的说明，或直接复制连接地址。对方软件要填的就是：

1. 以 `/mcp` 结尾的 URL
2. 若开了鉴权，再加 `Authorization: Bearer <访问令牌>`

下面是说明页里的示例。地址请换成你自己页面上的。

![MCP 连接说明](/assets/images/docs/third-party/mcp-2.png)

```json
{
  "mcpServers": {
    "baishou": {
      "url": "http://127.0.0.1:31004/mcp"
    }
  }
}
```

同一台机器用 `127.0.0.1`。截图里是局域网 IP，那是给别的设备连的。

开了鉴权时，在 `baishou` 里再加：

```json
"headers": {
  "Authorization": "Bearer 你的访问令牌"
}
```

令牌在 MCP 页复制。刷新过令牌，对方软件里也要改。

## 接到哪

按你实际在用的软件选一页跟着点：

- [Cursor](/docs/third-party/cursor/)
- [ChatGPT](/docs/third-party/chatgpt/)
- [Cherry Studio](/docs/third-party/cherry-studio/)
- [WorkBuddy](/docs/third-party/workbuddy/)

连上之后，用「我最近吃了什么」这类问题试。能读到日记，这一步就完成了。

工具清单、少工具、401、局域网连不上，见 [MCP 服务](/docs/advanced/mcp/) 对照页。

:::caution[地址加令牌就能读写日记]
不要把连接地址和令牌发到公开地方，也不要在不可信的网络里开放局域网访问。MCP 配置按设备保存在本地，不会跟着工作区同步。
:::
