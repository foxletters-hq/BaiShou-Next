import { formatDiaryPreviewText } from '@baishou/shared'
import type { ToolContext } from './agent.tool'

function previewFromRaw(raw: string | null | undefined): string {
  const cleaned = formatDiaryPreviewText(raw)
  const firstLine = cleaned
    .split('\n')
    .map((l) => l.trim())
    .find((l) => l.length > 0 && !l.startsWith('#') && !l.startsWith('---'))
  if (!firstLine) return '(empty)'
  return firstLine.length > 80 ? `${firstLine.slice(0, 80)}...` : firstLine
}

export async function runDiaryListViaDb(
  args: { start_date: string; end_date: string },
  context: ToolContext
): Promise<string> {
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/
  if (!dateRegex.test(args.start_date) || !dateRegex.test(args.end_date)) {
    return 'Error: Invalid date format. Expected YYYY-MM-DD.'
  }

  if (!context.diarySearcher?.listInDateRange) {
    return 'Error: Diary listing is not available. Please ensure diary index is synced.'
  }

  const rows = await context.diarySearcher.listInDateRange(args.start_date, args.end_date)
  if (rows.length === 0) {
    return `No diary entries found between ${args.start_date} and ${args.end_date}.`
  }

  const sorted = [...rows].sort((a, b) => b.date.localeCompare(a.date))
  const lines = [
    `Found ${sorted.length} diary entries between ${args.start_date} and ${args.end_date}:\n`
  ]
  for (const r of sorted) {
    lines.push(`- **${r.date}**: ${r.preview}`)
  }

  return lines.join('\n')
}

export { previewFromRaw }
