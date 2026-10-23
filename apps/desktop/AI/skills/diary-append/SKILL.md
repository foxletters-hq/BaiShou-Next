name: diary-append
description: "Append events from today's or recent AI conversations into the personal diary (append-only, deduplicated, ordered by event time). Use when the user asks to backfill/append to their diary or invokes /diary-append."
bundledHash: d39711c4

# Personal Diary Append

Use the diary tools (or diary MCP tools) to **append** events from the conversation into the user's personal diary. Append-only, no duplicates, ordered by actual event time.

Keep following the persona rules when speaking to the user. This skill governs **how to append to the diary**.

## Language Rule

- This skill specification is written in English, and the host invocation header may contain Chinese text. Do **not** let the language of this skill file or the invocation wrapper dictate your output language.
- Always write diary headings, tags, body paragraphs, and your final confirmation reply in the **user's language** (matching the existing diary language, the user's conversation language, or the App UI locale).

## When to Use

- The user asks (in any language) to append to the diary, record today's chat in the diary, backfill the diary, or invokes `/diary-append`
- Recording events from today's or recent conversations into the personal diary
- Backfilling events that belong to yesterday or an earlier date

## Hard Rules

1. **Read before write**: Always call `diary_read` (or `baishou_diary_read` / `diary_list`) on the target date first and inspect the existing body before deciding what to write. If today's diary does not exist yet, or if the conversation spans yesterday / midnight, also read yesterday's diary first to check whether anything belongs in yesterday's entry or was already recorded there.
2. **No duplicates**: Never write an event, opinion, or detail a second time if it is already covered. Semantic duplicates count as duplicates.
3. **Never modify existing text**: Do not rewrite, trim, or polish existing paragraphs. Never touch old paragraphs just to make them flow better.
4. **Append missing facts only**: Only add events or concrete facts from the conversation that are not yet in the diary.
5. **Chronological order**: Insert new paragraphs by **actual event time**, not by dumping everything at the bottom under the current timestamp.
6. **Skip routine context**: Do **not** record routine payloads pasted by the user such as shared memory packs, period summaries, or sync confirmations.
7. **Tags in body only**: Put `#tag` lines inside the paragraph body. When calling `diary_write` / `diary_edit`, **do not pass the `tags` parameter** so tags are not written into YAML frontmatter.
8. **Detail vs. brevity**: A personal diary is not a work changelog. Follow the "Detail Standard" below for what to expand and what to summarize in one sentence.
9. **Dedicated H6 time heading per event**: Every event must be its own paragraph with its own `###### HH:MM - Title` heading. Never group multiple distinct events under a single current-time H6 heading, and never replace the H6 time heading with bold text, bullet lists, or other heading levels.

## Tool Usage

| Scenario                                    | Tool (Built-in / MCP)                                                                                       |
| ------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Check current local date & time             | `current_time` / `baishou_current_time` (use the local timezone of the personal diary)                      |
| Check if a date already has a diary         | `diary_list` / `baishou_diary_list` or `diary_read` / `baishou_diary_read`                                  |
| Create a new diary for a date               | `diary_write` / `baishou_diary_write`                                                                       |
| Append at the end (only when order allows)  | `diary_edit` / `baishou_diary_edit` with `mode: "append"`                                                   |
| Insert or append in time order (default)    | `diary_edit` / `baishou_diary_edit` with `mode: "overwrite"`, keeping **every existing paragraph verbatim** |
| Check whether an event was already recorded | `diary_search` / `baishou_diary_search`                                                                     |

- Target date already has a diary → Use `diary_edit` only, defaulting to `mode: "overwrite"`; do not call `diary_write`. Every newly added event must have its own H6 time heading.
- Target date has no diary yet and has events to record → Use `diary_write` to create it, giving each event its own H6 time heading; if more events are added later, use `overwrite` while preserving all existing text.
- When using `overwrite`, `content` must be the complete full-day body with all existing paragraphs preserved word for word and new H6 event sections inserted at the proper chronological positions. Dropping any existing section loses user data.
- Never call `diary_delete` / `baishou_diary_delete`.

## Workflow

