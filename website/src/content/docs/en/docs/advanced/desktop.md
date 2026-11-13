---
title: Desktop-only features
description: Global shortcuts, sidebar management, Git version control, and other desktop features.
---

The capabilities below exist only on desktop (Electron); mobile either lacks them or handles them differently. For the full comparison, see [Desktop vs mobile](/en/docs/reference/platforms/).

## Global shortcuts

You can configure global shortcuts in settings — by default Alt+S shows and hides the window. They fire from inside other apps too, which is handy when you want to jot something down the moment you think of it.

## Sidebar management

Customize which sidebar items are shown or hidden, and in what order. The ones visible by default usually include Diary, Memories, incremental sync, and version control.

## Git version control

On desktop you can run Git operations on the storage root: init, commit, push and pull, configure the remote and a token, and deal with conflicts.

It suits people who treat desktop as the primary library and want version history and a way back after a mistake. It works best paired with [Incremental sync](/en/docs/sync/incremental/).

:::tip[Don’t mix up the three concepts]
Git version control isn’t incremental sync, and it isn’t a full ZIP backup. For how the three divide the work, see [Which method to use](/en/docs/sync/overview/).
:::

## Local search engines

Desktop can borrow a hidden Electron window to scrape the Bing and Google results pages, so web search gets two extra options that need no API key: **Bing Local Search** and **Google Local Search**. Mobile doesn’t have them. See [Web search & tools](/en/docs/advanced/tools-search/).

## Other

Settings can be opened from the sidebar or as a full-screen settings page; the exact UI shifts between versions.

**About BaiShou** holds version info, the feedback entry, and diagnostic log export. Attaching a diagnostic log to an Issue makes things go a lot faster.
