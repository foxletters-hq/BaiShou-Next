---
title: Chat in ten minutes
description: Configure a provider, pick models, turn on RAG, write a diary, and talk to your companion.
---

This page does one thing: take you from an empty setup to “the companion can answer from your diary.” The order is fixed — keys, models, confirm RAG, write one entry, then ask.

Screenshots are from the Chinese desktop UI. Android uses the same menu names; open **Settings** from the bottom tab.

Sync, TTS, web search, MCP, custom companions, and memory rings are out of scope. You can skip API setup during onboarding and come back here.

## What you need

BaiShou does not host your keys. You need two kinds of models: one for chat, and one that turns diaries into searchable vectors.

| Job | Where to get it |
|-----|-----------------|
| Chat, summaries, session titles | [DeepSeek Platform](https://platform.deepseek.com/) |
| Embeddings (RAG) | [SiliconFlow](https://siliconflow.cn/) |

One provider that offers both chat and embeddings is fine — then you only configure one. The walkthrough below uses DeepSeek + SiliconFlow, which is a common pairing.

## 1. Open Settings

Click **System settings** at the bottom of the sidebar. If you already pinned **Provider management** to the sidebar, you can open that directly.

![System settings at the bottom of the sidebar](/assets/images/docs/quickstart/01.png)

*Bottom of the sidebar: **System settings**. New installs may not show provider entries in the main sidebar, so Settings is the reliable path.*

## 2. Get a chat API key

Open the [DeepSeek Platform](https://platform.deepseek.com/), go to **API keys**, and click **Create API key**. The full key is shown only once at creation. Copy it, then paste it in BaiShou.

![DeepSeek Platform API keys page](/assets/images/docs/quickstart/04.png)

*Create the key in the DeepSeek console. Never share the full key.*

## 3. Configure DeepSeek

Open **Settings → Provider management** and select **DeepSeek** on the left.

1. Turn the switch on in the top right. Off means unused.
2. Paste the key into API configuration. You usually leave the Base URL as-is.
3. Click **Fetch models** and enable the chat models you want.
4. Click **Test connection**. In the dialog, pick a chat model — not Embedding, Rerank, or TTS.
5. Click **Save changes** at the bottom. This is the step people skip.

![DeepSeek in Provider management](/assets/images/docs/quickstart/02.png)

![Fetch models first, then test the connection](/assets/images/docs/quickstart/03.png)

*Follow the 1 and 2 on the screenshot: fetch and enable models, then test. An empty list means the test has no chat model to call.*

## 4. Get an embedding API key

Open [SiliconFlow](https://siliconflow.cn/), complete identity verification, then create a key under **API Key** in account management.

You enable the embedding model later inside BaiShou. You do not turn on RAG on the website.

![SiliconFlow console: verify identity, then get an API key](/assets/images/docs/quickstart/05.png)

*Verify first, then open **API Key**. The model gallery is only a catalog; enabling happens in BaiShou.*

## 5. Configure SiliconFlow

Back in **Provider management**, select **SiliconFlow** and repeat: switch on → paste the key → **Fetch models** → enable only an embedding model → **Save changes**.

The list can be dozens or hundreds of models. Search for names containing `embed` / `embedding`, for example `Qwen/Qwen3-Embedding-8B`. You do not need to enable chat models here.

![SiliconFlow with an embedding model enabled](/assets/images/docs/quickstart/06.png)

:::caution[Chat models and embedding models are not the same]
If you only configure DeepSeek and skip embeddings, companions can chat but cannot find diary details. Semantic search needs an embedding model.
:::

## 6. Assign global default models

Open **Settings → Global default models**. Only models you enabled on a provider show up here.

| Card | Required? | What to pick |
|------|-----------|--------------|
| Default chat model | Required | A DeepSeek chat model |
| Embedding model | Required | The SiliconFlow embedding model |
| Memory summary model | Recommended | Can be the same provider as chat |
| Default naming model | Optional for later | A small model is enough for session titles |

Click the selector on each card. The embedding card is the one people miss; the UI also highlights it.

![All four global default models assigned](/assets/images/docs/quickstart/07.png)

TTS lives on another page — skip it for now. If you see **Switch embedding model?**, new users with no old vectors can confirm. Do not switch casually once diary vectors exist; see [RAG memory](/en/docs/configure/rag/).

## 7. Confirm RAG is on

Open **Settings → RAG memory**.

- The switch next to the title is on. It defaults to on; turning it off shows a “RAG is off” notice.
- The **Model:** label under the title should be the embedding model you just chose, not **Not configured (click to go)**.
- Diary vector count can still be 0. You write a diary next.
- Leave **Retrieval parameters** alone. A threshold that is too high returns nothing.

![RAG on, embedding model shown](/assets/images/docs/quickstart/08.png)

## 8. Write a diary

Close settings and click **+ Write diary**. Leave something you can ask about later — what you ate, where you went, how you felt — then save.

Saving tries to embed automatically. If that fails, the UI tells you to finish the job on the RAG page.

![Diary list with entries](/assets/images/docs/quickstart/09.png)

## 9. Confirm the diary is in the index

Open **RAG memory** again. If **Diary vectors** is still 0, click **Full scan of unindexed diaries**. When the list below shows the diary and **Diary vectors** is greater than 0, you are done.

![Diary vectors appearing in RAG](/assets/images/docs/quickstart/10.png)

You can also switch the search box to **Semantic search** and try a word from the diary. A hit means embeddings are working.

## 10. Ask Latte

Open the **Companion** tab. The default companion is **Latte**, type **Intimate companion**. Start a new chat and ask about the diary, for example “What have I eaten lately?”

If the reply expands **Diary search** and **Semantic search**, retrieval is working.

![Asking Latte and retrieving diary entries](/assets/images/docs/quickstart/11.png)

:::tip[It has to be an intimate companion]
Work companions cannot read or write diaries, and they cannot use semantic search. That is by design. See [AI companions & chat](/en/docs/basics/companions/).
:::

The chat model needs tool calling. Newly written vectors can take a few seconds; if nothing comes back, ask again or check the vector count on the RAG page.

## Easy to miss

1. The provider switch in the top right is off.
2. You fetched models but did not enable any.
3. You never clicked **Save changes**.
4. Global defaults have chat but no **embedding model**.
5. The RAG switch next to the title is off.
6. You ask “do you remember me?” before writing a diary.
7. You ask a work companion about diaries.

## Next

- Writing diaries more steadily: [Write diary](/en/docs/basics/diary/)
- Providers, the four model roles, and troubleshooting: [AI providers & models](/en/docs/configure/ai-providers/)
- Switching embeddings, parameters, and full scans: [RAG memory](/en/docs/configure/rag/)
- Companion types, tools, and “doesn’t remember”: [AI companions & chat](/en/docs/basics/companions/)
