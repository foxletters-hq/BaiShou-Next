import type { AgentGateConfigScope, AgentGatePartData } from './agent-gate.types'

/** 门控卡片出现的界面：伙伴页与工作台互不串卡 */
export type AgentGateSurface = 'companion' | 'workspace'

export function isAgentGateScopeOnSurface(
  surface: AgentGateSurface,
  scope: AgentGateConfigScope | undefined
): boolean {
  if (!scope) return true
  return scope.kind === surface
}

export function collectAgentGatePartDataForSurface(
  parts: Array<{ type?: string; data?: unknown }> | undefined,
  surface: AgentGateSurface
): AgentGatePartData[] {
  if (!parts?.length) return []
  const result: AgentGatePartData[] = []
  for (const part of parts) {
    if (part.type !== 'agent_gate') continue
    const data = part.data as AgentGatePartData | undefined
    if (!data?.request) continue
    if (!isAgentGateScopeOnSurface(surface, data.request.scope)) continue
    result.push(data)
  }
  return result
}

/** 落盘后仍未答复的门控，用来把确认卡灌回收件箱 */
export function collectUnresolvedAgentGateRequestsForSurface(
  parts: Array<{ type?: string; data?: unknown }> | undefined,
  surface: AgentGateSurface
): AgentGatePartData['request'][] {
  return collectAgentGatePartDataForSurface(parts, surface)
    .filter((data) => data.resolution == null)
    .map((data) => data.request)
}

/** 伙伴提问已有工具行，消息流里不再单独挂「已确认」卡 */
export function shouldRenderAgentGateHistoryCard(data: AgentGatePartData): boolean {
  return data.request.action !== 'companion_ask'
}
