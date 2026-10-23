export type DiaryEditMode = 'append' | 'overwrite'

export function isDiaryEditOverwriteMode(mode: string | undefined | null): boolean {
  return mode === 'overwrite'
}

export function resolveDiaryEditMode(mode?: string | null): DiaryEditMode {
  return isDiaryEditOverwriteMode(mode) ? 'overwrite' : 'append'
}

/**
 * 将助手给出的新段落追加到已有正文。
 * 这里只规范两段之间的空行，不添加、识别或改写时间标题。
 */
export function appendDiaryContent(existingContent: string, content: string): string {
  if (!existingContent.trim()) return content
  if (!content.trim()) return existingContent

  const existing = existingContent.trimEnd()
  const incoming = content.replace(/^(?:\r?\n)+/u, '')
  return `${existing}\n\n${incoming}`
}

/** 助手新建日记：正文原样写入，不附带独立标签参数。 */
export function prepareDiarySearcherWrite(content: string): { content: string } {
  return { content }
}

/** 助手编辑日记：追加只规范空行，覆盖则整篇替换；都不改写时间标题或标签。 */
export function prepareDiarySearcherEdit(
  existingContent: string,
  content: string,
  mode?: string | null
): { content: string } {
  const editMode = resolveDiaryEditMode(mode)
  return {
    content: editMode === 'append' ? appendDiaryContent(existingContent, content) : content
  }
}
