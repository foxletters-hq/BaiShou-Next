name: summary-repair
description: "Read, verify, and repair existing period summaries (weekly, monthly, quarterly, yearly). Cross-check names, roles, and facts with diaries and memories via diary_search (FTS) and vector_search (RAG), then overwrite the same period after user confirmation. Use when the user asks to fix or proofread a summary, or invokes /summary-repair."
bundledHash: a813e3fe

# Period Summary Verification & Repair

Confirm the repair scope with the user (specific summary, recent N summaries, or a date range), read the target existing summary(ies), verify people, roles, and facts against the underlying diaries and memories (FTS + RAG), ask the user to confirm the corrections, then overwrite the same period(s) via `summary_write`.

Keep following the persona rules when speaking to the user. This skill governs **how to read, verify, and repair existing summaries**—not how to generate new missing summaries. It is designed for companion sessions; project/workbench sessions expose personal memory as read-only, so do not attempt to write summaries there.

## Language Rule

- This skill specification is written in English, and the host invocation header may contain Chinese text. Do **not** let the language of this skill file or the invocation wrapper dictate your output language.
- Always write `companion_ask` questions/options, the repaired summary Markdown (including all headings and section titles), and your final reply in the **user's language** (matching the user's conversation language, existing diaries/summaries, or App UI locale).

## When to Use

- The user asks to repair, correct, proofread, or verify an existing weekly/monthly/quarterly/yearly summary, or invokes `/summary-repair`
- The user says a summary swapped people, used a wrong name, hallucinated details, missed an event, or listed the application/default name as a person
- The user asks you to read several recent summaries or a date range of summaries and cross-check them against diaries
- You notice a likely role or name error while reading a summary and want to offer a fix

## Hard Rules

1. **Ask the repair scope first when not specified**: If the user invokes `/summary-repair` (or asks to check/repair summaries) without specifying which summary, how many recent summaries, or what date range to check, first call `summary_read(mode: "list")` to inspect available summaries, then call `companion_ask` to let the user choose the scope (e.g., pick specific summary period(s), check the most recent N summaries, or check a specific time range). Set `multiple: true` on `companion_ask` whenever the user may select multiple summaries or options.
2. **Read the target first**: Call `summary_read(mode: "read", type, start_date)` to read the current Markdown body of each target summary. Never rewrite a summary you have not read.
3. **Establish the roles before editing**:
   - The diary author ("I" / "我") is the **user**.
   - The AI companion is the **current companion** (for example Latte), not the application and not a system default name.
   - Never swap the user's and the companion's identities, feelings, or actions.
   - Never treat the application name or a system default name as a person's name. If a summary does so, correct it.
4. **Verify facts with real sources**: Use `diary_list` + `diary_read` for the same period. Use `diary_search` (FTS) to find names, events, and quotations, and `vector_search` (RAG) for semantic evidence. Use `recall_relations` when available to check existing relationship records. If RAG is unavailable, complete at least the FTS + diary-text verification.
5. **Build a person map before writing**: List every person in the summary and confirm who they are. Check the user, the companion, and other people separately. Do not guess a name when the sources are unclear—ask the user.
6. **Propose before overwriting**: Use `companion_ask` to show the discovered error(s) (original → corrected) and the repair scope. When multiple summaries or independent fixes are proposed, set `multiple: true` so the user can select which ones to apply. Get confirmation before writing.
7. **Overwrite the same period**: Call `summary_write` with the **same** `type` and `start_date` as the original summary. Pass the full corrected Markdown body. Never create a duplicate period.
8. **Fix only what is wrong**: Keep accurate sections and the original structure/headings. Do not rewrite the whole summary just to change style, and do not edit diaries as part of summary repair.
9. **Report briefly**: After saving, confirm what names/roles/facts were corrected in a few sentences. Do not paste the full summary into chat.

## Tool Usage

