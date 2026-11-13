---
title: First launch
description: Onboarding steps when you first open BaiShou — language, storage, API, and privacy.
---

The first time you open BaiShou it walks you through onboarding, about seven steps. You can change everything later in settings, but it’s worth getting the language and the storage location right from the start.

## What onboarding asks you

| Step | What you are doing |
|------|--------------------|
| Choose language | The UI language. The default companion Latte is also created in this language |
| Welcome | Get to know BaiShou |
| Write our memories | Explains that diaries are the anchor for the whole memory system |
| Copy shared memories | Explains where weekly journals, monthly reports, quarterly reports, and yearbooks come from |
| Choose storage location | Where your data lives |
| API / providers | You bring your own model keys; you can skip this |
| Protect your privacy | Notes on local processing |

When you’re done you land in the main UI, and you already have one companion: the mascot, Latte.

## Choosing a storage location

On desktop, just pick a folder you’ll remember and can back up easily as the storage root.

On Android the default is the app sandbox. If you want the same directory layout as desktop, you can enable an external `BaiShou_Root`, which usually requires broader storage permission.

For the differences and the risks of each, see [Workspaces & data location](/en/docs/configure/workspace/).

## Can I configure the API later?

Yes — just skip it during onboarding. Afterwards, follow [Chat in ten minutes](/en/docs/getting-started/quick-start/) to configure a provider, pick models, and turn on RAG so you can start talking.

Just know what you’re missing in the meantime: without a chat model, companions can’t talk to you; without an embedding model, automatic diary embedding and semantic search won’t work properly. For the full reference, see [AI providers & models](/en/docs/configure/ai-providers/).

## Upgrading from the legacy version

If you installed over the legacy Flutter BaiShou, you may see a **Version migration** prompt after launch. Follow [Migrate from legacy BaiShou](/en/docs/migrate/from-legacy/) step by step, and don’t delete the old data directory yet.
