/** 从 AI 正文中剥离 <think>，与 web/native ChatBubble 共用 */
export function parseRedactedThinking(content: string, reasoning = '') {
  let cleanContent = content || ''
  let cleanReasoning = reasoning || ''

  const thinkRegex = /<think>([\s\S]*?)<\/think>/gi
  let match
  while ((match = thinkRegex.exec(content || '')) !== null) {
    if (match[1]) {
      cleanReasoning += (cleanReasoning ? '\n' : '') + match[1].trim()
    }
  }
  cleanContent = cleanContent.replace(thinkRegex, '')

  if (cleanContent.includes('<think>')) {
    const parts = cleanContent.split('<think>')
    cleanContent = parts[0] || ''
    const unclosed = parts.slice(1).join('<think>')
    if (unclosed) {
      cleanReasoning += (cleanReasoning ? '\n' : '') + unclosed.trim()
    }
  }

  return {
    cleanContent: cleanContent.trim(),
    cleanReasoning: cleanReasoning.trim()
  }
}
