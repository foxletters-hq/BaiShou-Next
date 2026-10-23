export type PersistedToolStatus = 'running' | 'completed' | 'failed'

/** 等待用户作答的提问不能落成失败，否则确认卡还在、工具行却显示执行失败。 */
export function resolvePersistedToolStatus(input: {
  toolName: string
  status: PersistedToolStatus
  hasResult: boolean
}): PersistedToolStatus {
  if (input.hasResult) {
    return input.status === 'failed' ? 'failed' : 'completed'
  }
  if (input.toolName === 'companion_ask' && input.status !== 'failed') {
    return 'running'
  }
  if (input.status === 'running') return 'failed'
  return input.status
}
