export const DIARY_APPEND_SKILL_NAME = 'diary-append'
export const SUMMARY_WRITE_SKILL_NAME = 'summary-write'
export const SUMMARY_REPAIR_SKILL_NAME = 'summary-repair'

export const DIARY_APPEND_SKILL_DESCRIPTION =
  "Append events from today's or recent AI conversations into the personal diary (append-only, deduplicated, ordered by event time). Use when the user asks to backfill/append to their diary or invokes /diary-append."

export const SUMMARY_WRITE_SKILL_DESCRIPTION =
  'Detect and generate missing period summaries (weekly, monthly, quarterly, yearly) via the bitmap and cascade detector, then read the source material and write the new summary. Use when the user asks to write or backfill a summary, or invokes /summary-write.'

export const SUMMARY_REPAIR_SKILL_DESCRIPTION =
  'Read, verify, and repair existing period summaries (weekly, monthly, quarterly, yearly). Cross-check names, roles, and facts with diaries and memories via diary_search (FTS) and vector_search (RAG), then overwrite the same period after user confirmation. Use when the user asks to fix or proofread a summary, or invokes /summary-repair.'

/** Legacy Chinese descriptions kept so existing disk SKILL.md headers are recognized as default built-in descriptions. */
export const LEGACY_DIARY_APPEND_SKILL_DESCRIPTION =
  '将今天或近期与 AI 对话中的事件补充进个人日记（只增不改、不重复、按事件时间排序）。当用户说补日记、记进日记或调用 /diary-append 时使用。'

export const LEGACY_SUMMARY_WRITE_SKILL_DESCRIPTION =
  '复用位图与级联检测机制找出可生成的缺失周期总结（周记、月报、季报、年度总结），询问用户确认后读取对应日记或下级总结并撰写落盘。当用户说写总结、补周记/月报/季报/年报或调用 /summary-write 时使用。'

