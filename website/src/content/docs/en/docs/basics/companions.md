---
title: AI companions & chat
description: Latte, intimate vs work companions, session features, and common settings.
---

Where to find it: the companion and chat area on desktop, “Companions” in the bottom bar on mobile.

After your first launch there’s already one companion, Latte, the mascot. You can create more, and each one has its own persona and model configuration. For Latte’s character sheet and factory prompt, see [Mascot Latte](/en/docs/basics/latte/).

## Get the companion types straight first

When you create a companion you pick a type, and that decides whether it can touch your diary. Pick the wrong one and you end up wondering “why won’t they write my diary for me?”

| | Intimate companion | Work companion |
|--|--------------------|----------------|
| Role | Company, writing diaries, talking about memories | Getting things done and thinking out loud, while staying away from private material |
| Diary tools | Can read and write, as long as the tools are enabled | Cannot read or write diaries or the memory store |
| Memory & semantic search | Available | The related tools are disabled |

## What you can configure per companion

- Name, bio, avatar (built-in or your own upload)
- System prompt, which is where the persona lives
- A dedicated model binding; without one it uses the global default chat model
- Set as default, pin to the top of the sidebar (desktop)
- Context turns, either limited or unlimited
- Auto-compress: token threshold, turns to keep, and the prompt used for compressing
- Sticker pack toggle

## What you can do in a conversation

For session management: create, rename, browse, and tidy up your session list, and switch companion or model whenever you want.

Replies stream in, and you can watch the thinking and the tool calls, depending on the model and your settings.

Messages can be copied, regenerated, and resent, and you can **Branch from here** to fork a new conversation line off any message.

There are also quick commands, a per-session web search toggle (the search tool still has to be enabled globally in settings), TTS read-aloud (off / always read / manual), custom chat backgrounds, and sending and receiving attachments.

## Identity cards

In settings you can maintain your own nickname and avatar, and build several identity cards — one for work, one for travel, say — describing yourself as key-value entries.

Inject an identity card into a conversation and the companion gets much more consistent about what to call you and what it knows about your background.

## The companion “doesn’t remember” what I wrote

Work through this in order:

1. Have you written enough diaries? If there’s very little content, there really isn’t much to find.
2. Is this an intimate companion? Are the diary and memory tools enabled?
3. Are the embedding model and RAG healthy? Any unindexed warnings? See [RAG memory](/en/docs/configure/rag/).
4. Do you need memory wake-up or shared memories to inject a longer stretch of summaries directly? See [Memories & shared recall](/en/docs/basics/memories/).
