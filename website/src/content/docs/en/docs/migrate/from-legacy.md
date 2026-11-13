---
title: Migrate from legacy BaiShou
description: Recommended order and caveats when upgrading from the Flutter legacy app to BaiShou-Next.
---

The legacy Flutter client is no longer maintained. The current product is BaiShou-Next (Electron on desktop plus Expo on mobile).

## Upgrading on mobile

On Android, if the package name matches, you can just install the new APK over the old one. But be clear about this: installing over the top doesn’t mean your data migrated itself — you still have to run the in-app **Version migration** once.

## Three rules for version migration

Import selectively, section by section, rather than dumping everything in at once.

Don’t delete the old data directory; if something goes wrong you can still go back and look.

Follow the order, and in particular put chat history after companions, or the mapping tends to come out wrong:

1. Global data: avatar, identity cards, config
2. Diaries for each workspace
3. Companions
4. Chat history

## A few things to do once you’re done

1. Restart the app if you’re prompted to.
2. Check that your diaries and companions are all there.
3. Confirm your [AI providers & models](/en/docs/configure/ai-providers/) are configured.
4. Go to the RAG page and run **Scan all unindexed diaries**. Inherited diaries usually need the vector store rebuilt — see [RAG memory](/en/docs/configure/rag/).
5. Make a [local full backup](/en/docs/sync/backup/).

## Don’t do these

Don’t delete the old directory or wipe storage before the migration is fully finished.

Don’t assume that “chat works” means RAG is ready — those are two different things.

Report problems in the BaiShou-Next repository; nobody is reading Issues on the old repo anymore.
