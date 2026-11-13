---
title: Write diary
description: Create and edit diaries, weather/mood/tags, attachments, templates, and export.
---

The diary is BaiShou’s memory anchor. What your companions understand, the memory summaries, semantic search — all of it is built on what you keep writing. Without diaries, the whole memory system on top is empty.

This page is what a diary *is*, and how it connects to AI. To go from an empty setup to a working chat, see [Chat in ten minutes](/en/docs/getting-started/quick-start/).

Where to find it: “Diary” in the sidebar on desktop, “Diary” in the bottom bar on mobile.

## How to write

1. Create a diary; it defaults to today’s date.
2. Write in Markdown — both platforms give you a live-preview editing experience.
3. Fill in weather, mood, tags, and location while you’re at it, and favorite the entry if you like.
4. After saving, browse by year and month, or filter by favorites, weather, or mood.

Other things you’ll use often: change a diary’s date, delete a diary (you get a confirmation first), get warned about unsaved changes when you leave, export Markdown, and insert attachments (images are referenced from inside the Markdown).

## Save yourself work with templates

Under **Settings → Diary format** you can set up three templates: the one used when you create a diary, the one used when you append an entry, and the format a companion has to follow when it writes a diary for you.

Templates can use variables like `{time}`, `{date}`, and `{datetime}`.

## How diaries relate to AI

Intimate companions can read, write, and search your diaries through tools, as long as the matching tools are enabled in tool management.

Once a diary is saved, BaiShou automatically tries to embed it. If that fails, open the RAG page and click **Scan all unindexed diaries** to catch up — see [RAG memory](/en/docs/configure/rag/).

Diaries are also the raw material for everything from weekly journals to yearbooks; for how each layer reads the one below it, see [Memories & shared recall](/en/docs/basics/memories/).

## A few suggestions

Don’t force yourself to write an essay every day — two or three sentences count too. Tag or favorite the things that matter, so filtering and recall find them later. And check your backup strategy every once in a while, rather than remembering it after something goes wrong.