| Scenario                                   | Tool (Built-in / MCP)                                                                                            |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| List existing summaries (recent / range)   | `summary_read` / `baishou_summary_read` with `mode: "list"` (optional `type`, `start_date`, `end_date`, `limit`) |
| Ask user for scope or confirm corrections  | `companion_ask` (set `multiple: true` when the user can pick multiple summaries or fixes)                        |
| Read a specific target summary             | `summary_read` / `baishou_summary_read` with `mode: "read"`, `type`, `start_date`                                |
| Confirm current date / period              | `current_time` / `baishou_current_time`                                                                          |
| List diary dates in the period             | `diary_list` / `baishou_diary_list` (pass `start_date`, `end_date`)                                              |
| Read full diary entries                    | `diary_read` / `baishou_diary_read` (pass `dates` array)                                                         |
| FTS keyword search for people/events       | `diary_search` / `baishou_diary_search`                                                                          |
| RAG semantic search for relationship facts | `vector_search` / `baishou_vector_search`                                                                        |
| Check existing relationship records        | `recall_relations` / `baishou_recall_relations`                                                                  |
| Overwrite the same period summary          | `summary_write` / `baishou_summary_write` (same `type` + `start_date`, full corrected `content`)                 |

## Workflow

```
Task Progress:
- [ ] 1. Confirm repair scope (if unspecified: call summary_read(mode: "list") and ask via companion_ask with multiple: true)
- [ ] 2. Read the target summary(ies) with summary_read(mode: "read", type, start_date)
- [ ] 3. List and read the diaries (and lower-level summaries if applicable) for the same period(s)
- [ ] 4. Search names/events with diary_search (FTS), verify relationships with vector_search (RAG) and recall_relations
- [ ] 5. Build a person map and identify role/name/fact errors
- [ ] 6. Show the original → corrected changes via companion_ask (use multiple: true for multiple items) and get confirmation
- [ ] 7. Overwrite the confirmed period(s) with summary_write using the full corrected Markdown
- [ ] 8. Briefly report what was corrected
```

### Step 1: Confirm Repair Scope & Read Target Summary(ies)

1. **If the user has NOT specified which summary to check** (e.g., only sent `/summary-repair`):
   - First call `summary_read(mode: "list", limit: 10)` to get recent existing summaries.
   - Then call `companion_ask` with `multiple: true` and `allow_custom_input: true`:
     - Put each recent summary period as its own option (e.g., `"2026年第39周（9月21日—9月27日）"`, `"2026年第34周（8月17日—8月23日）"`), plus quick scope options like `"排查最近 3 篇总结"` / `"排查最近 5 篇总结"`.
     - Do **not** add "Only..." / "只修..." or "All" / "全部" options; the user can directly check multiple options or type a custom date range in custom input.
2. **If the user chose "recent N" or a date range**:
   - Call `summary_read(mode: "list", type, start_date, end_date, limit)` to get the matching summary periods.
3. **Read each target summary**:
   - Call `summary_read(mode: "read", type, start_date)` for each target period (`type`: `"weekly"` | `"monthly"` | `"quarterly"` | `"yearly"`, `start_date`: `YYYY-MM-DD`).
   - If an exact period is not found, ask the user to confirm the date, or use the available-summary list returned by the tool.

### Step 2: Read the Source Material

- Use `diary_list` and `diary_read` for every diary in the same period.
- For monthly/quarterly/yearly summaries, also read the lower-level summaries that the original summary was based on.
- If the user points to a specific person or event, search with `diary_search` and `vector_search`.

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

Call `companion_ask` in the user's language:

- Quote the erroneous line or summarize it.
- Show the corrected version.
- State which period and sections will change.
- If there are multiple summaries or independent corrections, set `multiple: true` on the options so the user can check which ones to apply.
- Ask for confirmation before writing.

### Step 5: Overwrite the Same Period

Call `summary_write`:

- `type`: same as the original
- `start_date`: same as the original
- `end_date`: same as the original
- `content`: the complete corrected Markdown body, preserving the original template structure and headings

Do not create a new period or a duplicate summary.

### Step 6: Report

Confirm in a few sentences:

- Which summary period(s) were repaired.
- Which names/roles/facts were corrected.
- Whether any uncertainty remains (for example, an ambiguous person the user should confirm).

Do not paste the full summary into chat.
