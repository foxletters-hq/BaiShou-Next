/** 固定 Markdown 摘要结构 */
export const COMPRESSION_SUMMARY_TEMPLATE = `请严格按下列 Markdown 结构输出（保留全部标题，无内容时写 (none)），不要输出 <template> 标签本身：

## Goal
- [单句任务目标]

## Constraints & Preferences
- [用户约束、偏好或 (none)]

## Progress
### Done
- [已完成事项或 (none)]

### In Progress
- [进行中或 (none)]

### Blocked
- [阻塞项或 (none)]

## Key Decisions
- [关键决策及原因或 (none)]

## Next Steps
- [有序后续行动或 (none)]

## Critical Context
- [重要技术事实、错误、待确认问题或 (none)]

## Relevant Files
- [路径: 为何相关 或 (none)]

规则：条目精炼；保留确切路径、命令、错误信息；不要提及「压缩」或「摘要」过程本身。`

export function buildAnchoredCompressionUserPrompt(input: {
  previousSummary?: string
  useStructuredTemplate?: boolean
}): string {
  const anchor = input.previousSummary?.trim()
    ? [
        '请根据上方对话历史，更新下列 anchored 摘要：保留仍成立的信息，删除过时内容，合并新事实。',
        '<previous-summary>',
        input.previousSummary.trim(),
        '</previous-summary>'
      ].join('\n')
    : '请根据上方对话历史，创建一份新的 anchored 摘要。'

  const parts = [anchor]
  if (input.useStructuredTemplate !== false) {
    parts.push(COMPRESSION_SUMMARY_TEMPLATE)
  }
  return parts.join('\n\n')
}
