import { isWorkspaceEditGateAction, type AgentGateRequest } from '@baishou/shared'

type GateCopyTranslate = (key: string, fallback: string, options?: { count: number }) => string

/** 合并进同一张确认卡的同类写入，用文件数说清楚，不要只展示第一份预览 */
export function formatCoalescedToolHint(
  request: Pick<AgentGateRequest, 'action' | 'coalescedCount'>,
  t: GateCopyTranslate
): string | null {
  const count = request.coalescedCount ?? 1
  if (count <= 1) return null
  if (isWorkspaceEditGateAction(request.action)) {
    return t('agent_gate.coalesced_writes', '将一并写入 {{count}} 个文件', { count })
  }
  if (request.action === 'workspace_delete') {
    return t('agent_gate.coalesced_deletes', '将一并删除 {{count}} 个文件', { count })
  }
  return t('agent_gate.coalesced_ops', '将一并执行 {{count}} 次同类操作', { count })
}