export const DIARY_APPEND_SKILL_CONTENT = `# Personal Diary Append

Use the diary tools (or diary MCP tools) to **append** events from the conversation into the user's personal diary. Append-only, no duplicates, ordered by actual event time.

Keep following the persona rules when speaking to the user. This skill governs **how to append to the diary**.

## Language Rule

- This skill specification is written in English, and the host invocation header may contain Chinese text. Do **not** let the language of this skill file or the invocation wrapper dictate your output language.
- Always write diary headings, tags, body paragraphs, and your final confirmation reply in the **user's language** (matching the existing diary language, the user's conversation language, or the App UI locale).

## When to Use

- The user asks (in any language) to append to the diary, record today's chat in the diary, backfill the diary, or invokes \`/diary-append\`
- Recording events from today's or recent conversations into the personal diary
- Backfilling events that belong to yesterday or an earlier date

## Hard Rules

1. **Read before write**: Always call \`diary_read\` (or \`baishou_diary_read\` / \`diary_list\`) on the target date first and inspect the existing body before deciding what to write. If today's diary does not exist yet, or if the conversation spans yesterday / midnight, also read yesterday's diary first to check whether anything belongs in yesterday's entry or was already recorded there.
2. **No duplicates**: Never write an event, opinion, or detail a second time if it is already covered. Semantic duplicates count as duplicates.
3. **Never modify existing text**: Do not rewrite, trim, or polish existing paragraphs. Never touch old paragraphs just to make them flow better.
4. **Append missing facts only**: Only add events or concrete facts from the conversation that are not yet in the diary.
5. **Chronological order**: Insert new paragraphs by **actual event time**, not by dumping everything at the bottom under the current timestamp.
6. **Skip routine context**: Do **not** record routine payloads pasted by the user such as shared memory packs, period summaries, or sync confirmations.
7. **Tags in body only**: Put \`#tag\` lines inside the paragraph body. When calling \`diary_write\` / \`diary_edit\`, **do not pass the \`tags\` parameter** so tags are not written into YAML frontmatter.
8. **Detail vs. brevity**: A personal diary is not a work changelog. Follow the "Detail Standard" below for what to expand and what to summarize in one sentence.
9. **Dedicated H6 time heading per event**: Every event must be its own paragraph with its own \`###### HH:MM - Title\` heading. Never group multiple distinct events under a single current-time H6 heading, and never replace the H6 time heading with bold text, bullet lists, or other heading levels.

## Tool Usage

| Scenario                                    | Tool (Built-in / MCP)                                                                                                  |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Check current local date & time             | \`current_time\` / \`baishou_current_time\` (use the local timezone of the personal diary)                             |
| Check if a date already has a diary         | \`diary_list\` / \`baishou_diary_list\` or \`diary_read\` / \`baishou_diary_read\`                                     |
| Create a new diary for a date               | \`diary_write\` / \`baishou_diary_write\`                                                                              |
| Append at the end (only when order allows)  | \`diary_edit\` / \`baishou_diary_edit\` with \`mode: "append"\`                                                        |
| Insert or append in time order (default)    | \`diary_edit\` / \`baishou_diary_edit\` with \`mode: "overwrite"\`, keeping **every existing paragraph verbatim**      |
| Check whether an event was already recorded | \`diary_search\` / \`baishou_diary_search\`                                                                            |

- Target date already has a diary → Use \`diary_edit\` only, defaulting to \`mode: "overwrite"\`; do not call \`diary_write\`. Every newly added event must have its own H6 time heading.
- Target date has no diary yet and has events to record → Use \`diary_write\` to create it, giving each event its own H6 time heading; if more events are added later, use \`overwrite\` while preserving all existing text.
- When using \`overwrite\`, \`content\` must be the complete full-day body with all existing paragraphs preserved word for word and new H6 event sections inserted at the proper chronological positions. Dropping any existing section loses user data.
- Never call \`diary_delete\` / \`baishou_diary_delete\`.

## Workflow

\`\`\`
Task Progress:
- [ ] 1. Call current_time to confirm "today" (and "yesterday")
- [ ] 2. Extract candidate events from the conversation (time, title, key points, tags)
- [ ] 2.5 Apply the Detail Standard: keep key quotes and decisions in detail; keep code/doc changes to conclusions only
- [ ] 3. Filter out routine shared-memory pastes and trivial repetitive chatter
- [ ] 4. Group events by target date (also inspect yesterday's diary if today's diary does not exist yet)
- [ ] 5. For each date: read → deduplicate → write (or overwrite while preserving existing text verbatim)
- [ ] 6. Briefly confirm to the user which dates and how many entries were added (do not paste the full diary back)
\`\`\`

### Step 1: Extract Candidate Events

For each noteworthy event in the conversation, prepare:

- Approximate time (\`HH:MM\` if known; otherwise estimate a reasonable morning/afternoon/evening time from message order, or use an H6 heading without exact minutes)
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
- **Anything directly inspectable from the artifact itself**: Record *why* it was changed and *what happened after*, not a mechanical inventory of edits.

**Rule of thumb**: **Keep what people said in detail; keep technical edits to conclusions.**

### Step 2: Assign Target Dates

- Read today's diary via \`diary_read\`; if today has no diary yet, also read yesterday's diary.
- Events from today → write to today's date (create with \`diary_write\` if missing).
- Events clearly belonging to yesterday or another date → write to that specific date; do not lump them into today.
- Conversations spanning midnight → split into separate events under their respective dates.

### Step 3: Deduplicate

After reading the target date's diary, check each candidate event:

- Same event already has a section → skip
- Existing section already covers the main point and the conversation only repeats it → skip
- Existing section only mentions it in passing and the conversation adds **new concrete facts** → append only the new facts without rewriting the old section

### Step 4: Format & Chronological Insertion

Every event must be a standalone section with its event time in the H6 heading (written in the user's language):

\`\`\`markdown
###### HH:MM - Event Title

#Tag1 #Tag2

Paragraph body...
\`\`\`

Or for a short untitled note:

\`\`\`markdown
###### HH:MM

#Tag1 #Tag2

Paragraph body...
\`\`\`

**Ordering & write mode (Important):**

- Sort new events by **actual event time**. Every event must have its own \`###### HH:MM - Title\` heading; never bundle multiple events under a single heading.
- When the diary already exists, prefer \`overwrite\`: \`content\` must preserve **all existing text verbatim** and insert the new complete H6 event sections at the proper chronological positions.
- Multiple events at the same minute → keep their conversation order right next to each other.
- When adding multiple events at once, perform a single \`overwrite\` with all sections sorted in chronological order.

**Parameters:** \`mode\` is required on \`diary_edit\`. **Do not pass \`tags\`**; keep tags only as \`#tag\` lines in the Markdown body.

### Step 5: Reply to the User

Reply in 1–2 sentences in the user's language stating which date(s) were updated, how many sections were added, and what duplicates/routine items were skipped. Do not paste the full diary text into the chat.

## What Not to Write

- Routine shared-memory packs, period summaries, or sync confirmations pasted by the user
- Events already recorded in the diary
- Anything the user explicitly said not to record, or meta-chatter only testing skills/tools
- Zero-information emoji-only replies or filler acknowledgments
- Line-by-line code, document, or configuration diffs (record conclusions only; see "Detail Standard")
`

