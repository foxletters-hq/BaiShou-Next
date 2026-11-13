---
title: FAQ
description: Common BaiShou questions — free use, privacy, platforms, models, sync, RAG, and migration.
---

## Is BaiShou free?

The core features are free and open source. Diary, self-hosted sync, and custom model APIs don’t depend on a paywall. If officially hosted sync, backup, or AI services show up later, they’re optional. See [Privacy & open source](/en/docs/reference/privacy/).

## Where is my data stored, and is it safe?

On your local device by default. Sync and backup only go to remotes you configured yourself, and AI requests only go to the model providers you configured. See [Workspaces & data location](/en/docs/configure/workspace/) and [Privacy & open source](/en/docs/reference/privacy/).

## Which platforms are supported?

Officially, Windows and Android. You can compile Linux yourself; there’s no iOS or macOS client for now. See [Install & platforms](/en/docs/getting-started/install/).

## How is it different from Notion or Obsidian?

Note-taking tools lean toward organizing and writing; BaiShou leans toward long-term memory built out of AI companions, memory rings, and RAG. See [What is BaiShou](/en/docs/getting-started/what-is-baishou/).

## How do I configure models?

To click through the UI once, see [Chat in ten minutes](/en/docs/getting-started/quick-start/). Add a provider under **Settings → Provider management**, then go to **Global default models** and assign the chat, summary, and embedding models. Reference: [AI providers & models](/en/docs/configure/ai-providers/).

## My companion doesn’t remember the diaries I wrote

First check that the companion type is intimate companion, that the embedding model is configured, and that RAG isn’t showing unindexed warnings — then run a full scan. See [RAG memory](/en/docs/configure/rag/).

## Can I use incremental sync and backup interchangeably?

No — don’t treat them as one mechanism; the cloud paths and the scope are both different. See [Which method to use](/en/docs/sync/overview/).

## What’s the difference between memories, shared memories, and RAG?

| Term | In one line |
|------|-------------|
| Memory rings | Weekly journals, monthly reports, quarterly reports, yearbooks; by default each layer only reads the one below |
| Shared memories | Folds several summary layers into one block you can copy or inject |
| RAG | Semantic search over vectorized diaries |

See [Memories & shared recall](/en/docs/basics/memories/) and [RAG memory](/en/docs/configure/rag/).

## How do I migrate from the legacy version?

Install over the old app, then run the in-app version migration; the recommended order is in [Migrate from legacy BaiShou](/en/docs/migrate/from-legacy/). Remember to rescan RAG when you’re done.

## Can I export my data?

Yes. Markdown export, full ZIP backup, and sync to your own S3 or WebDAV all work. You’re not locked to the platform.

## Are the costs shown in the client accurate?

Treat them as a rough guide only; your model provider’s bill is what counts.

## Still have questions?

- GitHub Issues: https://github.com/foxletters-hq/BaiShou-Next/issues
- Community links on the website: [foxletters.com](/)
