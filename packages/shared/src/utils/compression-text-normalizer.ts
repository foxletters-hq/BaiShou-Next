/**
 * 将模型写入 text 流的 think / summary 标记整理为独立的思考与摘要正文。
 */

const OPEN_THINK = '<' + 'think>'
const CLOSE_THINK = '<' + '/think>'
const OPEN_REDacted = '<' + 'redacted_thinking>'
const CLOSE_REDacted = '<' + '/redacted_thinking>'
const OPEN_SUMMARY = '<' + 'summary>'
const CLOSE_SUMMARY = '<' + '/summary>'

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** 模型误把助手回复与摘要标题混进 text 流时的常见分隔标记 */
const SUMMARY_SECTION_MARKERS = [
  /更新后的滚动摘要[：:\s（(]/,
  /更新後的滾動摘要[：:\s（(]/,
  /滚动摘要[：:\s（(]/,
  /滾動摘要[：:\s（(]/,
  /^#{1,3}\s*滚动摘要/m,
  /^#{1,3}\s*Rolling\s+[Ss]ummary/m,
  /^Rolling\s+[Ss]ummary[：:\s]/m
]

function stripAssistantReplyBeforeSummaryMarker(text: string): string {
  for (const marker of SUMMARY_SECTION_MARKERS) {
    const match = text.match(marker)
    if (!match || match.index == null || match.index === 0) continue
    const afterMarker = text.slice(match.index)
    const headerEnd = afterMarker.indexOf('\n')
    const body = (headerEnd >= 0 ? afterMarker.slice(headerEnd + 1) : '').trim()
    if (body.length >= 20) return body
  }
  return text
}

export function normalizeCompressionOutput(
  summaryText: string,
  reasoningText: string
): { summaryText: string; reasoningText: string } {
  let raw = summaryText.trim()
  let reasoning = reasoningText.trim()
  const extractedThink: string[] = []

  const closedThink = new RegExp(
    `${escapeRegExp(OPEN_THINK)}([\\s\\S]*?)${escapeRegExp(CLOSE_THINK)}`,
    'gi'
  )
  raw = raw.replace(closedThink, (_, inner: string) => {
    if (inner?.trim()) extractedThink.push(inner.trim())
    return ''
  })

  const closedRedacted = new RegExp(
    `${escapeRegExp(OPEN_REDacted)}([\\s\\S]*?)${escapeRegExp(CLOSE_REDacted)}`,
    'gi'
  )
  raw = raw.replace(closedRedacted, (_, inner: string) => {
    if (inner?.trim()) extractedThink.push(inner.trim())
    return ''
  })

  const unclosedThink = new RegExp(
    `${escapeRegExp(OPEN_THINK)}([\\s\\S]*?)(?=${escapeRegExp(OPEN_SUMMARY)}|$)`,
    'i'
  )
  raw = raw.replace(unclosedThink, (_, inner: string) => {
    if (inner?.trim()) extractedThink.push(inner.trim())
    return ''
  })

  const summaryWrapped = new RegExp(
    `${escapeRegExp(OPEN_SUMMARY)}\\s*([\\s\\S]*?)\\s*${escapeRegExp(CLOSE_SUMMARY)}`,
    'i'
  )
  const summaryMatch = raw.match(summaryWrapped)
  let summary = summaryMatch?.[1]?.trim() ?? raw

  summary = summary
    .replace(new RegExp(`<\\/?summary>`, 'gi'), '')
    .replace(new RegExp(`${escapeRegExp(OPEN_THINK)}`, 'gi'), '')
    .replace(new RegExp(`${escapeRegExp(CLOSE_THINK)}`, 'gi'), '')
    .replace(new RegExp(`${escapeRegExp(OPEN_REDacted)}`, 'gi'), '')
    .replace(new RegExp(`${escapeRegExp(CLOSE_REDacted)}`, 'gi'), '')
    .trim()

  summary = stripAssistantReplyBeforeSummaryMarker(summary)

  if (extractedThink.length > 0) {
    reasoning = [reasoning, ...extractedThink].filter(Boolean).join('\n\n').trim()
  }

  return { summaryText: summary, reasoningText: reasoning }
}