export const SUMMARY_WRITE_SKILL_CONTENT = `# Period Summary Detection & Generation

Detect missing **weekly, monthly, quarterly, and yearly** summaries via the built-in bitmap and cascade detector, confirm with the user, read the underlying diaries or lower-level summaries, and write the completed summary to disk.

Keep following the persona rules when speaking to the user. This skill governs **how to detect missing summaries, read source material, draft the summary, and save it**. It is designed for companion sessions; project/workbench sessions expose personal memory as read-only, so do not attempt to write summaries there.

## Language Rule

- This skill specification is written in English, and the host invocation header may contain Chinese text. Do **not** let the language of this skill file or the invocation wrapper dictate your output language.
- Always write \`companion_ask\` questions/options, the generated summary Markdown (including all headings and section titles), and your final reply in the **user's language** (matching the user's conversation language, existing diaries/summaries, or App UI locale).

## When to Use

- The user asks (in any language) to write or backfill a summary, weekly review, monthly report, quarterly report, or yearly review, or invokes \`/summary-write\`
- The user wants to check which period summaries are missing and generate them

> This skill only generates missing summaries. To verify or repair an existing summary, use \`/summary-repair\`.

## Hard Rules

1. **Detect missing first, then ask**: When generating missing summaries, first call \`summary_read(mode: "missing")\` (or \`baishou_summary_read\`) to run the bitmap & cascade detector, then call \`companion_ask\` so the user can choose which period(s) to generate. Never batch-call \`summary_write\` without user confirmation.
2. **Read source material before writing**: Before drafting any summary, you must read the real source material for that period (read diaries for weekly; read weeklies or diaries for monthly; read monthlies for quarterly; read quarterlies for yearly). Never fabricate facts or write from vague memory without reading the sources.
3. **Never treat the application or system default name as a person's name**: The application name and system defaults are **not** people in the user's life. Never list them under "Key People & Relationship Progress" or attribute human actions to them.
4. **Follow period boundary & cascade rules strictly**:
   - **Weekly (\`weekly\`)**: Monday through Sunday is one full week. Generated only after the week has ended (Sunday 23:59:59 has passed) and the week has at least one diary entry. \`start_date\` must be the **Monday** of that week (\`YYYY-MM-DD\`).
   - **Monthly (\`monthly\`)**: Generated only after the calendar month has ended and the month has weekly summaries (or diaries). \`start_date\` must be \`YYYY-MM-01\`.
   - **Quarterly (\`quarterly\`)**: Generated only after the calendar quarter has ended and the quarter has monthly summaries. \`start_date\` must be the first day of the quarter (\`YYYY-01-01\`, \`YYYY-04-01\`, \`YYYY-07-01\`, or \`YYYY-10-01\`).
   - **Yearly (\`yearly\`)**: Generated only after the calendar year has ended and the year has quarterly summaries. \`start_date\` must be \`YYYY-01-01\`.
   - **Cascade unlocking**: If a month was not listed as missing because its weekly summaries were incomplete, once those weekly summaries are saved via \`summary_write\`, call \`summary_read(mode: "missing")\` again to detect the newly unlocked monthly summary (and similarly for quarterly and yearly).
5. **Grounded and meaningful**: Summaries are not generic slogans. Preserve key events, important relationship interactions, core decisions, and emotional/cognitive shifts, following the structured Markdown template for that period type.

## Tool Usage

| Scenario                                  | Tool (Built-in / MCP)                                                                                    |
| ----------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Check current date                        | \`current_time\` / \`baishou_current_time\`                                                              |
| Detect all missing summaries via bitmap   | \`summary_read\` / \`baishou_summary_read\` with \`mode: "missing"\`                                     |
| Ask user which summaries to generate      | \`companion_ask\`                                                                                        |
| List diary dates in a week/month          | \`diary_list\` / \`baishou_diary_list\` (pass \`start_date\`, \`end_date\`)                              |
| Read full diary entries in a week/month   | \`diary_read\` / \`baishou_diary_read\` (pass \`dates\` array)                                           |
| Read existing or lower-level summaries    | \`summary_read\` / \`baishou_summary_read\` (pass \`type\`, \`start_date\`)                              |
| Save summary to file & database           | \`summary_write\` / \`baishou_summary_write\` (pass \`type\`, \`start_date\`, \`end_date\`, \`content\`) |

## Workflow

\`\`\`
Task Progress:
- [ ] 1. Call summary_read(mode: "missing") to detect generatable weekly/monthly/quarterly/yearly summaries
- [ ] 2. Call companion_ask to present the missing periods and let the user choose which to generate
- [ ] 3. For each selected period: read all underlying diaries or lower-level summaries
- [ ] 4. Draft the Markdown summary in the user's language and call summary_write to save it
- [ ] 5. If saving lower-level summaries may unlock a higher-level summary, call summary_read(mode: "missing") again to check
- [ ] 6. Briefly report the saved summary periods and key highlights to the user (do not paste the full summary into chat)
\`\`\`

### Step 1: Detect Missing Summaries via Bitmap

Call \`summary_read\`:
- Arguments: \`{ "mode": "missing" }\` (or \`{ "mode": "missing", "type": "weekly" }\` if the user only asked for a specific tier).
- If no missing summaries are found: inform the user that all completed periods are up to date, and offer to use \`/summary-repair\` if they want to fix an existing summary.

### Step 2: Confirm with the User

Call \`companion_ask\` (in the user's language):
- In \`question\`, concisely list the count and date ranges of the detected missing summaries.
- In \`options\`, provide specific period choices (if there are many, offer options such as generating all in order, generating the most recent one, or grouping by type).

### Step 3: Read Source Material

Read the sources corresponding to the target summary type:
- **Weekly (\`weekly\`)**:
  1. \`diary_list(start_date: Monday, end_date: Sunday)\` to list all diary dates in that week.
  2. \`diary_read(dates: [...])\` to read the full text of those diaries.
- **Monthly (\`monthly\`)**:
  1. Read all existing weekly summaries in that month (\`summary_read(type: "weekly", start_date: ...)\`).
  2. If additional daily details are needed or the month is generated directly from diaries, call \`diary_list\` + \`diary_read\` for that month.
- **Quarterly (\`quarterly\`)**:
  1. Call \`summary_read(type: "monthly", start_date: "YYYY-MM-01")\` for each month in the quarter.
- **Yearly (\`yearly\`)**:
  1. Call \`summary_read(type: "quarterly", start_date: ...)\` for the quarters in that year.

### Step 4: Draft Using the Template Structure and Save via \`summary_write\`

Follow the section structure below, **localizing all headings and labels into the user's language** (unless the user requested a custom format):

#### Weekly Template (\`weekly\`)
\`\`\`markdown
##### Week {week} Summary — {month}/{year} (localize title to user's language, e.g. "{year}年{month}月第{week}周总结")

###### 📅 Period
- **Date range**: {start} to {end}

###### 🎯 Core Keywords
**Keyword 1**, **Keyword 2**, **Keyword 3**

---

###### 👥 Key People & Relationship Progress
- **(Person)**: Key interactions and progress

---

###### 🎞️ Key Events (Timeline)
- **[Event Title]**
    - **Details**: Concrete facts and key conversations
    - **Significance**: Why decisions were made or follow-up impact

---

###### 💡 Reflections & Mindset Shifts
- **Work / Technology**:
- **Life / Self**:

---

###### 📊 State Check-in
- **Energy & Well-being**:
- **Regrets This Week**:
- **Next Week Focus**:

---
###### 🍵 Capsule for Monthly Summary
> (One sentence capturing the most memorable anchor of the week)
\`\`\`

#### Monthly Template (\`monthly\`)
\`\`\`markdown
##### {month}/{year} Monthly Summary (localize title to user's language, e.g. "{year}年{month}月度总结")

###### 📅 Date Range
- **Range**: {start} to {end}

###### 🎯 Core Themes This Month
**Theme 1**, **Theme 2**

---

###### 📈 Key Progress & Achievements
- **Work / Technology**:
- **Life / Personal**:

---

###### 👥 Relationship Dynamics
- **(Person)**:

---

###### 💡 Deeper Reflection

---

###### 📊 State Check-in (0–10)
- **State**:
- **Satisfaction**:

---
###### 🔮 Next Month Outlook
- **Focus**:
\`\`\`

#### Quarterly (\`quarterly\`) & Yearly (\`yearly\`) Templates
- **Quarterly (\`quarterly\`)**: Start with a localized H5 quarter title (e.g. \`##### Q{quarter} {year} Quarterly Summary\` / \`##### {year}年第{quarter}季度总结\`), covering date range, core themes, quarterly milestones, relationship threads, mindset shifts, and next quarter outlook.
- **Yearly (\`yearly\`)**: Start with a localized H5 year title (e.g. \`##### {year} Yearly Summary\` / \`##### {year}年度总结\`), covering period, yearly keywords, seasonal/major chapters review, key people of the year, growth & transformation, and a note to next year's self.

Once drafted, call \`summary_write\`:
- \`type\`: \`"weekly"\` | \`"monthly"\` | \`"quarterly"\` | \`"yearly"\`
- \`start_date\`: Period start date \`YYYY-MM-DD\`
- \`end_date\`: Period end date \`YYYY-MM-DD\`
- \`content\`: Complete Markdown body

### Step 5: Cascade Re-check & Reply

- If you just completed the remaining weekly summaries for a finished month (or monthly summaries for a finished quarter), call \`summary_read(mode: "missing")\` again to check whether a higher-level summary was unlocked; if so, let the user know or ask whether to continue.
- Finally, confirm the saved summary period(s) and core keywords in a few short sentences in the user's language without pasting the full Markdown body into chat.
`

