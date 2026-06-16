/** MCP initialize 说明：告知外部客户端当前工作空间 */
export function buildMcpInstructions(vaultName: string): string {
  return (
    'BaiShou is an AI companion diary app. Use the tools below to read/edit diaries, search memories, and manage stored knowledge. ' +
    `Current workspace: ${vaultName}. Diary tools read and write within this workspace only.`
  )
}

/** 根据工具返回文本推断 MCP isError（工具层仍返回 string，此处做启发式判断） */
export function isMcpToolErrorResult(result: string): boolean {
  const text = result.trim()
  if (!text) return false
  if (text.startsWith('Error:')) return true
  if (text.startsWith('工具执行失败')) return true
  if (/^(请提供|Please provide)/.test(text)) return true
  if (/未配置.*无法|无法.*未配置/.test(text)) return true
  return false
}

export function formatMcpToolCallResult(result: string): {
  content: Array<{ type: 'text'; text: string }>
  isError: boolean
} {
  const text = typeof result === 'string' ? result : JSON.stringify(result)
  return {
    content: [{ type: 'text', text }],
    isError: isMcpToolErrorResult(text)
  }
}
