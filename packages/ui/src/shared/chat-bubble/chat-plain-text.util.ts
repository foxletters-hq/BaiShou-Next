/** 聊天气泡是否需完整 Markdown（代码块、图片、列表等）；否则用 RN Text 避免高度少报 */
export function chatNeedsRichMarkdown(content: string): boolean {
  return /```|!\[[^\]]*\]\(|^\s{0,3}[-*+]\s|^\s{0,3}\d+\.\s|^\s{0,3}>\s/m.test(content)
}