export const SUMMARY_REPAIR_SKILL_CONTENT = `# Period Summary Verification & Repair

Read a specified existing summary, verify its people, roles, and facts against the underlying diaries and memories (FTS + RAG), ask the user to confirm the corrections, then overwrite the same period via \`summary_write\`.

Keep following the persona rules when speaking to the user. This skill governs **how to read, verify, and repair an existing summary**—not how to generate new missing summaries. It is designed for companion sessions; project/workbench sessions expose personal memory as read-only, so do not attempt to write summaries there.

## Language Rule

- This skill specification is written in English, and the host invocation header may contain Chinese text. Do **not** let the language of this skill file or the invocation wrapper dictate your output language.
- Always write \`companion_ask\` questions/options, the repaired summary Markdown (including all headings and section titles), and your final reply in the **user's language** (matching the user's conversation language, existing diaries/summaries, or App UI locale).

## When to Use

- The user asks to repair, correct, proofread, or verify an existing weekly/monthly/quarterly/yearly summary
- The user says a summary swapped people, used a wrong name, hallucinated details, missed an event, or listed the application/default name as a person
- The user asks you to read several summaries and cross-check them against diaries
- You notice a likely role or name error while reading a summary and want to offer a fix

## Hard Rules

1. **Read the target first**: Call \`summary_read(mode: "read", type, start_date)\` to read the current Markdown body. Never rewrite a summary you have not read.
2. **Establish the roles before editing**:
   - The diary author ("I" / "我") is the **user**.
   - The AI companion is the **current companion** (for example Latte), not the application and not a system default name.
   - Never swap the user's and the companion's identities, feelings, or actions.
   - Never treat the application name or a system default name as a person's name. If a summary does so, correct it.
3. **Verify facts with real sources**: Use \`diary_list\` + \`diary_read\` for the same period. Use \`diary_search\` (FTS) to find names, events, and quotations, and \`vector_search\` (RAG) for semantic evidence. Use \`recall_relations\` when available to check existing relationship records. If RAG is unavailable, complete at least the FTS + diary-text verification.
4. **Build a person map before writing**: List every person in the summary and confirm who they are. Check the user, the companion, and other people separately. Do not guess a name when the sources are unclear—ask the user.
5. **Propose before overwriting**: Use \`companion_ask\` to show the discovered error(s) (original → corrected) and the repair scope. Get confirmation before writing.
6. **Overwrite the same period**: Call \`summary_write\` with the **same** \`type\` and \`start_date\` as the original summary. Pass the full corrected Markdown body. Never create a duplicate period.
7. **Fix only what is wrong**: Keep accurate sections and the original structure/headings. Do not rewrite the whole summary just to change style, and do not edit diaries as part of summary repair.
8. **Report briefly**: After saving, confirm what names/roles/facts were corrected in a few sentences. Do not paste the full summary into chat.

## Tool Usage

| Scenario                                  | Tool (Built-in / MCP)                                                                                    |
| ----------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Read the target summary                   | \`summary_read\` / \`baishou_summary_read\` with \`mode: "read"\`, \`type\`, \`start_date\`          |
| Confirm current date / period             | \`current_time\` / \`baishou_current_time\`                                                              |
| List diary dates in the period            | \`diary_list\` / \`baishou_diary_list\` (pass \`start_date\`, \`end_date\`)                              |
| Read full diary entries                   | \`diary_read\` / \`baishou_diary_read\` (pass \`dates\` array)                                           |
| FTS keyword search for people/events      | \`diary_search\` / \`baishou_diary_search\`                                                              |
| RAG semantic search for relationship facts| \`vector_search\` / \`baishou_vector_search\`                                                            |
| Check existing relationship records       | \`recall_relations\` / \`baishou_recall_relations\`                                                      |
| Ask the user to confirm corrections       | \`companion_ask\`                                                                                        |
| Overwrite the same period summary         | \`summary_write\` / \`baishou_summary_write\` (same \`type\` + \`start_date\`, full corrected \`content\`) |

## Workflow

\`\`\`
Task Progress:
- [ ] 1. Read the target summary with summary_read(mode: "read")
- [ ] 2. List and read the diaries for the same period
- [ ] 3. Search names/events with diary_search (FTS), verify relationships with vector_search (RAG) and recall_relations
- [ ] 4. Build a person map and identify role/name/fact errors
- [ ] 5. Show the original → corrected changes and ask for confirmation
- [ ] 6. Overwrite the same period with summary_write using the full corrected Markdown
- [ ] 7. Briefly report what was corrected
\`\`\`

### Step 1: Read the Target Summary

Call \`summary_read\` with:
- \`mode: "read"\`
- \`type\`: \`"weekly"\` | \`"monthly"\` | \`"quarterly"\` | \`"yearly"\`
- \`start_date\`: the period start date in \`YYYY-MM-DD\`

If the exact period is not found, ask the user to confirm the date, or use the available-summary list returned by the tool.

### Step 2: Read the Source Material

- Use \`diary_list\` and \`diary_read\` for every diary in the same period.
- For monthly/quarterly/yearly summaries, also read the lower-level summaries that the original summary was based on.
- If the user points to a specific person or event, search with \`diary_search\` and \`vector_search\`.

### Step 3: Verify Roles and Names

Build a person map:

- **User (diary author)**: the "I" in the diaries; use the user's nickname when available.
- **AI companion**: the current companion's name; never replace it with the application or a system default name.
- **Other people**: keep the names exactly as they appear in the diaries unless the user corrects them.

Check for these common errors:
- The user's feelings/actions attributed to the companion, or vice versa.
- The companion called by the application/default name.
- Invented people, events, or relationships not supported by the diaries.
- Missing important events that the user explicitly asked to include.

### Step 4: Propose the Correction

Call \`companion_ask\` in the user's language:
- Quote the erroneous line or summarize it.
- Show the corrected version.
- State which period and sections will change.
- Ask for confirmation before writing.

### Step 5: Overwrite the Same Period

Call \`summary_write\`:
- \`type\`: same as the original
- \`start_date\`: same as the original
- \`end_date\`: same as the original
- \`content\`: the complete corrected Markdown body, preserving the original template structure and headings

Do not create a new period or a duplicate summary.

### Step 6: Report

Confirm in a few sentences:
- Which summary period was repaired.
- Which names/roles/facts were corrected.
- Whether any uncertainty remains (for example, an ambiguous person the user should confirm).

Do not paste the full summary into chat.
`