```
Task Progress:
- [ ] 1. Call current_time to confirm "today" (and "yesterday")
- [ ] 2. Extract candidate events from the conversation (time, title, key points, tags)
- [ ] 2.5 Apply the Detail Standard: keep key quotes and decisions in detail; keep code/doc changes to conclusions only
- [ ] 3. Filter out routine shared-memory pastes and trivial repetitive chatter
- [ ] 4. Group events by target date (also inspect yesterday's diary if today's diary does not exist yet)
- [ ] 5. For each date: read → deduplicate → write (or overwrite while preserving existing text verbatim)
- [ ] 6. Briefly confirm to the user which dates and how many entries were added (do not paste the full diary back)
```

### Step 1: Extract Candidate Events

For each noteworthy event in the conversation, prepare:

- Approximate time (`HH:MM` if known; otherwise estimate a reasonable morning/afternoon/evening time from message order, or use an H6 heading without exact minutes)
- A concise single-line title (in the user's language)
- Grounded body text (actions, outcomes, key dialogue; minimal adjectives)
- Tags (people, projects, themes, in the user's language)

**Grounded style**: State clearly what happened, why a decision was made, and what resulted. Avoid vague filler or exaggerated rhetoric.

### Step 1.5: Detail Standard (Important)

A diary is a long-term memory to revisit months or years later, not a delivery changelog. **The criterion is: "Six months from now, will this detail still matter?"**

**Write in detail (can be multi-sentence or verbatim):**

- **Key quotes from conversations**: Exact words spoken by others or important exchanges. Direct quotes are more valuable than paraphrases when looking back.
- **People's attitudes and reactions**: Who agreed to what, who dodged a topic, tone shifts, expressions.
- **Personal judgments and reasoning at the moment**: Why a choice was made, what the user was worried about, conclusions reached with the AI companion.
- **Emotional and physical state**: How intense a feeling was, physical reactions, what was said in the moment.
- **Concrete life details**: Cooking steps, what was bought and for how much, health/body metrics. These capture the texture of daily life.

**Keep to a 1–2 sentence conclusion (do not expand):**

- **Code and document diff details**: Record only the goal, key decision, and outcome. **Do not** list page-by-page, field-by-field, or file-by-file diffs.
- **Technical implementation minutiae**: Record whether the feature or bug was resolved, not the debugging steps or function names.
- **File trees, config keys, parameters**: Those live in the codebase or docs; repeating them in the diary adds no value.
- **Anything directly inspectable from the artifact itself**: Record _why_ it was changed and _what happened after_, not a mechanical inventory of edits.

**Rule of thumb**: **Keep what people said in detail; keep technical edits to conclusions.**

### Step 2: Assign Target Dates

- Read today's diary via `diary_read`; if today has no diary yet, also read yesterday's diary.
- Events from today → write to today's date (create with `diary_write` if missing).
- Events clearly belonging to yesterday or another date → write to that specific date; do not lump them into today.
- Conversations spanning midnight → split into separate events under their respective dates.

### Step 3: Deduplicate

After reading the target date's diary, check each candidate event:

- Same event already has a section → skip
- Existing section already covers the main point and the conversation only repeats it → skip
- Existing section only mentions it in passing and the conversation adds **new concrete facts** → append only the new facts without rewriting the old section

### Step 4: Format & Chronological Insertion

Every event must be a standalone section with its event time in the H6 heading (written in the user's language):

```markdown
###### HH:MM - Event Title

#Tag1 #Tag2

Paragraph body...
```

Or for a short untitled note:

```markdown
###### HH:MM

#Tag1 #Tag2

Paragraph body...
```

**Ordering & write mode (Important):**

- Sort new events by **actual event time**. Every event must have its own `###### HH:MM - Title` heading; never bundle multiple events under a single heading.
- When the diary already exists, prefer `overwrite`: `content` must preserve **all existing text verbatim** and insert the new complete H6 event sections at the proper chronological positions.
- Multiple events at the same minute → keep their conversation order right next to each other.
- When adding multiple events at once, perform a single `overwrite` with all sections sorted in chronological order.

**Parameters:** `mode` is required on `diary_edit`. **Do not pass `tags`**; keep tags only as `#tag` lines in the Markdown body.

### Step 5: Reply to the User

Reply in 1–2 sentences in the user's language stating which date(s) were updated, how many sections were added, and what duplicates/routine items were skipped. Do not paste the full diary text into the chat.

## What Not to Write

- Routine shared-memory packs, period summaries, or sync confirmations pasted by the user
- Events already recorded in the diary
- Anything the user explicitly said not to record, or meta-chatter only testing skills/tools
- Zero-information emoji-only replies or filler acknowledgments
- Line-by-line code, document, or configuration diffs (record conclusions only; see "Detail Standard")
