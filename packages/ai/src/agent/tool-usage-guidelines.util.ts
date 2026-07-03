/**
 * 根据当前可用工具，构建伙伴必须遵守的工具使用规范（注入 system prompt）。
 */
export function buildToolUsageGuidelines(availableToolIds: readonly string[]): string | null {
  const ids = new Set(availableToolIds)
  const lines: string[] = []

  const hasDiarySearch = ids.has('diary_search')
  const hasVectorSearch = ids.has('vector_search')
  const hasDiaryRead = ids.has('diary_read')
  const hasDiaryEdit = ids.has('diary_edit')
  const hasDiaryList = ids.has('diary_list')

  const canSearchPersonalRecords = hasDiarySearch || hasVectorSearch

  if (canSearchPersonalRecords) {
    lines.push('## 查事实，禁止装懂')
    lines.push(
      '- 涉及具体人名、地点、事件、日期或用户过往经历时，若当前对话上下文（含压缩摘要）中没有明确依据，**不得猜测、推断或编造**。'
    )

    const lookupSteps: string[] = []
    if (hasDiarySearch) {
      lookupSteps.push('diary_search（关键词搜索日记）')
    }
    if (hasVectorSearch) {
      lookupSteps.push('vector_search（语义搜索对话与记忆）')
    }
    lines.push(`- **必须**先调用 ${lookupSteps.join(' 和/或 ')} 查阅，再回答。`)

    if (hasDiaryRead) {
      lines.push('- 若搜索已定位到具体日记日期，须用 diary_read 读取完整正文后再引用或编辑。')
    } else if (hasDiaryList) {
      lines.push('- 不知道日期时，可先用 diary_list 缩小范围。')
    }

    lines.push('- 查不到时如实说明「没有找到相关记录」，并请用户补充或确认；引用时注明来源日期。')
  } else if (hasDiaryRead || hasDiaryList || hasDiaryEdit) {
    lines.push('## 个人记录查阅说明')
    lines.push(
      '- 当前未启用日记关键词搜索与语义搜索，**无法**按人名或事件检索；若上下文无明确依据，**不得编造**具体人名、事件或日记内容。'
    )
    lines.push(
      '- 若用户提供了确切日期，可用 diary_read 读取；否则请说明无法检索，并请用户补充日期或开启搜索工具。'
    )
  }

  if (hasDiaryEdit && hasDiaryRead) {
    if (lines.length > 0) lines.push('')
    lines.push('## 编辑日记前先读取（强制）')
    lines.push(
      '- 调用 diary_edit 修改某篇日记之前，**必须**在同一轮任务中先对该日期调用 diary_read，确认现有内容与结构后再编辑。'
    )
    lines.push('- 未先读取就执行的 diary_edit 会被系统拒绝。')
  }

  return lines.length > 0 ? lines.join('\n') : null
}
