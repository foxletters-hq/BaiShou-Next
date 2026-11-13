---
title: Backup & restore
description: Cloud backup, local ZIP, local snapshots, and LAN transfer usage notes.
---

When you need to “take the whole package with you” or “roll back when something goes wrong,” use backup, not incremental sync.

## What’s available

| Capability | Description |
|------------|-------------|
| Local ZIP backup | Export and import a complete backup package |
| Cloud backup | Put a full package on S3 or WebDAV, on a path separate from incremental sync |
| Local snapshots | Automatic protection before major operations; what triggers them depends on the version |
| LAN transfer | Whole-library transfer between devices on the same Wi-Fi |

## Habits worth having when exporting

Make a local ZIP regularly, and copy it to a second place — an external drive or another cloud drive. One copy isn’t a backup.

Back up before a major version upgrade or a migration.

Before importing, make sure the target device has enough space, and read the overwrite warnings all the way through.

## Things to watch when importing

An import can overwrite existing data, so don’t click through the prompts on autopilot.

Coming from the legacy version, use [Migrate from legacy BaiShou](/en/docs/migrate/from-legacy/) instead of expecting that unzipping a directory somewhere will do the job.

If your companions suddenly “lose their memory” after an import, go to the RAG page and run a [full scan](/en/docs/configure/rag/) — usually the vector store just hasn’t caught up.

## Attachments

**Attachment management** shows you diary attachments and session attachments, and can clean up orphaned files. Before cleaning, confirm nothing you still need is referenced.
