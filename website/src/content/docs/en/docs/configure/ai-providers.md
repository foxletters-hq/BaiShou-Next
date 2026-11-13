---
title: AI providers & models
description: Provider management, global default models (chat / summary / Embedding / TTS), and security notes.
---

BaiShou doesn’t host your API keys — they only live in your local settings. If you have incremental sync turned on, keep in mind that the settings directory may get uploaded along with everything else.

:::tip[Want to click through the UI once]
See [Chat in ten minutes](/en/docs/getting-started/quick-start/). This page is the reference.
:::

## Setup order

1. Open **Settings → Provider management** and add a provider. OpenAI, Gemini, DeepSeek, Anthropic, and all kinds of OpenAI-compatible endpoints work.
2. Fill in the API Key, add a Base URL if you need one, tick the models you want to use, and optionally test connectivity first.
3. Open **Settings → Global default models** and assign each of the roles below.

Not sure where to get a key, or how the whole setup works? Apply on the provider’s site, or follow the walkthrough video:

| What you need | Where to go |
|---------------|-------------|
| DeepSeek API for chat / summary | [DeepSeek Platform](https://platform.deepseek.com/) |
| Embedding model | [SiliconFlow](https://siliconflow.cn/) |
| Step-by-step setup | [Bilibili walkthrough](https://www.bilibili.com/video/BV1FRuTzwEig) |

## What the four default model roles do

This is the step people skip most often, and it’s behind a lot of “why doesn’t X work?”

| Type | Where it’s used | What happens if you skip it |
|------|-----------------|-----------------------------|
| Chat model | Companion chat | No chatting |
| Memory summary model | Generating weekly journals through yearbooks | Memory generation fails |
| Embedding model | Vectorizing diaries and memories, RAG retrieval | Auto-embedding and semantic search misbehave |
| TTS model | Read-aloud | Only affects read-aloud |

A companion can also bind its own dedicated model; without one it falls back to the global chat model.

## What else lives on the provider side

Besides which models are enabled and their ordering, every model has a **Web search mode** with just two values: off, or go through the external tool (the default).

In other words, BaiShou’s web search always runs through its own search tool rather than relying on a model’s built-in search. For how to pick an engine, see [Web search & tools](/en/docs/advanced/tools-search/).

## Security notes

Keys stay on your machine. Once incremental sync is on, settings files containing keys can show up on the cloud target, so restrict permissions on that cloud storage and don’t sync from environments you don’t trust.

Chat, summary, and embedding requests all go straight to the model providers you configured. They don’t pass through BaiShou’s servers.

## Common failures

| Symptom | Usual cause |
|---------|-------------|
| Endless spinner, or a straight-up error | Wrong Key, Base URL, or model name; or an unpaid account or blocked network |
| Chat works but memories won’t generate | No memory summary model configured |
| The companion can’t find your diaries | No embedding model, or RAG hasn’t indexed yet — see [RAG memory](/en/docs/configure/rag/) |
| Retrieval went haywire after switching embedding models | You need to migrate the vector store — see [RAG memory](/en/docs/configure/rag/) |
