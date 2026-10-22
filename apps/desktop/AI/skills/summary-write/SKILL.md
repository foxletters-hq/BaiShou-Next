name: summary-write
description: "Detect and generate missing period summaries (weekly, monthly, quarterly, yearly) via the bitmap and cascade detector, then read the source material and write the new summary. Use when the user asks to write or backfill a summary, or invokes /summary-write."
bundledHash: 3460912f

# Period Summary Detection & Generation

Detect missing **weekly, monthly, quarterly, and yearly** summaries via the built-in bitmap and cascade detector, confirm with the user, read the underlying diaries or lower-level summaries, and write the completed summary to disk.

Keep following the persona rules when speaking to the user. This skill governs **how to detect missing summaries, read source material, draft the summary, and save it**. It is designed for companion sessions; project/workbench sessions expose personal memory as read-only, so do not attempt to write summaries there.

## Language Rule

- This skill specification is written in English, and the host invocation header may contain Chinese text. Do **not** let the language of this skill file or the invocation wrapper dictate your output language.
- Always write `companion_ask` questions/options, the generated summary Markdown (including all headings and section titles), and your final reply in the **user's language** (matching the user's conversation language, existing diaries/summaries, or App UI locale).

## When to Use

- The user asks (in any language) to write or backfill a summary, weekly review, monthly report, quarterly report, or yearly review, or invokes `/summary-write`
- The user wants to check which period summaries are missing and generate them

> This skill only generates missing summaries. To verify or repair an existing summary, use `/summary-repair`.

## Hard Rules

1. **Detect missing first, then ask**: When generating missing summaries, first call `summary_read(mode: "missing")` (or `baishou_summary_read`) to run the bitmap & cascade detector, then call `companion_ask` so the user can choose which period(s) to generate. Never batch-call `summary_write` without user confirmation.
2. **Read source material before writing**: Before drafting any summary, you must read the real source material for that period (read diaries for weekly; read weeklies or diaries for monthly; read monthlies for quarterly; read quarterlies for yearly). Never fabricate facts or write from vague memory without reading the sources.
3. **Never treat the application or system default name as a person's name**: The application name and system defaults are **not** people in the user's life. Never list them under "Key People & Relationship Progress" or attribute human actions to them.
4. **Follow period boundary & cascade rules strictly**:
   - **Weekly (`weekly`)**: Monday through Sunday is one full week. Generated only after the week has ended (Sunday 23:59:59 has passed) and the week has at least one diary entry. `start_date` must be the **Monday** of that week (`YYYY-MM-DD`).
   - **Monthly (`monthly`)**: Generated only after the calendar month has ended and the month has weekly summaries (or diaries). `start_date` must be `YYYY-MM-01`.
   - **Quarterly (`quarterly`)**: Generated only after the calendar quarter has ended and the quarter has monthly summaries. `start_date` must be the first day of the quarter (`YYYY-01-01`, `YYYY-04-01`, `YYYY-07-01`, or `YYYY-10-01`).
   - **Yearly (`yearly`)**: Generated only after the calendar year has ended and the year has quarterly summaries. `start_date` must be `YYYY-01-01`.
   - **Cascade unlocking**: If a month was not listed as missing because its weekly summaries were incomplete, once those weekly summaries are saved via `summary_write`, call `summary_read(mode: "missing")` again to detect the newly unlocked monthly summary (and similarly for quarterly and yearly).
5. **Grounded and meaningful**: Summaries are not generic slogans. Preserve key events, important relationship interactions, core decisions, and emotional/cognitive shifts, following the structured Markdown template for that period type.

## Tool Usage

| Scenario                                | Tool (Built-in / MCP)                                                                        |
| --------------------------------------- | -------------------------------------------------------------------------------------------- |
| Check current date                      | `current_time` / `baishou_current_time`                                                      |
| Detect all missing summaries via bitmap | `summary_read` / `baishou_summary_read` with `mode: "missing"`                               |
| Ask user which summaries to generate    | `companion_ask` (pass `multiple: true` when 2+ periods are missing)                          |
| List diary dates in a week/month        | `diary_list` / `baishou_diary_list` (pass `start_date`, `end_date`)                          |
| Read full diary entries in a week/month | `diary_read` / `baishou_diary_read` (pass `dates` array)                                     |
| Read existing or lower-level summaries  | `summary_read` / `baishou_summary_read` (pass `type`, `start_date`)                          |
| Save summary to file & database         | `summary_write` / `baishou_summary_write` (pass `type`, `start_date`, `end_date`, `content`) |

