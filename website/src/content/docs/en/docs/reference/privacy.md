---
title: Privacy & open source
description: Local-first design, where data goes, open-source license, and pricing stance.
---

## What local-first means

Diaries and core business data are stored on your device by default.

Apart from the model APIs you configure yourself and the sync or backup remotes you point at, BaiShou doesn’t upload your diaries to “BaiShou’s own servers” to make basic features work.

## When data does leave your device

| What you did | Where the data goes |
|--------------|---------------------|
| Chatting with AI, generating summaries, embedding | The model providers you configured |
| Web search | The search engine service you chose; fetched page text also enters the model’s context |
| Incremental sync, cloud backup | The S3 / WebDAV you configured |

All of these are triggered by configuration you set up yourself. It’s worth reading the privacy policy of each service you use, and keeping the sync scope to what you actually need.

## How pricing works

The core capabilities are free and open source: diary, self-hosted sync, and custom model APIs have no paywall.

If official services show up later (encrypted sync, hosted backup, official AI, that sort of thing), they’re optional and you buy them as described on the website. Without paying you can still use everything fully, and you can take your data with you at any time.

## Open-source license

The project is released as open source, and the license in the repository’s `LICENSE` is authoritative (currently AGPLv3). Feedback via Issue or PR is welcome, and so are documentation improvements.
