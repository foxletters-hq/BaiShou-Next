/** 工具调用结果解析 — web / native 共用 */

export interface ToolInvocationLike {
  toolCallId?: string
  toolName?: string
  result?: unknown
}

export function getToolDisplayName(
  invocation: ToolInvocationLike,
  t: (key: string, fallback?: string) => string
): string {
  const rawName = invocation.toolName
  if (rawName) return t(`agent.tools.${rawName}`, rawName)
  const callId = invocation.toolCallId
  if (!callId) return t('agent.tools.tool_invocation', 'tool_invocation')
  return callId
}

export function getToolResultRawContent(invocation: ToolInvocationLike): string {
  if (typeof invocation.result === 'string') return invocation.result
  const resultObj =
    typeof invocation.result === 'object' && invocation.result !== null
      ? invocation.result
      : { content: '' }
  return JSON.stringify(resultObj)
}

export function isToolResultError(invocation: ToolInvocationLike): boolean {
  const rawContent = getToolResultRawContent(invocation)
  if (rawContent.startsWith('Error') || rawContent.startsWith('Tool execution failed:')) {
    return true
  }
  if (
    typeof invocation.result === 'object' &&
    invocation.result !== null &&
    'error' in (invocation.result as Record<string, unknown>)
  ) {
    return true
  }
  return rawContent.toLowerCase().includes('failed')
}

export function parseToolResultJson(invocation: ToolInvocationLike): unknown | null {
  if (typeof invocation.result === 'object' && invocation.result !== null) {
    return invocation.result
  }
  const rawContent = getToolResultRawContent(invocation)
  try {
    return JSON.parse(rawContent)
  } catch {
    return null
  }
}
