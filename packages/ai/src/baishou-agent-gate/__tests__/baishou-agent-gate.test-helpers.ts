import { AgentGateKind } from '@baishou/shared'

/** Gate 测试共用的基础请求，避免各拆分文件重复维护同一份 fixture。 */
export const baseAssertInput = {
  sessionId: 'sess_1',
  vaultName: 'Personal',
  kind: AgentGateKind.Tool,
  action: 'diary_edit',
  title: '编辑日记'
}
