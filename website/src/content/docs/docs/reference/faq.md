---
title: 常见问题
description: 白守使用中的常见问题：免费、隐私、平台、模型、同步、RAG 与迁移。
---

## 白守是免费的吗

核心功能免费开源。日记、自建同步、自定义模型 API 都不依赖付费墙。如果之后有官方托管的同步、备份、AI 服务，那属于可选项。详见 [隐私与开源](/docs/reference/privacy/)。

## 数据存在哪里，安全吗

默认在本地设备上。同步和备份只会去你自己配置的远端，AI 请求只会发给你配置的模型商。详见 [工作区与数据位置](/docs/configure/workspace/) 和 [隐私与开源](/docs/reference/privacy/)。

## 支持哪些平台

官方有 Windows 和 Android。Linux 可以自己编译，暂时没有 iOS 和 macOS 客户端。详见 [安装与平台](/docs/getting-started/install/)。

## 和 Notion、Obsidian 有什么区别

笔记工具侧重整理和写作，白守侧重「AI 伙伴 + 回忆年轮 + RAG」这套长期记忆。详见 [白守是什么](/docs/getting-started/what-is-baishou/)。

## 模型怎么配

跟着界面点一遍见 [十分钟聊起来](/docs/getting-started/quick-start/)。**设置 → 供应商管理** 添加供应商，再到 **全局默认模型** 分别指定对话、总结、嵌入模型。对照说明见 [配置 AI 供应商与模型](/docs/configure/ai-providers/)。

## 伙伴不记得我写过的日记

先确认伙伴类型是亲密伙伴、嵌入模型配好了、RAG 没有未索引提示，然后做一次全量扫描。详见 [RAG 记忆管理](/docs/configure/rag/)。

## 增量同步和备份能混用吗

不能当成同一套机制用，云路径和覆盖范围都不一样。详见 [三种方式怎么选](/docs/sync/overview/)。

## 回忆、共同回忆、RAG 有什么区别

| 名词 | 一句话解释 |
|------|------------|
| 回忆年轮 | 周记、月报、季报、年鉴，默认每层只读下一层 |
| 共同回忆 | 把多层总结折叠聚合成可复制、可注入的一段内容 |
| RAG | 对日记做向量化的语义检索 |

详见 [回忆与共同回忆](/docs/basics/memories/) 和 [RAG 记忆管理](/docs/configure/rag/)。

## 从旧版怎么迁

覆盖安装后走应用内的版本迁移，推荐顺序见 [从旧版白守迁移](/docs/migrate/from-legacy/)。迁完记得重扫一次 RAG。

## 数据能导出吗

可以。Markdown 导出、全量 ZIP 备份、同步到自建 S3 或 WebDAV 都行，不锁平台。

## 客户端显示的费用准吗

只能当参考，最终以模型服务商的账单为准。

## 还有别的问题

- GitHub Issues：https://github.com/foxletters-hq/BaiShou-Next/issues
- 官网社群入口：[foxletters.com](/)
