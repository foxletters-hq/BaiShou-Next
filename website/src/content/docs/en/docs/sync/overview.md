---
title: Which method to use
description: Incremental sync, full backup, LAN transfer, and Git version control — comparison and recommended scenarios.
---

BaiShou has several ways to “move your data somewhere else.” The names all look like sync, but what they’re for is quite different. Mixing up cloud paths, or getting the scope wrong, is the most common way people get burned.

## The four options side by side

| Method | What it does | When to use it | Watch out for |
|--------|--------------|----------------|---------------|
| Incremental sync | Aligns files incrementally, covering diaries, summaries, sessions, companions, attachments, and some settings | Keeping several devices continuously in sync with your own S3 / WebDAV | The cloud path differs from full backup, and it may include settings that contain keys |
| Data backup | Full ZIP export and import, or putting a full package in the cloud | New device, disaster recovery, periodic archives | Both the path and the scope differ from incremental — don’t treat them as one system |
| LAN transfer | Transfers the whole library between devices on the same Wi-Fi | Moving quickly between desktop and phone | Needs the same network; be careful not to reverse the direction |
| Version control | Desktop-side Git commits and pushes on the storage root | You want version history and rollback | Desktop only; complements incremental sync |

## Pick by what you need

If you just want a way out, use local full ZIP backups and copy them somewhere else regularly.

If two devices need to stay aligned day to day, use incremental sync to your own S3 or WebDAV, and on desktop it’s worth enabling Git as a safety net too.

If you only occasionally move to a new device or reinstall, import a full backup or transfer directly over the LAN.

On mobile, treat it as one-way backup, or be extra careful if you go both ways. Phones have more permission and background restrictions than desktops.

## One security reminder

The scope of incremental sync can include config directories like `.baishou/settings/`, and those may contain API keys. So:

- Use a private bucket or private WebDAV, with the least permission that works
- Never point the sync target at a publicly readable address
- On a shared computer, think the risk through before you sync
