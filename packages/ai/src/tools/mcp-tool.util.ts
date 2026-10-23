/** MCP 外部工具调用使用的 sessionId，与应用内 Agent 会话区分 */
export const MCP_EXTERNAL_SESSION_ID = 'mcp-external'

/** MCP initialize 说明：告知外部客户端当前工作空间 */
export function buildMcpInstructions(vaultName: string): string {
  return (
    'This is an AI companion diary app. Use the tools below to read/edit diaries, write period summaries, search memories, and manage stored knowledge. ' +
    `Current workspace: ${vaultName}. Diary and summary tools read and write within this workspace only. ` +
    'Built-in workflow skills (such as "diary-append" for appending conversation events to the diary, "summary-write" for detecting and generating missing weekly/monthly/quarterly/yearly summaries, and "summary-repair" for verifying and repairing existing summaries) and user custom skills are available two ways: call `baishou_skill_read` without `name` to list all skills (or pass `name` to read the full SKILL.md), or use MCP prompts (`prompts/list` / `prompts/get`) where every skill is exposed as a prompt with the same name.'
  )
}

export function unwrapBaishouMcpToolName(name: string): string {
  return name.startsWith('baishou_') ? name.slice('baishou_'.length) : name
}

/** 根据工具返回文本推断 MCP isError（工具层仍返回 string，此处做启发式判断） */
export function isMcpToolErrorResult(result: string): boolean {
  const text = result.trim()
  if (!text) return false
  if (text.startsWith('Error:')) return true
  if (text.startsWith('工具执行失败')) return true
  if (text.includes('已被禁用')) return true
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
