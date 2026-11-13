---
title: Incremental sync
description: Scope and flow of incremental sync, differences from full backup, and risk notes.
---

Incremental sync aligns files incrementally between your devices and your own cloud (S3 or WebDAV). It transfers what changed, not the whole package.

## Running it once

1. Configure the remote: endpoint, bucket or path, credentials.
2. Click **Preview plan** and see exactly which files this run will touch.
3. Once it looks right, run the sync.

Before your first run, it’s worth reading the sync notes and risk warnings inside the client.

The sync scope usually covers diaries, memory summaries, sessions, companions, attachments, some settings directories, and workspace registry info.

:::caution[This is not the same system as full backup]
- The cloud paths are separate by default; incremental typically uses a directory like `memories_sync`.
- The scope differs too — whether the full database and vector cache are included isn’t the same.
- Never point both features at the same directory and let them overwrite each other.

For the differences, see [Which method to use](/en/docs/sync/overview/).
:::

## Per-platform advice

On desktop you can run bidirectional sync without worrying much, and it’s worth keeping [Git version control](/en/docs/advanced/desktop/) on so you can roll back.

On mobile both the network and the permissions are more fragile, so always check the preview plan first. If you hit a conflict, back up before syncing.

Also, don’t let app versions on your devices drift too far apart — that’s a good way to get strange problems.

## Your keys travel with it

If the sync scope includes the settings directory, your API keys can end up in the cloud. Restrict access to that bucket or directory, and don’t pull your full config down onto a device you don’t trust.
