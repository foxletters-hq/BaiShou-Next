import type { ToolContext } from './agent.tool'

export function resolveDiarySearchResultLimit(
  argsLimit: number | undefined,
  userConfig?: Record<string, unknown>
): number {
  const custom = userConfig?.customConfigs
  const raw =
    custom && typeof custom === 'object'
      ? (custom as Record<string, { max_results?: unknown }>).diary_search?.max_results
      : undefined
  const configured =
    typeof raw === 'number' && Number.isFinite(raw)
      ? Math.min(50, Math.max(1, Math.floor(raw)))
      : undefined
  const requested =
    typeof argsLimit === 'number' && Number.isFinite(argsLimit)
      ? Math.max(1, Math.floor(argsLimit))
      : (configured ?? 10)
  return configured != null ? Math.min(requested, configured) : Math.min(requested, 50)
}

export async function runDiarySearchViaFts(
  args: { query: string; start_date?: string; end_date?: string; limit?: number },
  context: ToolContext
): Promise<string> {
  const keywords = args.query
    .trim()
    .split(/\s+/)
    .filter((k) => k.length > 0)
  if (keywords.length === 0) {
    return 'Error: Query contains no valid keywords.'
  }
  if (!context.diarySearcher) {
    return 'Error: Diary search is not available. Please ensure diary index is synced.'
  }

  const limit = resolveDiarySearchResultLimit(args.limit, context.userConfig)
  const results: Array<{ date: string; snippet: string }> = []

  for (const keyword of keywords) {
    const ftsResults = await context.diarySearcher.searchFTS(keyword, limit * 2)

    for (const r of ftsResults) {
      if (args.start_date && r.date < args.start_date) continue
      if (args.end_date && r.date > args.end_date) continue
      if (results.some((existing) => existing.date === r.date)) continue

      results.push({
        date: r.date,
        snippet: r.contentSnippet || '(no preview)'
      })

      if (results.length >= limit) break
    }
    if (results.length >= limit) break
  }

  if (results.length === 0) {
    return `No diary entries found matching "${args.query}".`
  }

  results.sort((a, b) => b.date.localeCompare(a.date))

  const lines = [`Found ${results.length} diary entries matching "${args.query}" (FTS):\n`]
  for (const r of results) {
    lines.push(`## ${r.date}`)
    lines.push(r.snippet)
    lines.push('')
  }

  return lines.join('\n')
}
