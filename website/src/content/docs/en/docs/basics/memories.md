---
title: Memories & shared recall
description: Weekly journals, monthly reports, quarterly reports, yearbooks, plus shared memories and memory wake-up.
---

BaiShou has three things that sound almost the same but do different jobs. Sort them out first:

| Name | What it is |
|------|------------|
| Memory rings | Summary files that compress diaries layer by layer into weekly journals, monthly reports, quarterly reports, and yearbooks |
| Shared memories | Walks back through time and folds several summary layers into one block you can copy or inject |
| RAG semantic memory | Vectorizes your diaries for semantic search; a separate mechanism |

This page covers the first two. For RAG, see [RAG memory](/en/docs/configure/rag/).

Where to find it: “Memories” in the sidebar on desktop, “Memories” in the bottom bar on mobile.

## Memory rings

The default rule is simple: each layer only reads the layer directly below it.

| Level | Name | What it reads when generating |
|-------|------|------------------------------|
| Day | Diary | What you wrote by hand, not an AI summary |
| Week | Weekly journal | The diaries inside that week |
| Month | Monthly report | That month’s weekly journals by default; in settings you can switch to weekly journals plus that month’s diaries |
| Quarter | Quarterly report | That quarter’s monthly reports; it doesn’t read weekly journals or diaries directly |
| Year | Yearbook | That year’s quarterly reports; it doesn’t read monthly reports, weekly journals, or diaries directly |

Two things people trip over:

- A lower-level summary only counts as raw material if its entire span falls inside the target range. A week that straddles two months doesn’t count toward this month.
- Only the monthly report can “look one layer deeper.” Whether it reads that month’s diaries along with the weekly journals is decided by the monthly-report source switch under **Settings → Memory generation settings**.

The memories panel shows stats, an activity heatmap, and the memory gallery, and lets you run **Generate now** or **Generate all** for summary points that are missing; the tasks queue up in the background.

:::tip[You need a summary model first]
Generating memories uses the memory summary model, which is configured separately under global default models. If you only set a chat model and skip the summary model, generation will fail. See [AI providers & models](/en/docs/configure/ai-providers/).
:::

## Shared memories

Shared memories folds the memories from a past stretch of time into one block, based on the number of look-back months you set.

Click **Copy shared memories** and it goes to your clipboard (you can set a prefix), which is handy for pasting into an external AI or keeping your own archive. Generation settings also have toggles such as “inject shared memories before generating.”

This is what you want when you need to package up “here’s what happened lately” and take it somewhere else.

## Memory wake-up

While chatting with a companion, you can send it a summary of the past N months of memories so the conversation follows where your life has actually been going. The entry point lives in the memories and chat screens; its exact location shifts a little between versions.

## Memory generation settings

Under **Settings → Memory generation settings**, the options you’ll actually touch are:

- Which summary model to use, and with what prompt
- Whether to reuse the companion’s persona
- Monthly report source: that month’s weekly journals only, or weekly journals plus that month’s diaries
- Look-back months and cascade-fold behavior
- Whether to inject shared memories before generating
