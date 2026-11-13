---
title: RAG memory
description: Semantic search store, auto-embed, full scan, Embedding migration, and troubleshooting.
---

In the product this is called **RAG memory management**, and some screens label it “semantic search store.” Its job is to chunk and vectorize your diaries so companions can find specific passages by meaning.

If this is your first setup, start with [Chat in ten minutes](/en/docs/getting-started/quick-start/) to confirm the switch is on, an embedding model is assigned, and diaries are in the index. This page covers parameters, migration, and troubleshooting.

## It isn’t the same thing as “Memories”

| | Memory rings | RAG |
|--|--------------|-----|
| Form | Summary documents — weekly journals, monthly reports, and so on | Vector chunks plus a retrieval index |
| Purpose | Compress your life’s timeline | Pinpoint one specific passage |
| Who uses it | Generating and copying shared memories | Companions calling the semantic search tool |

The two run side by side without conflict: summaries handle the big picture, RAG handles the details.

## How diaries get into RAG

1. First configure an embedding model under global default models.
2. From then on, saving a diary automatically tries to embed it.
3. For anything missed or failed, open the RAG page and click **Scan all unindexed diaries** to fill the gaps.

You can also add memory snippets by hand and then look through them with semantic or full-text search.

The screen also shows things like the number of vector chunks, the dimensions, cache usage, and the diary vector count in the current workspace.

## Parameters you can tune

- Top-K recall count: how many chunks come back at once
- Similarity threshold: anything scoring below this isn’t a hit
- Recall truncation tokens: the length cap on what gets injected into context
- Batch embedding concurrency

When search comes up empty, the threshold is usually set too high.

## Switching embedding models means migrating

Different embedding models generally produce incompatible vector dimensions. After switching models, always run **Embedding model migration** as the client prompts you to; the flow gives you backup, continue, restore, and cancel options.

:::danger[Don’t skip the migration]
Forcing old vectors to work with a new model will leave your retrieval results scrambled or completely unusable.
:::

## How to debug a companion that “doesn’t remember”

Go in this order:

1. Is this an intimate companion? Are semantic search and the memory tools enabled? Work companions can’t use them by default.
2. Is the embedding model configured? Did the connectivity test pass?
3. Does the RAG page show anything unindexed or failed?
4. Did you just migrate from the legacy version? The diaries may be there while the vector store still needs a full rescan.
5. Is the similarity threshold too high? Lower it a bit, or raise Top-K, and try again.

For the difference between companion types, see [AI companions & chat](/en/docs/basics/companions/).
