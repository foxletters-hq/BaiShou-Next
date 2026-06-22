const DIARY_ATTACHMENT_REF_RE = /!\[[^\]]*\]\((attachment\/[^ |)]+)/g

/** 从日记 Markdown 正文提取 attachment/ 引用（去重） */
export function extractDiaryAttachmentRefs(content: string): string[] {
  if (!content) return []
  const found = new Set<string>()
  const re = new RegExp(DIARY_ATTACHMENT_REF_RE.source, 'g')
  let match: RegExpExecArray | null
  while ((match = re.exec(content)) !== null) {
    const src = match[1]?.trim()
    if (src?.startsWith('attachment/')) found.add(src)
  }
  return [...found]
}
