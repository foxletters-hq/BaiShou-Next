---
title: Workspaces & data location
description: Workspaces (Vault), storage root, Android BaiShou_Root, and data isolation notes.
---

## Workspaces

You can create several workspaces whose data is isolated from each other, which is handy for keeping life, projects, and testing apart. Day to day you’ll mostly create, switch, and delete them — and before deleting, make sure you have a backup.

What follows the workspace when you switch is your content: diaries, memory summaries, companions and chats, and attachments.

What tends to stay global and not follow the switch: theme and language, some AI and RAG configuration, your nickname and identity cards, and the workspace list and storage root itself.

The exact boundary depends on the settings in your version. If you’re not sure, take a [local full backup](/en/docs/sync/backup/) before you start moving things.

## Storage root

On desktop you pick the data directory during first-launch onboarding or in **Storage management**. Choose somewhere you have write permission, enough space, and an easy backup path.

Android has two options:

- The default is the app sandbox. Uninstalling the app can take your data with it, so back up regularly.
- You can also enable an external `BaiShou_Root`, which matches the desktop directory layout but usually needs an “All files access” style permission. Every vendor names that setting differently.

:::caution
Grant the minimum permissions you actually need. Be even more careful on a public or shared device.
:::

## How the data is stored

BaiShou leans toward saving your content in forms you can read and control locally, such as Markdown plus SQLite. Even so, keep the habit of exporting and backing up — don’t start from the assumption that “the cloud will look after it for me.”