## Workflow

```
Task Progress:
- [ ] 1. Call summary_read(mode: "missing") to detect generatable weekly/monthly/quarterly/yearly summaries
- [ ] 2. Call companion_ask to present the missing periods and let the user choose which to generate
- [ ] 3. For each selected period: read all underlying diaries or lower-level summaries
- [ ] 4. Draft the Markdown summary in the user's language and call summary_write to save it
- [ ] 5. If saving lower-level summaries may unlock a higher-level summary, call summary_read(mode: "missing") again to check
- [ ] 6. Briefly report the saved summary periods and key highlights to the user (do not paste the full summary into chat)
```

### Step 1: Detect Missing Summaries via Bitmap

Call `summary_read`:

- Arguments: `{ "mode": "missing" }` (or `{ "mode": "missing", "type": "weekly" }` if the user only asked for a specific tier).
- If no missing summaries are found: inform the user that all completed periods are up to date, and offer to use `/summary-repair` if they want to fix an existing summary.

### Step 2: Confirm with the User

Call `companion_ask` (in the user's language):

- In `question`, concisely list the count and date ranges of the detected missing summaries.
- When 2 or more missing periods are detected, pass `multiple: true` on `companion_ask` and make each option a single period item (for example `["2026年第34周（8月17日—8月23日）", "2026年第39周（9月21日—9月27日）"]`). Do **not** prefix options with "Only..." / "只补..." or mix "Both / All of them" / "两份都补" into a multi-select option list, because the user can directly check one or more periods.

### Step 3: Read Source Material

Read the sources corresponding to the target summary type:

- **Weekly (`weekly`)**:
  1. `diary_list(start_date: Monday, end_date: Sunday)` to list all diary dates in that week.
  2. `diary_read(dates: [...])` to read the full text of those diaries.
- **Monthly (`monthly`)**:
  1. Read all existing weekly summaries in that month (`summary_read(type: "weekly", start_date: ...)`).
  2. If additional daily details are needed or the month is generated directly from diaries, call `diary_list` + `diary_read` for that month.
- **Quarterly (`quarterly`)**:
  1. Call `summary_read(type: "monthly", start_date: "YYYY-MM-01")` for each month in the quarter.
- **Yearly (`yearly`)**:
  1. Call `summary_read(type: "quarterly", start_date: ...)` for the quarters in that year.

### Step 4: Draft Using the Template Structure and Save via `summary_write`

Follow the section structure below, **localizing all headings and labels into the user's language** (unless the user requested a custom format):

#### Weekly Template (`weekly`)

```markdown
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
```

#### Monthly Template (`monthly`)

```markdown
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
```

#### Quarterly (`quarterly`) & Yearly (`yearly`) Templates

- **Quarterly (`quarterly`)**: Start with a localized H5 quarter title (e.g. `##### Q{quarter} {year} Quarterly Summary` / `##### {year}年第{quarter}季度总结`), covering date range, core themes, quarterly milestones, relationship threads, mindset shifts, and next quarter outlook.
- **Yearly (`yearly`)**: Start with a localized H5 year title (e.g. `##### {year} Yearly Summary` / `##### {year}年度总结`), covering period, yearly keywords, seasonal/major chapters review, key people of the year, growth & transformation, and a note to next year's self.

Once drafted, call `summary_write`:

- `type`: `"weekly"` | `"monthly"` | `"quarterly"` | `"yearly"`
- `start_date`: Period start date `YYYY-MM-DD`
- `end_date`: Period end date `YYYY-MM-DD`
- `content`: Complete Markdown body

### Step 5: Cascade Re-check & Reply

- If you just completed the remaining weekly summaries for a finished month (or monthly summaries for a finished quarter), call `summary_read(mode: "missing")` again to check whether a higher-level summary was unlocked; if so, let the user know or ask whether to continue.
- Finally, confirm the saved summary period(s) and core keywords in a few short sentences in the user's language without pasting the full Markdown body into chat.
