import type { AgentGatePermissionRule } from '@baishou/shared'
import { agentGatePermissionRuleMatches, type AgentGateResourceRef } from '@baishou/shared'

/** 本轮回答内的「本次允许」：进程内有效，随 cancelSession 清掉 */
export class AgentGateTurnAllowStore {
  private readonly rules = new Map<string, AgentGatePermissionRule[]>()

  add(sessionId: string, rule: AgentGatePermissionRule): void {
    const list = this.rules.get(sessionId) ?? []
    if (list.some((item) => item.action === rule.action && item.pattern === rule.pattern)) {
      return
    }
    list.push(rule)
    this.rules.set(sessionId, list)
  }

  list(sessionId: string): AgentGatePermissionRule[] {
    return this.rules.get(sessionId) ?? []
  }

  matches(
    sessionId: string,
    action: string,
    resources: readonly AgentGateResourceRef[] = []
  ): boolean {
    return this.list(sessionId).some((rule) =>
      agentGatePermissionRuleMatches(rule, action, resources)
    )
  }

  clearSession(sessionId: string): void {
    this.rules.delete(sessionId)
  }
}
