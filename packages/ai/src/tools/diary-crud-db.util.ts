import type { ToolContext } from './agent.tool'

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

export function mergeDiaryTags(existing: string | null | undefined, incoming: string): string {
  const existingArr = (existing || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  const incomingArr = incoming
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  return Array.from(new Set([...existingArr, ...incomingArr])).join(', ')
}

/** 为无 DiaryService 的宿主（纯文件写入）构建标准 frontmatter 包裹的正文 */
export function buildJournalMarkdownForTool(date: string, content: string, tags?: string): string {
  const trimmed = content.replace(/^\uFEFF/, '').trimStart()
  if (trimmed.startsWith('---')) {
    return content
  }

  const lines = ['---', `date: ${date}`]
  const tagArr = (tags || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  if (tagArr.length > 0) {
    lines.push(`tags: [${tagArr.join(', ')}]`)
  }
  lines.push('---', '', content)
  return lines.join('\n')
}

export async function runDiaryReadViaDb(
  args: { dates: string[] },
  context: ToolContext
): Promise<string> {
  if (!context.diarySearcher?.readByDates) {
    return 'Error: Diary reading is not available. Please ensure diary index is synced.'
  }

  const results: string[] = []
  const rows = await context.diarySearcher.readByDates(args.dates.slice(0, 20))

  for (const row of rows) {
    if (!DATE_RE.test(row.date)) {
      results.push(`## ${row.date}\nError: Invalid date format. Expected YYYY-MM-DD.\n`)
      continue
    }
    if (!row.content) {
      results.push(`## ${row.date}\nNo diary entry found.\n`)
      continue
    }
    results.push(`## ${row.date}\n\n${row.content}\n`)
  }

  return results.join('\n---\n\n')
}

export async function runDiaryWriteViaDb(
  args: { date: string; content: string; tags?: string },
  context: ToolContext
): Promise<string> {
  if (!context.diarySearcher?.writeEntry) {
    return 'Error: Diary writing is not available. Please ensure diary storage is ready.'
  }
  if (!DATE_RE.test(args.date)) {
    return `Error: Invalid date format "${args.date}". Expected YYYY-MM-DD.`
  }

  const result = await context.diarySearcher.writeEntry(args.date, args.content, args.tags)
  const tagNote = args.tags?.trim() ? ` Tags: ${args.tags.trim()}.` : ''
  if (result.ok === false) return result.message
  return `Successfully created diary entry for ${args.date}.${tagNote}`
}

export async function runDiaryEditViaDb(
  args: {
    date: string
    content: string
    mode?: 'append' | 'overwrite'
    tags?: string
  },
  context: ToolContext
): Promise<string> {
  if (!context.diarySearcher?.editEntry) {
    return 'Error: Diary editing is not available. Please ensure diary storage is ready.'
  }
  if (!DATE_RE.test(args.date)) {
    return `Error: Invalid date format "${args.date}". Expected YYYY-MM-DD.`
  }

  const result = await context.diarySearcher.editEntry({
    date: args.date,
    content: args.content,
    mode: args.mode ?? 'append',
    tags: args.tags
  })

  if (result.ok === false) return result.message
  return `Successfully modified the diary entry for ${args.date} (${args.mode || 'append'} mode).`
}

export async function runDiaryDeleteViaDb(
  args: { date: string },
  context: ToolContext
): Promise<string> {
  if (!context.diarySearcher?.deleteEntry) {
    return 'Error: Diary deletion is not available. Please ensure diary storage is ready.'
  }
  if (!DATE_RE.test(args.date)) {
    return `Error: Invalid date format "${args.date}". Expected YYYY-MM-DD.`
  }

  const result = await context.diarySearcher.deleteEntry(args.date)
  if (result.ok === false) return result.message
  return `Successfully deleted the diary entry for ${args.date}.`
}
