/** 聊天气泡是否需完整 Markdown（代码块、图片、标题、列表、链接等）；否则可用 RN Text */
export function chatNeedsRichMarkdown(content: string): boolean {
  return /```|!\[[^\]]*\]\(|^\s{0,3}#{1,6}\s|^\s{0,3}[-*+]\s|^\s{0,3}\d+\.\s|^\s{0,3}>\s|\[[^\]]+\]\([^)]+\)|^\s*\|.+\||^\s{0,3}(-{3,}|\*{3,}|_{3,})\s*$|~~[^~\n]+~~/m.test(
    content
  )
}
