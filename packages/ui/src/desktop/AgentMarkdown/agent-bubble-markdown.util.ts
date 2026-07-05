const THINK_OPEN = '<think>'
const THINK_CLOSE = '</think>'

/** 将 reasoning 通道内容包装为 XMarkdown 可识别的 think 标签 */
export function composeThinkMarkdown(reasoning: string, isReasoning = false): string {
  const body = reasoning.trim()
  if (isReasoning) {
    return body ? `${THINK_OPEN}\n${body}` : THINK_OPEN
  }
  if (!body) return ''
  return `${THINK_OPEN}\n${body}\n${THINK_CLOSE}`
}
