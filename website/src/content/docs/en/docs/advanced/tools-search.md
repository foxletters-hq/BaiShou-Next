---
title: Web search & tools
description: The built-in tool list, the layers of switches, search engine configuration, and common failures.
---

Besides chatting, companions can call tools to read and write diaries, retrieve memories, and search the web. This page covers which tools exist, which layers the switches hide in, and how to pick a search engine.

## The built-in tools

You’ll find them under **Settings → Tool management**, listed by category.

| Category | Tool | What it does |
|----------|------|--------------|
| Diary | Read Diary | Reads full entries by date, up to 20 at a time |
| Diary | Write Diary | Creates a new diary on a given date |
| Diary | Edit Diary | Appends or overwrites the whole entry; append is the default |
| Diary | Delete Diary | Deletes the diary on a given date; not recoverable |
| Diary | List Diaries | Lists the days that have diaries in a date range |
| Diary | Search Diary | Local full-text keyword search |
| Summaries | Read Summary | Reads weekly journals, monthly reports, quarterly reports, and yearbooks |
| Memory | Search Messages | Searches chat history across sessions |
| Memory | Semantic Search | Vector or hybrid retrieval to find relevant passages |
| Memory | Store Memory | Writes content into long-term vector memory |
| Memory | Delete Memory | Deletes memories after matching them semantically |
| Search | Web Search | Searches the web, 1 to 3 queries per call |
| Search | Read Webpage | Fetches the body text of a given URL |
| General | Get Current Time | Gets the real current time; this one can’t be turned off |

The tool management page also has an **Auto inject time** item, which isn’t a tool: it only controls whether the current time is added to the system prompt automatically. It’s off by default.

Sending stickers counts as a companion capability rather than a tool, and is managed in the sticker settings.

## The switches come in four layers

“Why won’t my companion use that tool?” almost always comes down to one of these four layers. Check them from the top down:

1. **Tool management (global)**: anything you switch off here, no companion can use.
2. **Companion type**: work companions automatically disable every diary, summary, memory, and semantic search tool, leaving only things like web search, webpage read, and time. That’s by design, not a bug — see [AI companions & chat](/en/docs/basics/companions/).
3. **RAG toggle and embedding model**: with RAG off or no embedding model configured, semantic search and memory store are flatly unavailable.
4. **Per-session web toggle**: the search button in the chat input bar. If it’s off, the web search tool never gets handed to the model, and the companion answers with “Web search not enabled. Please enable it in the toolbar.”

Layer 4 is the one people miss, because it and the web search entry in tool management are two independent switches. You need both.

## Choosing a search engine

Pick your engine in the web search settings. The default is Exa MCP, which works without any key.

| Engine | Needs an API Key | Notes |
|--------|------------------|-------|
| Exa MCP | No | The default; works out of the box |
| DuckDuckGo | No | Scrapes the HTML results page; gets rate-limited occasionally |
| Tavily API | Yes | A search API built for AI |
| Exa API | Yes | Exa’s official API, more controllable than the MCP route |
| AnySearch API | Yes | For mainland China; defaults to the Chinese region |
| Bing Local Search | No | Uses your local browser to scrape Bing’s results page; desktop only |
| Google Local Search | No | Same idea; desktop only |

Mobile doesn’t have the two local search options, only the first five.

When the primary engine fails, BaiShou automatically falls back to other engines whose keys are configured and retries. The two local searches don’t fall back, though — if they fail, you get an error.

## Search parameters you can tune

| Parameter | Default | Notes |
|-----------|---------|-------|
| Max Results | 5 | How many results come back per query, up to 30 |
| RAG Vector Compression | Off | When on, fetched pages get chunked and compressed down to the relevant parts |
| Total Max Chunks | 12 | With compression on, the most chunks kept in one call |
| Max Chunks per Source | 4 | Keeps one site from eating the entire budget |
| Plain Text Snippet Length Limit | 3000 | Without RAG compression, how many characters are kept per page |

Too few results? Raise the max results. Web content blowing up your context? Turn on RAG compression, or shorten the snippet length.

:::note[Search sends your content out]
Search requests go to the search service you chose, and page text ends up in the model’s context. That means extra cost and extra privacy exposure, so turn it on when you actually need it.
:::

## TTS and stickers

**TTS speech synthesis** can use OpenAI-compatible endpoints, Xiaomi MiMo, MiniMax, a local GPT-SoVITS, and more. Once it’s set up, pick off, always read, or manual in the conversation.

**Sticker settings** is where you manage sticker packs, then decide per companion which packs are enabled.

## Common failures

| Symptom | Cause |
|---------|-------|
| The companion says “Web search not enabled” | The search toggle in the session toolbar is off |
| Search returns API key is missing or invalid | You chose an engine that needs a key and left it empty, or got it wrong |
| A message says the embedding model isn’t configured, so memory can’t be stored | Set an embedding model under global default models, see [AI providers & models](/en/docs/configure/ai-providers/) |
| A message says the diary index isn’t ready | Run a full scan on the RAG page, see [RAG memory](/en/docs/configure/rag/) |
| The companion never calls tools at all | Most likely the model itself doesn’t support function calling; switch to one that does |
| Webpage read says the content isn’t accessible | The target site blocks scrapers or requires a login; find another source |
