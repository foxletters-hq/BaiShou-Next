---
title: MCP 服务
description: 开启白守的 MCP 服务，让 Cursor、Claude Desktop 等外部客户端调用你的日记与记忆工具。
---

白守可以在本机启动一个 MCP 服务，把日记、回忆、记忆检索这些工具暴露出去，让支持 MCP 的外部客户端直接调用。

跟着界面点一遍见 [开启 MCP](/docs/third-party/enable-mcp/)。本页是地址、工具清单和排障对照。

方向要先搞清：**白守是 MCP 服务端**。它把自己的能力提供给外部 AI，不是用来接入别人的 MCP 服务器。所以你在白守里找不到填 `mcpServers` 的地方，那是客户端侧的事。

桌面端和 Android 都支持，两边都需要保持白守应用在运行。

## 开启

进 **设置 → MCP 服务**，打开 **启用 MCP 服务**。

| 项目 | 说明 |
|------|------|
| 端口 | 默认 31004，可改成 1000 到 65535 之间任意端口。开发版默认用 31005 避免和正式版撞 |
| 连接地址 | `http://127.0.0.1:31004/mcp` |
| 访问令牌 | 首次启用时自动生成，可以随时点刷新重新生成 |

设置页里会同时显示本机地址和局域网地址。同一台机器上的客户端用 `127.0.0.1`，别的设备连过来就用局域网 IP。

:::caution[用 /mcp，不要用 /sse]
白守走的是 Streamable HTTP 传输，路径是 `/mcp`。桌面端还留了一个 `/sse` 的旧版兼容端点，已经不推荐用了，移动端根本没有。填错路径的表现通常就是连不上或者拿不到工具。
:::

## 在客户端里配

以 Cursor 为例，编辑 `~/.cursor/mcp.json`（Windows 是 `%USERPROFILE%\.cursor\mcp.json`）。完整点击步骤见 [接到 Cursor](/docs/third-party/cursor/)。

```json
{
  "mcpServers": {
    "baishou": {
      "url": "http://127.0.0.1:31004/mcp",
      "headers": {
        "Authorization": "Bearer 你的访问令牌"
      }
    }
  }
}
```

令牌从白守设置页复制。改了端口就同步改 URL；连手机上的白守就把 host 换成手机 IP。

其他 MCP 客户端的配置文件位置不同，但要填的东西就这两样：`/mcp` 结尾的 URL，加一个 `Authorization: Bearer` 头。

## 会暴露哪些工具

一共 14 个，对外的名字统一带 `baishou_` 前缀。

| 工具名 | 做什么 | 主要参数 |
|--------|--------|----------|
| `baishou_diary_read` | 按日期读日记全文，一次最多 20 篇 | `dates` |
| `baishou_diary_write` | 在指定日期新建日记 | `date`, `content`, `tags` |
| `baishou_diary_edit` | 追加或整篇覆盖已有日记 | `date`, `content`, `mode` |
| `baishou_diary_delete` | 删除指定日期的日记 | `date` |
| `baishou_diary_list` | 列出某段日期内有日记的日子和预览 | `start_date`, `end_date` |
| `baishou_diary_search` | 全文关键词搜日记 | `query`, `limit` |
| `baishou_summary_read` | 读周记、月报、季报、年鉴 | `type`, `start_date` |
| `baishou_message_search` | 跨会话关键词搜历史消息 | `query`, `limit` |
| `baishou_vector_search` | 语义或混合检索记忆 | `query`, `mode`, `min_score` |
| `baishou_memory_store` | 写入长期记忆 | `content`, `tags` |
| `baishou_memory_delete` | 搜到后删除记忆 | `query` |
| `baishou_web_search` | 联网搜索，一次 1 到 3 条查询 | `queries` |
| `baishou_url_read` | 抓取指定网页正文 | `url`, `query` |
| `baishou_current_time` | 获取当前真实时间 | 无 |

外部客户端和白守内部的伙伴用的是同一套工具，所以行为完全一致。

表情包发送和上下文压缩属于内部工具，不会暴露出去。

## 工具列表比预期少？

外部看到的工具是动态过滤的，和你在白守里的设置直接相关：

- 在 **设置 → 工具管理** 里关掉的工具，MCP 这边也不会出现。
- 关了 RAG 或者没配嵌入模型，`baishou_vector_search` 和 `baishou_memory_store` 会消失。
- 会话工具栏的联网搜索没开，`baishou_web_search` 不会暴露。
- `baishou_current_time` 不能被关闭，永远在。

另外 MCP 操作的始终是**当前活跃的工作空间**。切了工作区，外部客户端读到的数据也跟着变。

## 排障

| 现象 | 检查什么 |
|------|----------|
| 连不上 | 白守在运行吗；地址是不是 `/mcp` 结尾；端口有没有被别的程序占用或被防火墙拦 |
| 401 | 令牌对不对。刷新过令牌的话，客户端那边也要同步更新 |
| 一个工具都没有 | MCP 开关是不是没打开 |
| 少了几个工具 | 见上一节的动态过滤规则 |
| 局域网连不上 | 用局域网 IP 而不是 `127.0.0.1`，并确认两台设备在同一网络 |
| 手机上没有 MCP 选项 | 需要包含原生模块的正式 APK，Expo Go 里用不了 |

## 安全

:::caution[令牌就是你日记的钥匙]
拿到令牌加地址，对方就能读写你的日记和记忆。所以别把令牌贴到公开地方，也别在不可信的网络里开放局域网访问。

MCP 配置按设备本地保存，不会跟着工作区同步，各台设备的令牌是独立的。
:::
