/**
 * 向压缩模型传递上一轮摘要的纯数据块（不含隐藏指令；规则均在 compressSystemPrompt）。
 */
export function buildCompressionPreviousSummaryBlock(previousSummary?: string): string | null {
  if (!previousSummary?.trim()) return null
  return `<previous-summary>\n${previousSummary.trim()}\n</previous-summary>`
}
